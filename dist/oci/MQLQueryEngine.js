/**
 * Enhanced MQL (Metric Query Language) Engine
 * Based on OCI Grafana plugin MQL patterns and OCI Monitoring Query Language
 */
import moment from 'moment-timezone';
export class MQLQueryEngine {
    variables = new Map();
    templates = new Map();
    constructor() {
        this.initializeDefaultVariables();
        this.initializeDefaultTemplates();
    }
    /**
     * Initialize default template variables
     */
    initializeDefaultVariables() {
        // Time interval variables
        this.addVariable({
            name: 'interval',
            type: 'interval',
            value: 'auto',
            includeAll: false,
            multiValue: false
        });
        // Common dimension variables
        this.addVariable({
            name: 'compartment',
            type: 'query',
            query: 'compartments()',
            includeAll: true,
            multiValue: true
        });
        this.addVariable({
            name: 'instance',
            type: 'query',
            query: 'instances($compartment)',
            includeAll: true,
            multiValue: true
        });
        this.addVariable({
            name: 'namespace',
            type: 'query',
            query: 'namespaces()',
            includeAll: false,
            multiValue: false
        });
    }
    /**
     * Initialize default query templates
     */
    initializeDefaultTemplates() {
        // Basic metric template
        this.addTemplate({
            name: 'basic_metric',
            query: '{metricName}[$interval].{aggregation}()',
            variables: ['metricName', 'interval', 'aggregation'],
            description: 'Basic metric query with configurable aggregation'
        });
        // Filtered metric template
        this.addTemplate({
            name: 'filtered_metric',
            query: '{metricName}[$interval]{{{filters}}}.{aggregation}()',
            variables: ['metricName', 'interval', 'filters', 'aggregation'],
            description: 'Metric query with dimension filters'
        });
        // Grouped metric template
        this.addTemplate({
            name: 'grouped_metric',
            query: '{metricName}[$interval]{{{filters}}}.{aggregation}() by ({groupBy})',
            variables: ['metricName', 'interval', 'filters', 'aggregation', 'groupBy'],
            description: 'Metric query with grouping by dimensions'
        });
        // Rate calculation template
        this.addTemplate({
            name: 'rate_metric',
            query: 'rate({metricName}[$interval]{{{filters}}})',
            variables: ['metricName', 'interval', 'filters'],
            description: 'Rate calculation for counter metrics'
        });
        // Percentile template
        this.addTemplate({
            name: 'percentile_metric',
            query: '{metricName}[$interval]{{{filters}}}.percentile({percentile})',
            variables: ['metricName', 'interval', 'filters', 'percentile'],
            description: 'Percentile calculation for metrics'
        });
    }
    /**
     * Parse MQL query string into structured query
     */
    parseMQL(queryString) {
        const query = {
            metricName: '',
            namespace: '',
            aggregation: 'mean'
        };
        // Remove whitespace and normalize
        const normalized = queryString.trim();
        // Extract metric name and window
        const metricMatch = normalized.match(/^([^[\]{}()]+)(\[[^\]]+\])?/);
        if (metricMatch) {
            query.metricName = metricMatch[1].trim();
            if (metricMatch[2]) {
                query.window = metricMatch[2].slice(1, -1); // Remove brackets
            }
        }
        // Extract dimensions/filters
        const dimensionsMatch = normalized.match(/\{([^}]+)\}/);
        if (dimensionsMatch) {
            query.dimensions = this.parseDimensions(dimensionsMatch[1]);
        }
        // Extract aggregation function
        const aggregationMatch = normalized.match(/\.(\w+)\(/);
        if (aggregationMatch) {
            query.aggregation = aggregationMatch[1];
        }
        // Extract groupBy
        const groupByMatch = normalized.match(/by\s*\(([^)]+)\)/);
        if (groupByMatch) {
            query.groupBy = groupByMatch[1].split(',').map(g => g.trim());
        }
        return query;
    }
    /**
     * Parse dimension filters from MQL string
     */
    parseDimensions(dimensionString) {
        const dimensions = {};
        // Split by comma, but respect quoted values
        const parts = dimensionString.match(/[^,]+/g) || [];
        for (const part of parts) {
            const trimmed = part.trim();
            const eqMatch = trimmed.match(/^([^=]+)=(.+)$/);
            if (eqMatch) {
                const key = eqMatch[1].trim();
                let value = eqMatch[2].trim();
                // Remove quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                dimensions[key] = value;
            }
        }
        return dimensions;
    }
    /**
     * Build MQL query string from structured query
     */
    buildMQL(query) {
        let mqlString = query.metricName;
        // Add window/interval
        if (query.window) {
            mqlString += `[${query.window}]`;
        }
        // Add dimensions
        if (query.dimensions && Object.keys(query.dimensions).length > 0) {
            const dimensionParts = Object.entries(query.dimensions)
                .map(([key, value]) => `${key}="${value}"`)
                .join(',');
            mqlString += `{${dimensionParts}}`;
        }
        // Add aggregation
        if (query.aggregation && query.aggregation !== 'rate') {
            if (query.aggregation === 'percentile') {
                mqlString += `.percentile(95)`; // Default percentile
            }
            else {
                mqlString += `.${query.aggregation}()`;
            }
        }
        else if (query.aggregation === 'rate') {
            mqlString = `rate(${mqlString})`;
        }
        // Add groupBy
        if (query.groupBy && query.groupBy.length > 0) {
            mqlString += ` by (${query.groupBy.join(', ')})`;
        }
        return mqlString;
    }
    /**
     * Resolve template variables in query string
     */
    resolveVariables(queryString, customValues) {
        let resolved = queryString;
        // Resolve template variables like $variable or ${variable}
        const variablePattern = /(\$\{([^}]+)\}|\$([a-zA-Z_][a-zA-Z0-9_]*))/g;
        resolved = resolved.replace(variablePattern, (match, fullMatch, bracketVar, simpleVar) => {
            const varName = bracketVar || simpleVar;
            // Check custom values first
            if (customValues && customValues[varName]) {
                return customValues[varName];
            }
            // Check registered variables
            const variable = this.variables.get(varName);
            if (variable && variable.value) {
                if (Array.isArray(variable.value)) {
                    return variable.value.join(',');
                }
                return String(variable.value);
            }
            // Handle special variables
            switch (varName) {
                case '__interval':
                case 'interval':
                    return this.resolveIntervalVariable();
                case '__range':
                    return '24h'; // Default range
                default:
                    return match; // Keep original if no resolution found
            }
        });
        return resolved;
    }
    /**
     * Resolve interval variable based on time range
     */
    resolveIntervalVariable() {
        const intervalVar = this.variables.get('interval');
        if (intervalVar?.value === 'auto') {
            // Auto-calculate based on time range
            // This would typically be based on dashboard time range
            return '1m'; // Default to 1 minute
        }
        return intervalVar?.value || '1m';
    }
    /**
     * Add template variable
     */
    addVariable(variable) {
        this.variables.set(variable.name, variable);
    }
    /**
     * Get template variable
     */
    getVariable(name) {
        return this.variables.get(name);
    }
    /**
     * List all variables
     */
    listVariables() {
        return Array.from(this.variables.values());
    }
    /**
     * Add query template
     */
    addTemplate(template) {
        this.templates.set(template.name, template);
    }
    /**
     * Get query template
     */
    getTemplate(name) {
        return this.templates.get(name);
    }
    /**
     * List all templates
     */
    listTemplates() {
        return Array.from(this.templates.values());
    }
    /**
     * Apply template with variable substitution
     */
    applyTemplate(templateName, variables) {
        const template = this.templates.get(templateName);
        if (!template) {
            throw new Error(`Template '${templateName}' not found`);
        }
        let query = template.query;
        // Replace template variables
        Object.entries(variables).forEach(([key, value]) => {
            const patterns = [
                new RegExp(`\\{${key}\\}`, 'g'),
                new RegExp(`\\$\\{${key}\\}`, 'g'),
                new RegExp(`\\$${key}\\b`, 'g')
            ];
            patterns.forEach(pattern => {
                query = query.replace(pattern, value);
            });
        });
        return query;
    }
    /**
     * Validate MQL query syntax
     */
    validateMQL(queryString) {
        const errors = [];
        try {
            const query = this.parseMQL(queryString);
            if (!query.metricName || query.metricName.trim() === '') {
                errors.push('Metric name is required');
            }
            if (query.aggregation && !this.isValidAggregation(query.aggregation)) {
                errors.push(`Invalid aggregation function: ${query.aggregation}`);
            }
            if (query.window && !this.isValidWindow(query.window)) {
                errors.push(`Invalid window format: ${query.window}`);
            }
        }
        catch (error) {
            errors.push(`Parse error: ${error instanceof Error ? error.message : String(error)}`);
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
    /**
     * Check if aggregation function is valid
     */
    isValidAggregation(aggregation) {
        const validAggregations = [
            'mean', 'sum', 'count', 'max', 'min', 'rate',
            'percentile', 'stddev', 'variance', 'absent', 'present'
        ];
        return validAggregations.includes(aggregation);
    }
    /**
     * Check if window format is valid
     */
    isValidWindow(window) {
        // Check for valid time formats: 1m, 5m, 1h, 1d, etc.
        return /^(\d+[smhd]|auto)$/.test(window);
    }
    /**
     * Convert relative time to absolute timestamps
     */
    resolveTimeRange(startTime, endTime) {
        const now = moment();
        let start;
        let end;
        // Parse start time
        if (startTime.match(/^\d+[smhd]$/)) {
            // Relative time (e.g., "24h", "1d")
            const value = parseInt(startTime);
            const unit = startTime.slice(-1);
            const unitMap = {
                's': 'seconds',
                'm': 'minutes',
                'h': 'hours',
                'd': 'days'
            };
            start = now.clone().subtract(value, unitMap[unit] || 'hours');
        }
        else {
            // Absolute time
            start = moment(startTime);
        }
        // Parse end time
        if (endTime) {
            if (endTime.match(/^\d+[smhd]$/)) {
                const value = parseInt(endTime);
                const unit = endTime.slice(-1);
                const unitMap = {
                    's': 'seconds',
                    'm': 'minutes',
                    'h': 'hours',
                    'd': 'days'
                };
                end = now.clone().subtract(value, unitMap[unit] || 'hours');
            }
            else {
                end = moment(endTime);
            }
        }
        else {
            end = now;
        }
        return {
            startTime: start.toISOString(),
            endTime: end.toISOString()
        };
    }
    /**
     * Generate query suggestions based on namespace
     */
    getQuerySuggestions(namespace) {
        const suggestions = [];
        const namespaceTemplates = {
            'oci_computeagent': [
                'CpuUtilization[5m].mean()',
                'MemoryUtilization[5m].max()',
                'NetworksBytesIn[1m].rate()',
                'DiskBytesRead[5m].sum() by (resourceId)'
            ],
            'oci_lbaas': [
                'RequestCount[1m].sum()',
                'ResponseTime[5m].percentile(95)',
                'ActiveConnections[1m].mean()',
                'HealthyBackendCount[1m].min()'
            ],
            'oci_vcn': [
                'VnicBytesIn[1m].rate()',
                'VnicBytesOut[1m].rate()',
                'PacketsIn[1m].sum()',
                'DroppedPacketsIn[5m].sum() by (resourceId)'
            ]
        };
        return namespaceTemplates[namespace] || [
            '{metricName}[5m].mean()',
            '{metricName}[1m].sum()',
            '{metricName}[1h].max()'
        ];
    }
    /**
     * Export configuration
     */
    exportConfig() {
        return {
            variables: Object.fromEntries(this.variables.entries()),
            templates: Object.fromEntries(this.templates.entries())
        };
    }
    /**
     * Import configuration
     */
    importConfig(config) {
        if (config.variables) {
            Object.entries(config.variables).forEach(([name, variable]) => {
                this.variables.set(name, variable);
            });
        }
        if (config.templates) {
            Object.entries(config.templates).forEach(([name, template]) => {
                this.templates.set(name, template);
            });
        }
    }
}
//# sourceMappingURL=MQLQueryEngine.js.map