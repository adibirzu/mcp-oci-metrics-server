# Enhanced OCI Metrics MCP Server

A Model Context Protocol (MCP) server that provides Oracle Cloud Infrastructure (OCI) monitoring metrics access for Large Language Models with **Grafana collection model architecture**. This enhanced server enables LLMs to query, analyze, and visualize OCI metrics through multi-tenancy support, advanced MQL queries, and template variables.

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](package.json)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![FastMCP](https://img.shields.io/badge/FastMCP-compatible-purple.svg)](https://fastmcp.com)
[![Grafana](https://img.shields.io/badge/Grafana-inspired-orange.svg)](https://grafana.com)

## 🆕 Enhanced Features (v2.0)

### 🏢 **Multi-Tenancy Support**
- Query metrics across multiple OCI tenancies
- Instance Principal and User Principal authentication
- Automatic tenancy discovery from OCI config
- Cross-tenancy metric comparison

### 🔍 **Advanced MQL (Metric Query Language)**
- Enhanced query syntax: `CpuUtilization[5m].mean()`, `rate(NetworksBytesIn[1m])`
- Query validation and suggestions
- Template-based queries with variable substitution
- Aggregation functions: mean, sum, max, min, rate, percentile

### 📊 **Template Variables**
- Dynamic dashboard variables (compartment, instance, namespace, metric)
- Query-based variable resolution
- Variable dependency management
- Auto-refresh on time range changes

### 🔐 **Enhanced Authentication**
- Instance Principal (for OCI-hosted environments)
- User Principal with multiple profile support
- Automatic authentication context detection
- Connection health monitoring

### ⚙️ **Grafana-Style Datasource Management**
- Datasource configuration with validation
- Export/import configuration for backup
- Real-time connection testing
- Multi-region support

## ✨ Core Features

- 🔍 **Query OCI Metrics**: Access metrics from OCI Monitoring, Stack Monitoring, DB Management, and OPS Insights
- 📊 **LLM-Compatible Visualizations**: ASCII charts and data tables that work in any LLM context
- 🌐 **Interactive Charts**: Optional Plotly.js charts for web browser environments
- 🔄 **Instance Correlation**: Correlate metrics across compute instances and services
- 🎯 **Anomaly Detection**: Prepare metrics data for anomaly detection workflows
- ⚡ **Multiple Interfaces**: Enhanced and standard MCP server implementations

## 🚀 Quick Start

- **Node.js** 18.0 or higher
- **OCI CLI** configured with proper credentials
- **Python 3.8+** (for FastMCP server)
- Valid OCI account with monitoring permissions

### 1. Clone and Setup

```bash
git clone https://github.com/your-username/mcp-oci-metrics-server.git
cd mcp-oci-metrics-server
npm install
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your OCI details
OCI_COMPARTMENT_ID=ocid1.compartment.oc1..your-compartment-id
OCI_REGION=us-ashburn-1
```

### 3. Setup OCI CLI

```bash
# Configure OCI CLI (one-time setup)
oci setup config

# Verify configuration
oci iam compartment list
```

### 4. Build and Test

```bash
# Build TypeScript
npm run build

# Start enhanced server (default)
npm start

# Or start standard server
npm run start:standard

# Test the server
node test-server.js
```

### 5. Configure Claude Desktop

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "oci-metrics": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-oci-metrics-server/dist/index.js"],
      "env": {
        "OCI_COMPARTMENT_ID": "your-compartment-ocid",
        "OCI_REGION": "your-region"
      }
    }
  }
}
```

## 🛠️ Available Tools

### Enhanced Tools (v2.0)

#### 1. `manage_datasource_config`
Manage OCI datasource configuration with multi-tenancy support.

**Actions**: list, add, remove, set_default, test, export, import

**Example**:
```json
{
  "action": "list"
}
```

#### 2. `query_mql`
Execute MQL (Metric Query Language) queries with advanced syntax.

**Parameters**:
- `query` (required): MQL query string (e.g., "CpuUtilization[5m].mean()")
- `namespace` (required): OCI namespace
- `tenancyId` (optional): Tenancy to use for query
- `timeRange` (optional): Time range override
- `variables` (optional): Template variables

**Example**:
```json
{
  "query": "CpuUtilization[5m].percentile(95)",
  "namespace": "oci_computeagent"
}
```

#### 3. `manage_template_variables`
Manage template variables for dynamic queries.

**Actions**: list, add, update, remove, refresh, resolve

**Example**:
```json
{
  "action": "refresh",
  "variableName": "compartment"
}
```

#### 4. `manage_authentication`
Manage OCI authentication contexts and test connectivity.

**Actions**: list, test, test_all, refresh, report

**Example**:
```json
{
  "action": "test_all"
}
```

#### 5. `query_cross_tenancy`
Query metrics across multiple tenancies for comparison.

**Example**:
```json
{
  "queries": [
    {
      "tenancyId": "prod",
      "namespace": "oci_computeagent",
      "metricName": "CpuUtilization"
    },
    {
      "tenancyId": "dev",
      "namespace": "oci_computeagent", 
      "metricName": "CpuUtilization"
    }
  ],
  "timeRange": {
    "startTime": "1h"
  }
}
```

### Core Tools

#### 1. `query_oci_metrics`
Query OCI monitoring metrics with Logan MCP compatible timestamps.

**Parameters**:
- `namespace` (required): OCI namespace (e.g., "oci_computeagent", "oci_lbaas")
- `metricName` (required): Metric to query (e.g., "CpuUtilization", "NetworksBytesIn")
- `startTime` (required): Start time (ISO 8601 or relative like "1h", "24h")
- `endTime` (optional): End time (defaults to now)
- `compartmentId` (optional): Uses default if not provided
- `dimensions` (optional): Metric dimension filters
- `aggregation` (optional): mean, sum, count, max, min, rate (default: mean)
- `interval` (optional): PT1M, PT5M, PT1H, etc. (default: PT1M)

### 2. `generate_metrics_graph`
Create interactive visualizations for metrics data.

**Parameters**:
- `metricQueries` (required): Array of metric queries to visualize
- `graphType` (optional): line, bar, scatter, heatmap, pie (default: line)
- `title` (optional): Graph title
- `includeCorrelation` (optional): Generate correlation analysis
- `ipAddresses` (optional): IP addresses for Logan correlation

### 3. `list_oci_namespaces`
Discover available OCI monitoring namespaces.

### 4. `list_namespace_metrics`
List available metrics in a specific namespace.

### 5. `prepare_anomaly_detection_data`
Format metrics data for Data Science MCP server analysis.

### 6. `get_logan_time_correlation`
Synchronize OCI metrics with Logan MCP timestamps.

### 7. `test_oci_connection`
Verify OCI connectivity and configuration.

### 8. `get_common_time_ranges`
Get Logan MCP compatible time ranges and intervals.

## 📊 Usage Examples

### Enhanced MQL Queries (v2.0)

#### Advanced Aggregations
```json
// 95th percentile CPU over 5 minutes
{
  "query": "CpuUtilization[5m].percentile(95)",
  "namespace": "oci_computeagent"
}

