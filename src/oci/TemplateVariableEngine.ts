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

export class TemplateVariableEngine {
  private variables: Map<string, TemplateVariable> = new Map();
  private authManager: AuthenticationManager;
  private monitoringClient: MonitoringClient;
  private queryCache: Map<string, { data: any; expires: Date }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(authManager: AuthenticationManager, monitoringClient: MonitoringClient) {
    this.authManager = authManager;
    this.monitoringClient = monitoringClient;
    this.initializeBuiltinVariables();
  }

  /**
   * Initialize built-in template variables
   */
  private initializeBuiltinVariables(): void {
    // Time interval variable
    this.addVariable({
      name: 'interval',
      type: 'interval',
      label: 'Interval',
      description: 'Query resolution interval',
      value: 'auto',
      options: [
        { text: 'auto', value: 'auto', selected: true },
        { text: '1m', value: '1m' },
        { text: '5m', value: '5m' },
        { text: '15m', value: '15m' },
        { text: '1h', value: '1h' },
        { text: '6h', value: '6h' },
        { text: '1d', value: '1d' }
      ],
      current: { value: 'auto', text: 'auto', selected: true }
    });

    // Region variable
    this.addVariable({
      name: 'region',
      type: 'query',
      label: 'Region',
      description: 'OCI Region',
      query: 'regions()',
      includeAll: false,
      multiValue: false,
      refresh: 'on_dashboard_load',
      sort: 'alpha'
    });

    // Compartment variable
    this.addVariable({
      name: 'compartment',
      type: 'query',
      label: 'Compartment',
      description: 'OCI Compartment',
      query: 'compartments($region)',
      includeAll: true,
      multiValue: true,
      refresh: 'on_dashboard_load',
      allValue: '*',
      sort: 'alpha'
    });

    // Namespace variable
    this.addVariable({
      name: 'namespace',
      type: 'query',
      label: 'Namespace',
      description: 'Metrics Namespace',
      query: 'namespaces($compartment)',
      includeAll: false,
      multiValue: false,
      refresh: 'on_time_range_change',
      sort: 'alpha'
    });

    // Instance variable
    this.addVariable({
      name: 'instance',
      type: 'query',
      label: 'Instance',
      description: 'Compute Instance',
      query: 'instances($compartment)',
      includeAll: true,
      multiValue: true,
      refresh: 'on_time_range_change',
      allValue: '*',
      sort: 'alpha'
    });

    // Metric variable
    this.addVariable({
      name: 'metric',
      type: 'query',
      label: 'Metric',
      description: 'Metric Name',
      query: 'metrics($namespace)',
      includeAll: false,
      multiValue: false,
      refresh: 'on_time_range_change',
      sort: 'alpha'
    });
  }

  /**
   * Add template variable
   */
  addVariable(variable: TemplateVariable): void {
    this.variables.set(variable.name, variable);
  }

  /**
   * Get template variable
   */
  getVariable(name: string): TemplateVariable | undefined {
    return this.variables.get(name);
  }

  /**
   * List all variables
   */
  listVariables(): TemplateVariable[] {
    return Array.from(this.variables.values());
  }

  /**
   * Update variable value
   */
  updateVariableValue(name: string, value: string | string[]): boolean {
    const variable = this.variables.get(name);
    if (!variable) {
      return false;
    }

    variable.value = value;
    variable.current = {
      value,
      text: Array.isArray(value) ? value : [value],
      selected: true
    };

    return true;
  }

  /**
   * Resolve variable query and get options
   */
  async resolveVariableQuery(variable: TemplateVariable): Promise<TemplateVariableOption[]> {
    if (variable.type !== 'query' || !variable.query) {
      return variable.options || [];
    }

    const cacheKey = `${variable.name}_${variable.query}`;
    const cached = this.queryCache.get(cacheKey);

    if (cached && cached.expires > new Date()) {
      return cached.data;
    }

    try {
      const options = await this.executeVariableQuery(variable.query);
      
      // Apply sorting
      this.sortOptions(options, variable.sort);

      // Cache results
      this.queryCache.set(cacheKey, {
        data: options,
        expires: new Date(Date.now() + this.CACHE_TTL)
      });

      return options;

    } catch (error) {
      console.error(`Error resolving variable query for ${variable.name}:`, error);
      return variable.options || [];
    }
  }

