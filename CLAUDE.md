# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the MCP OCI Metrics Server repository.

## Repository Overview

The **MCP OCI Metrics Server** is a sophisticated Model Context Protocol server that provides Oracle Cloud Infrastructure (OCI) monitoring and management capabilities for Large Language Models. It features a Grafana-inspired collection model architecture with comprehensive OCI integration.

**Key Versions:**
- **Standard Version** (`src/index.ts`, `src/index-standard.ts`) - Core OCI metrics functionality
- **Enhanced Version** (`src/index-enhanced.ts`) - Multi-tenancy, advanced MQL queries, and template variables  
- **Python FastMCP** (`fastmcp_server.py`) - Python implementation using FastMCP framework

## Architecture Overview

### Core Components

#### 1. **Server Implementations**
- **`src/index.ts`** - Main MCP server with standard OCI metrics tools (25+ tools)
- **`src/index-enhanced.ts`** - Enhanced server with Grafana collection model (35+ tools)
- **`src/index-standard.ts`** - Alias pointing to standard implementation
- **`fastmcp_server.py`** - Python FastMCP server with OCI SDK integration

#### 2. **OCI Integration Layer** (`src/oci/`)
- **`MonitoringClient.ts`** - Core OCI monitoring API client with metric querying
- **`OCIRestClient.ts`** - Direct OCI REST API client for advanced operations
- **`CoreServicesClient.ts`** - Compute instance lifecycle management
- **`InstanceCorrelationService.ts`** - Instance-to-IP correlation for Logan MCP integration

#### 3. **Enhanced Features** (`src/oci/`)
- **`DatasourceManager.ts`** - Multi-tenancy datasource configuration and management
- **`AuthenticationManager.ts`** - Instance/User Principal authentication handling
- **`MQLQueryEngine.ts`** - Advanced Metric Query Language parser and executor
- **`TemplateVariableEngine.ts`** - Dynamic template variable management system

#### 4. **Visualization Engine** (`src/visualization/`)
- **`GraphGenerator.ts`** - ASCII charts for LLM display and interactive Plotly.js graphs

#### 5. **Utilities** (`src/utils/`)
- **`TimeUtils.ts`** - Time range parsing with Logan MCP timestamp compatibility

## Development Commands

### Setup and Installation
```bash
# Install dependencies
npm install
pip install -r requirements.txt  # For Python FastMCP server

# Build TypeScript server
npm run build

# Test server connectivity
node test-server.js

# Run Python FastMCP server
python fastmcp_server.py
```

### Development and Testing
```bash
# Watch mode for development (if available)
npm run dev

# Test OCI connectivity
node -e "const { testConnection } = require('./dist/index.js'); testConnection();"

# Validate MQL queries
node -e "const { MQLQueryEngine } = require('./dist/oci/MQLQueryEngine.js'); console.log(new MQLQueryEngine().validate('CpuUtilization[5m].mean()'));"
```

## Key Features & Capabilities

### Standard Features (All Versions)
1. **OCI Metrics Querying**
   - Query metrics from 20+ OCI services (Compute, Load Balancer, VCN, Database, etc.)
   - Support for all OCI aggregations (mean, sum, max, min, rate, count, percentile)
   - Flexible time ranges (relative: "1h", "24h" or absolute timestamps)
   - Advanced dimension filtering and grouping

2. **Compute Instance Management**
   - Start/stop/restart/reboot instances with state waiting
   - Comprehensive instance details (OCIDs, shapes, availability domains)
   - VNICs and volume attachment information
   - Network topology discovery

3. **Visualization Capabilities**
   - ASCII charts optimized for LLM consumption
   - Interactive Plotly.js graphs (line, bar, scatter, heatmap, pie, treemap)
   - Statistical correlation heatmaps
   - Multi-series time series support

4. **Logan MCP Integration**
   - Bidirectional timestamp synchronization
   - IP address to instance OCID correlation
   - Security event correlation support
   - Log analysis correlation utilities

### Enhanced Features (v2.0 - Enhanced Server Only)

1. **Multi-Tenancy Architecture**
   - Manage unlimited OCI tenancies simultaneously
   - Automatic discovery from `~/.oci/config` profiles
   - Cross-tenancy metric comparison and analysis
   - Per-tenancy authentication context isolation

2. **Advanced MQL (Metric Query Language)**
   ```mql
   # Basic metric querying
   CpuUtilization[5m].mean()
   
   # Advanced aggregations and filtering
   CpuUtilization[5m].percentile(95){resourceDisplayName =~ "prod*"}
   
   # Rate calculations
   rate(NetworksBytesIn[1m])
   
   # Complex conditions and joins
   CpuUtilization[5m].mean() > 80 && MemoryUtilization[5m].mean() > 70
   
   # Absence detection
   absent(CpuUtilization[5m])
   ```
   - OCI Grafana plugin compatible syntax
   - Fuzzy matching with wildcards (`*`, `?`)
   - Alarm condition expressions
   - Boolean operations (AND, OR)
   - Arithmetic operations (+, -, *, /, %)
   - Absence and null handling

