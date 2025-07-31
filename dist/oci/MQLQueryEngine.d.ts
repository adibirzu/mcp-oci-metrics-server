/**
 * Enhanced MQL (Metric Query Language) Engine
 * Based on OCI Grafana plugin MQL patterns and OCI Monitoring Query Language
 */
import { TimeRange } from '../types/index.js';
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
export type MQLAggregation = 'mean' | 'sum' | 'count' | 'max' | 'min' | 'rate' | 'percentile' | 'stddev' | 'variance' | 'absent' | 'present';
export interface MQLTemplate {
    name: string;
    query: string;
    variables: string[];
    description?: string;
}
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
export declare class MQLQueryEngine {
    private variables;
    private templates;
    constructor();
    /**
     * Initialize default template variables
     */
    private initializeDefaultVariables;
    /**
     * Initialize default query templates
     */
    private initializeDefaultTemplates;
    /**
     * Parse MQL query string into structured query
     */
    parseMQL(queryString: string): MQLQuery;
    /**
     * Parse dimension filters from MQL string
     */
    private parseDimensions;
    /**
     * Build MQL query string from structured query
     */
    buildMQL(query: MQLQuery): string;
    /**
     * Resolve template variables in query string
     */
    resolveVariables(queryString: string, customValues?: Record<string, string>): string;
    /**
     * Resolve interval variable based on time range
     */
    private resolveIntervalVariable;
    /**
     * Add template variable
     */
    addVariable(variable: MQLVariable): void;
    /**
     * Get template variable
     */
    getVariable(name: string): MQLVariable | undefined;
    /**
     * List all variables
     */
    listVariables(): MQLVariable[];
    /**
     * Add query template
     */
    addTemplate(template: MQLTemplate): void;
    /**
     * Get query template
     */
    getTemplate(name: string): MQLTemplate | undefined;
    /**
     * List all templates
     */
    listTemplates(): MQLTemplate[];
    /**
     * Apply template with variable substitution
     */
    applyTemplate(templateName: string, variables: Record<string, string>): string;
    /**
     * Validate MQL query syntax
     */
    validateMQL(queryString: string): {
        valid: boolean;
        errors: string[];
    };
    /**
     * Check if aggregation function is valid
     */
    private isValidAggregation;
    /**
     * Check if window format is valid
     */
    private isValidWindow;
    /**
     * Convert relative time to absolute timestamps
     */
    resolveTimeRange(startTime: string, endTime?: string): TimeRange;
    /**
     * Generate query suggestions based on namespace
     */
    getQuerySuggestions(namespace: string): string[];
    /**
     * Export configuration
     */
    exportConfig(): {
        variables: Record<string, MQLVariable>;
        templates: Record<string, MQLTemplate>;
    };
    /**
     * Import configuration
     */
    importConfig(config: {
        variables?: Record<string, MQLVariable>;
        templates?: Record<string, MQLTemplate>;
    }): void;
}
//# sourceMappingURL=MQLQueryEngine.d.ts.map