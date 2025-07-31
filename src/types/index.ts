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
  startTime: string; // ISO 8601 format - compatible with Logan MCP
  endTime: string;   // ISO 8601 format - compatible with Logan MCP
}

export interface MetricQuery {
  compartmentId: string;
  namespace: string;
  metricName: string;
  dimensions?: Record<string, string>;
  aggregation?: 'mean' | 'sum' | 'count' | 'max' | 'min' | 'rate' | 'percentile' | 'stddev' | 'variance' | 'absent' | 'present';
  interval?: string; // PT1M, PT5M, PT1H, etc.
  timeRange: TimeRange;
}

export interface MetricDataPoint {
  timestamp: string; // ISO 8601 format - compatible with Logan MCP
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

// Compatible with Logan MCP IP correlation
export interface IPMetricCorrelation {
  ipAddress: string;
  timestamp: string; // ISO 8601 format - matches Logan format
  metricValue: number;
  metricName: string;
  namespace: string;
  logEvents?: any[]; // For correlation with Logan data
}

// Anomaly detection data structure
export interface AnomalyDetectionData {
  timestamp: string;
  metricName: string;
  value: number;
  expectedValue?: number;
  anomalyScore?: number;
  contextData: Record<string, any>;
}

// OCI Monitoring API response types
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

// FastMCP tool request/response types
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

// Enhanced types for Grafana-style functionality

// Datasource configuration types
export interface TenancyConfig {
  id: string;
  name: string;
  tenancyOCID: string;
  region: string;
  compartmentId?: string;
  authMethod: 'instance_principal' | 'user_principal';
  configProfile?: string;
  isDefault?: boolean;
}

export interface DatasourceConfig {
  name: string;
  tenancies: TenancyConfig[];
  defaultRegion: string;
  maxConcurrentQueries: number;
  queryTimeout: number;
  enableTemplateVariables: boolean;
  enableCustomMetrics: boolean;
  cacheEnabled: boolean;
  cacheTTL: number;
}

// Authentication types
export interface AuthenticationConfig {
  method: 'instance_principal' | 'user_principal';
  profile?: string;
  configFile?: string;
  tenancyOCID?: string;
  userOCID?: string;
  fingerprint?: string;
  keyFile?: string;
  region?: string;
  passphraseFile?: string;
}

export interface AuthenticationContext {
  method: 'instance_principal' | 'user_principal';
  tenancyOCID: string;
  region: string;
  profile?: string;
  isValid: boolean;
  expires?: Date;
  metadata?: Record<string, any>;
}

export interface InstanceMetadata {
  instanceId: string;
  compartmentId: string;
  availabilityDomain: string;
  faultDomain: string;
  region: string;
  shape: string;
  displayName: string;
  timeCreated: string;
  lifecycleState: string;
}

// MQL (Metric Query Language) types
export interface MQLQuery {
  metricName: string;
  namespace: string;
  dimensions?: Record<string, string>;
  window?: string;
  resolution?: string;
  aggregation?: MQLAggregation;
  filters?: MQLFilter[];
  groupBy?: string[];
  alarmConditions?: MQLAlarmCondition[];
}

export interface MQLFilter {
  dimension: string;
  operator: '=' | '!=' | '~' | '!~' | 'in' | 'not in';
  value: string | string[];
}

export interface MQLAlarmCondition {
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  threshold: number;
  duration?: string;
}

export type MQLAggregation = 
  | 'mean' | 'sum' | 'count' | 'max' | 'min' 
  | 'rate' | 'percentile' | 'stddev' | 'variance'
  | 'absent' | 'present';

export interface MQLTemplate {
  name: string;
  query: string;
  variables: string[];
  description?: string;
}

// Template Variable types
export interface MQLVariable {
  name: string;
  type: 'constant' | 'interval' | 'custom' | 'query' | 'datasource' | 'textbox';
  value?: string | string[];
  query?: string;
  regex?: string;
  allValue?: string;
  includeAll?: boolean;
  multiValue?: boolean;
}

export interface TemplateVariable {
  name: string;
  type: 'constant' | 'interval' | 'custom' | 'query' | 'datasource' | 'textbox' | 'adhoc';
  label?: string;
  description?: string;
  value?: string | string[];
  query?: string;
  datasource?: string;
  regex?: string;
  sort?: 'none' | 'alpha' | 'alpha_case_insensitive' | 'numeric';
  allValue?: string;
  includeAll?: boolean;
  multiValue?: boolean;
  current?: TemplateVariableValue;
  options?: TemplateVariableOption[];
  refresh?: 'never' | 'on_dashboard_load' | 'on_time_range_change';
  hide?: 'variable' | 'label' | 'value';
  skipUrlSync?: boolean;
}

export interface TemplateVariableValue {
  value: string | string[];
  text: string | string[];
  selected: boolean;
}

export interface TemplateVariableOption {
  text: string;
  value: string;
  selected?: boolean;
}

export interface VariableQuery {
  query: string;
  refId: string;
  datasource?: string;
  format?: 'time_series' | 'table' | 'logs';
}

// Enhanced query types
export interface EnhancedMetricQuery extends MetricQuery {
  tenancyId?: string;
  templateVariables?: Record<string, string>;
  mqlQuery?: string;
}

export interface CrossTenancyQuery {
  tenancyId: string;
  namespace: string;
  metricName: string;
  compartmentId?: string;
  dimensions?: Record<string, string>;
  aggregation?: string;
  interval?: string;
}

export interface CrossTenancyResult {
  tenancyId: string;
  query: MetricQuery | CrossTenancyQuery;
  result?: MetricResult;
  error?: string;
  success: boolean;
}

// Configuration export/import types
export interface EnhancedConfiguration {
  datasource: any;
  authentication: any;
  mqlEngine: {
    variables: Record<string, MQLVariable>;
    templates: Record<string, MQLTemplate>;
  };
  templateVariables: Record<string, TemplateVariable>;
  exportedAt: string;
  version: string;
  includeSecrets: boolean;
}

// Enhanced response types
export interface EnhancedMetricResult extends MetricResult {
  enhanced: boolean;
  authenticationUsed?: {
    method: string;
    tenancy: string;
    region: string;
  };
  mqlQuery?: string;
  templateVariables?: Record<string, string>;
  tenancyId?: string;
}

export interface EnhancedVisualizationResult extends VisualizationResult {
  enhanced: boolean;
  generatedAt: string;
  grafanaCompatible: boolean;
  templateVariables?: Record<string, string>;
}