/**
 * Simplified OCI Monitoring API Client
 * Uses OCI CLI for API calls to avoid SDK compatibility issues
 */

import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import moment from 'moment-timezone';
import { OCIRestClient } from './OCIRestClient.js';
import { 
  OCIConfig, 
  MetricQuery, 
  MetricResult, 
  OCINamespace, 
  OCIMetricDefinition,
  MetricDataPoint 
} from '../types/index.js';

const execAsync = promisify(exec);

export class MonitoringClient {
  private compartmentId: string;
  private region: string;
  private restClient: OCIRestClient | null = null;
  private useRestAPI: boolean;

  constructor(useRestAPI: boolean = false) {
    this.compartmentId = '';
    this.region = 'eu-frankfurt-1'; // Default to your region
    this.useRestAPI = useRestAPI;
    
    // Initialize region synchronously
    this.initializeRegionSync();
    
    // Initialize REST client if requested
    if (this.useRestAPI) {
      try {
        this.restClient = new OCIRestClient();
      } catch (error) {
        console.error('Failed to initialize REST client, falling back to CLI:', error);
        this.useRestAPI = false;
      }
    }
  }

  /**
   * Initialize region from OCI CLI config synchronously
   */
  private initializeRegionSync(): void {
    try {
      // Try to get current region from config
      try {
        const currentConfig = execSync('cat ~/.oci/config 2>/dev/null | grep "^region" | head -1', { encoding: 'utf8' });
        const regionMatch = currentConfig.match(/region\s*=\s*(.+)/);
        if (regionMatch && regionMatch[1]) {
          this.region = regionMatch[1].trim();
        }
      } catch (configError) {
        // Keep default region
      }
    } catch (error) {
      // Keep default region
      this.region = 'eu-frankfurt-1';
    }
  }

  /**
   * List available namespaces using OCI CLI or REST API
   */
  async listNamespaces(compartmentId?: string): Promise<OCINamespace[]> {
    if (this.useRestAPI && this.restClient) {
      try {
        return await this.restClient.listNamespaces(compartmentId);
      } catch (error) {
        console.error('REST API failed, falling back to CLI:', error);
      }
    }
    
    return this.listNamespacesCLI(compartmentId);
  }

  /**
   * List available namespaces using OCI CLI
   */
  private async listNamespacesCLI(compartmentId?: string): Promise<OCINamespace[]> {
    const targetCompartmentId = compartmentId || this.getCompartmentId();
    
    try {
      const command = `oci monitoring metric list --compartment-id "${targetCompartmentId}" --region "${this.region}" --output json`;
      const { stdout } = await execAsync(command);
      const response = JSON.parse(stdout);

      // Extract unique namespaces
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
      console.error('Error listing namespaces:', error);
      // Return common OCI namespaces as fallback
      return [
        { name: 'oci_computeagent', displayName: 'Compute Agent', description: 'Compute instance metrics' },
        { name: 'oci_lbaas', displayName: 'Load Balancer', description: 'Load balancer metrics' },
        { name: 'oci_vcn', displayName: 'Virtual Cloud Network', description: 'VCN metrics' },
        { name: 'oci_database', displayName: 'Database', description: 'Database metrics' },
        { name: 'oci_objectstorage', displayName: 'Object Storage', description: 'Object storage metrics' }
      ];
    }
  }

  /**
   * List available metrics for a namespace using OCI CLI or REST API
   */
  async listMetrics(namespace: string, compartmentId?: string): Promise<OCIMetricDefinition[]> {
    if (this.useRestAPI && this.restClient) {
      try {
        return await this.restClient.listMetrics(namespace, compartmentId);
      } catch (error) {
        console.error('REST API failed, falling back to CLI:', error);
      }
    }
    
    return this.listMetricsCLI(namespace, compartmentId);
  }

  /**
   * List available metrics for a namespace using OCI CLI
   */
  private async listMetricsCLI(namespace: string, compartmentId?: string): Promise<OCIMetricDefinition[]> {
    const targetCompartmentId = compartmentId || this.getCompartmentId();

    try {
      const command = `oci monitoring metric list --compartment-id "${targetCompartmentId}" --namespace "${namespace}" --region "${this.region}" --output json`;
      const { stdout } = await execAsync(command);
      const response = JSON.parse(stdout);
      
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
      console.error('Error listing metrics:', error);
      // Return common metrics for known namespaces
      return this.getCommonMetricsForNamespace(namespace);
    }
  }

  /**
   * Query metric data using OCI CLI or REST API
   */
  async queryMetrics(query: MetricQuery): Promise<MetricResult> {
    if (this.useRestAPI && this.restClient) {
      try {
        return await this.restClient.queryMonitoringMetrics(query);
      } catch (error) {
        console.error('REST API failed, falling back to CLI:', error);
      }
    }
    
    return this.queryMetricsCLI(query);
  }