3. **Template Variables System**
   - Dynamic dashboard variables with auto-refresh
   - Query-based variable resolution
   - Variable dependency chains
   - Time-aware variable updates
   - Cross-tenancy variable support

4. **Enterprise Authentication**
   - Instance Principal for OCI-hosted environments
   - User Principal with multiple profile support
   - Automatic authentication context detection
   - Connection health monitoring and failover

## Available MCP Tools

### Core Tools (Standard & Enhanced - 25+ tools)
- `query_oci_metrics` - Execute monitoring metric queries
- `generate_metrics_graph` - Create visualizations (ASCII/Plotly)
- `list_oci_namespaces` - Discover available metric namespaces
- `list_namespace_metrics` - List metrics for specific namespaces
- `prepare_anomaly_detection_data` - Format metrics for ML analysis
- `test_oci_connection` - Verify OCI connectivity and permissions
- `start_instance`, `stop_instance`, `restart_instance` - Instance lifecycle
- `get_instance_details` - Comprehensive instance information
- `list_instances` - Instance discovery with filtering
- `get_instance_vnics` - Network interface details
- `get_instance_volumes` - Storage attachment information
- `correlate_ip_to_instance` - Logan MCP integration utility
- `wait_for_instance_state` - State change monitoring

### Enhanced Tools (Enhanced Server Only - 10+ additional tools)
- `manage_datasource_config` - Multi-tenancy datasource management
- `query_mql` - Execute advanced MQL queries across tenancies
- `validate_mql` - MQL query validation and syntax checking
- `get_mql_suggestions` - Intelligent query suggestions
- `manage_template_variables` - Variable lifecycle management
- `manage_authentication` - Authentication context management
- `query_cross_tenancy` - Cross-tenancy metric comparison
- `get_enhanced_capabilities` - Feature discovery
- `sync_logan_timestamps` - Logan MCP time synchronization
- `analyze_metric_patterns` - Advanced pattern analysis

## Environment Variables

### Required Configuration
Create `.env` file:
```bash
# Primary OCI Configuration
OCI_COMPARTMENT_OCID="ocid1.compartment.oc1..aaaa..."
OCI_REGION="us-ashburn-1"

# Optional: Default time ranges
DEFAULT_TIME_RANGE="1h"
DEFAULT_RESOLUTION="1m"

# Optional: Debug and performance
DEBUG_MODE="false"
REQUEST_TIMEOUT="30000"
MAX_DATAPOINTS="1000"

# Enhanced Features (Enhanced server only)
ENABLE_MULTI_TENANCY="true"
ENABLE_TEMPLATE_VARIABLES="true"
AUTO_DISCOVER_PROFILES="true"
```

### OCI Authentication Setup
```bash
# Install and configure OCI CLI
brew install oci-cli  # macOS
sudo yum install python-oci-cli  # Oracle Linux

# Configure authentication
oci setup config

# Verify configuration
oci iam compartment list

# For multiple profiles (Enhanced features)
oci setup config --profile secondary-tenancy
```

## Project Structure

```
mcp-oci-metrics-server/
├── src/
│   ├── index.ts                 # Standard MCP server (25+ tools)
│   ├── index-enhanced.ts        # Enhanced server (35+ tools)
│   ├── index-standard.ts        # Alias to standard
│   ├── oci/                     # OCI integration layer
│   │   ├── MonitoringClient.ts      # Core monitoring API
│   │   ├── OCIRestClient.ts         # Direct REST client
│   │   ├── CoreServicesClient.ts    # Compute management
│   │   ├── InstanceCorrelationService.ts  # Logan integration
│   │   ├── DatasourceManager.ts     # Multi-tenancy (Enhanced)
│   │   ├── AuthenticationManager.ts # Auth handling (Enhanced)
│   │   ├── MQLQueryEngine.ts       # Query language (Enhanced)
│   │   └── TemplateVariableEngine.ts # Variables (Enhanced)
│   ├── visualization/           # Chart generation
│   │   └── GraphGenerator.ts
│   ├── utils/                   # Utility functions
│   │   └── TimeUtils.ts
│   └── types/                   # TypeScript definitions
│       └── index.ts
├── fastmcp_server.py           # Python FastMCP implementation
├── test-server.js              # Connectivity testing
├── dist/                       # Compiled TypeScript
├── claude-desktop-config.json  # Claude Desktop integration
├── README.md                   # Primary documentation
├── ENHANCED_FEATURES.md        # Enhanced version documentation
├── INSTALL.md                  # Installation guide
├── MQL_EXAMPLES.md            # MQL query examples
├── SECURITY.md                # Security considerations
└── CLAUDE.md                  # This file
```

