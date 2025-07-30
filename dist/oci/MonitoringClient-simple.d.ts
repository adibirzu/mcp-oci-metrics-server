/**
 * Simplified OCI Monitoring API Client
 * Uses OCI CLI for API calls to avoid SDK compatibility issues
 */
import { MetricQuery, MetricResult, OCINamespace, OCIMetricDefinition } from '../types/index.js';
export declare class MonitoringClient {
    private compartmentId;
    private region;
    constructor();
    /**
     * Initialize configuration from OCI CLI defaults
     */
    private initializeConfig;
    /**
     * List available namespaces using OCI CLI
     */
    listNamespaces(compartmentId?: string): Promise<OCINamespace[]>;
    /**
     * List available metrics for a namespace using OCI CLI
     */
    listMetrics(namespace: string, compartmentId?: string): Promise<OCIMetricDefinition[]>;
    /**
     * Query metric data using OCI CLI
     */
    queryMetrics(query: MetricQuery): Promise<MetricResult>;
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
    getRegion(): Promise<string>;
    /**
     * Test connection to OCI (simplified)
     */
    testConnection(): Promise<{
        success: boolean;
        message: string;
        region?: string;
        compartmentId?: string;
    }>;
}
//# sourceMappingURL=MonitoringClient-simple.d.ts.map