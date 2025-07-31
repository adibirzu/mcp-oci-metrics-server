/**
 * Template Variable Engine
 * Dynamic configuration support similar to Grafana's template variables
 */
import { AuthenticationManager } from './AuthenticationManager.js';
import { MonitoringClient } from './MonitoringClient.js';
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
export declare class TemplateVariableEngine {
    private variables;
    private authManager;
    private monitoringClient;
    private queryCache;
    private readonly CACHE_TTL;
    constructor(authManager: AuthenticationManager, monitoringClient: MonitoringClient);
    /**
     * Initialize built-in template variables
     */
    private initializeBuiltinVariables;
    /**
     * Add template variable
     */
    addVariable(variable: TemplateVariable): void;
    /**
     * Get template variable
     */
    getVariable(name: string): TemplateVariable | undefined;
    /**
     * List all variables
     */
    listVariables(): TemplateVariable[];
    /**
     * Update variable value
     */
    updateVariableValue(name: string, value: string | string[]): boolean;
    /**
     * Resolve variable query and get options
     */
    resolveVariableQuery(variable: TemplateVariable): Promise<TemplateVariableOption[]>;
    /**
     * Execute variable query
     */
    private executeVariableQuery;
    /**
     * Get region options
     */
    private getRegionOptions;
    /**
     * Get compartment options
     */
    private getCompartmentOptions;
    /**
     * Get namespace options
     */
    private getNamespaceOptions;
    /**
     * Get instance options
     */
    private getInstanceOptions;
    /**
     * Get metric options
     */
    private getMetricOptions;
    /**
     * Get dimension options
     */
    private getDimensionOptions;
    /**
     * Execute custom query
     */
    private executeCustomQuery;
    /**
     * Extract parameter from query function
     */
    private extractParameterFromQuery;
    /**
     * Extract all parameters from query function
     */
    private extractParametersFromQuery;
    /**
     * Get variable value by name
     */
    private getVariableValue;
    /**
     * Interpolate variables in string
     */
    interpolateVariables(text: string): string;
    /**
     * Sort options array
     */
    private sortOptions;
    /**
     * Apply regex filter to options
     */
    private applyRegexFilter;
    /**
     * Refresh variable options
     */
    refreshVariable(name: string): Promise<boolean>;
    /**
     * Check if current value is still valid
     */
    private isValidCurrentValue;
    /**
     * Refresh all variables
     */
    refreshAllVariables(): Promise<{
        success: string[];
        failed: string[];
    }>;
    /**
     * Export variables configuration
     */
    exportVariables(): Record<string, TemplateVariable>;
    /**
     * Import variables configuration
     */
    importVariables(variables: Record<string, TemplateVariable>): void;
    /**
     * Clear variable cache
     */
    clearCache(): void;
    /**
     * Get variable dependencies
     */
    getVariableDependencies(name: string): string[];
    /**
     * Get variable resolution order
     */
    getResolutionOrder(): string[];
}
//# sourceMappingURL=TemplateVariableEngine.d.ts.map