  /**
   * Execute variable query
   */
  private async executeVariableQuery(query: string): Promise<TemplateVariableOption[]> {
    const resolvedQuery = this.interpolateVariables(query);
    
    // Parse query type
    if (resolvedQuery.startsWith('regions()')) {
      return await this.getRegionOptions();
    } else if (resolvedQuery.startsWith('compartments(')) {
      const region = this.extractParameterFromQuery(resolvedQuery, 0);
      return await this.getCompartmentOptions(region);
    } else if (resolvedQuery.startsWith('namespaces(')) {
      const compartment = this.extractParameterFromQuery(resolvedQuery, 0);
      return await this.getNamespaceOptions(compartment);
    } else if (resolvedQuery.startsWith('instances(')) {
      const compartment = this.extractParameterFromQuery(resolvedQuery, 0);
      return await this.getInstanceOptions(compartment);
    } else if (resolvedQuery.startsWith('metrics(')) {
      const namespace = this.extractParameterFromQuery(resolvedQuery, 0);
      return await this.getMetricOptions(namespace);
    } else if (resolvedQuery.startsWith('dimensions(')) {
      const params = this.extractParametersFromQuery(resolvedQuery);
      return await this.getDimensionOptions(params[0], params[1]);
    } else {
      // Custom query - try to execute as MQL or OCI CLI
      return await this.executeCustomQuery(resolvedQuery);
    }
  }

  /**
   * Get region options
   */
  private async getRegionOptions(): Promise<TemplateVariableOption[]> {
    try {
      const regions = await this.authManager.executeOCICommand('iam region list');
      const result = JSON.parse(regions.stdout);

      if (result.data && Array.isArray(result.data)) {
        return result.data.map((region: any) => ({
          text: region['region-name'] || region.name,
          value: region['region-key'] || region.name
        }));
      }

      return [];
    } catch (error) {
      console.error('Error getting region options:', error);
      return [
        { text: 'us-ashburn-1', value: 'us-ashburn-1' },
        { text: 'us-phoenix-1', value: 'us-phoenix-1' },
        { text: 'eu-frankfurt-1', value: 'eu-frankfurt-1' }
      ];
    }
  }

  /**
   * Get compartment options
   */
  private async getCompartmentOptions(region?: string): Promise<TemplateVariableOption[]> {
    try {
      const compartments = await this.authManager.executeOCICommand('iam compartment list');
      const result = JSON.parse(compartments.stdout);

      if (result.data && Array.isArray(result.data)) {
        return result.data
          .filter((comp: any) => comp['lifecycle-state'] === 'ACTIVE')
          .map((comp: any) => ({
            text: comp.name,
            value: comp.id
          }));
      }

      return [];
    } catch (error) {
      console.error('Error getting compartment options:', error);
      return [];
    }
  }

  /**
   * Get namespace options
   */
  private async getNamespaceOptions(compartmentId?: string): Promise<TemplateVariableOption[]> {
    try {
      const compartment = compartmentId || process.env.OCI_COMPARTMENT_ID;
      if (!compartment) {
        throw new Error('No compartment specified');
      }

      const namespaces = await this.monitoringClient.listNamespaces(compartment);
      
      return namespaces.map(ns => ({
        text: ns.displayName,
        value: ns.name
      }));

    } catch (error) {
      console.error('Error getting namespace options:', error);
      return [
        { text: 'Compute Agent', value: 'oci_computeagent' },
        { text: 'Load Balancer', value: 'oci_lbaas' },
        { text: 'VCN', value: 'oci_vcn' }
      ];
    }
  }

  /**
   * Get instance options
   */
  private async getInstanceOptions(compartmentId?: string): Promise<TemplateVariableOption[]> {
    try {
      const compartment = compartmentId || process.env.OCI_COMPARTMENT_ID;
      if (!compartment) {
        throw new Error('No compartment specified');
      }

      const instances = await this.authManager.executeOCICommand(
        `compute instance list --compartment-id "${compartment}"`
      );
      const result = JSON.parse(instances.stdout);

      if (result.data && Array.isArray(result.data)) {
        return result.data
          .filter((instance: any) => instance['lifecycle-state'] === 'RUNNING')
          .map((instance: any) => ({
            text: instance['display-name'],
            value: instance.id
          }));
      }

      return [];
    } catch (error) {
      console.error('Error getting instance options:', error);
      return [];
    }
  }