## Integration Points

### 1. Claude Desktop Integration
Update `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "oci-metrics": {
      "command": "node",
      "args": ["/path/to/mcp-oci-metrics-server/dist/index-enhanced.js"],
      "env": {
        "OCI_COMPARTMENT_OCID": "ocid1.compartment.oc1..your_compartment",
        "OCI_REGION": "us-ashburn-1"
      }
    }
  }
}
```

### 2. Logan MCP Integration
- Timestamp synchronization for log correlation
- IP address to instance OCID mapping
- Security event correlation workflow
- Bidirectional data exchange

### 3. Data Science MCP Integration
- Anomaly detection data preparation
- Time series forecasting data formatting
- Statistical analysis correlation matrices
- ML-ready data export

## Common Tasks

### Adding New OCI Service Support
1. Update `MonitoringClient.ts` with new namespace
2. Add service-specific metric mappings
3. Update type definitions in `types/index.ts`
4. Add examples to `MQL_EXAMPLES.md`

### Adding New MQL Functions
1. Extend `MQLQueryEngine.ts` parser
2. Implement function logic in query executor
3. Add validation rules
4. Update documentation and examples

### Adding New Template Variable Types
1. Extend `TemplateVariableEngine.ts` resolver
2. Add variable type definitions
3. Update dependency resolution logic
4. Add UI integration examples

### Testing Changes
```bash
# Test standard server
node test-server.js standard

# Test enhanced server
node test-server.js enhanced

# Test specific functionality
node -e "
const server = require('./dist/index-enhanced.js');
server.testMQLQuery('CpuUtilization[5m].mean()');
"

# Validate MQL syntax
node -e "
const { MQLQueryEngine } = require('./dist/oci/MQLQueryEngine.js');
const engine = new MQLQueryEngine();
console.log(engine.validate('your_mql_query_here'));
"
```

## Security Considerations

### Authentication Best Practices
- Use Instance Principal for OCI-hosted deployments
- Rotate API keys regularly (90 days recommended)
- Use least-privilege IAM policies
- Encrypt sensitive configuration data
- Audit tool usage and access patterns

### Required OCI Permissions
```json
{
  "statements": [
    "allow group mcp-users to read metrics in compartment your-compartment",
    "allow group mcp-users to read instances in compartment your-compartment",
    "allow group mcp-users to manage instances in compartment your-compartment",
    "allow group mcp-users to read vnics in compartment your-compartment",
    "allow group mcp-users to read volumes in compartment your-compartment"
  ]
}
```

## Performance Optimization

### Recommended Settings
- `MAX_DATAPOINTS`: 1000 (prevent memory issues)
- `REQUEST_TIMEOUT`: 30000ms (handle slow queries)
- `DEFAULT_RESOLUTION`: "1m" (balance detail vs performance)
- Connection pooling enabled by default
- Automatic retry with exponential backoff

### Monitoring and Observability
- Built-in connection health monitoring
- Query performance metrics
- Error rate tracking
- Authentication success/failure logging
- Resource usage monitoring

## Important Notes

- **Node.js Version**: Requires Node.js 18.0+ for modern JavaScript features
- **Python Version**: Requires Python 3.8+ for FastMCP server
- **OCI Permissions**: Monitoring read access minimum, compute manage for instance operations
- **Network**: Outbound HTTPS (443) access to OCI APIs required
- **Memory**: Minimum 256MB RAM recommended for metric processing
- **Storage**: Minimal disk usage, mostly for temporary metric caching

## Troubleshooting

### Common Issues
1. **Authentication Failures**: Verify OCI CLI configuration and API key permissions
2. **Network Timeouts**: Check OCI service availability and network connectivity  
3. **Memory Issues**: Reduce `MAX_DATAPOINTS` or query time ranges
4. **Missing Metrics**: Verify compartment OCID and metric namespace availability
5. **MQL Parse Errors**: Use `validate_mql` tool for syntax checking

### Debug Mode
```bash
export DEBUG_MODE="true"
node dist/index-enhanced.js
```

### Logging Levels
- **ERROR**: Authentication, network, and critical failures
- **WARN**: Performance issues, fallbacks, deprecated features
- **INFO**: Tool executions, query results, state changes
- **DEBUG**: Detailed API calls, parsing, internal operations

This MCP server provides enterprise-grade OCI monitoring capabilities with LLM integration, making it ideal for AI-powered infrastructure management, incident response, and operational analytics.