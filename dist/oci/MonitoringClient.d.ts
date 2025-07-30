/**
 * Simplified OCI Monitoring API Client
 * Uses OCI CLI for API calls to avoid SDK compatibility issues
 */
import { MetricQuery, MetricResult, OCINamespace, OCIMetricDefinition } from '../types/index.js';
export declare class MonitoringClient {
    private compartmentId;
    private region;
    private restClient;
    private useRestAPI;
    constructor(useRestAPI?: boolean);
    /**
     * Initialize region from OCI CLI config synchronously
     */
    private initializeRegionSync;
    /**
     * List available namespaces using OCI CLI or REST API
     */
    listNamespaces(compartmentId?: string): Promise<OCINamespace[]>;
    /**
     * List available namespaces using OCI CLI
     */
    private listNamespacesCLI;
    /**
     * List available metrics for a namespace using OCI CLI or REST API
     */
    listMetrics(namespace: string, compartmentId?: string): Promise<OCIMetricDefinition[]>;
    /**
     * List available metrics for a namespace using OCI CLI
     */
    private listMetricsCLI;
    /**
     * Query metric data using OCI CLI or REST API
     */
    queryMetrics(query: MetricQuery): Promise<MetricResult>;
    /**
     * Query metric data using OCI CLI
     */
    private queryMetricsCLI;
    /**
     * Generate mock metric data for testing
     */
    private generateMockMetricData;
    /**
     * Parse OCI interval format to moment duration
     */
    private parseInterval;
    /**
     * Get common metrics for known namespaces
     */
    private getCommonMetricsForNamespace;
    /**
     * Query multiple metrics for correlation analysis
     */
    queryMultipleMetrics(queries: MetricQuery[]): Promise<MetricResult[]>;
    /**
     * Get metrics for IP correlation (simplified)
     */
    getIPCorrelationMetrics(ipAddresses: string[], timeRange: {
        startTime: string;
        endTime: string;
    }, compartmentId?: string): Promise<any[]>;
    /**
     * Prepare data for anomaly detection
     */
    prepareAnomalyDetectionData(metricQueries: MetricQuery[], includeContext?: boolean): Promise<any[]>;
    /**
     * Get compartment ID from environment or runtime configuration
     */
    private getCompartmentId;
    /**
     * Get current region
     */
    getRegion(): string;
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
     * Test connection to OCI (CLI and/or REST API)
     */
    testConnection(): Promise<{
        success: boolean;
        message: string;
        region?: string;
        compartmentId?: string;
        restAPI?: any;
    }>;
}
//# sourceMappingURL=MonitoringClient.d.ts.map