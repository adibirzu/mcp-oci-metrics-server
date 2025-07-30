#!/usr/bin/env node
/**
 * OCI Metrics MCP Server (Standard MCP SDK)
 *
 * A MCP server that provides OCI monitoring metrics with graph generation capabilities.
 * Compatible with Logan MCP for time correlation and anomaly detection data preparation.
 *
 * Prerequisites:
 * - OCI CLI installed and configured
 * - OCI config file at ~/.oci/config
 * - Appropriate OCI permissions for monitoring service
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { MonitoringClient } from './oci/MonitoringClient.js';
import { GraphGenerator } from './visualization/GraphGenerator.js';
import { TimeUtils } from './utils/TimeUtils.js';
import { InstanceCorrelationService } from './oci/InstanceCorrelationService.js';
import { CoreServicesClient } from './oci/CoreServicesClient.js';
// Initialize MCP server
const server = new Server({
    name: 'oci-metrics-mcp-server',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
// Initialize clients (check environment variable for REST API preference)
const useRestAPI = process.env.OCI_USE_REST_API === 'true';
const monitoringClient = new MonitoringClient(useRestAPI);
const restApiClient = useRestAPI ? new MonitoringClient(true) : null;
const graphGenerator = new GraphGenerator();
const correlationService = new InstanceCorrelationService(useRestAPI);
const coreServicesClient = new CoreServicesClient(useRestAPI);
// Initialize monitoring client configuration
async function initializeClient() {
    // MonitoringClient will initialize its own config when first used
}
// Tool definitions
const tools = [
    {
        name: 'query_oci_metrics',
        description: 'Query OCI monitoring metrics with Logan MCP compatible time format for correlation analysis',
        inputSchema: {
            type: 'object',
            properties: {
                compartmentId: {
                    type: 'string',
                    description: 'OCI compartment ID (uses default if not provided)'
                },
                namespace: {
                    type: 'string',
                    description: 'OCI monitoring namespace (e.g., oci_computeagent, oci_lbaas)'
                },
                metricName: {
                    type: 'string',
                    description: 'Metric name to query'
                },
                startTime: {
                    type: 'string',
                    description: 'Start time (ISO 8601 or relative like "1h", "24h", "7d")'
                },
                endTime: {
                    type: 'string',
                    description: 'End time (ISO 8601, defaults to now)'
                },
                dimensions: {
                    type: 'object',
                    description: 'Metric dimensions filter',
                    additionalProperties: { type: 'string' }
                },
                aggregation: {
                    type: 'string',
                    enum: ['mean', 'sum', 'count', 'max', 'min', 'rate'],
                    default: 'mean',
                    description: 'Aggregation method'
                },
                interval: {
                    type: 'string',
                    default: 'PT1M',
                    description: 'Data interval (PT1M, PT5M, PT1H, etc.)'
                }
            },
            required: ['namespace', 'metricName', 'startTime']
        }
    },
    {
        name: 'generate_metrics_graph',
        description: 'Generate interactive graphs from OCI metrics data for display in GenAI chat',
        inputSchema: {
            type: 'object',
            properties: {
                metricQueries: {
                    type: 'array',
                    description: 'Array of metric queries to visualize',
                    items: {
                        type: 'object',
                        properties: {
                            compartmentId: { type: 'string' },
                            namespace: { type: 'string' },
                            metricName: { type: 'string' },
                            startTime: { type: 'string' },
                            endTime: { type: 'string' },
                            dimensions: { type: 'object', additionalProperties: { type: 'string' } },
                            aggregation: { type: 'string', enum: ['mean', 'sum', 'count', 'max', 'min', 'rate'] },
                            interval: { type: 'string' }
                        },
                        required: ['namespace', 'metricName', 'startTime']
                    }
                },
                graphType: {
                    type: 'string',
                    enum: ['line', 'bar', 'scatter', 'heatmap', 'pie'],
                    default: 'line',
                    description: 'Type of graph to generate'
                },
                title: {
                    type: 'string',
                    description: 'Graph title'
                },
                includeCorrelation: {
                    type: 'boolean',
                    default: false,
                    description: 'Include correlation analysis'
                },
                ipAddresses: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'IP addresses for Logan correlation'
                }
            },
            required: ['metricQueries']
        }
    },
    {
        name: 'list_oci_namespaces',
        description: 'List available OCI monitoring namespaces for metric discovery',
        inputSchema: {
            type: 'object',
            properties: {
                compartmentId: {
                    type: 'string',
                    description: 'Compartment ID (uses default if not provided)'
                }
            }
        }
    },
    {
        name: 'list_namespace_metrics',
        description: 'List available metrics in a specific OCI monitoring namespace',
        inputSchema: {
            type: 'object',
            properties: {
                compartmentId: {
                    type: 'string',
                    description: 'Compartment ID (uses default if not provided)'
                },
                namespace: {
                    type: 'string',
                    description: 'Namespace to list metrics from'
                }
            },
            required: ['namespace']
        }
    },
    {
        name: 'prepare_anomaly_detection_data',
        description: 'Prepare OCI metrics data for anomaly detection analysis (for Data Science MCP)',
        inputSchema: {
            type: 'object',
            properties: {
                metricQueries: {
                    type: 'array',
                    description: 'Metrics to prepare for anomaly detection',
                    items: {
                        type: 'object',
                        properties: {
                            compartmentId: { type: 'string' },
                            namespace: { type: 'string' },
                            metricName: { type: 'string' },
                            startTime: { type: 'string' },
                            endTime: { type: 'string' },
                            dimensions: { type: 'object', additionalProperties: { type: 'string' } },
                            aggregation: { type: 'string' },
                            interval: { type: 'string' }
                        },
                        required: ['namespace', 'metricName', 'startTime']
                    }
                },
                includeContext: {
                    type: 'boolean',
                    default: true,
                    description: 'Include contextual metadata'
                },
                timeWindow: {
                    type: 'string',
                    description: 'Time window for analysis (e.g., "1h", "24h")'
                }
            },
            required: ['metricQueries']
        }
    },
    {
        name: 'test_oci_connection',
        description: 'Test connectivity to OCI Monitoring service and validate configuration',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'query_compute_agent_metrics',
        description: 'Query OCI Compute Agent metrics for specific instances (CPU, Memory, Network)',
        inputSchema: {
            type: 'object',
            properties: {
                instanceId: {
                    type: 'string',
                    description: 'OCI Compute instance OCID'
                },
                metricName: {
                    type: 'string',
                    description: 'Metric name (e.g., CpuUtilization, MemoryUtilization, NetworksBytesIn)'
                },
                startTime: {
                    type: 'string',
                    description: 'Start time (ISO 8601 or relative like "1h", "24h")'
                },
                endTime: {
                    type: 'string',
                    description: 'End time (ISO 8601, defaults to now)'
                },
                interval: {
                    type: 'string',
                    default: 'PT1M',
                    description: 'Data interval (PT1M, PT5M, PT1H, etc.)'
                }
            },
            required: ['instanceId', 'metricName', 'startTime']
        }
    },
    {
        name: 'query_stack_monitoring_metrics',
        description: 'Query OCI Stack Monitoring metrics for managed resources (requires REST API)',
        inputSchema: {
            type: 'object',
            properties: {
                resourceId: {
                    type: 'string',
                    description: 'Stack Monitoring resource OCID'
                },
                metricName: {
                    type: 'string',
                    description: 'Stack Monitoring metric name'
                },
                startTime: {
                    type: 'string',
                    description: 'Start time (ISO 8601 or relative like "1h", "24h")'
                },
                endTime: {
                    type: 'string',
                    description: 'End time (ISO 8601, defaults to now)'
                }
            },
            required: ['resourceId', 'metricName', 'startTime']
        }
    },
    {
        name: 'query_db_management_metrics',
        description: 'Query OCI Database Management metrics (requires REST API)',
        inputSchema: {
            type: 'object',
            properties: {
                databaseId: {
                    type: 'string',
                    description: 'Managed Database OCID'
                },
                metricName: {
                    type: 'string',
                    description: 'Database metric name'
                },
                startTime: {
                    type: 'string',
                    description: 'Start time (ISO 8601 or relative like "1h", "24h")'
                },
                endTime: {
                    type: 'string',
                    description: 'End time (ISO 8601, defaults to now)'
                }
            },
            required: ['databaseId', 'metricName', 'startTime']
        }
    },
    {
        name: 'query_ops_insights_metrics',
        description: 'Query OCI Operations Insights metrics for database performance (requires REST API)',
        inputSchema: {
            type: 'object',
            properties: {
                resourceId: {
                    type: 'string',
                    description: 'Database resource OCID for OPS Insights'
                },
                metricName: {
                    type: 'string',
                    description: 'OPS Insights metric name'
                },
                startTime: {
                    type: 'string',
                    description: 'Start time (ISO 8601 or relative like "1h", "24h")'
                },
                endTime: {
                    type: 'string',
                    description: 'End time (ISO 8601, defaults to now)'
                }
            },
            required: ['resourceId', 'metricName', 'startTime']
        }
    },
    {
        name: 'get_instance_correlations',
        description: 'Get instance Name/IP/OCID correlations for Logan log analysis',
        inputSchema: {
            type: 'object',
            properties: {
                compartmentId: {
                    type: 'string',
                    description: 'OCI compartment ID (uses default if not provided)'
                },
                includeIPs: {
                    type: 'boolean',
                    default: true,
                    description: 'Include IP address mappings'
                }
            }
        }
    },
    {
        name: 'find_instances_by_ip',
        description: 'Find compute instances by IP address for Logan correlation',
        inputSchema: {
            type: 'object',
            properties: {
                ipAddresses: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of IP addresses to search for'
                },
                compartmentId: {
                    type: 'string',
                    description: 'OCI compartment ID (uses default if not provided)'
                }
            },
            required: ['ipAddresses']
        }
    },
    {
        name: 'find_instances_by_name',
        description: 'Find compute instances by name pattern for Logan correlation',
        inputSchema: {
            type: 'object',
            properties: {
                namePattern: {
                    type: 'string',
                    description: 'Name pattern to search for (case-insensitive)'
                },
                compartmentId: {
                    type: 'string',
                    description: 'OCI compartment ID (uses default if not provided)'
                }
            },
            required: ['namePattern']
        }
    },
    {
        name: 'generate_logan_correlation_data',
        description: 'Generate Logan-compatible correlation data for log analysis',
        inputSchema: {
            type: 'object',
            properties: {
                startTime: {
                    type: 'string',
                    description: 'Start time for correlation window (ISO 8601 or relative like "1h", "24h")'
                },
                endTime: {
                    type: 'string',
                    description: 'End time for correlation window (ISO 8601, defaults to now)'
                },
                compartmentId: {
                    type: 'string',
                    description: 'OCI compartment ID (uses default if not provided)'
                },
                includeMetrics: {
                    type: 'boolean',
                    default: false,
                    description: 'Include basic compute metrics for correlation'
                }
            },
            required: ['startTime']
        }
    },
    {
        name: 'get_instance_details',
        description: 'Get comprehensive instance details including configuration, volumes, and network info',
        inputSchema: {
            type: 'object',
            properties: {
                instanceId: {
                    type: 'string',
                    description: 'OCI Compute instance OCID'
                },
                compartmentId: {
                    type: 'string',
                    description: 'OCI compartment ID (uses default if not provided)'
                },
                includeAttachments: {
                    type: 'boolean',
                    default: true,
                    description: 'Include volume and VNIC attachment details'
                }
            },
            required: ['instanceId']
        }
    },
    {
        name: 'start_instance',
        description: 'Start a stopped OCI compute instance',
        inputSchema: {
            type: 'object',
            properties: {
                instanceId: {
                    type: 'string',
                    description: 'OCI Compute instance OCID to start'
                },
                waitForRunning: {
                    type: 'boolean',
                    default: false,
                    description: 'Wait for instance to reach RUNNING state'
                },
                maxWaitMinutes: {
                    type: 'number',
                    default: 10,
                    description: 'Maximum minutes to wait for state change'
                }
            },
            required: ['instanceId']
        }
    },
    {
        name: 'stop_instance',
        description: 'Stop a running OCI compute instance',
        inputSchema: {
            type: 'object',
            properties: {
                instanceId: {
                    type: 'string',
                    description: 'OCI Compute instance OCID to stop'
                },
                softStop: {
                    type: 'boolean',
                    default: false,
                    description: 'Use soft stop (graceful shutdown)'
                },
                waitForStopped: {
                    type: 'boolean',
                    default: false,
                    description: 'Wait for instance to reach STOPPED state'
                },
                maxWaitMinutes: {
                    type: 'number',
                    default: 10,
                    description: 'Maximum minutes to wait for state change'
                }
            },
            required: ['instanceId']
        }
    },
    {
        name: 'restart_instance',
        description: 'Restart (reboot) a running OCI compute instance',
        inputSchema: {
            type: 'object',
            properties: {
                instanceId: {
                    type: 'string',
                    description: 'OCI Compute instance OCID to restart'
                },
                softRestart: {
                    type: 'boolean',
                    default: false,
                    description: 'Use soft restart (graceful reboot)'
                },
                waitForRunning: {
                    type: 'boolean',
                    default: false,
                    description: 'Wait for instance to reach RUNNING state after restart'
                },
                maxWaitMinutes: {
                    type: 'number',
                    default: 15,
                    description: 'Maximum minutes to wait for restart completion'
                }
            },
            required: ['instanceId']
        }
    },
    {
        name: 'get_instance_console_history',
        description: 'Get console history/logs from an OCI compute instance',
        inputSchema: {
            type: 'object',
            properties: {
                instanceId: {
                    type: 'string',
                    description: 'OCI Compute instance OCID'
                },
                length: {
                    type: 'number',
                    default: 10240,
                    description: 'Number of bytes to retrieve from console history'
                }
            },
            required: ['instanceId']
        }
    },
    {
        name: 'get_instance_vnics',
        description: 'Get network interface (VNIC) details for an instance',
        inputSchema: {
            type: 'object',
            properties: {
                instanceId: {
                    type: 'string',
                    description: 'OCI Compute instance OCID'
                },
                compartmentId: {
                    type: 'string',
                    description: 'OCI compartment ID (uses default if not provided)'
                }
            },
            required: ['instanceId']
        }
    },
    {
        name: 'get_instance_volumes',
        description: 'Get storage volume attachments for an instance',
        inputSchema: {
            type: 'object',
            properties: {
                instanceId: {
                    type: 'string',
                    description: 'OCI Compute instance OCID'
                },
                compartmentId: {
                    type: 'string',
                    description: 'OCI compartment ID (uses default if not provided)'
                }
            },
            required: ['instanceId']
        }
    },
    {
        name: 'wait_for_instance_state',
        description: 'Wait for an instance to reach a specific lifecycle state',
        inputSchema: {
            type: 'object',
            properties: {
                instanceId: {
                    type: 'string',
                    description: 'OCI Compute instance OCID'
                },
                desiredState: {
                    type: 'string',
                    enum: ['RUNNING', 'STOPPED', 'STOPPING', 'STARTING', 'TERMINATED'],
                    description: 'Desired instance lifecycle state'
                },
                maxWaitMinutes: {
                    type: 'number',
                    default: 10,
                    description: 'Maximum minutes to wait for state change'
                }
            },
            required: ['instanceId', 'desiredState']
        }
    },
    {
        name: 'list_compute_instances',
        description: 'List all compute instances in the compartment with basic details',
        inputSchema: {
            type: 'object',
            properties: {
                compartmentId: {
                    type: 'string',
                    description: 'OCI compartment ID (uses default if not provided)'
                },
                lifecycleState: {
                    type: 'string',
                    enum: ['RUNNING', 'STOPPED', 'STARTING', 'STOPPING', 'TERMINATED'],
                    default: 'RUNNING',
                    description: 'Filter instances by lifecycle state'
                }
            }
        }
    },
    {
        name: 'list_instances_with_network',
        description: 'List compute instances with complete network information including IP addresses',
        inputSchema: {
            type: 'object',
            properties: {
                compartmentId: {
                    type: 'string',
                    description: 'OCI compartment ID (uses default if not provided)'
                },
                lifecycleState: {
                    type: 'string',
                    enum: ['RUNNING', 'STOPPED', 'STARTING', 'STOPPING', 'TERMINATED'],
                    default: 'RUNNING',
                    description: 'Filter instances by lifecycle state'
                }
            }
        }
    }
];
// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
});
// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case 'query_oci_metrics':
                return await handleQueryMetrics(args);
            case 'generate_metrics_graph':
                return await handleGenerateGraph(args);
            case 'list_oci_namespaces':
                return await handleListNamespaces(args);
            case 'list_namespace_metrics':
                return await handleListMetrics(args);
            case 'prepare_anomaly_detection_data':
                return await handlePrepareAnomalyData(args);
            case 'test_oci_connection':
                return await handleTestConnection(args);
            case 'query_compute_agent_metrics':
                return await handleQueryComputeAgentMetrics(args);
            case 'query_stack_monitoring_metrics':
                return await handleQueryStackMonitoringMetrics(args);
            case 'query_db_management_metrics':
                return await handleQueryDbManagementMetrics(args);
            case 'query_ops_insights_metrics':
                return await handleQueryOpsInsightsMetrics(args);
            case 'get_instance_correlations':
                return await handleGetInstanceCorrelations(args);
            case 'find_instances_by_ip':
                return await handleFindInstancesByIP(args);
            case 'find_instances_by_name':
                return await handleFindInstancesByName(args);
            case 'generate_logan_correlation_data':
                return await handleGenerateLoganCorrelationData(args);
            case 'get_instance_details':
                return await handleGetInstanceDetails(args);
            case 'start_instance':
                return await handleStartInstance(args);
            case 'stop_instance':
                return await handleStopInstance(args);
            case 'restart_instance':
                return await handleRestartInstance(args);
            case 'get_instance_console_history':
                return await handleGetInstanceConsoleHistory(args);
            case 'get_instance_vnics':
                return await handleGetInstanceVnics(args);
            case 'get_instance_volumes':
                return await handleGetInstanceVolumes(args);
            case 'wait_for_instance_state':
                return await handleWaitForInstanceState(args);
            case 'list_compute_instances':
                return await handleListComputeInstances(args);
            case 'list_instances_with_network':
                return await handleListInstancesWithNetwork(args);
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
// Tool handlers
async function handleQueryMetrics(args) {
    if (process.env.MCP_DEBUG) {
        console.error('🔍 Querying OCI metrics:', JSON.stringify(args, null, 2));
    }
    // Parse time range
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
    // Build metric query
    const metricQuery = {
        compartmentId: args.compartmentId || process.env.OCI_COMPARTMENT_ID || '',
        namespace: args.namespace,
        metricName: args.metricName,
        timeRange,
        dimensions: args.dimensions,
        aggregation: args.aggregation || 'mean',
        interval: args.interval || 'PT1M'
    };
    // Query metrics
    const result = await monitoringClient.queryMetrics(metricQuery);
    // Add Logan compatibility info
    const response = {
        ...result,
        loganCompatible: true,
        timestampFormat: 'ISO 8601 UTC',
        dataPoints: result.aggregatedDatapoints.length,
        timeRangeInfo: {
            duration: TimeUtils.formatDuration(timeRange.startTime, timeRange.endTime),
            timezone: TimeUtils.getTimezoneInfo()
        }
    };
    if (process.env.MCP_DEBUG) {
        console.error(`✅ Retrieved ${result.aggregatedDatapoints.length} data points`);
    }
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(response, null, 2)
            }
        ]
    };
}
async function handleGenerateGraph(args) {
    if (process.env.MCP_DEBUG) {
        console.error('📊 Generating metrics graph:', JSON.stringify(args, null, 2));
    }
    // Query all requested metrics
    const metricResults = [];
    for (const queryReq of args.metricQueries) {
        // Parse time range for each query
        let timeRange;
        if (queryReq.endTime) {
            timeRange = {
                startTime: TimeUtils.toLoganFormat(queryReq.startTime),
                endTime: TimeUtils.toLoganFormat(queryReq.endTime)
            };
        }
        else {
            timeRange = TimeUtils.parseTimeRange(queryReq.startTime);
        }
        const metricQuery = {
            compartmentId: queryReq.compartmentId || process.env.OCI_COMPARTMENT_ID || '',
            namespace: queryReq.namespace,
            metricName: queryReq.metricName,
            timeRange,
            dimensions: queryReq.dimensions,
            aggregation: queryReq.aggregation || 'mean',
            interval: queryReq.interval || 'PT1M'
        };
        const result = await monitoringClient.queryMetrics(metricQuery);
        metricResults.push(result);
    }
    // Generate graph
    const graphConfig = {
        type: args.graphType || 'line',
        title: args.title || `OCI Metrics - ${(args.graphType || 'line').charAt(0).toUpperCase() + (args.graphType || 'line').slice(1)} Chart`,
        xAxis: 'Time',
        yAxis: 'Value',
        showLegend: true
    };
    let visualization;
    if (args.includeCorrelation && metricResults.length > 1) {
        // Generate correlation heatmap
        visualization = await graphGenerator.generateCorrelationHeatmap(metricResults, args.title || 'OCI Metrics Correlation Analysis');
    }
    else {
        // Generate standard graph
        visualization = await graphGenerator.generateGraph(metricResults, graphConfig);
    }
    const response = {
        ...visualization,
        loganCompatible: true,
        generatedAt: TimeUtils.toLoganFormat(new Date()),
        chartType: args.graphType || 'line',
        metricsCount: metricResults.length
    };
    if (process.env.MCP_DEBUG) {
        console.error(`✅ Generated ${args.graphType || 'line'} chart with ${metricResults.length} metrics`);
    }
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(response, null, 2)
            }
        ]
    };
}
async function handleListNamespaces(args) {
    if (process.env.MCP_DEBUG) {
        console.error('📋 Listing OCI namespaces...');
    }
    const namespaces = await monitoringClient.listNamespaces(args.compartmentId);
    const response = {
        namespaces,
        count: namespaces.length,
        retrievedAt: TimeUtils.toLoganFormat(new Date()),
        compartmentId: args.compartmentId || process.env.OCI_COMPARTMENT_ID
    };
    if (process.env.MCP_DEBUG) {
        console.error(`✅ Found ${namespaces.length} namespaces`);
    }
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(response, null, 2)
            }
        ]
    };
}
async function handleListMetrics(args) {
    if (process.env.MCP_DEBUG) {
        console.error(`📋 Listing metrics for namespace: ${args.namespace}`);
    }
    const metrics = await monitoringClient.listMetrics(args.namespace, args.compartmentId);
    const response = {
        namespace: args.namespace,
        metrics,
        count: metrics.length,
        retrievedAt: TimeUtils.toLoganFormat(new Date()),
        compartmentId: args.compartmentId || process.env.OCI_COMPARTMENT_ID
    };
    if (process.env.MCP_DEBUG) {
        console.error(`✅ Found ${metrics.length} metrics in ${args.namespace}`);
    }
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(response, null, 2)
            }
        ]
    };
}
async function handlePrepareAnomalyData(args) {
    if (process.env.MCP_DEBUG) {
        console.error('🔬 Preparing anomaly detection data...');
    }
    // Build metric queries with proper time ranges
    const metricQueries = args.metricQueries.map((queryReq) => {
        let timeRange;
        if (queryReq.endTime) {
            timeRange = {
                startTime: TimeUtils.toLoganFormat(queryReq.startTime),
                endTime: TimeUtils.toLoganFormat(queryReq.endTime)
            };
        }
        else {
            timeRange = TimeUtils.parseTimeRange(args.timeWindow || queryReq.startTime);
        }
        return {
            compartmentId: queryReq.compartmentId || process.env.OCI_COMPARTMENT_ID || '',
            namespace: queryReq.namespace,
            metricName: queryReq.metricName,
            timeRange,
            dimensions: queryReq.dimensions,
            aggregation: queryReq.aggregation || 'mean',
            interval: queryReq.interval || 'PT1M'
        };
    });
    // Prepare anomaly detection data
    const anomalyData = await monitoringClient.prepareAnomalyDetectionData(metricQueries, args.includeContext !== false);
    const response = {
        anomalyData,
        dataPoints: anomalyData.length,
        metricsAnalyzed: metricQueries.length,
        timeWindow: args.timeWindow,
        loganCompatible: true,
        preparedAt: TimeUtils.toLoganFormat(new Date()),
        format: {
            timestampFormat: 'ISO 8601 UTC',
            description: 'Ready for Data Science MCP anomaly detection',
            fields: ['timestamp', 'metricName', 'namespace', 'value', 'dimensions', 'contextData']
        }
    };
    if (process.env.MCP_DEBUG) {
        console.error(`✅ Prepared ${anomalyData.length} data points for anomaly detection`);
    }
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(response, null, 2)
            }
        ]
    };
}
async function handleTestConnection(args) {
    if (process.env.MCP_DEBUG) {
        console.error('🔧 Testing OCI connection...');
    }
    const result = await monitoringClient.testConnection();
    const response = {
        ...result,
        testedAt: TimeUtils.toLoganFormat(new Date()),
        configurationInfo: {
            compartmentId: process.env.OCI_COMPARTMENT_ID || 'Not set',
            region: monitoringClient.getRegion(),
            configFile: process.env.OCI_CONFIG_FILE || '~/.oci/config',
            profile: process.env.OCI_CONFIG_PROFILE || 'DEFAULT'
        }
    };
    if (process.env.MCP_DEBUG) {
        console.error(`✅ Connection test: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    }
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(response, null, 2)
            }
        ]
    };
}
async function handleQueryComputeAgentMetrics(args) {
    if (process.env.MCP_DEBUG) {
        console.error('🖥️ Querying Compute Agent metrics:', JSON.stringify(args, null, 2));
    }
    // Parse time range
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
    try {
        const result = await monitoringClient.queryComputeAgentMetrics(args.instanceId, args.metricName, timeRange, args.interval || 'PT1M');
        const response = {
            ...result,
            loganCompatible: true,
            timestampFormat: 'ISO 8601 UTC',
            dataPoints: result.aggregatedDatapoints.length,
            instanceId: args.instanceId,
            service: 'OCI Compute Agent',
            timeRangeInfo: {
                duration: TimeUtils.formatDuration(timeRange.startTime, timeRange.endTime),
                timezone: TimeUtils.getTimezoneInfo()
            }
        };
        if (process.env.MCP_DEBUG) {
            console.error(`✅ Retrieved ${result.aggregatedDatapoints.length} Compute Agent data points`);
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(response, null, 2)
                }
            ]
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: 'text',
                    text: `Error querying Compute Agent metrics: ${errorMessage}`
                }
            ]
        };
    }
}
async function handleQueryStackMonitoringMetrics(args) {
    if (process.env.MCP_DEBUG) {
        console.error('📊 Querying Stack Monitoring metrics:', JSON.stringify(args, null, 2));
    }
    // Parse time range
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
    try {
        const result = await monitoringClient.queryStackMonitoringMetrics(args.resourceId, args.metricName, timeRange);
        const response = {
            result,
            loganCompatible: true,
            timestampFormat: 'ISO 8601 UTC',
            resourceId: args.resourceId,
            metricName: args.metricName,
            service: 'OCI Stack Monitoring',
            retrievedAt: TimeUtils.toLoganFormat(new Date()),
            timeRangeInfo: {
                duration: TimeUtils.formatDuration(timeRange.startTime, timeRange.endTime),
                timezone: TimeUtils.getTimezoneInfo()
            }
        };
        if (process.env.MCP_DEBUG) {
            console.error('✅ Retrieved Stack Monitoring metrics');
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(response, null, 2)
                }
            ]
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: 'text',
                    text: `Error querying Stack Monitoring metrics: ${errorMessage}`
                }
            ]
        };
    }
}
async function handleQueryDbManagementMetrics(args) {
    if (process.env.MCP_DEBUG) {
        console.error('🗃️ Querying DB Management metrics:', JSON.stringify(args, null, 2));
    }
    // Parse time range
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
    try {
        const result = await monitoringClient.queryDbManagementMetrics(args.databaseId, args.metricName, timeRange);
        const response = {
            result,
            loganCompatible: true,
            timestampFormat: 'ISO 8601 UTC',
            databaseId: args.databaseId,
            metricName: args.metricName,
            service: 'OCI DB Management',
            retrievedAt: TimeUtils.toLoganFormat(new Date()),
            timeRangeInfo: {
                duration: TimeUtils.formatDuration(timeRange.startTime, timeRange.endTime),
                timezone: TimeUtils.getTimezoneInfo()
            }
        };
        if (process.env.MCP_DEBUG) {
            console.error('✅ Retrieved DB Management metrics');
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(response, null, 2)
                }
            ]
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: 'text',
                    text: `Error querying DB Management metrics: ${errorMessage}`
                }
            ]
        };
    }
}
async function handleQueryOpsInsightsMetrics(args) {
    if (process.env.MCP_DEBUG) {
        console.error('🔍 Querying OPS Insights metrics:', JSON.stringify(args, null, 2));
    }
    // Parse time range
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
    try {
        const result = await monitoringClient.queryOpsInsightsMetrics(args.resourceId, args.metricName, timeRange);
        const response = {
            result,
            loganCompatible: true,
            timestampFormat: 'ISO 8601 UTC',
            resourceId: args.resourceId,
            metricName: args.metricName,
            service: 'OCI Operations Insights',
            retrievedAt: TimeUtils.toLoganFormat(new Date()),
            timeRangeInfo: {
                duration: TimeUtils.formatDuration(timeRange.startTime, timeRange.endTime),
                timezone: TimeUtils.getTimezoneInfo()
            }
        };
        if (process.env.MCP_DEBUG) {
            console.error('✅ Retrieved OPS Insights metrics');
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(response, null, 2)
                }
            ]
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: 'text',
                    text: `Error querying OPS Insights metrics: ${errorMessage}`
                }
            ]
        };
    }
}
async function handleGetInstanceCorrelations(args) {
    if (process.env.MCP_DEBUG) {
        console.error('🔗 Getting instance correlations:', JSON.stringify(args, null, 2));
    }
    try {
        const correlations = await correlationService.generateCorrelationMappings(args.compartmentId);
        const response = {
            correlations: args.includeIPs !== false ? correlations : correlations.map(c => ({
                ...c,
                privateIp: null,
                publicIp: null,
                loganCorrelationData: {
                    ...c.loganCorrelationData,
                    ipAddresses: []
                }
            })),
            count: correlations.length,
            loganCompatible: true,
            timestampFormat: 'ISO 8601 UTC',
            retrievedAt: TimeUtils.toLoganFormat(new Date()),
            cacheStats: correlationService.getCacheStats(),
            compartmentId: args.compartmentId || process.env.OCI_COMPARTMENT_ID
        };
        if (process.env.MCP_DEBUG) {
            console.error(`✅ Retrieved ${correlations.length} instance correlations`);
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(response, null, 2)
                }
            ]
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: 'text',
                    text: `Error getting instance correlations: ${errorMessage}`
                }
            ]
        };
    }
}
async function handleFindInstancesByIP(args) {
    if (process.env.MCP_DEBUG) {
        console.error('🔍 Finding instances by IP:', JSON.stringify(args, null, 2));
    }
    try {
        const matches = await correlationService.findInstancesByIP(args.ipAddresses, args.compartmentId);
        const response = {
            searchedIPs: args.ipAddresses,
            matches,
            matchCount: matches.length,
            loganCompatible: true,
            timestampFormat: 'ISO 8601 UTC',
            searchedAt: TimeUtils.toLoganFormat(new Date()),
            correlationType: 'ip_to_instance',
            compartmentId: args.compartmentId || process.env.OCI_COMPARTMENT_ID
        };
        if (process.env.MCP_DEBUG) {
            console.error(`✅ Found ${matches.length} instances matching ${args.ipAddresses.length} IP addresses`);
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(response, null, 2)
                }
            ]
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: 'text',
                    text: `Error finding instances by IP: ${errorMessage}`
                }
            ]
        };
    }
}
async function handleFindInstancesByName(args) {
    if (process.env.MCP_DEBUG) {
        console.error('🔍 Finding instances by name:', JSON.stringify(args, null, 2));
    }
    try {
        const matches = await correlationService.findInstancesByName(args.namePattern, args.compartmentId);
        const response = {
            namePattern: args.namePattern,
            matches,
            matchCount: matches.length,
            loganCompatible: true,
            timestampFormat: 'ISO 8601 UTC',
            searchedAt: TimeUtils.toLoganFormat(new Date()),
            correlationType: 'name_to_instance',
            compartmentId: args.compartmentId || process.env.OCI_COMPARTMENT_ID
        };
        if (process.env.MCP_DEBUG) {
            console.error(`✅ Found ${matches.length} instances matching pattern "${args.namePattern}"`);
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(response, null, 2)
                }
            ]
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: 'text',
                    text: `Error finding instances by name: ${errorMessage}`
                }
            ]
        };
    }
}
async function handleGenerateLoganCorrelationData(args) {
    if (process.env.MCP_DEBUG) {
        console.error('📊 Generating Logan correlation data:', JSON.stringify(args, null, 2));
    }
    try {
        // Parse time range
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
        const correlationData = await correlationService.generateLoganCorrelationData(timeRange, args.compartmentId);
        let enhancedData = correlationData;
        // Include basic metrics if requested
        if (args.includeMetrics) {
            try {
                const correlations = await correlationService.generateCorrelationMappings(args.compartmentId);
                for (const correlation of correlations.slice(0, 5)) { // Limit to first 5 to avoid timeout
                    try {
                        // Get CPU utilization for correlation
                        const cpuResult = await monitoringClient.queryComputeAgentMetrics(correlation.ocid, 'CpuUtilization', timeRange, 'PT5M');
                        cpuResult.aggregatedDatapoints.forEach(point => {
                            enhancedData.push({
                                timestamp: point.timestamp,
                                type: 'oci_metric_correlation',
                                instanceOCID: correlation.ocid,
                                instanceName: correlation.instanceName,
                                metricName: 'CpuUtilization',
                                metricValue: point.value,
                                ipAddresses: correlation.loganCorrelationData.ipAddresses,
                                correlationMetadata: {
                                    service: 'OCI Compute Agent',
                                    correlationType: 'metric_correlation',
                                    loganCompatible: true
                                }
                            });
                        });
                    }
                    catch (metricError) {
                        console.error(`Failed to get metrics for ${correlation.ocid}:`, metricError);
                    }
                }
            }
            catch (metricError) {
                console.error('Failed to include metrics in correlation data:', metricError);
            }
        }
        const response = {
            correlationData: enhancedData,
            dataPoints: enhancedData.length,
            timeRange,
            includeMetrics: args.includeMetrics || false,
            loganCompatible: true,
            timestampFormat: 'ISO 8601 UTC',
            generatedAt: TimeUtils.toLoganFormat(new Date()),
            correlationType: 'logan_integration',
            compartmentId: args.compartmentId || process.env.OCI_COMPARTMENT_ID,
            usage: {
                description: 'Use this data to correlate OCI instances with Logan security logs',
                searchFields: ['instanceOCID', 'instanceName', 'ipAddress'],
                timeCorrelation: 'Match timestamps with Logan log entries',
                ipCorrelation: 'Match IP addresses with network events in Logan'
            }
        };
        if (process.env.MCP_DEBUG) {
            console.error(`✅ Generated ${enhancedData.length} Logan correlation data points`);
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(response, null, 2)
                }
            ]
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: 'text',
                    text: `Error generating Logan correlation data: ${errorMessage}`
                }
            ]
        };
    }
}
async function handleGetInstanceDetails(args) {
    if (process.env.MCP_DEBUG) {
        console.error('🖥️ Getting instance details:', JSON.stringify(args, null, 2));
    }
    try {
        let instanceData;
        if (args.includeAttachments !== false) {
            instanceData = await coreServicesClient.getInstanceFullDetails(args.instanceId, args.compartmentId);
        }
        else {
            const instance = await coreServicesClient.getInstanceDetails(args.instanceId);
            instanceData = {
                instance,
                volumeAttachments: [],
                vnicAttachments: [],
                vnicDetails: []
            };
        }
        const response = {
            ...instanceData,
            loganCompatible: true,
            timestampFormat: 'ISO 8601 UTC',
            retrievedAt: TimeUtils.toLoganFormat(new Date()),
            instanceId: args.instanceId,
            service: 'OCI Core Services',
            summary: {
                name: instanceData.instance.displayName,
                state: instanceData.instance.lifecycleState,
                shape: instanceData.instance.shape,
                availabilityDomain: instanceData.instance.availabilityDomain,
                volumeCount: instanceData.volumeAttachments.length,
                vnicCount: instanceData.vnicAttachments.length
            }
        };
        if (process.env.MCP_DEBUG) {
            console.error(`✅ Retrieved details for instance ${instanceData.instance.displayName} (${instanceData.instance.lifecycleState})`);
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(response, null, 2)
                }
            ]
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: 'text',
                    text: `Error getting instance details: ${errorMessage}`
                }
            ]
        };
    }
}
async function handleStartInstance(args) {
    if (process.env.MCP_DEBUG) {
        console.error('▶️ Starting instance:', JSON.stringify(args, null, 2));
    }
    try {
        const actionResult = await coreServicesClient.performInstanceAction(args.instanceId, 'START');
        let stateResult = null;
        if (args.waitForRunning) {
            stateResult = await coreServicesClient.waitForInstanceState(args.instanceId, 'RUNNING', args.maxWaitMinutes || 10);
        }
        const response = {
            action: actionResult,
            stateWait: stateResult,
            loganCompatible: true,
            timestampFormat: 'ISO 8601 UTC',
            requestedAt: TimeUtils.toLoganFormat(new Date()),
            instanceId: args.instanceId,
            service: 'OCI Core Services',
            operationType: 'instance_lifecycle_start'
        };
        if (process.env.MCP_DEBUG) {
            const status = actionResult.result.success ? 'SUCCESS' : 'FAILED';
            console.error(`✅ Instance start ${status}: ${actionResult.result.message}`);
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(response, null, 2)
                }
            ]
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: 'text',
                    text: `Error starting instance: ${errorMessage}`
                }
            ]
        };
    }
}
async function handleStopInstance(args) {
    if (process.env.MCP_DEBUG) {
        console.error('⏹️ Stopping instance:', JSON.stringify(args, null, 2));
    }
    try {
        const action = args.softStop ? 'SOFTSTOP' : 'STOP';
        const actionResult = await coreServicesClient.performInstanceAction(args.instanceId, action);
        let stateResult = null;
        if (args.waitForStopped) {
            stateResult = await coreServicesClient.waitForInstanceState(args.instanceId, 'STOPPED', args.maxWaitMinutes || 10);
        }
        const response = {
            action: actionResult,
            stateWait: stateResult,
            loganCompatible: true,
            timestampFormat: 'ISO 8601 UTC',
            requestedAt: TimeUtils.toLoganFormat(new Date()),
            instanceId: args.instanceId,
            service: 'OCI Core Services',
            operationType: `instance_lifecycle_${action.toLowerCase()}`
        };
        if (process.env.MCP_DEBUG) {
            const status = actionResult.result.success ? 'SUCCESS' : 'FAILED';
            console.error(`✅ Instance ${action} ${status}: ${actionResult.result.message}`);
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(response, null, 2)
                }
            ]
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: 'text',
                    text: `Error stopping instance: ${errorMessage}`
                }
            ]
        };
    }
}
async function handleRestartInstance(args) {
    if (process.env.MCP_DEBUG) {
        console.error('🔄 Restarting instance:', JSON.stringify(args, null, 2));
    }
    try {
        const action = args.softRestart ? 'SOFTRESET' : 'RESET';
        const actionResult = await coreServicesClient.performInstanceAction(args.instanceId, action);
        let stateResult = null;
        if (args.waitForRunning) {
            stateResult = await coreServicesClient.waitForInstanceState(args.instanceId, 'RUNNING', args.maxWaitMinutes || 15);
        }
        const response = {
            action: actionResult,
            stateWait: stateResult,
            loganCompatible: true,
            timestampFormat: 'ISO 8601 UTC',
            requestedAt: TimeUtils.toLoganFormat(new Date()),
            instanceId: args.instanceId,
            service: 'OCI Core Services',
            operationType: `instance_lifecycle_${action.toLowerCase()}`
        };
        if (process.env.MCP_DEBUG) {
            const status = actionResult.result.success ? 'SUCCESS' : 'FAILED';
            console.error(`✅ Instance ${action} ${status}: ${actionResult.result.message}`);
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(response, null, 2)
                }
            ]
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: 'text',
                    text: `Error restarting instance: ${errorMessage}`
                }
            ]
        };
    }
}
async function handleGetInstanceConsoleHistory(args) {
    if (process.env.MCP_DEBUG) {
        console.error('📜 Getting instance console history:', JSON.stringify(args, null, 2));
    }
    try {
        // This would require additional implementation for console history
        // For now, we'll provide a placeholder that shows how it would work
        const response = {
            instanceId: args.instanceId,
            consoleHistory: 'Console history retrieval not yet implemented in Core Services client',
            length: args.length || 10240,
            loganCompatible: true,
            timestampFormat: 'ISO 8601 UTC',
            retrievedAt: TimeUtils.toLoganFormat(new Date()),
            service: 'OCI Core Services',
            note: 'Console history requires additional OCI CLI/API implementation'
        };
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(response, null, 2)
                }
            ]
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: 'text',
                    text: `Error getting console history: ${errorMessage}`
                }
            ]
        };
    }
}
async function handleGetInstanceVnics(args) {
    if (process.env.MCP_DEBUG) {
        console.error('🌐 Getting instance VNICs:', JSON.stringify(args, null, 2));
    }
    try {
        const compartmentId = args.compartmentId || process.env.OCI_COMPARTMENT_ID;
        if (!compartmentId) {
            throw new Error('Compartment ID is required');
        }
        const vnicAttachments = await coreServicesClient.getVnicAttachments(args.instanceId, compartmentId);
        const vnicDetails = [];
        for (const attachment of vnicAttachments) {
            try {
                const vnic = await coreServicesClient.getVnicDetails(attachment.vnicId);
                vnicDetails.push({
                    attachment,
                    vnic
                });
            }
            catch (error) {
                console.error(`Failed to get VNIC details for ${attachment.vnicId}:`, error);
                vnicDetails.push({
                    attachment,
                    vnic: null,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        const response = {
            instanceId: args.instanceId,
            vnicAttachments,
            vnicDetails,
            count: vnicAttachments.length,
            loganCompatible: true,
            timestampFormat: 'ISO 8601 UTC',
            retrievedAt: TimeUtils.toLoganFormat(new Date()),
            compartmentId,
            service: 'OCI Core Services'
        };
        if (process.env.MCP_DEBUG) {
            console.error(`✅ Retrieved ${vnicAttachments.length} VNIC attachments`);
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(response, null, 2)
                }
            ]
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: 'text',
                    text: `Error getting instance VNICs: ${errorMessage}`
                }
            ]
        };
    }
}
async function handleGetInstanceVolumes(args) {
    if (process.env.MCP_DEBUG) {
        console.error('💾 Getting instance volumes:', JSON.stringify(args, null, 2));
    }
    try {
        const compartmentId = args.compartmentId || process.env.OCI_COMPARTMENT_ID;
        if (!compartmentId) {
            throw new Error('Compartment ID is required');
        }
        const volumeAttachments = await coreServicesClient.getVolumeAttachments(args.instanceId, compartmentId);
        const response = {
            instanceId: args.instanceId,
            volumeAttachments,
            count: volumeAttachments.length,
            loganCompatible: true,
            timestampFormat: 'ISO 8601 UTC',
            retrievedAt: TimeUtils.toLoganFormat(new Date()),
            compartmentId,
            service: 'OCI Core Services',
            summary: {
                totalAttachments: volumeAttachments.length,
                readOnlyCount: volumeAttachments.filter(v => v.isReadOnly).length,
                encryptedCount: volumeAttachments.filter(v => v.isPvEncryptionInTransitEnabled).length
            }
        };
        if (process.env.MCP_DEBUG) {
            console.error(`✅ Retrieved ${volumeAttachments.length} volume attachments`);
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(response, null, 2)
                }
            ]
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: 'text',
                    text: `Error getting instance volumes: ${errorMessage}`
                }
            ]
        };
    }
}
async function handleWaitForInstanceState(args) {
    if (process.env.MCP_DEBUG) {
        console.error('⏳ Waiting for instance state:', JSON.stringify(args, null, 2));
    }
    try {
        const result = await coreServicesClient.waitForInstanceState(args.instanceId, args.desiredState, args.maxWaitMinutes || 10);
        const response = {
            instanceId: args.instanceId,
            desiredState: args.desiredState,
            result,
            maxWaitMinutes: args.maxWaitMinutes || 10,
            loganCompatible: true,
            timestampFormat: 'ISO 8601 UTC',
            waitStartedAt: TimeUtils.toLoganFormat(new Date()),
            service: 'OCI Core Services',
            operationType: 'instance_state_wait'
        };
        if (process.env.MCP_DEBUG) {
            const status = result.success ? 'SUCCESS' : 'TIMEOUT/FAILED';
            console.error(`✅ Wait for ${args.desiredState} ${status}: ${result.message}`);
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(response, null, 2)
                }
            ]
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: 'text',
                    text: `Error waiting for instance state: ${errorMessage}`
                }
            ]
        };
    }
}
async function handleListComputeInstances(args) {
    if (process.env.MCP_DEBUG) {
        console.error('📋 Listing compute instances:', JSON.stringify(args, null, 2));
    }
    try {
        const instances = await coreServicesClient.listInstances(args.compartmentId, args.lifecycleState || 'RUNNING');
        const response = {
            instances,
            count: instances.length,
            filters: {
                compartmentId: args.compartmentId || process.env.OCI_COMPARTMENT_ID,
                lifecycleState: args.lifecycleState || 'RUNNING'
            },
            loganCompatible: true,
            timestampFormat: 'ISO 8601 UTC',
            retrievedAt: TimeUtils.toLoganFormat(new Date()),
            service: 'OCI Core Services',
            operationType: 'list_instances'
        };
        if (process.env.MCP_DEBUG) {
            console.error(`✅ Found ${instances.length} instances with state: ${args.lifecycleState || 'RUNNING'}`);
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(response, null, 2)
                }
            ]
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: 'text',
                    text: `Error listing compute instances: ${errorMessage}`
                }
            ]
        };
    }
}
async function handleListInstancesWithNetwork(args) {
    if (process.env.MCP_DEBUG) {
        console.error('🌐 Listing instances with network info:', JSON.stringify(args, null, 2));
    }
    try {
        const instances = await coreServicesClient.listInstancesWithNetworkInfo(args.compartmentId, args.lifecycleState || 'RUNNING');
        const response = {
            instances,
            count: instances.length,
            filters: {
                compartmentId: args.compartmentId || process.env.OCI_COMPARTMENT_ID,
                lifecycleState: args.lifecycleState || 'RUNNING'
            },
            includesNetworkInfo: true,
            loganCompatible: true,
            timestampFormat: 'ISO 8601 UTC',
            retrievedAt: TimeUtils.toLoganFormat(new Date()),
            service: 'OCI Core Services',
            operationType: 'list_instances_with_network'
        };
        if (process.env.MCP_DEBUG) {
            console.error(`✅ Found ${instances.length} instances with network info`);
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(response, null, 2)
                }
            ]
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: 'text',
                    text: `Error listing instances with network info: ${errorMessage}`
                }
            ]
        };
    }
}
// Start server
async function startServer() {
    try {
        // Use stderr for debugging info so it doesn't interfere with JSON-RPC
        if (process.env.MCP_DEBUG) {
            console.error('🚀 Starting OCI Metrics MCP Server...');
            console.error('📋 Available tools:');
            console.error('   - query_oci_metrics: Query monitoring data with Logan compatibility');
            console.error('   - generate_metrics_graph: Create interactive visualizations');
            console.error('   - list_oci_namespaces: Discover available namespaces');
            console.error('   - list_namespace_metrics: List metrics in namespace');
            console.error('   - prepare_anomaly_detection_data: Format data for ML analysis');
            console.error('   - test_oci_connection: Verify OCI connectivity');
            console.error('   - query_compute_agent_metrics: Query Compute Agent metrics (CPU, Memory, Network)');
            console.error('   - query_stack_monitoring_metrics: Query Stack Monitoring metrics (requires REST API)');
            console.error('   - query_db_management_metrics: Query DB Management metrics (requires REST API)');
            console.error('   - query_ops_insights_metrics: Query OPS Insights metrics (requires REST API)');
            console.error('   - get_instance_correlations: Get instance Name/IP/OCID correlations for Logan');
            console.error('   - find_instances_by_ip: Find instances by IP address for Logan correlation');
            console.error('   - find_instances_by_name: Find instances by name pattern for Logan correlation');
            console.error('   - generate_logan_correlation_data: Generate Logan-compatible correlation data');
            console.error('   - get_instance_details: Get comprehensive instance details and configuration');
            console.error('   - start_instance: Start a stopped compute instance');
            console.error('   - stop_instance: Stop a running compute instance');
            console.error('   - restart_instance: Restart (reboot) a compute instance');
            console.error('   - get_instance_vnics: Get network interface details for an instance');
            console.error('   - get_instance_volumes: Get storage volume attachments for an instance');
            console.error('   - wait_for_instance_state: Wait for instance to reach desired state');
            console.error('   - list_compute_instances: List all compute instances with basic details');
            console.error('   - list_instances_with_network: List instances with complete network information');
            console.error('');
            console.error('⚙️  Prerequisites check:');
            console.error(`   - OCI_COMPARTMENT_ID: ${process.env.OCI_COMPARTMENT_ID || '❌ Not set'}`);
            console.error(`   - OCI_REGION: ${process.env.OCI_REGION || 'us-ashburn-1 (default)'}`);
            console.error(`   - OCI_CONFIG_FILE: ${process.env.OCI_CONFIG_FILE || '~/.oci/config (default)'}`);
            console.error('');
        }
        const transport = new StdioServerTransport();
        await server.connect(transport);
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}
// Handle graceful shutdown
process.on('SIGINT', () => {
    if (process.env.MCP_DEBUG) {
        console.error('\n👋 Shutting down OCI Metrics MCP Server...');
    }
    process.exit(0);
});
process.on('SIGTERM', () => {
    if (process.env.MCP_DEBUG) {
        console.error('\n👋 Shutting down OCI Metrics MCP Server...');
    }
    process.exit(0);
});
startServer();
//# sourceMappingURL=index.js.map