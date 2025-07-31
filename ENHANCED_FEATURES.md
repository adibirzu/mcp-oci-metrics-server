# Enhanced OCI Metrics MCP Server - Grafana Collection Model

## Overview

This enhanced version (v2.0) of the OCI Metrics MCP Server adopts the **Grafana collection model architecture** to provide advanced metrics querying capabilities with multi-tenancy, template variables, and sophisticated query language support.

## Architecture Enhancements

### 1. Multi-Tenancy Support (`DatasourceManager`)

**Based on**: OCI Grafana plugin multi-tenancy patterns

**Features**:
- Support for multiple OCI tenancies in a single configuration
- Automatic discovery from `~/.oci/config` file
- Tenancy validation and connection testing
- Default tenancy management
- Configuration export/import for backup

**Key Components**:
- `TenancyConfig`: Individual tenancy configuration
- `DatasourceConfig`: Overall datasource settings
- Connection health monitoring
- Region management per tenancy

### 2. Enhanced Authentication (`AuthenticationManager`)

**Based on**: OCI Grafana plugin authentication patterns

**Features**:
- **Instance Principal**: For OCI-hosted environments (auto-detected)
- **User Principal**: Multiple profile support from OCI config
- Automatic authentication context selection
- Connection health monitoring and validation
- Authentication context caching

**Key Components**:
- `AuthenticationContext`: Active auth session management
- `InstanceMetadata`: OCI instance information retrieval
- Multi-profile OCI config parsing
- Real-time connection testing

### 3. MQL Query Engine (`MQLQueryEngine`)

**Based on**: OCI Monitoring Query Language and Grafana query patterns

**Features**:
- Advanced query syntax parsing: `CpuUtilization[5m].mean()`
- Rate calculations: `rate(NetworksBytesIn[1m])`
- Aggregation functions: mean, sum, max, min, percentile, rate
- Query validation and syntax checking
- Template-based queries with variable substitution
- Query suggestions per namespace

**Supported Syntax**:
```
MetricName[TimeWindow].Aggregation()
MetricName[TimeWindow]{DimensionFilters}.Aggregation() by (GroupBy)
rate(MetricName[TimeWindow])
percentile(MetricName[TimeWindow], 95)
```

### 4. Template Variable Engine (`TemplateVariableEngine`)

**Based on**: Grafana template variables and dashboard patterns

**Features**:
- Dynamic variable resolution from OCI APIs
- Variable dependency management
- Query-based variables (compartments, instances, namespaces)
- Interval and custom variables
- Auto-refresh on time range changes
- Variable interpolation in queries

**Built-in Variables**:
- `$interval`: Query resolution interval
- `$region`: OCI region selection
- `$compartment`: Compartment selection (multi-value)
- `$namespace`: Metrics namespace selection
- `$instance`: Compute instance selection (multi-value)
- `$metric`: Metric name selection

## Enhanced Tools

### Datasource Management
- `manage_datasource_config`: Multi-tenancy configuration management
- Actions: list, add, remove, set_default, test, export, import

### Advanced Querying
- `query_mql`: Execute MQL queries with advanced syntax
- `validate_mql`: Query syntax validation and suggestions
- `get_mql_suggestions`: Namespace-specific query suggestions
- `query_with_template`: Template-based query execution
- `query_cross_tenancy`: Cross-tenancy metric comparison

### Template Variables
- `manage_template_variables`: Variable lifecycle management  
- Actions: list, add, update, remove, refresh, resolve
- Variable types: constant, interval, custom, query, datasource

### Authentication
- `manage_authentication`: Authentication context management
- Actions: list, test, test_all, refresh, report
- Support for both Instance Principal and User Principal

### Configuration Management
- `export_configuration`: Complete configuration backup
- `import_configuration`: Configuration restoration
- Supports selective import/export with security considerations

## Integration Benefits

### 1. Grafana Compatibility
- Query syntax compatible with OCI Grafana plugin patterns
- Template variable concepts align with Grafana dashboards
- Multi-tenancy support mirrors Grafana datasource management

### 2. Enhanced User Experience
- Familiar query patterns for Grafana users
- Automated variable resolution
- Cross-tenancy comparison capabilities
- Configuration portability

### 3. Enterprise Features
- Multi-tenancy support for complex OCI environments
- Authentication context management
- Configuration backup/restore
- Health monitoring and validation

## Usage Patterns

### Basic Enhanced Query
```json
{
  "query": "CpuUtilization[5m].percentile(95)",
  "namespace": "oci_computeagent",
  "tenancyId": "production"
}
```

### Template Variable Usage
```json
{
  "query": "$metric[$interval].$aggregation() by (resourceId)",
  "namespace": "oci_computeagent",
  "variables": {
    "metric": "MemoryUtilization",
    "interval": "1m",
    "aggregation": "max"
  }
}
```

### Cross-Tenancy Comparison
```json
{
  "queries": [
    {
      "tenancyId": "production",
      "namespace": "oci_computeagent",
      "metricName": "CpuUtilization"
    },
    {
      "tenancyId": "development",
      "namespace": "oci_computeagent",
      "metricName": "CpuUtilization"
    }
  ],
  "timeRange": {"startTime": "1h"},
  "generateComparison": true
}
```

## Migration from v1.0

### Backward Compatibility
- All v1.0 tools remain available
- Standard server mode (`index-standard.ts`) unchanged
- Enhanced server mode (`index-enhanced.ts`) adds new capabilities

### Configuration Migration
- Automatic tenancy discovery from existing OCI config
- No breaking changes to existing tool interfaces
- Enhanced tools provide additional functionality

### Deployment Options
- **Standard Mode**: `npm run start:standard` - Original functionality
- **Enhanced Mode**: `npm start` - Full Grafana-style features
- **Development**: `npm run dev` - Watch mode with enhanced features

## Technical Implementation

### File Structure
```
src/
├── oci/
│   ├── DatasourceManager.ts         # Multi-tenancy management
│   ├── AuthenticationManager.ts     # Enhanced authentication
│   ├── MQLQueryEngine.ts           # Query language processing
│   ├── TemplateVariableEngine.ts   # Dynamic variables
│   └── [existing files...]
├── types/
│   └── index.ts                    # Enhanced type definitions
├── index-enhanced.ts               # Enhanced server implementation
└── index-standard.ts               # Original server (unchanged)
```

### Key Dependencies
- Existing MCP SDK and OCI tooling
- Enhanced TypeScript interfaces
- Grafana-inspired architecture patterns
- OCI CLI integration for authentication

## Future Enhancements

### Planned Features
1. **Alerting Integration**: MQL-based alert rules
2. **Dashboard Templates**: Pre-built dashboard configurations
3. **Advanced Visualizations**: Enhanced chart types
4. **Query Caching**: Performance optimization
5. **Metric Annotations**: Event correlation support

### Extensibility
- Plugin architecture for custom variables
- Custom aggregation functions
- External datasource integration
- Advanced template features

This enhanced architecture provides a foundation for sophisticated OCI metrics analysis while maintaining compatibility with existing workflows and tools.