/**
 * Types and interfaces for OCI Metrics MCP Server
 * Compatible with Logan MCP date/time formats for correlation
 */
export interface OCIConfig {
    tenancy: string;
    user: string;
    key_file: string;
    fingerprint: string;
    region: string;
    compartment_id?: string;
}
export interface TimeRange {
    startTime: string;
    endTime: string;
}
export interface MetricQuery {
    compartmentId: string;
    namespace: string;
    metricName: string;
    dimensions?: Record<string, string>;
    aggregation?: 'mean' | 'sum' | 'count' | 'max' | 'min' | 'rate';
    interval?: string;
    timeRange: TimeRange;
}
export interface MetricDataPoint {
    timestamp: string;
    value: number;
    dimensions?: Record<string, string>;
}
export interface MetricResult {
    namespace: string;
    metricName: string;
    dimensions: Record<string, string>;
    aggregatedDatapoints: MetricDataPoint[];
    resolution?: string;
}
export interface GraphConfig {
    type: 'line' | 'bar' | 'scatter' | 'heatmap' | 'pie';
    title: string;
    xAxis: string;
    yAxis: string;
    showLegend?: boolean;
    colorScheme?: string[];
}
export interface VisualizationResult {
    graphHtml: string;
    graphJson: string;
    summary: string;
    dataPoints: number;
    timeRange: TimeRange;
}
export interface IPMetricCorrelation {
    ipAddress: string;
    timestamp: string;
    metricValue: number;
    metricName: string;
    namespace: string;
    logEvents?: any[];
}
export interface AnomalyDetectionData {
    timestamp: string;
    metricName: string;
    value: number;
    expectedValue?: number;
    anomalyScore?: number;
    contextData: Record<string, any>;
}
export interface OCIMetricData {
    compartmentId: string;
    namespace: string;
    resourceGroup?: string;
    name: string;
    dimensions: Record<string, string>;
    metadata: Record<string, string>;
    aggregatedDatapoints: Array<{
        timestamp: string;
        value: number;
    }>;
}
export interface OCINamespace {
    name: string;
    displayName: string;
    description?: string;
}
export interface OCIMetricDefinition {
    name: string;
    namespace: string;
    displayName: string;
    description?: string;
    dimensionKeys: string[];
    unitDisplayName?: string;
}
export interface MetricsQueryRequest {
    compartmentId?: string;
    namespace: string;
    metricName: string;
    startTime: string;
    endTime: string;
    dimensions?: Record<string, string>;
    aggregation?: string;
    interval?: string;
}
export interface GraphGenerationRequest {
    metricData: MetricResult[];
    graphType: 'line' | 'bar' | 'scatter' | 'heatmap' | 'pie';
    title?: string;
    includeCorrelation?: boolean;
    ipAddresses?: string[];
}
export interface NamespaceListRequest {
    compartmentId?: string;
}
export interface MetricListRequest {
    compartmentId?: string;
    namespace: string;
}
export interface AnomalyPrepRequest {
    metricData: MetricResult[];
    includeContext?: boolean;
    timeWindow?: string;
}
//# sourceMappingURL=index.d.ts.map