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
        // Alarm condition template
        this.addTemplate({
            name: 'alarm_condition',
            query: '{metricName}[$interval]{{{filters}}}.{aggregation}() {operator} {threshold}',
            variables: ['metricName', 'interval', 'filters', 'aggregation', 'operator', 'threshold'],
            description: 'Alarm condition with threshold comparison'
        });
        // Absence alarm template
        this.addTemplate({
            name: 'absence_alarm',
            query: '{metricName}[$interval]{{{filters}}}.groupBy({groupBy}).absent({duration})',
            variables: ['metricName', 'interval', 'filters', 'groupBy', 'duration'],
            description: 'Absence alarm for detecting missing metrics'
        });
        // Fuzzy matching template
        this.addTemplate({
            name: 'fuzzy_match',
            query: '{metricName}[$interval]{{resourceDisplayName =~ "{pattern}"}}.{aggregation}()',
            variables: ['metricName', 'interval', 'pattern', 'aggregation'],
            description: 'Fuzzy matching query with wildcards'
        });
        // Join query template
        this.addTemplate({
            name: 'join_query',
            query: '{metric1}[$interval].{aggregation1}() {joinOperator} {metric2}[$interval].{aggregation2}()',
            variables: ['metric1', 'metric2', 'interval', 'aggregation1', 'aggregation2', 'joinOperator'],
            description: 'Join two metrics with AND/OR operators'
        });
        // Unit conversion template
        this.addTemplate({
            name: 'unit_conversion',
            query: '{metricName}[$interval].{aggregation}() / {conversionFactor}',
            variables: ['metricName', 'interval', 'aggregation', 'conversionFactor'],
            description: 'Convert metric units (e.g., milliseconds to seconds)'
        });
    }
    /**
     * Parse MQL query string into structured query with enhanced OCI MQL support
     */
    parseMQL(queryString) {
        const query = {
            metricName: '',
            namespace: '',
            aggregation: 'mean'
        };
        // Remove whitespace and normalize
        let normalized = queryString.trim();
        // Check for join operators (&&, ||)
        const joinMatch = normalized.match(/(.*?)\s*(&&|\|\|)\s*(.*)/);
        if (joinMatch) {
            query.joinOperator = joinMatch[2];
            // For now, parse the first part of the join
            normalized = joinMatch[1].trim();
        }
        // Check for arithmetic operations (+, -, *, /, %)
        const arithmeticMatch = normalized.match(/(.*?)\s*([+\-*/%])\s*(.*)/);
        if (arithmeticMatch) {
            query.arithmeticOperations = [arithmeticMatch[2]];
            // For now, parse the first part
            normalized = arithmeticMatch[1].trim();
        }
        // Check for rate() wrapper function
        const rateMatch = normalized.match(/^rate\((.*)\)$/);
        if (rateMatch) {
            query.aggregation = 'rate';
            normalized = rateMatch[1];
        }
        // Extract metric name and window
        const metricMatch = normalized.match(/^([^[\]{}()]+)(\[[^\]]+\])?/);
        if (metricMatch) {
            query.metricName = metricMatch[1].trim();
            if (metricMatch[2]) {
                query.window = metricMatch[2].slice(1, -1); // Remove brackets
            }
        }
        // Extract dimensions/filters with enhanced operators
        const dimensionsMatch = normalized.match(/\{([^}]+)\}/);
        if (dimensionsMatch) {
            query.dimensions = this.parseDimensions(dimensionsMatch[1]);
            query.filters = this.parseFilters(dimensionsMatch[1]);
            // Check for fuzzy matching patterns
            query.fuzzyMatching = dimensionsMatch[1].includes('=~') ||
                dimensionsMatch[1].includes('*') ||
                dimensionsMatch[1].includes('|');
        }
        // Extract aggregation function with parameters
        const aggregationMatch = normalized.match(/\.(\w+)\((\d*)\)/);
        if (aggregationMatch && !rateMatch) {
            query.aggregation = aggregationMatch[1];
            // Handle percentile parameter
            if (query.aggregation === 'percentile' && aggregationMatch[2]) {
                query.percentileValue = parseInt(aggregationMatch[2]);
            }
        }
        // Extract groupBy with grouping() and groupBy() functions
        const groupByMatch = normalized.match(/\.(grouping|groupBy)\(([^)]+)\)|by\s*\(([^)]+)\)/);
        if (groupByMatch) {
            const groupByString = groupByMatch[2] || groupByMatch[3];
            query.groupBy = groupByString.split(',').map(g => g.trim());
        }
        // Extract absence conditions
        const absenceMatch = normalized.match(/\.absent\((\d*[smhd]?)\)/);
        if (absenceMatch) {
            query.aggregation = 'absent';
            query.absencePeriod = absenceMatch[1] || '5m';
        }
        // Extract comparison operators for alarm conditions
        const comparisonMatch = normalized.match(/\s*([><=!]+)\s*(\d+(?:\.\d+)?)/);
        if (comparisonMatch) {
            query.alarmConditions = [{
                    operator: comparisonMatch[1],
                    threshold: parseFloat(comparisonMatch[2])
                }];
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
            // Handle various operators: =, !=, =~, !~
            const opMatch = trimmed.match(/^([^=!~]+)(=~|!~|!=|=)(.+)$/);
            if (opMatch) {
                const key = opMatch[1].trim();
                const operator = opMatch[2];
                let value = opMatch[3].trim();
                // Remove quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                // For basic dimensions, only store exact matches
                if (operator === '=') {
                    dimensions[key] = value;
                }
            }
        }
        return dimensions;
    }
    /**
     * Parse advanced filters from MQL dimension string
     */
    parseFilters(dimensionString) {
        const filters = [];
        // Split by comma, but respect quoted values
        const parts = dimensionString.match(/[^,]+/g) || [];
        for (const part of parts) {
            const trimmed = part.trim();
            // Match various operators with enhanced support
            const opMatch = trimmed.match(/^([^=!~<>]+)(=~|!~|!=|=|>=|<=|>|<|\s+in\s+|\s+not\s+in\s+)(.+)$/);
            if (opMatch) {
                const dimension = opMatch[1].trim();
                let operator = opMatch[2].trim();
                let value = opMatch[3].trim();
                // Handle 'in' and 'not in' operators
                if (operator.includes('in')) {
                    operator = operator.includes('not') ? 'not in' : 'in';
                    // Parse array values: "value1|value2|value3"
                    if (value.includes('|')) {
                        value = value.split('|').map(v => v.trim().replace(/["']/g, ''));
                    }
                }
                else {
                    // Remove quotes
                    if ((value.startsWith('"') && value.endsWith('"')) ||
                        (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }
                    // Convert to number for comparison operators
                    if (['>', '<', '>=', '<='].includes(operator) && !isNaN(Number(value))) {
                        value = Number(value);
                    }
                }
                filters.push({
                    dimension,
                    operator,
                    value
                });
            }
        }
        return filters;
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
     * Check if aggregation function is valid for OCI MQL
     */
    isValidAggregation(aggregation) {
        const validAggregations = [
            'mean', 'sum', 'count', 'max', 'min', 'rate',
            'percentile', 'stddev', 'variance', 'absent', 'present',
            'stddev_over_time', 'changes', 'resets'
        ];
        return validAggregations.includes(aggregation);
    }
    /**
     * Check if window format is valid for OCI MQL
     */
    isValidWindow(window) {
        // OCI MQL supports: 1m-60m, 1h-24h, 1d
        if (window === 'auto')
            return true;
        const minuteMatch = window.match(/^(\d+)m$/);
        if (minuteMatch) {
            const minutes = parseInt(minuteMatch[1]);
            return minutes >= 1 && minutes <= 60;
        }
        const hourMatch = window.match(/^(\d+)h$/);
        if (hourMatch) {
            const hours = parseInt(hourMatch[1]);
            return hours >= 1 && hours <= 24;
        }
        return /^1d$/.test(window);
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
     * Generate enhanced OCI MQL query suggestions based on namespace
     */
    getQuerySuggestions(namespace) {
        const suggestions = [];
        const namespaceTemplates = {
            'oci_computeagent': [
                // Basic aggregations
                'CpuUtilization[5m].mean()',
                'MemoryUtilization[5m].max()',
                'NetworksBytesIn[1m].rate()',
                'DiskBytesRead[5m].sum() by (resourceId)',
                // Advanced queries
                'CpuUtilization[5m].percentile(95)',
                'CpuUtilization[1m]{resourceDisplayName =~ "prod*"}.mean()',
                'CpuUtilization[5m].mean() > 80',
                'MemoryUtilization[1m].absent(5m)',
                'CpuUtilization[1m].mean() && MemoryUtilization[1m].mean()'
            ],
            'oci_lbaas': [
                'RequestCount[1m].sum()',
                'ResponseTime[5m].percentile(95)',
                'ActiveConnections[1m].mean()',
                'HealthyBackendCount[1m].min()',
                // Advanced load balancer queries
                'RequestCount[1m].sum() by (backendSetName)',
                'ResponseTime[5m]{backendSetName = "web-backend"}.percentile(99)',
                'HealthyBackendCount[1m].min() < 2'
            ],
            'oci_vcn': [
                'VnicBytesIn[1m].rate()',
                'VnicBytesOut[1m].rate()',
                'PacketsIn[1m].sum()',
                'DroppedPacketsIn[5m].sum() by (resourceId)',
                // Network-specific queries
                'VnicBytesIn[1m].rate() + VnicBytesOut[1m].rate()',
                'DroppedPacketsIn[5m].sum() > 100'
            ],
            'oci_database': [
                'CpuUtilization[5m].mean()',
                'DatabaseConnections[1m].count()',
                'StorageUtilization[1h].max()',
                'DatabaseConnections[1m].count() > 80'
            ],
            'oci_objectstorage': [
                'TotalRequestLatency[1m].percentile(95)',
                'RequestCount[1m].sum()',
                'TotalRequestLatency[1m].mean() / 1000', // Convert to seconds
                'RequestCount[1m]{bucketName =~ "backup*"}.sum()'
            ]
        };
        const templates = namespaceTemplates[namespace] || [
            '{metricName}[5m].mean()',
            '{metricName}[1m].sum()',
            '{metricName}[1h].max()',
            '{metricName}[5m].percentile(95)',
            '{metricName}[1m].absent()',
            'rate({metricName}[1m])'
        ];
        // Add common OCI MQL patterns
        const commonPatterns = [
            '// Alarm condition examples:',
            '{metricName}[5m].mean() > {threshold}',
            '{metricName}[1m].absent({duration})',
            '{metricName}[5m]{dimension = "value"}.percentile(95)',
            '// Fuzzy matching examples:',
            '{metricName}[1m]{resourceDisplayName =~ "pattern*"}.mean()',
            '{metricName}[5m]{resourceId in "id1|id2|id3"}.sum()',
            '// Join operations:',
            '{metric1}[1m].mean() && {metric2}[1m].mean()',
            '{metric1}[1m].mean() || {metric2}[1m].mean()'
        ];
        return [...templates, ...commonPatterns];
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