// Rate of network bytes over 1 minute  
{
  "query": "rate(NetworksBytesIn[1m])",
  "namespace": "oci_computeagent"
}

// Maximum memory utilization with grouping
{
  "query": "MemoryUtilization[5m].max() by (resourceId)",
  "namespace": "oci_computeagent"
}
```

#### Template Variables
```json
// Query with template variable substitution
{
  "query": "$metric[$interval].$aggregation()",
  "namespace": "oci_computeagent",
  "variables": {
    "metric": "CpuUtilization",
    "interval": "5m", 
    "aggregation": "mean"
  }
}
```

#### Cross-Tenancy Comparison
```json
{
  "queries": [
    {
      "tenancyId": "production",
      "namespace": "oci_computeagent",
      "metricName": "CpuUtilization",
      "compartmentId": "ocid1.compartment.oc1..prod"
    },
    {
      "tenancyId": "development", 
      "namespace": "oci_computeagent",
      "metricName": "CpuUtilization",
      "compartmentId": "ocid1.compartment.oc1..dev"
    }
  ],
  "timeRange": {
    "startTime": "1h"
  },
  "generateComparison": true
}
```

#### Multi-Tenancy Management
```json
// List all configured tenancies
{
  "action": "list"
}

// Test specific tenancy connection
{
  "action": "test",
  "tenancyId": "production"
}