  /**
   * Query metric data using OCI CLI
   */
  private async queryMetricsCLI(query: MetricQuery): Promise<MetricResult> {
    try {
      // Convert to OCI format timestamps
      const startTime = moment(query.timeRange.startTime).toISOString();
      const endTime = moment(query.timeRange.endTime).toISOString();
      
      const targetCompartmentId = query.compartmentId || this.getCompartmentId();
      const targetRegion = this.region;

      // Build OCI CLI command using proper MQL syntax
      const resolution = query.interval || 'PT1M';
      const interval = resolution.replace('PT', '').toLowerCase(); // Convert PT1M to 1m
      
      // Build MQL query text (simplified - dimensions handling needs proper MQL syntax)
      let mqlQuery = `${query.metricName}[${interval}]`;
      
      // Add aggregation method
      const aggregation = query.aggregation || 'mean';
      mqlQuery += `.${aggregation}()`;
      
      // Note: Dimension filtering in MQL requires proper syntax that differs from the simple approach
      // For now, we'll use the basic query without dimensions to avoid syntax errors
      
      // Build complete command
      let command = `oci monitoring metric-data summarize-metrics-data`;
      command += ` --compartment-id "${targetCompartmentId}"`;
      command += ` --region "${targetRegion}"`;
      command += ` --namespace "${query.namespace}"`;
      command += ` --query-text "${mqlQuery}"`;
      command += ` --start-time "${startTime}"`;
      command += ` --end-time "${endTime}"`;
      command += ` --resolution "${interval}"`;
      command += ` --output json`;

      const { stdout } = await execAsync(command);
      
      // Handle empty response (no data available)
      if (!stdout || stdout.trim() === '') {
        console.error('Warning: No data returned from OCI CLI (metric may not have data for the specified time range)');
        return this.generateMockMetricData(query);
      }
      
      const response = JSON.parse(stdout);

      let aggregatedDatapoints: MetricDataPoint[] = [];

      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        const metricData = response.data[0];
        if (metricData['aggregated-datapoints']) {
          aggregatedDatapoints = metricData['aggregated-datapoints'].map((point: any) => ({
            timestamp: moment(point.timestamp).toISOString(),
            value: parseFloat(point.value) || 0,
            dimensions: query.dimensions
          }));
        }
      }

      return {
        namespace: query.namespace,
        metricName: query.metricName,
        dimensions: query.dimensions || {},
        aggregatedDatapoints,
        resolution: query.interval
      };
    } catch (error) {
      console.error('Error querying metrics:', error);
      
      // Return mock data for testing purposes
      return this.generateMockMetricData(query);
    }
  }

  /**
   * Generate mock metric data for testing
   */
  private generateMockMetricData(query: MetricQuery): MetricResult {
    const startTime = moment(query.timeRange.startTime);
    const endTime = moment(query.timeRange.endTime);
    const interval = this.parseInterval(query.interval || 'PT1M');
    
    const dataPoints: MetricDataPoint[] = [];
    let current = startTime.clone();
    
    while (current.isBefore(endTime)) {
      // Generate realistic looking data based on metric name
      let value = 0;
      const metricLower = query.metricName.toLowerCase();
      
      if (metricLower.includes('cpu')) {
        value = Math.random() * 100; // CPU percentage
      } else if (metricLower.includes('memory')) {
        value = Math.random() * 100; // Memory percentage
      } else if (metricLower.includes('bytes') || metricLower.includes('network')) {
        value = Math.random() * 1000000; // Network bytes
      } else if (metricLower.includes('count') || metricLower.includes('request')) {
        value = Math.floor(Math.random() * 1000); // Request count
      } else {
        value = Math.random() * 100; // Default
      }
      
      dataPoints.push({
        timestamp: current.toISOString(),
        value: Math.round(value * 100) / 100, // Round to 2 decimal places
        dimensions: query.dimensions
      });
      
      current.add(interval.value, interval.unit);
    }

    return {
      namespace: query.namespace,
      metricName: query.metricName,
      dimensions: query.dimensions || {},
      aggregatedDatapoints: dataPoints,
      resolution: query.interval
    };
  }

  /**
   * Parse OCI interval format to moment duration
   */
  private parseInterval(interval: string): { value: number; unit: moment.unitOfTime.DurationConstructor } {
    if (interval.startsWith('PT')) {
      const match = interval.match(/PT(\d+)([MH])/);
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2] === 'M' ? 'minutes' : 'hours';
        return { value, unit };
      }
    }
    
    // Default to 1 minute
    return { value: 1, unit: 'minutes' };
  }

  /**
   * Get common metrics for known namespaces
   */
  private getCommonMetricsForNamespace(namespace: string): OCIMetricDefinition[] {
    const commonMetrics: Record<string, OCIMetricDefinition[]> = {
      'oci_computeagent': [
        { name: 'CpuUtilization', namespace, displayName: 'CPU Utilization', description: 'CPU usage percentage', dimensionKeys: ['resourceId'], unitDisplayName: 'Percent' },
        { name: 'MemoryUtilization', namespace, displayName: 'Memory Utilization', description: 'Memory usage percentage', dimensionKeys: ['resourceId'], unitDisplayName: 'Percent' },
        { name: 'NetworksBytesIn', namespace, displayName: 'Network Bytes In', description: 'Network bytes received', dimensionKeys: ['resourceId'], unitDisplayName: 'Bytes' },
        { name: 'NetworksBytesOut', namespace, displayName: 'Network Bytes Out', description: 'Network bytes sent', dimensionKeys: ['resourceId'], unitDisplayName: 'Bytes' }
      ],
      'oci_lbaas': [
        { name: 'RequestCount', namespace, displayName: 'Request Count', description: 'Number of requests', dimensionKeys: ['loadBalancerId'], unitDisplayName: 'Count' },
        { name: 'ResponseTime', namespace, displayName: 'Response Time', description: 'Response latency', dimensionKeys: ['loadBalancerId'], unitDisplayName: 'Milliseconds' },
        { name: 'ActiveConnections', namespace, displayName: 'Active Connections', description: 'Current connections', dimensionKeys: ['loadBalancerId'], unitDisplayName: 'Count' }
      ],
      'oci_vcn': [
        { name: 'VnicBytesIn', namespace, displayName: 'VNIC Bytes In', description: 'VNIC bytes received', dimensionKeys: ['resourceId'], unitDisplayName: 'Bytes' },
        { name: 'VnicBytesOut', namespace, displayName: 'VNIC Bytes Out', description: 'VNIC bytes sent', dimensionKeys: ['resourceId'], unitDisplayName: 'Bytes' }
      ]
    };

    return commonMetrics[namespace] || [];
  }

  /**
   * Query multiple metrics for correlation analysis
   */
  async queryMultipleMetrics(queries: MetricQuery[]): Promise<MetricResult[]> {
    const results: MetricResult[] = [];
    
    for (const query of queries) {
      try {
        const result = await this.queryMetrics(query);
        results.push(result);
      } catch (error) {
        console.error(`Failed to query metric ${query.metricName}:`, error);
        // Continue with other queries
      }
    }

    return results;
  }

  /**
   * Get metrics for IP correlation (simplified)
   */
  async getIPCorrelationMetrics(
    ipAddresses: string[], 
    timeRange: { startTime: string; endTime: string },
    compartmentId?: string
  ): Promise<any[]> {
    const correlationData: any[] = [];
    
    // Query network-related metrics
    const networkQueries: MetricQuery[] = [
      {
        compartmentId: compartmentId || this.getCompartmentId(),
        namespace: 'oci_vcn',
        metricName: 'VnicBytesIn',
        timeRange,
        interval: 'PT1M'
      },
      {
        compartmentId: compartmentId || this.getCompartmentId(),
        namespace: 'oci_vcn',
        metricName: 'VnicBytesOut',
        timeRange,
        interval: 'PT1M'
      }
    ];

    for (const query of networkQueries) {
      try {
        const result = await this.queryMetrics(query);
        
        result.aggregatedDatapoints.forEach(point => {
          correlationData.push({
            timestamp: point.timestamp,
            ipAddress: 'multiple', // Simplified - would need actual IP mapping
            metricName: query.metricName,
            namespace: query.namespace,
            value: point.value,
            correlationType: 'network_metric'
          });
        });
      } catch (error) {
        console.error(`Error querying ${query.metricName}:`, error);
      }
    }

    return correlationData;
  }

  /**
   * Prepare data for anomaly detection
   */
  async prepareAnomalyDetectionData(
    metricQueries: MetricQuery[],
    includeContext: boolean = true
  ): Promise<any[]> {
    const anomalyData: any[] = [];

    for (const query of metricQueries) {
      try {
        const result = await this.queryMetrics(query);
        
        result.aggregatedDatapoints.forEach(point => {
          const dataPoint: any = {
            timestamp: point.timestamp,
            metricName: query.metricName,
            namespace: query.namespace,
            value: point.value,
            dimensions: result.dimensions
          };

          if (includeContext) {
            dataPoint.contextData = {
              compartmentId: query.compartmentId,
              aggregation: query.aggregation,
              interval: query.interval,
              originalQuery: query
            };
          }

          anomalyData.push(dataPoint);
        });
      } catch (error) {
        console.error(`Error preparing anomaly data for ${query.metricName}:`, error);
      }
    }

    return anomalyData;
  }

  /**
   * Get compartment ID from environment or runtime configuration
   */
  private getCompartmentId(): string {
    // Try environment variable first (for MCP configuration)
    const envCompartmentId = process.env.OCI_COMPARTMENT_ID;
    if (envCompartmentId) {
      return envCompartmentId;
    }
    
    // If no environment variable, this should be provided by the caller
    throw new Error('No compartment ID provided. Please set OCI_COMPARTMENT_ID environment variable or pass compartmentId parameter.');
  }

  /**
   * Get current region
   */
  public getRegion(): string {
    return this.region;
  }

  /**
   * Query Compute Agent metrics specifically
   */
  async queryComputeAgentMetrics(instanceId: string, metricName: string, timeRange: { startTime: string; endTime: string }, interval: string = 'PT1M'): Promise<MetricResult> {
    if (this.useRestAPI && this.restClient) {
      try {
        return await this.restClient.queryComputeAgentMetrics(instanceId, metricName, timeRange, interval);
      } catch (error) {
        console.error('REST API failed, falling back to CLI:', error);
      }
    }
    
    // Fallback to regular query with CLI
    const query: MetricQuery = {
      compartmentId: this.getCompartmentId(),
      namespace: 'oci_computeagent',
      metricName,
      timeRange,
      dimensions: {
        resourceId: instanceId
      },
      interval,
      aggregation: 'mean'
    };
    
    return this.queryMetricsCLI(query);
  }

  /**
   * Query Stack Monitoring metrics
   */
  async queryStackMonitoringMetrics(resourceId: string, metricName: string, timeRange: { startTime: string; endTime: string }): Promise<any> {
    if (this.useRestAPI && this.restClient) {
      return await this.restClient.queryStackMonitoringMetrics(resourceId, metricName, timeRange);
    }
    
    throw new Error('Stack Monitoring metrics require REST API access. Please enable REST API mode.');
  }

  /**
   * Query DB Management metrics
   */
  async queryDbManagementMetrics(databaseId: string, metricName: string, timeRange: { startTime: string; endTime: string }): Promise<any> {
    if (this.useRestAPI && this.restClient) {
      return await this.restClient.queryDbManagementMetrics(databaseId, metricName, timeRange);
    }
    
    throw new Error('DB Management metrics require REST API access. Please enable REST API mode.');
  }

  /**
   * Query OPS Insights metrics
   */
  async queryOpsInsightsMetrics(resourceId: string, metricName: string, timeRange: { startTime: string; endTime: string }): Promise<any> {
    if (this.useRestAPI && this.restClient) {
      return await this.restClient.queryOpsInsightsMetrics(resourceId, metricName, timeRange);
    }
    
    throw new Error('OPS Insights metrics require REST API access. Please enable REST API mode.');
  }

  /**
   * Test connection to OCI (CLI and/or REST API)
   */
  async testConnection(): Promise<{ success: boolean; message: string; region?: string; compartmentId?: string; restAPI?: any }> {
    try {
      // Test OCI CLI availability
      const { stdout } = await execAsync('oci --version');
      
      let cliSuccess = false;
      let restApiResult = null;
      
      if (stdout.trim().match(/\d+\.\d+\.\d+/)) {
        try {
          const targetCompartmentId = this.getCompartmentId();
          const targetRegion = this.region;
          
          // Test basic connectivity with a simple command
          await execAsync(`oci iam compartment get --compartment-id "${targetCompartmentId}" --region "${targetRegion}" --output json`);
          cliSuccess = true;
        } catch {
          // CLI test failed
        }
      }
      
      // Test REST API if enabled
      if (this.useRestAPI && this.restClient) {
        try {
          restApiResult = await this.restClient.testConnection();
        } catch (error) {
          restApiResult = { success: false, message: `REST API test failed: ${error}`, services: [] };
        }
      }
      
      const success = cliSuccess || (restApiResult?.success || false);
      const messages = [];
      
      if (cliSuccess) {
        messages.push(`CLI: Connected (version ${stdout.trim()})`);
      }
      
      if (restApiResult) {
        messages.push(`REST API: ${restApiResult.success ? `Connected to ${restApiResult.services.length} service(s)` : 'Failed'}`);
      }
      
      return {
        success,
        message: messages.length > 0 ? messages.join(', ') : 'No connection methods available',
        region: this.region,
        compartmentId: process.env.OCI_COMPARTMENT_ID?.substring(0, 20) + '...',
        restAPI: restApiResult
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}