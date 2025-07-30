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
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  TextContent,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { MonitoringClient } from './oci/MonitoringClient.js';
import { GraphGenerator } from './visualization/GraphGenerator.js';
import { TimeUtils } from './utils/TimeUtils.js';
import { 
  MetricQuery,
  TimeRange
} from './types/index.js';

// Initialize MCP server
const server = new Server(
  {
    name: 'oci-metrics-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize clients
const monitoringClient = new MonitoringClient();
const graphGenerator = new GraphGenerator();

// Tool definitions
const tools: Tool[] = [
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
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error executing ${name}: ${errorMessage}`
        } as TextContent
      ]
    };
  }
});

// Tool handlers
async function handleQueryMetrics(args: any) {
  console.log('🔍 Querying OCI metrics:', JSON.stringify(args, null, 2));

  // Parse time range
  let timeRange: TimeRange;
  if (args.endTime) {
    timeRange = {
      startTime: TimeUtils.toLoganFormat(args.startTime),
      endTime: TimeUtils.toLoganFormat(args.endTime)
    };
  } else {
    timeRange = TimeUtils.parseTimeRange(args.startTime);
  }

  // Build metric query
  const metricQuery: MetricQuery = {
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

  console.log(`✅ Retrieved ${result.aggregatedDatapoints.length} data points`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2)
      } as TextContent
    ]
  };
}

async function handleGenerateGraph(args: any) {
  console.log('📊 Generating metrics graph:', JSON.stringify(args, null, 2));

  // Query all requested metrics
  const metricResults = [];
  for (const queryReq of args.metricQueries) {
    // Parse time range for each query
    let timeRange: TimeRange;
    if (queryReq.endTime) {
      timeRange = {
        startTime: TimeUtils.toLoganFormat(queryReq.startTime),
        endTime: TimeUtils.toLoganFormat(queryReq.endTime)
      };
    } else {
      timeRange = TimeUtils.parseTimeRange(queryReq.startTime);
    }

    const metricQuery: MetricQuery = {
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
    visualization = await graphGenerator.generateCorrelationHeatmap(
      metricResults,
      args.title || 'OCI Metrics Correlation Analysis'
    );
  } else {
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

  console.log(`✅ Generated ${args.graphType || 'line'} chart with ${metricResults.length} metrics`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2)
      } as TextContent
    ]
  };
}

async function handleListNamespaces(args: any) {
  console.log('📋 Listing OCI namespaces...');

  const namespaces = await monitoringClient.listNamespaces(args.compartmentId);

  const response = {
    namespaces,
    count: namespaces.length,
    retrievedAt: TimeUtils.toLoganFormat(new Date()),
    compartmentId: args.compartmentId || process.env.OCI_COMPARTMENT_ID
  };

  console.log(`✅ Found ${namespaces.length} namespaces`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2)
      } as TextContent
    ]
  };
}

async function handleListMetrics(args: any) {
  console.log(`📋 Listing metrics for namespace: ${args.namespace}`);

  const metrics = await monitoringClient.listMetrics(args.namespace, args.compartmentId);

  const response = {
    namespace: args.namespace,
    metrics,
    count: metrics.length,
    retrievedAt: TimeUtils.toLoganFormat(new Date()),
    compartmentId: args.compartmentId || process.env.OCI_COMPARTMENT_ID
  };

  console.log(`✅ Found ${metrics.length} metrics in ${args.namespace}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2)
      } as TextContent
    ]
  };
}

async function handlePrepareAnomalyData(args: any) {
  console.log('🔬 Preparing anomaly detection data...');

  // Build metric queries with proper time ranges
  const metricQueries: MetricQuery[] = args.metricQueries.map((queryReq: any) => {
    let timeRange: TimeRange;
    if (queryReq.endTime) {
      timeRange = {
        startTime: TimeUtils.toLoganFormat(queryReq.startTime),
        endTime: TimeUtils.toLoganFormat(queryReq.endTime)
      };
    } else {
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
  const anomalyData = await monitoringClient.prepareAnomalyDetectionData(
    metricQueries,
    args.includeContext !== false
  );

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

  console.log(`✅ Prepared ${anomalyData.length} data points for anomaly detection`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2)
      } as TextContent
    ]
  };
}

async function handleTestConnection(args: any) {
  console.log('🔧 Testing OCI connection...');

  const result = await monitoringClient.testConnection();
  
  const response = {
    ...result,
    testedAt: TimeUtils.toLoganFormat(new Date()),
    configurationInfo: {
      compartmentId: process.env.OCI_COMPARTMENT_ID || 'Not set',
      region: process.env.OCI_REGION || 'us-ashburn-1',
      configFile: process.env.OCI_CONFIG_FILE || '~/.oci/config',
      profile: process.env.OCI_CONFIG_PROFILE || 'DEFAULT'
    }
  };

  console.log(`✅ Connection test: ${result.success ? 'SUCCESS' : 'FAILED'}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2)
      } as TextContent
    ]
  };
}

// Start server
async function startServer() {
  try {
    console.log('🚀 Starting OCI Metrics MCP Server...');
    console.log('📋 Available tools:');
    console.log('   - query_oci_metrics: Query monitoring data with Logan compatibility');
    console.log('   - generate_metrics_graph: Create interactive visualizations');
    console.log('   - list_oci_namespaces: Discover available namespaces');
    console.log('   - list_namespace_metrics: List metrics in namespace');
    console.log('   - prepare_anomaly_detection_data: Format data for ML analysis');
    console.log('   - test_oci_connection: Verify OCI connectivity');
    console.log('');
    console.log('⚙️  Prerequisites check:');
    console.log(`   - OCI_COMPARTMENT_ID: ${process.env.OCI_COMPARTMENT_ID || '❌ Not set'}`);
    console.log(`   - OCI_REGION: ${process.env.OCI_REGION || 'us-ashburn-1 (default)'}`);
    console.log(`   - OCI_CONFIG_FILE: ${process.env.OCI_CONFIG_FILE || '~/.oci/config (default)'}`);
    console.log('');

    const transport = new StdioServerTransport();
    await server.connect(transport);
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down OCI Metrics MCP Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down OCI Metrics MCP Server...');
  process.exit(0);
});

startServer();