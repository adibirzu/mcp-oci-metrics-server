/**
 * OCI REST API Client
 * Provides REST API access to OCI Monitoring, Stack Monitoring, DB Management, and OPS Insights
 */
import { MetricQuery, MetricResult, OCINamespace, OCIMetricDefinition } from '../types/index.js';
export declare class OCIRestClient {
    private config;
    private httpClient;
    private region;
    constructor();
    /**
     * Detect region from OCI CLI config
     */
    private detectRegion;
    /**
     * Load OCI configuration from ~/.oci/config
     */
    private loadOCIConfig;
    /**
     * Parse OCI config file section
     */
    private parseConfigSection;
    /**
     * Create HTTP client with OCI authentication
     */
    private createHttpClient;
    /**
     * Generate OCI authentication headers
     */
    private generateAuthHeaders;
    /**
     * Get OCI Monitoring service endpoint
     */
    private getMonitoringEndpoint;
    /**
     * Get Stack Monitoring service endpoint
     */
    private getStackMonitoringEndpoint;
    /**
     * Get DB Management service endpoint
     */
    private getDbManagementEndpoint;
    /**
     * Get OPS Insights service endpoint
     */
    private getOpsInsightsEndpoint;
    /**
     * Query metrics via REST API (OCI Monitoring)
     */
    queryMonitoringMetrics(query: MetricQuery): Promise<MetricResult>;
    /**
     * Build MQL query string from MetricQuery
     */
    private buildMQLQuery;
    /**
     * Parse monitoring API response
     */
    private parseMonitoringResponse;
    /**
     * List namespaces via REST API
     */
    listNamespaces(compartmentId?: string): Promise<OCINamespace[]>;
    /**
     * List metrics for a namespace via REST API
     */
    listMetrics(namespace: string, compartmentId?: string): Promise<OCIMetricDefinition[]>;
    /**
     * Query Compute Agent metrics specifically
     */
    queryComputeAgentMetrics(instanceId: string, metricName: string, timeRange: {
        startTime: string;
        endTime: string;
    }, interval?: string): Promise<MetricResult>;
    /**
     * Query Stack Monitoring metrics
     */
    queryStackMonitoringMetrics(resourceId: string, metricName: string, timeRange: {
        startTime: string;
        endTime: string;
    }): Promise<any>;
    /**
     * Query DB Management metrics
     */
    queryDbManagementMetrics(databaseId: string, metricName: string, timeRange: {
        startTime: string;
        endTime: string;
    }): Promise<any>;
    /**
     * Query OPS Insights metrics
     */
    queryOpsInsightsMetrics(resourceId: string, metricName: string, timeRange: {
        startTime: string;
        endTime: string;
    }): Promise<any>;
    /**
     * Test REST API connectivity
     */
    testConnection(): Promise<{
        success: boolean;
        message: string;
        services: string[];
    }>;
    /**
     * Get current region
     */
    getRegion(): string;
    /**
     * Get current configuration (without sensitive data)
     */
    getConfigInfo(): {
        region: string;
        profile: string;
        tenancy: string;
        user: string;
    };
}
//# sourceMappingURL=OCIRestClient.d.ts.map