// Test all authentication contexts
{
  "action": "test_all"
}
```

### Basic Metrics Query
```typescript
// Query CPU utilization for last 24 hours
{
  "namespace": "oci_computeagent",
  "metricName": "CpuUtilization",
  "startTime": "24h",
  "aggregation": "mean",
  "interval": "PT5M"
}
```

### Generate Interactive Graph
```typescript
// Create line chart with multiple metrics
{
  "metricQueries": [
    {
      "namespace": "oci_computeagent",
      "metricName": "CpuUtilization",
      "startTime": "6h"
    },
    {
      "namespace": "oci_computeagent", 
      "metricName": "MemoryUtilization",
      "startTime": "6h"
    }
  ],
  "graphType": "line",
  "title": "Compute Instance Performance"
}
```

### Correlation Analysis
```typescript
// Generate correlation heatmap
{
  "metricQueries": [...],
  "graphType": "heatmap",
  "includeCorrelation": true,
  "title": "Service Correlation Analysis"
}
```

### Anomaly Detection Preparation
```typescript
// Prepare data for ML analysis
{
  "metricQueries": [...],
  "includeContext": true,
  "timeWindow": "7d"
}
```

## 🕒 Logan MCP Integration

This server is designed for seamless integration with Logan MCP:

### Time Format Compatibility
- **Timestamps**: ISO 8601 UTC format (`2024-01-15T10:30:00.000Z`)
- **Time Ranges**: Same relative formats (`1h`, `24h`, `7d`)
- **Correlation**: Built-in timestamp synchronization

### IP Correlation
```typescript
// Correlate metrics with network events
{
  "metricQueries": [...],
  "ipAddresses": ["10.0.1.100", "192.168.1.50"],
  "graphType": "line"
}
```

### Data Flow for Correlation
1. **Logan MCP** → Security events with timestamps and IPs
2. **OCI Metrics MCP** → Infrastructure metrics at same time periods  
3. **Correlation** → Match events with performance anomalies
4. **Data Science MCP** → Anomaly detection and predictive analysis

## 📈 Common OCI Namespaces & Metrics

### Compute (`oci_computeagent`)
- `CpuUtilization` - CPU usage percentage
- `MemoryUtilization` - Memory usage percentage  
- `NetworksBytesIn/Out` - Network traffic
- `DiskBytesRead/Written` - Disk I/O

### Load Balancer (`oci_lbaas`)
- `RequestCount` - Number of requests
- `ResponseTime` - Response latency
- `ActiveConnections` - Current connections
- `HealthyBackendCount` - Healthy backends

### VCN (`oci_vcn`)
- `VnicBytesIn/Out` - VNIC network traffic
- `PacketsIn/Out` - Packet counts
- `DroppedPacketsIn/Out` - Dropped packets

### Database (`oci_database`)
- `CpuUtilization` - Database CPU usage
- `DatabaseConnections` - Active connections
- `StorageUtilization` - Storage usage

## 🎨 Graph Types & Visualizations

### Line Charts
Perfect for time-series metrics showing trends over time.

### Bar Charts  
Compare metrics across different resources or time periods.

### Scatter Plots
Identify correlations between different metrics.

### Heatmaps
Visualize correlation matrices and intensity patterns.

### Pie Charts
Show proportional relationships for latest metric values.

## 🔧 Configuration

### Claude Desktop Configuration
```json
{
  "mcpServers": {
    "oci-metrics": {
      "command": "node",
      "args": ["/Users/abirzu/dev/mcp-oci-metrics-server/dist/index.js"],
      "env": {
        "OCI_COMPARTMENT_ID": "ocid1.compartment.oc1..aaaa...",
        "SUPPRESS_LABEL_WARNING": "true"
      }
    }
  }
}
```

### Claude Code Configuration
```json
{
  "oci-metrics": {
    "command": "node",
    "args": ["dist/index.js"],
    "cwd": "/Users/abirzu/dev/mcp-oci-metrics-server",
    "env": {
      "OCI_COMPARTMENT_ID": "ocid1.compartment.oc1..aaaa...",
      "SUPPRESS_LABEL_WARNING": "true"
    }
  }
}
```

### Environment Variables

- **`OCI_COMPARTMENT_ID`** (required): The OCID of the compartment to query metrics from
- **`SUPPRESS_LABEL_WARNING`** (optional): Suppress warning labels in output
- **Region is auto-detected** from OCI CLI config (`~/.oci/config`), defaults to `eu-frankfurt-1`

## 🚨 Troubleshooting

### Common Issues

1. **"OCI config file not found"**
   ```bash
   # Ensure OCI CLI is configured
   oci setup config
   ```

2. **"Failed to query metrics"**
   - Check compartment ID and permissions
   - Verify metric name and namespace exist
   - Ensure time range is valid

3. **"Graph generation failed"**
   - Verify metrics returned data points
   - Check if time ranges overlap
   - Ensure proper metric query parameters

### Debug Mode
```bash
# Enable verbose logging
export OCI_DEBUG=true
npm start
```

### Connection Test
```bash
# Test OCI connectivity
curl -X POST http://localhost:3001/tools/test_oci_connection \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 🧪 Testing

```bash
# Run tests
npm test

# Test specific namespace
npm run test -- --grep "monitoring"

# Integration test
node dist/test-integration.js
```

## 📚 API Reference

### OCI Monitoring API  
Based on: https://docs.public.content.oci.oraclecloud.com/en-us/iaas/api/#/en/monitoring/20180401/

### Supported Operations
- **ListMetrics**: Discover available metrics
- **SummarizeMetricsData**: Query time-series data  
- **GetMetric**: Retrieve metric definitions

## 🤝 Integration Workflow

### With Logan MCP
1. Query security events from Logan MCP
2. Extract timestamps and IP addresses  
3. Query corresponding OCI metrics for same time periods
4. Use `get_logan_time_correlation` to synchronize timestamps
5. Generate correlation visualizations

### With Data Science MCP
1. Use `prepare_anomaly_detection_data` to format metrics
2. Send prepared data to Data Science MCP
3. Receive anomaly scores and predictions
4. Visualize results with annotated graphs

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

For issues and questions:
1. Check OCI CLI configuration: `oci setup config`
2. Verify permissions and compartment access
3. Test connection: Use `test_oci_connection` tool
4. Review server logs for detailed error messages

---

**Built for seamless OCI monitoring integration with Logan MCP correlation and Data Science MCP anomaly detection capabilities.**