  /**
   * Get metric options
   */
  private async getMetricOptions(namespace?: string): Promise<TemplateVariableOption[]> {
    try {
      if (!namespace) {
        throw new Error('No namespace specified');
      }

      const compartment = process.env.OCI_COMPARTMENT_ID;
      if (!compartment) {
        throw new Error('No compartment specified');
      }

      const metrics = await this.monitoringClient.listMetrics(namespace, compartment);
      
      return metrics.map(metric => ({
        text: metric.displayName,
        value: metric.name
      }));

    } catch (error) {
      console.error('Error getting metric options:', error);
      return [];
    }
  }

  /**
   * Get dimension options  
   */
  private async getDimensionOptions(namespace?: string, metricName?: string): Promise<TemplateVariableOption[]> {
    try {
      if (!namespace || !metricName) {
        return [];
      }

      const compartment = process.env.OCI_COMPARTMENT_ID;
      if (!compartment) {
        throw new Error('No compartment specified');
      }

      const metrics = await this.monitoringClient.listMetrics(namespace, compartment);
      const metric = metrics.find(m => m.name === metricName);

      if (metric && metric.dimensionKeys) {
        return metric.dimensionKeys.map(key => ({
          text: key,
          value: key
        }));
      }

      return [];
    } catch (error) {
      console.error('Error getting dimension options:', error);
      return [];
    }
  }

  /**
   * Execute custom query
   */
  private async executeCustomQuery(query: string): Promise<TemplateVariableOption[]> {
    try {
      // Try to execute as OCI CLI command
      const result = await this.authManager.executeOCICommand(query);
      const parsed = JSON.parse(result.stdout);

      if (parsed.data && Array.isArray(parsed.data)) {
        return parsed.data.map((item: any, index: number) => ({
          text: item.name || item.displayName || `Item ${index + 1}`,
          value: item.id || item.name || String(index)
        }));
      }

      return [];
    } catch (error) {
      console.error('Error executing custom query:', error);
      return [];
    }
  }

