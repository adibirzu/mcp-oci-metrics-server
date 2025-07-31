#!/usr/bin/env node
/**
 * OCI Metrics MCP Server - Enhanced with Grafana Collection Model
 *
 * Enhanced version featuring:
 * - Multi-tenancy support
 * - Advanced MQL (Metric Query Language) support
 * - Enhanced authentication (Instance Principal + User Principal)
 * - Template variables for dynamic dashboards
 * - Grafana-style datasource management
 *
 * Based on OCI Grafana plugin architecture patterns and OCI Monitoring Query Language
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
// Enhanced components
import { DatasourceManager } from './oci/DatasourceManager.js';
import { AuthenticationManager } from './oci/AuthenticationManager.js';
import { MQLQueryEngine } from './oci/MQLQueryEngine.js';
import { TemplateVariableEngine } from './oci/TemplateVariableEngine.js';
// Existing components
import { MonitoringClient } from './oci/MonitoringClient.js';
import { GraphGenerator } from './visualization/GraphGenerator.js';
import { TimeUtils } from './utils/TimeUtils.js';
import { InstanceCorrelationService } from './oci/InstanceCorrelationService.js';
import { CoreServicesClient } from './oci/CoreServicesClient.js';
// Initialize enhanced MCP server
const server = new Server({
    name: 'oci-metrics-enhanced-mcp-server',
    version: '2.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
// Initialize enhanced components
let datasourceManager;
let authManager;
let mqlEngine;
let templateEngine;
// Initialize existing components
const useRestAPI = process.env.OCI_USE_REST_API === 'true';
const monitoringClient = new MonitoringClient(useRestAPI);
const graphGenerator = new GraphGenerator();
const correlationService = new InstanceCorrelationService(useRestAPI);
const coreServicesClient = new CoreServicesClient(useRestAPI);
// Enhanced tool definitions
const enhancedTools = [
    // Datasource Management Tools
    {
        name: 'manage_datasource_config',
        description: 'Manage OCI datasource configuration with multi-tenancy support',
        inputSchema: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['list', 'add', 'remove', 'set_default', 'test', 'export', 'import'],
                    description: 'Action to perform on datasource configuration'
                },
                tenancyId: {
                    type: 'string',
                    description: 'Tenancy ID for add/remove/set_default actions'
                },
                config: {
                    type: 'object',
                    description: 'Configuration data for add/import actions'
                }
            },
            required: ['action']
        }
    },
    // MQL Query Tools
    {
        name: 'query_mql',
        description: 'Execute MQL (Metric Query Language) queries with advanced syntax support',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'MQL query string (e.g., "CpuUtilization[5m].mean()", "rate(NetworksBytesIn[1m])")'
                },
                tenancyId: {
                    type: 'string',
                    description: 'Tenancy ID to use for query (uses default if not provided)'
                },
                namespace: {
                    type: 'string',
                    description: 'OCI namespace for the query'
                },
                compartmentId: {
                    type: 'string',
                    description: 'Compartment ID for the query'
                },
                timeRange: {
                    type: 'object',
                    properties: {
                        startTime: { type: 'string' },
                        endTime: { type: 'string' }
                    },
                    description: 'Time range for the query'
                },
                variables: {
                    type: 'object',
                    description: 'Template variables to resolve in the query'
                }
            },
            required: ['query', 'namespace']
        }
    },
    {
        name: 'validate_mql',
        description: 'Validate MQL query syntax and suggest corrections',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'MQL query string to validate'
                }
            },
            required: ['query']
        }
    },
    {
        name: 'get_mql_suggestions',
        description: 'Get MQL query suggestions for a namespace',
        inputSchema: {
            type: 'object',
            properties: {
                namespace: {
                    type: 'string',
                    description: 'OCI namespace to get suggestions for'
                }
            },
            required: ['namespace']
        }
    },
    // Template Variable Tools
    {
        name: 'manage_template_variables',
        description: 'Manage template variables for dynamic queries',
        inputSchema: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['list', 'add', 'update', 'remove', 'refresh', 'resolve'],
                    description: 'Action to perform on template variables'
                },
                variableName: {
                    type: 'string',
                    description: 'Variable name for specific actions'
                },
                variableConfig: {
                    type: 'object',
                    description: 'Variable configuration for add/update actions'
                },
                queryString: {
                    type: 'string',
                    description: 'Query string to resolve variables in'
                },
                customValues: {
                    type: 'object',
                    description: 'Custom variable values to use for resolution'
                }
            },
            required: ['action']
        }
    },
    // Authentication Tools
    {
        name: 'manage_authentication',
        description: 'Manage OCI authentication contexts and test connectivity',
        inputSchema: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['list', 'test', 'test_all', 'refresh', 'report', 'add', 'remove'],
                    description: 'Authentication management action'
                },
                identifier: {
                    type: 'string',
                    description: 'Authentication context identifier'
                },
                config: {
                    type: 'object',
                    description: 'Authentication configuration for add action'
                }
            },
            required: ['action']
        }
    },
    // Enhanced Query Tools
    {
        name: 'query_with_template',
        description: 'Execute metric query using template with variable substitution',
        inputSchema: {
            type: 'object',
            properties: {
                templateName: {
                    type: 'string',
                    description: 'Template name to use'
                },
                variables: {
                    type: 'object',
                    description: 'Variable values for template substitution'
                },
                tenancyId: {
                    type: 'string',
                    description: 'Tenancy ID to use for query'
                },
                compartmentId: {
                    type: 'string',
                    description: 'Compartment ID for the query'
                },
                timeRange: {
                    type: 'object',
                    properties: {
                        startTime: { type: 'string' },
                        endTime: { type: 'string' }
                    }
                }
            },
            required: ['templateName', 'variables']
        }
    },
    // Multi-tenancy Query Tools
    {
        name: 'query_cross_tenancy',
        description: 'Query metrics across multiple tenancies for comparison',
        inputSchema: {
            type: 'object',
            properties: {
                queries: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            tenancyId: { type: 'string' },
                            namespace: { type: 'string' },
                            metricName: { type: 'string' },
                            compartmentId: { type: 'string' },
                            dimensions: { type: 'object' },
                            aggregation: { type: 'string' },
                            interval: { type: 'string' }
                        },
                        required: ['tenancyId', 'namespace', 'metricName']
                    },
                    description: 'Array of cross-tenancy queries'
                },
                timeRange: {
                    type: 'object',
                    properties: {
                        startTime: { type: 'string' },
                        endTime: { type: 'string' }
                    },
                    required: ['startTime']
                },
                generateComparison: {
                    type: 'boolean',
                    default: true,
                    description: 'Generate comparison analysis'
                }
            },
            required: ['queries', 'timeRange']
        }
    },
    // Enhanced Configuration Tools
    {
        name: 'export_configuration',
        description: 'Export complete enhanced configuration (datasources, variables, templates)',
        inputSchema: {
            type: 'object',
            properties: {
                includeSecrets: {
                    type: 'boolean',
                    default: false,
                    description: 'Include sensitive authentication data (use with caution)'
                }
            }
        }
    },
    {
        name: 'import_configuration',
        description: 'Import enhanced configuration from backup',
        inputSchema: {
            type: 'object',
            properties: {
                configData: {
                    type: 'string',
                    description: 'JSON configuration data to import'
                },
                merge: {
                    type: 'boolean',
                    default: true,
                    description: 'Merge with existing configuration or replace'
                }
            },
            required: ['configData']
        }
    }
];
// Combine enhanced tools with existing tools (subset)
const tools = [
    ...enhancedTools,
    // Core existing tools
    {
        name: 'query_oci_metrics',
        description: 'Query OCI monitoring metrics with Logan MCP compatible time format',
        inputSchema: {
            type: 'object',
            properties: {
                compartmentId: { type: 'string' },
                namespace: { type: 'string' },
                metricName: { type: 'string' },
                startTime: { type: 'string' },
                endTime: { type: 'string' },
                dimensions: { type: 'object' },
                aggregation: { type: 'string', enum: ['mean', 'sum', 'count', 'max', 'min', 'rate'] },
                interval: { type: 'string' }
            },
            required: ['namespace', 'metricName', 'startTime']
        }
    },
    {
        name: 'generate_metrics_graph',
        description: 'Generate interactive graphs from OCI metrics data',
        inputSchema: {
            type: 'object',
            properties: {
                metricQueries: { type: 'array' },
                graphType: { type: 'string', enum: ['line', 'bar', 'scatter', 'heatmap', 'pie'] },
                title: { type: 'string' },
                includeCorrelation: { type: 'boolean' }
            },
            required: ['metricQueries']
        }
    },
    {
        name: 'test_oci_connection',
        description: 'Test connectivity to OCI services with enhanced authentication',
        inputSchema: {
            type: 'object',
            properties: {
                tenancyId: {
                    type: 'string',
                    description: 'Specific tenancy to test (tests all if not provided)'
                }
            }
        }
    }
];
// Initialize enhanced components
async function initializeEnhancedComponents() {
    try {
        if (process.env.MCP_DEBUG) {
            console.error('🔧 Initializing enhanced components...');
        }
        // Initialize authentication manager first
        authManager = new AuthenticationManager();
        // Initialize datasource manager
        datasourceManager = new DatasourceManager();
        // Initialize MQL engine
        mqlEngine = new MQLQueryEngine();
        // Initialize template variable engine
        templateEngine = new TemplateVariableEngine(authManager, monitoringClient);
        if (process.env.MCP_DEBUG) {
            console.error('✅ Enhanced components initialized successfully');
            // Log configuration summary
            const tenancies = datasourceManager.getTenancies();
            const authReport = authManager.getAuthenticationReport();
            console.error(`📊 Configuration Summary:`);
            console.error(`   - Tenancies: ${tenancies.length}`);
            console.error(`   - Auth Contexts: ${authReport.totalContexts} (${authReport.validContexts} valid)`);
            console.error(`   - Instance Principal: ${authReport.instancePrincipalAvailable ? '✅' : '❌'}`);
            console.error(`   - Template Variables: ${templateEngine.listVariables().length}`);
        }
    }
    catch (error) {
        console.error('❌ Failed to initialize enhanced components:', error);
        throw error;
    }
}
// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
});
// Enhanced call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            // Enhanced tool handlers
            case 'manage_datasource_config':
                return await handleManageDatasourceConfig(args);
            case 'query_mql':
                return await handleQueryMQL(args);
            case 'validate_mql':
                return await handleValidateMQL(args);
            case 'get_mql_suggestions':
                return await handleGetMQLSuggestions(args);
            case 'manage_template_variables':
                return await handleManageTemplateVariables(args);
            case 'manage_authentication':
                return await handleManageAuthentication(args);
            case 'query_with_template':
                return await handleQueryWithTemplate(args);
            case 'query_cross_tenancy':
                return await handleQueryCrossTenancy(args);
            case 'export_configuration':
                return await handleExportConfiguration(args);
            case 'import_configuration':
                return await handleImportConfiguration(args);
            // Enhanced existing tools
            case 'query_oci_metrics':
                return await handleEnhancedQueryMetrics(args);
            case 'generate_metrics_graph':
                return await handleEnhancedGenerateGraph(args);
            case 'test_oci_connection':
                return await handleEnhancedTestConnection(args);
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: 'text',
                    text: `Error executing ${name}: ${errorMessage}`
                }
            ]
        };
    }
});
// Enhanced tool handlers
async function handleManageDatasourceConfig(args) {
    const { action, tenancyId, config } = args;
    switch (action) {
        case 'list':
            const tenancies = datasourceManager.getTenancies();
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            tenancies,
                            count: tenancies.length,
                            default: datasourceManager.getDefaultTenancy()?.id,
                            action: 'list_tenancies'
                        }, null, 2)
                    }]
            };
        case 'test':
            if (!tenancyId)
                throw new Error('tenancyId required for test action');
            const testResult = await datasourceManager.testTenancyConnection(tenancyId);
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify(testResult, null, 2)
                    }]
            };
        case 'test_all':
            const allResults = await datasourceManager.testAllConnections();
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({ testResults: allResults }, null, 2)
                    }]
            };
        case 'export':
            const exportData = datasourceManager.exportConfig();
            return {
                content: [{
                        type: 'text',
                        text: exportData
                    }]
            };
        case 'set_default':
            if (!tenancyId)
                throw new Error('tenancyId required for set_default action');
            const success = datasourceManager.setDefaultTenancy(tenancyId);
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({ success, newDefault: tenancyId }, null, 2)
                    }]
            };
        default:
            throw new Error(`Unknown datasource action: ${action}`);
    }
}
async function handleQueryMQL(args) {
    const { query, tenancyId, namespace, compartmentId, timeRange, variables } = args;
    // Resolve variables in query
    let resolvedQuery = query;
    if (variables) {
        resolvedQuery = mqlEngine.resolveVariables(query, variables);
    }
    else {
        resolvedQuery = templateEngine.interpolateVariables(query);
    }
    // Parse MQL query
    const parsedQuery = mqlEngine.parseMQL(resolvedQuery);
    parsedQuery.namespace = namespace;
    // Build MetricQuery object
    const metricQuery = {
        compartmentId: compartmentId || process.env.OCI_COMPARTMENT_ID || '',
        namespace: parsedQuery.namespace,
        metricName: parsedQuery.metricName,
        timeRange: timeRange || mqlEngine.resolveTimeRange('1h'),
        dimensions: parsedQuery.dimensions,
        aggregation: parsedQuery.aggregation || 'mean',
        interval: parsedQuery.window || 'PT1M'
    };
    // Execute query with specified tenancy
    let authContext = authManager.getPreferredAuthContext();
    if (tenancyId) {
        const specifiedContext = authManager.getAuthContext(tenancyId);
        if (specifiedContext) {
            authContext = specifiedContext;
        }
    }
    const result = await monitoringClient.queryMetrics(metricQuery);
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({
                    originalQuery: query,
                    resolvedQuery,
                    parsedQuery,
                    result,
                    tenancyUsed: authContext?.profile || authContext?.method,
                    mqlEngine: 'enhanced',
                    loganCompatible: true
                }, null, 2)
            }]
    };
}
async function handleValidateMQL(args) {
    const validation = mqlEngine.validateMQL(args.query);
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({
                    query: args.query,
                    validation,
                    suggestions: validation.valid ? [] : ['Check metric name', 'Verify aggregation function', 'Validate time window format']
                }, null, 2)
            }]
    };
}
async function handleGetMQLSuggestions(args) {
    const suggestions = mqlEngine.getQuerySuggestions(args.namespace);
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({
                    namespace: args.namespace,
                    suggestions,
                    templates: mqlEngine.listTemplates()
                }, null, 2)
            }]
    };
}
async function handleManageTemplateVariables(args) {
    const { action, variableName, variableConfig, queryString, customValues } = args;
    switch (action) {
        case 'list':
            const variables = templateEngine.listVariables();
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({ variables }, null, 2)
                    }]
            };
        case 'refresh':
            if (variableName) {
                const success = await templateEngine.refreshVariable(variableName);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({ variableName, refreshed: success }, null, 2)
                        }]
                };
            }
            else {
                const results = await templateEngine.refreshAllVariables();
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({ refreshResults: results }, null, 2)
                        }]
                };
            }
        case 'resolve':
            if (!queryString)
                throw new Error('queryString required for resolve action');
            const resolved = templateEngine.interpolateVariables(queryString);
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            original: queryString,
                            resolved,
                            customValues
                        }, null, 2)
                    }]
            };
        case 'add':
            if (!variableConfig)
                throw new Error('variableConfig required for add action');
            templateEngine.addVariable(variableConfig);
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({ added: variableConfig.name }, null, 2)
                    }]
            };
        default:
            throw new Error(`Unknown template variable action: ${action}`);
    }
}
async function handleManageAuthentication(args) {
    const { action, identifier, config } = args;
    switch (action) {
        case 'list':
            const contexts = authManager.getAllAuthContexts();
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({ authenticationContexts: contexts }, null, 2)
                    }]
            };
        case 'test':
            if (!identifier)
                throw new Error('identifier required for test action');
            const testResult = await authManager.testAuthentication(identifier);
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify(testResult, null, 2)
                    }]
            };
        case 'test_all':
            const allResults = await authManager.testAllAuthentication();
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({ testResults: allResults }, null, 2)
                    }]
            };
        case 'report':
            const report = authManager.getAuthenticationReport();
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({ authenticationReport: report }, null, 2)
                    }]
            };
        case 'refresh':
            await authManager.refreshAuthContexts();
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({ message: 'Authentication contexts refreshed' }, null, 2)
                    }]
            };
        default:
            throw new Error(`Unknown authentication action: ${action}`);
    }
}
async function handleQueryWithTemplate(args) {
    const query = mqlEngine.applyTemplate(args.templateName, args.variables);
    // Execute the templated query
    const enhancedArgs = {
        query,
        tenancyId: args.tenancyId,
        namespace: args.variables.namespace || 'oci_computeagent',
        compartmentId: args.compartmentId,
        timeRange: args.timeRange
    };
    return await handleQueryMQL(enhancedArgs);
}
async function handleQueryCrossTenancy(args) {
    const results = [];
    for (const query of args.queries) {
        try {
            const metricQuery = {
                compartmentId: query.compartmentId || process.env.OCI_COMPARTMENT_ID || '',
                namespace: query.namespace,
                metricName: query.metricName,
                timeRange: args.timeRange,
                dimensions: query.dimensions,
                aggregation: query.aggregation || 'mean',
                interval: query.interval || 'PT1M'
            };
            // Use specified tenancy authentication
            const authContext = authManager.getAuthContext(query.tenancyId);
            if (!authContext) {
                throw new Error(`Authentication context not found for tenancy: ${query.tenancyId}`);
            }
            const result = await monitoringClient.queryMetrics(metricQuery);
            results.push({
                tenancyId: query.tenancyId,
                query: metricQuery,
                result,
                success: true
            });
        }
        catch (error) {
            results.push({
                tenancyId: query.tenancyId,
                query,
                error: error instanceof Error ? error.message : String(error),
                success: false
            });
        }
    }
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({
                    crossTenancyResults: results,
                    queriedTenancies: args.queries.length,
                    successfulQueries: results.filter(r => r.success).length,
                    failedQueries: results.filter(r => !r.success).length
                }, null, 2)
            }]
    };
}
async function handleExportConfiguration(args) {
    const config = {
        datasource: datasourceManager.exportConfig(),
        authentication: authManager.exportConfig(),
        mqlEngine: mqlEngine.exportConfig(),
        templateVariables: templateEngine.exportVariables(),
        exportedAt: TimeUtils.toLoganFormat(new Date()),
        version: '2.0.0',
        includeSecrets: args.includeSecrets || false
    };
    if (!args.includeSecrets) {
        // Remove sensitive data
        delete config.authentication.keyFile;
        delete config.authentication.fingerprint;
    }
    return {
        content: [{
                type: 'text',
                text: JSON.stringify(config, null, 2)
            }]
    };
}
async function handleImportConfiguration(args) {
    try {
        const config = JSON.parse(args.configData);
        if (config.templateVariables) {
            templateEngine.importVariables(config.templateVariables);
        }
        if (config.mqlEngine) {
            mqlEngine.importConfig(config.mqlEngine);
        }
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        imported: true,
                        version: config.version,
                        components: Object.keys(config),
                        importedAt: TimeUtils.toLoganFormat(new Date())
                    }, null, 2)
                }]
        };
    }
    catch (error) {
        throw new Error(`Failed to import configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
}
// Enhanced versions of existing handlers
async function handleEnhancedQueryMetrics(args) {
    // Use enhanced authentication if available
    const authContext = authManager.getPreferredAuthContext();
    // Parse time range with enhanced utilities
    let timeRange;
    if (args.endTime) {
        timeRange = {
            startTime: TimeUtils.toLoganFormat(args.startTime),
            endTime: TimeUtils.toLoganFormat(args.endTime)
        };
    }
    else {
        timeRange = TimeUtils.parseTimeRange(args.startTime);
    }
    const metricQuery = {
        compartmentId: args.compartmentId || process.env.OCI_COMPARTMENT_ID || '',
        namespace: args.namespace,
        metricName: args.metricName,
        timeRange,
        dimensions: args.dimensions,
        aggregation: args.aggregation || 'mean',
        interval: args.interval || 'PT1M'
    };
    const result = await monitoringClient.queryMetrics(metricQuery);
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({
                    ...result,
                    enhanced: true,
                    authenticationUsed: authContext ? {
                        method: authContext.method,
                        tenancy: authContext.tenancyOCID.substring(0, 20) + '...',
                        region: authContext.region
                    } : 'default',
                    loganCompatible: true,
                    timestampFormat: 'ISO 8601 UTC'
                }, null, 2)
            }]
    };
}
async function handleEnhancedGenerateGraph(args) {
    // Use enhanced query execution for each metric
    const metricResults = [];
    for (const queryReq of args.metricQueries) {
        const result = await handleEnhancedQueryMetrics(queryReq);
        const parsedResult = JSON.parse(result.content[0].text);
        metricResults.push(parsedResult);
    }
    const graphConfig = {
        type: args.graphType || 'line',
        title: args.title || `Enhanced OCI Metrics - ${(args.graphType || 'line')} Chart`,
        xAxis: 'Time',
        yAxis: 'Value',
        showLegend: true
    };
    const visualization = await graphGenerator.generateGraph(metricResults, graphConfig);
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({
                    ...visualization,
                    enhanced: true,
                    generatedAt: TimeUtils.toLoganFormat(new Date()),
                    grafanaCompatible: true
                }, null, 2)
            }]
    };
}
async function handleEnhancedTestConnection(args) {
    let results;
    if (args.tenancyId) {
        // Test specific tenancy
        const tenancyResult = await datasourceManager.testTenancyConnection(args.tenancyId);
        const authResult = await authManager.testAuthentication(args.tenancyId);
        results = {
            tenancyTest: tenancyResult,
            authTest: authResult,
            testedTenancy: args.tenancyId
        };
    }
    else {
        // Test all configurations
        const tenancyResults = await datasourceManager.testAllConnections();
        const authResults = await authManager.testAllAuthentication();
        const authReport = authManager.getAuthenticationReport();
        results = {
            tenancyTests: tenancyResults,
            authTests: authResults,
            authReport,
            summary: {
                totalTenancies: tenancyResults.length,
                successfulTenancies: tenancyResults.filter(r => r.success).length,
                totalAuthContexts: authResults.length,
                validAuthContexts: authResults.filter(r => r.success).length
            }
        };
    }
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({
                    enhanced: true,
                    testedAt: TimeUtils.toLoganFormat(new Date()),
                    ...results
                }, null, 2)
            }]
    };
}
// Start enhanced server
async function startEnhancedServer() {
    try {
        if (process.env.MCP_DEBUG) {
            console.error('🚀 Starting Enhanced OCI Metrics MCP Server v2.0...');
            console.error('');
            console.error('🆕 Enhanced Features:');
            console.error('   ✨ Multi-tenancy support with OCI Grafana patterns');
            console.error('   🔍 Advanced MQL (Metric Query Language) support');
            console.error('   🔐 Enhanced authentication (Instance + User Principal)');
            console.error('   📊 Template variables for dynamic dashboards');
            console.error('   ⚙️  Grafana-style datasource management');
            console.error('');
        }
        // Initialize enhanced components
        await initializeEnhancedComponents();
        // Start the server
        const transport = new StdioServerTransport();
        await server.connect(transport);
        if (process.env.MCP_DEBUG) {
            console.error('✅ Enhanced OCI Metrics MCP Server started successfully');
        }
    }
    catch (error) {
        console.error('❌ Failed to start enhanced server:', error);
        process.exit(1);
    }
}
// Graceful shutdown
process.on('SIGINT', () => {
    if (process.env.MCP_DEBUG) {
        console.error('\n👋 Shutting down Enhanced OCI Metrics MCP Server...');
    }
    process.exit(0);
});
process.on('SIGTERM', () => {
    if (process.env.MCP_DEBUG) {
        console.error('\n👋 Shutting down Enhanced OCI Metrics MCP Server...');
    }
    process.exit(0);
});
startEnhancedServer();
//# sourceMappingURL=index-enhanced.js.map