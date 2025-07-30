/**
 * OCI REST API Client
 * Provides REST API access to OCI Monitoring, Stack Monitoring, DB Management, and OPS Insights
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { createHash, createSign } from 'crypto';
import { readFileSync } from 'fs';
import moment from 'moment-timezone';
import { execSync } from 'child_process';
import { 
  MetricQuery, 
  MetricResult, 
  MetricDataPoint, 
  OCINamespace, 
  OCIMetricDefinition 
} from '../types/index.js';

interface OCIConfig {
  user: string;
  tenancy: string;
  region: string;
  fingerprint: string;
  keyFile: string;
  profile?: string;
}

interface OCIAuthHeaders {
  authorization: string;
  date: string;
  'x-content-sha256': string;
  host: string;
}

export class OCIRestClient {
  private config: OCIConfig;
  private httpClient: AxiosInstance;
  private region: string;

  constructor() {
    this.region = this.detectRegion();
    this.config = this.loadOCIConfig();
    this.httpClient = this.createHttpClient();
  }

  /**
   * Detect region from OCI CLI config
   */
  private detectRegion(): string {
    try {
      const configContent = execSync('cat ~/.oci/config 2>/dev/null | grep "^region" | head -1', { encoding: 'utf8' });
      const regionMatch = configContent.match(/region\s*=\s*(.+)/);
      return regionMatch?.[1]?.trim() || 'eu-frankfurt-1';
    } catch {
      return 'eu-frankfurt-1';
    }
  }

  /**
   * Load OCI configuration from ~/.oci/config
   */
  private loadOCIConfig(): OCIConfig {
    try {
      const configPath = process.env.OCI_CONFIG_FILE || `${process.env.HOME}/.oci/config`;
      const configContent = readFileSync(configPath, 'utf8');
      
      const profile = process.env.OCI_CONFIG_PROFILE || 'DEFAULT';
      const profileSection = this.parseConfigSection(configContent, profile);
      
      if (!profileSection.user || !profileSection.tenancy || !profileSection.fingerprint || !profileSection.key_file) {
        throw new Error('Incomplete OCI configuration');
      }

      return {
        user: profileSection.user,
        tenancy: profileSection.tenancy,
        region: profileSection.region || this.region,
        fingerprint: profileSection.fingerprint,
        keyFile: profileSection.key_file.startsWith('~/') 
          ? profileSection.key_file.replace('~', process.env.HOME || '') 
          : profileSection.key_file,
        profile
      };
    } catch (error) {
      throw new Error(`Failed to load OCI configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse OCI config file section
   */
  private parseConfigSection(content: string, profile: string): Record<string, string> {
    const lines = content.split('\\n');
    const section: Record<string, string> = {};
    let inSection = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine === `[${profile}]`) {
        inSection = true;
        continue;
      }
      
      if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
        inSection = false;
        continue;
      }
      
      if (inSection && trimmedLine.includes('=')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        section[key.trim()] = valueParts.join('=').trim();
      }
    }
    
    return section;
  }

  /**
   * Create HTTP client with OCI authentication
   */
  private createHttpClient(): AxiosInstance {
    const client = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MCP-OCI-Metrics-Server/1.0.0'
      }
    });

    // Add request interceptor for OCI authentication
    client.interceptors.request.use((config) => {
      if (config.url) {
        const authHeaders = this.generateAuthHeaders(config);
        Object.assign(config.headers, authHeaders);
      }
      return config;
    });

    return client;
  }

  /**
   * Generate OCI authentication headers
   */
  private generateAuthHeaders(config: AxiosRequestConfig): OCIAuthHeaders {
    const date = new Date().toUTCString();
    const host = new URL(config.url!).host;
    const method = (config.method || 'GET').toUpperCase();
    const uri = new URL(config.url!).pathname + new URL(config.url!).search;
    
    // Calculate content SHA256
    const body = config.data ? JSON.stringify(config.data) : '';
    const contentSha256 = createHash('sha256').update(body).digest('base64');
    
    // Create signing string
    const signingString = [
      `(request-target): ${method.toLowerCase()} ${uri}`,
      `date: ${date}`,
      `host: ${host}`,
      `x-content-sha256: ${contentSha256}`
    ].join('\\n');

    // Sign the string
    const privateKey = readFileSync(this.config.keyFile, 'utf8');
    const signature = createSign('RSA-SHA256').update(signingString).sign(privateKey, 'base64');
    
    // Create authorization header
    const keyId = `${this.config.tenancy}/${this.config.user}/${this.config.fingerprint}`;
    const authorization = `Signature version="1",keyId="${keyId}",algorithm="rsa-sha256",headers="(request-target) date host x-content-sha256",signature="${signature}"`;

    return {
      authorization,
      date,
      'x-content-sha256': contentSha256,
      host
    };
  }

  /**
   * Get OCI Monitoring service endpoint
   */
  private getMonitoringEndpoint(): string {
    return `https://telemetry.${this.region}.oraclecloud.com`;
  }

  /**
   * Get Stack Monitoring service endpoint
   */
  private getStackMonitoringEndpoint(): string {
    return `https://stack-monitoring.${this.region}.oci.oraclecloud.com`;
  }

  /**
   * Get DB Management service endpoint
   */
  private getDbManagementEndpoint(): string {
    return `https://dbmgmt.${this.region}.oci.oraclecloud.com`;
  }

  /**
   * Get OPS Insights service endpoint
   */
  private getOpsInsightsEndpoint(): string {
    return `https://operationsinsights.${this.region}.oci.oraclecloud.com`;
  }

  /**
   * Query metrics via REST API (OCI Monitoring)
   */
  async queryMonitoringMetrics(query: MetricQuery): Promise<MetricResult> {
    try {
      const endpoint = this.getMonitoringEndpoint();
      const compartmentId = query.compartmentId || process.env.OCI_COMPARTMENT_ID;
      
      if (!compartmentId) {
        throw new Error('Compartment ID is required');
      }

      // Convert time range to ISO format
      const startTime = moment(query.timeRange.startTime).toISOString();
      const endTime = moment(query.timeRange.endTime).toISOString();
      
      // Build request payload
      const payload = {
        compartmentId,
        namespace: query.namespace,
        query: this.buildMQLQuery(query),
        startTime,
        endTime,
        resolution: query.interval || 'PT1M'
      };

      const response = await this.httpClient.post(
        `${endpoint}/20180401/metrics/actions/summarizeMetricsData`,
        payload
      );

      return this.parseMonitoringResponse(response.data, query);
    } catch (error) {
      console.error('REST API query failed:', error);
      throw error;
    }
  }

  /**
   * Build MQL query string from MetricQuery
   */
  private buildMQLQuery(query: MetricQuery): string {
    const interval = (query.interval || 'PT1M').replace('PT', '').toLowerCase();
    let mqlQuery = `${query.metricName}[${interval}]`;
    
    // Add aggregation
    const aggregation = query.aggregation || 'mean';
    mqlQuery += `.${aggregation}()`;
    
    // Add dimension filters if provided
    if (query.dimensions && Object.keys(query.dimensions).length > 0) {
      const filters = Object.entries(query.dimensions)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' AND ');
      mqlQuery = `${query.metricName}{${filters}}[${interval}].${aggregation}()`;
    }
    
    return mqlQuery;
  }

  /**
   * Parse monitoring API response
   */
  private parseMonitoringResponse(data: any, query: MetricQuery): MetricResult {
    const aggregatedDatapoints: MetricDataPoint[] = [];
    
    if (data && data.length > 0) {
      const metricData = data[0];
      if (metricData && metricData.aggregatedDatapoints) {
        metricData.aggregatedDatapoints.forEach((point: any) => {
          aggregatedDatapoints.push({
            timestamp: moment(point.timestamp).toISOString(),
            value: parseFloat(point.value) || 0,
            dimensions: query.dimensions
          });
        });
      }
    }

    return {
      namespace: query.namespace,
      metricName: query.metricName,
      dimensions: query.dimensions || {},
      aggregatedDatapoints,
      resolution: query.interval
    };
  }

  /**
   * List namespaces via REST API
   */
  async listNamespaces(compartmentId?: string): Promise<OCINamespace[]> {
    try {
      const endpoint = this.getMonitoringEndpoint();
      const targetCompartmentId = compartmentId || process.env.OCI_COMPARTMENT_ID;
      
      if (!targetCompartmentId) {
        throw new Error('Compartment ID is required');
      }

      const response = await this.httpClient.get(
        `${endpoint}/20180401/metrics?compartmentId=${targetCompartmentId}&limit=1000`
      );

      const namespacesMap = new Map<string, OCINamespace>();
      
      if (response.data && Array.isArray(response.data)) {
        response.data.forEach((metric: any) => {
          if (metric.namespace && !namespacesMap.has(metric.namespace)) {
            namespacesMap.set(metric.namespace, {
              name: metric.namespace,
              displayName: metric.namespace.replace(/([A-Z])/g, ' $1').trim(),
              description: `Metrics namespace: ${metric.namespace}`
            });
          }
        });
      }

      return Array.from(namespacesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Failed to list namespaces via REST API:', error);
      throw error;
    }
  }

  /**
   * List metrics for a namespace via REST API
   */
  async listMetrics(namespace: string, compartmentId?: string): Promise<OCIMetricDefinition[]> {
    try {
      const endpoint = this.getMonitoringEndpoint();
      const targetCompartmentId = compartmentId || process.env.OCI_COMPARTMENT_ID;
      
      if (!targetCompartmentId) {
        throw new Error('Compartment ID is required');
      }

      const response = await this.httpClient.get(
        `${endpoint}/20180401/metrics?compartmentId=${targetCompartmentId}&namespace=${namespace}&limit=1000`
      );

      if (response.data && Array.isArray(response.data)) {
        return response.data.map((metric: any) => ({
          name: metric.name || 'Unknown',
          namespace: metric.namespace || namespace,
          displayName: (metric.name || 'Unknown').replace(/([A-Z])/g, ' $1').trim(),
          description: `Metric: ${metric.name} in namespace ${metric.namespace}`,
          dimensionKeys: metric.dimensions ? Object.keys(metric.dimensions) : [],
          unitDisplayName: metric.unit || undefined
        }));
      }

      return [];
    } catch (error) {
      console.error('Failed to list metrics via REST API:', error);
      throw error;
    }
  }

  /**
   * Query Compute Agent metrics specifically
   */
  async queryComputeAgentMetrics(instanceId: string, metricName: string, timeRange: { startTime: string; endTime: string }, interval: string = 'PT1M'): Promise<MetricResult> {
    const query: MetricQuery = {
      compartmentId: process.env.OCI_COMPARTMENT_ID || '',
      namespace: 'oci_computeagent',
      metricName,
      timeRange,
      dimensions: {
        resourceId: instanceId
      },
      interval,
      aggregation: 'mean'
    };

    return this.queryMonitoringMetrics(query);
  }

  /**
   * Query Stack Monitoring metrics
   */
  async queryStackMonitoringMetrics(resourceId: string, metricName: string, timeRange: { startTime: string; endTime: string }): Promise<any> {
    try {
      const endpoint = this.getStackMonitoringEndpoint();
      const compartmentId = process.env.OCI_COMPARTMENT_ID;
      
      if (!compartmentId) {
        throw new Error('Compartment ID is required');
      }

      // Stack Monitoring API call
      const payload = {
        compartmentId,
        resourceId,
        metricName,
        startTime: moment(timeRange.startTime).toISOString(),
        endTime: moment(timeRange.endTime).toISOString()
      };

      const response = await this.httpClient.post(
        `${endpoint}/20210330/metrics/actions/summarizeMetricsData`,
        payload
      );

      return response.data;
    } catch (error) {
      console.error('Stack Monitoring query failed:', error);
      throw error;
    }
  }

  /**
   * Query DB Management metrics
   */
  async queryDbManagementMetrics(databaseId: string, metricName: string, timeRange: { startTime: string; endTime: string }): Promise<any> {
    try {
      const endpoint = this.getDbManagementEndpoint();
      const compartmentId = process.env.OCI_COMPARTMENT_ID;
      
      if (!compartmentId) {
        throw new Error('Compartment ID is required');
      }

      // DB Management API call
      const response = await this.httpClient.get(
        `${endpoint}/20201101/managedDatabases/${databaseId}/metrics`,
        {
          params: {
            startTime: moment(timeRange.startTime).toISOString(),
            endTime: moment(timeRange.endTime).toISOString(),
            metricName
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('DB Management query failed:', error);
      throw error;
    }
  }

  /**
   * Query OPS Insights metrics
   */
  async queryOpsInsightsMetrics(resourceId: string, metricName: string, timeRange: { startTime: string; endTime: string }): Promise<any> {
    try {
      const endpoint = this.getOpsInsightsEndpoint();
      const compartmentId = process.env.OCI_COMPARTMENT_ID;
      
      if (!compartmentId) {
        throw new Error('Compartment ID is required');
      }

      // OPS Insights API call
      const payload = {
        compartmentId,
        resourceId,
        metricName,
        analysisTimeInterval: {
          timeIntervalStart: moment(timeRange.startTime).toISOString(),
          timeIntervalEnd: moment(timeRange.endTime).toISOString()
        }
      };

      const response = await this.httpClient.post(
        `${endpoint}/20200630/databaseInsights/actions/summarizeDatabaseInsightResourceStatistics`,
        payload
      );

      return response.data;
    } catch (error) {
      console.error('OPS Insights query failed:', error);
      throw error;
    }
  }

  /**
   * Test REST API connectivity
   */
  async testConnection(): Promise<{ success: boolean; message: string; services: string[] }> {
    const services: string[] = [];
    
    try {
      // Test Monitoring service
      try {
        const compartmentId = process.env.OCI_COMPARTMENT_ID;
        if (compartmentId) {
          await this.listNamespaces(compartmentId);
          services.push('Monitoring');
        }
      } catch {
        // Monitoring test failed
      }

      // Test Stack Monitoring service
      try {
        const endpoint = this.getStackMonitoringEndpoint();
        await this.httpClient.get(`${endpoint}/20210330/managedInstanceGroups`, { timeout: 5000 });
        services.push('Stack Monitoring');
      } catch {
        // Stack Monitoring test failed
      }

      // Test DB Management service
      try {
        const endpoint = this.getDbManagementEndpoint();
        await this.httpClient.get(`${endpoint}/20201101/managedDatabases`, { timeout: 5000 });
        services.push('DB Management');
      } catch {
        // DB Management test failed
      }

      // Test OPS Insights service
      try {
        const endpoint = this.getOpsInsightsEndpoint();
        await this.httpClient.get(`${endpoint}/20200630/databaseInsights`, { timeout: 5000 });
        services.push('OPS Insights');
      } catch {
        // OPS Insights test failed
      }

      return {
        success: services.length > 0,
        message: services.length > 0 
          ? `Successfully connected to ${services.length} OCI service(s): ${services.join(', ')}`
          : 'Failed to connect to any OCI services via REST API',
        services
      };
    } catch (error) {
      return {
        success: false,
        message: `REST API connection test failed: ${error instanceof Error ? error.message : String(error)}`,
        services: []
      };
    }
  }

  /**
   * Get current region
   */
  getRegion(): string {
    return this.region;
  }

  /**
   * Get current configuration (without sensitive data)
   */
  getConfigInfo(): { region: string; profile: string; tenancy: string; user: string } {
    return {
      region: this.config.region,
      profile: this.config.profile || 'DEFAULT',
      tenancy: this.config.tenancy.substring(0, 20) + '...',
      user: this.config.user.substring(0, 20) + '...'
    };
  }
}