  /**
   * Extract parameter from query function
   */
  private extractParameterFromQuery(query: string, paramIndex: number): string | undefined {
    const match = query.match(/\(([^)]*)\)/);
    if (match && match[1]) {
      const params = match[1].split(',').map(p => p.trim());
      const param = params[paramIndex];
      
      if (param && param.startsWith('$')) {
        return this.getVariableValue(param.substring(1));
      }
      
      return param;
    }
    return undefined;
  }

  /**
   * Extract all parameters from query function
   */
  private extractParametersFromQuery(query: string): string[] {
    const match = query.match(/\(([^)]*)\)/);
    if (match && match[1]) {
      return match[1].split(',').map(p => {
        const trimmed = p.trim();
        if (trimmed.startsWith('$')) {
          return this.getVariableValue(trimmed.substring(1)) || trimmed;
        }
        return trimmed;
      });
    }
    return [];
  }

  /**
   * Get variable value by name
   */
  private getVariableValue(name: string): string | undefined {
    const variable = this.variables.get(name);
    if (variable && variable.current) {
      if (Array.isArray(variable.current.value)) {
        return variable.current.value.join(',');
      }
      return String(variable.current.value);
    }
    return undefined;
  }

  /**
   * Interpolate variables in string
   */
  interpolateVariables(text: string): string {
    let result = text;

    // Replace $variable and ${variable} patterns
    const variablePattern = /(\$\{([^}]+)\}|\$([a-zA-Z_][a-zA-Z0-9_]*))/g;
    
    result = result.replace(variablePattern, (match, fullMatch, bracketVar, simpleVar) => {
      const varName = bracketVar || simpleVar;
      const value = this.getVariableValue(varName);
      
      return value !== undefined ? value : match;
    });

    return result;
  }

  /**
   * Sort options array
   */
  private sortOptions(options: TemplateVariableOption[], sortType?: string): void {
    switch (sortType) {
      case 'alpha':
        options.sort((a, b) => a.text.localeCompare(b.text));
        break;
      case 'alpha_case_insensitive':
        options.sort((a, b) => a.text.toLowerCase().localeCompare(b.text.toLowerCase()));
        break;
      case 'numeric':
        options.sort((a, b) => {
          const numA = parseFloat(a.value);
          const numB = parseFloat(b.value);
          if (isNaN(numA) && isNaN(numB)) return 0;
          if (isNaN(numA)) return 1;
          if (isNaN(numB)) return -1;
          return numA - numB;
        });
        break;
      // 'none' or default - no sorting
    }
  }

  /**
   * Apply regex filter to options
   */
  private applyRegexFilter(options: TemplateVariableOption[], regex?: string): TemplateVariableOption[] {
    if (!regex) {
      return options;
    }

    try {
      const regexPattern = new RegExp(regex, 'i');
      return options.filter(option => 
        regexPattern.test(option.text) || regexPattern.test(option.value)
      );
    } catch (error) {
      console.error('Invalid regex pattern:', regex, error);
      return options;
    }
  }

  /**
   * Refresh variable options
   */
  async refreshVariable(name: string): Promise<boolean> {
    const variable = this.variables.get(name);
    if (!variable) {
      return false;
    }

    try {
      const options = await this.resolveVariableQuery(variable);
      
      // Apply regex filter if specified
      const filteredOptions = this.applyRegexFilter(options, variable.regex);
      
      variable.options = filteredOptions;

      // Update current value if it's no longer valid
      if (variable.current && !this.isValidCurrentValue(variable.current, filteredOptions)) {
        if (filteredOptions.length > 0) {
          variable.current = {
            value: filteredOptions[0].value,
            text: filteredOptions[0].text,
            selected: true
          };
        }
      }

      return true;
    } catch (error) {
      console.error(`Error refreshing variable ${name}:`, error);
      return false;
    }
  }

  /**
   * Check if current value is still valid
   */
  private isValidCurrentValue(current: TemplateVariableValue, options: TemplateVariableOption[]): boolean {
    const currentValues = Array.isArray(current.value) ? current.value : [current.value];
    const optionValues = options.map(opt => opt.value);
    
    return currentValues.every(val => optionValues.includes(val));
  }

  /**
   * Refresh all variables
   */
  async refreshAllVariables(): Promise<{ success: string[]; failed: string[] }> {
    const results = { success: [] as string[], failed: [] as string[] };

    for (const [name, variable] of this.variables.entries()) {
      if (variable.type === 'query') {
        const success = await this.refreshVariable(name);
        if (success) {
          results.success.push(name);
        } else {
          results.failed.push(name);
        }
      }
    }

    return results;
  }

  /**
   * Export variables configuration
   */
  exportVariables(): Record<string, TemplateVariable> {
    return Object.fromEntries(this.variables.entries());
  }

  /**
   * Import variables configuration
   */
  importVariables(variables: Record<string, TemplateVariable>): void {
    Object.entries(variables).forEach(([name, variable]) => {
      this.variables.set(name, variable);
    });
  }

  /**
   * Clear variable cache
   */
  clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Get variable dependencies
   */
  getVariableDependencies(name: string): string[] {
    const variable = this.variables.get(name);
    if (!variable || !variable.query) {
      return [];
    }

    const dependencies: string[] = [];
    const variablePattern = /\$([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let match;

    while ((match = variablePattern.exec(variable.query)) !== null) {
      const depName = match[1];
      if (this.variables.has(depName)) {
        dependencies.push(depName);
      }
    }

    return dependencies;
  }

  /**
   * Get variable resolution order
   */
  getResolutionOrder(): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (name: string) => {
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected: ${name}`);
      }
      if (visited.has(name)) {
        return;
      }

      visiting.add(name);
      const dependencies = this.getVariableDependencies(name);
      
      for (const dep of dependencies) {
        visit(dep);
      }

      visiting.delete(name);
      visited.add(name);
      order.push(name);
    };

    for (const name of this.variables.keys()) {
      visit(name);
    }

    return order;
  }
}