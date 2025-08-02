# Enhanced OCI MQL (Monitoring Query Language) Examples

This document provides comprehensive examples of OCI Monitoring Query Language (MQL) queries for use with the Enhanced OCI Metrics MCP Server.

## Table of Contents

1. [Basic Query Syntax](#basic-query-syntax)
2. [Aggregation Functions](#aggregation-functions)
3. [Dimension Filtering](#dimension-filtering)
4. [Fuzzy Matching](#fuzzy-matching)
5. [Grouping and Time Windows](#grouping-and-time-windows)
6. [Alarm Conditions](#alarm-conditions)
7. [Absence Detection](#absence-detection)
8. [Join Operations](#join-operations)
9. [Arithmetic Operations](#arithmetic-operations)
10. [Namespace-Specific Examples](#namespace-specific-examples)
11. [Advanced Patterns](#advanced-patterns)

## Basic Query Syntax

### Simple Metric Query
```mql
CpuUtilization[5m].mean()
```
- **Metric**: CpuUtilization
- **Time Window**: 5 minutes
- **Aggregation**: mean (average)

### With Explicit Percentile
```mql
CpuUtilization[5m].percentile(95)
```
Gets the 95th percentile of CPU utilization over 5 minutes.

### Rate Calculation
```mql
rate(NetworksBytesIn[1m])
```
Calculates the rate of change for network bytes in per minute.

## Aggregation Functions

### Statistical Functions
```mql
# Mean (average)
MemoryUtilization[5m].mean()

# Maximum value
MemoryUtilization[5m].max()

# Minimum value
MemoryUtilization[5m].min()

# Sum of all values
RequestCount[1m].sum()

# Count of data points
RequestCount[1m].count()

# Standard deviation
ResponseTime[5m].stddev()

# Variance
ResponseTime[5m].variance()
```

### Percentile Functions
```mql
# 50th percentile (median)
ResponseTime[5m].percentile(50)

# 95th percentile
ResponseTime[5m].percentile(95)

# 99th percentile
ResponseTime[5m].percentile(99)
```

## Dimension Filtering

### Exact Match
```mql
CpuUtilization[5m]{resourceId = "ocid1.instance.oc1.iad.abcd..."}.mean()
```

### Multiple Conditions
```mql
CpuUtilization[5m]{resourceId = "ocid1.instance.oc1.iad.abcd...", availabilityDomain = "mwVB:US-ASHBURN-AD-1"}.mean()
```

### Not Equal
```mql
CpuUtilization[5m]{state != "STOPPED"}.mean()
```

### Comparison Operators
```mql
# Greater than
DatabaseConnections[1m]{connectionCount > 50}.count()

# Less than or equal
StorageUtilization[1h]{usedPercent <= 80}.max()
```

### In Operator
```mql
CpuUtilization[5m]{resourceId in "id1|id2|id3"}.mean()
```

## Fuzzy Matching

### Wildcard Matching
```mql
# Match resources starting with "prod"
CpuUtilization[5m]{resourceDisplayName =~ "prod*"}.mean()

# Match resources ending with "web"
CpuUtilization[5m]{resourceDisplayName =~ "*web"}.mean()

# Match resources containing "staging"
CpuUtilization[5m]{resourceDisplayName =~ "*staging*"}.mean()
```

### Multiple Pattern Matching
```mql
CpuUtilization[1m]{resourceDisplayName =~ "web01|web02|web03"}.mean()
```

### Negative Fuzzy Matching
```mql
CpuUtilization[5m]{resourceDisplayName !~ "test*"}.mean()
```

## Grouping and Time Windows

### Group By Resource
```mql
CpuUtilization[5m].mean() by (resourceId)
```

### Group By Multiple Dimensions
```mql
CpuUtilization[5m].mean() by (resourceId, availabilityDomain)
```

### Using groupBy() Function
```mql
CpuUtilization[5m].groupBy(resourceId).mean()
```

### Different Time Windows
```mql
# 1 minute window
CpuUtilization[1m].mean()

# 15 minute window
CpuUtilization[15m].mean()

# 1 hour window
CpuUtilization[1h].mean()

# 1 day window
CpuUtilization[1d].mean()
```

## Alarm Conditions

### Threshold Comparisons
```mql
# CPU above 80%
CpuUtilization[5m].mean() > 80

# Memory above 90%
MemoryUtilization[5m].max() > 90

# Response time above 500ms
ResponseTime[1m].percentile(95) >= 500

# Disk usage below 10% free
DiskFreePercent[5m].min() < 10
```

### Equality Checks
```mql
# Exact value match
HealthyBackendCount[1m].min() == 0

# Not equal
ActiveConnections[1m].count() != 0
```

## Absence Detection

### Basic Absence
```mql
CpuUtilization[1m].absent()
```
Detects when CpuUtilization metric is absent (no data).

### Absence with Custom Duration
```mql
CpuUtilization[1m].absent(10m)
```
Triggers when metric is absent for 10 minutes.

### Grouped Absence Detection
```mql
CpuUtilization[1m].groupBy(resourceId).absent(5m)
```
Detects absence per resource instance.

## Join Operations

### AND Operations
```mql
CpuUtilization[5m].mean() > 80 && MemoryUtilization[5m].mean() > 70
```
Triggers when both CPU and memory are high.

### OR Operations
```mql
CpuUtilization[5m].mean() > 90 || MemoryUtilization[5m].mean() > 95
```
Triggers when either CPU or memory is critically high.

### Complex Joins
```mql
(CpuUtilization[5m].mean() > 80 && MemoryUtilization[5m].mean() > 70) || DiskUtilization[5m].max() > 90
```

## Arithmetic Operations

### Unit Conversion
```mql
# Convert milliseconds to seconds
TotalRequestLatency[1m].mean() / 1000

# Convert bytes to megabytes
NetworksBytesIn[1m].sum() / 1048576
```

### Mathematical Operations
```mql
# Addition
VnicBytesIn[1m].rate() + VnicBytesOut[1m].rate()

# Subtraction
TotalMemory[1m].max() - UsedMemory[1m].max()

# Multiplication
RequestCount[1m].sum() * 0.001

# Division
SuccessfulRequests[1m].sum() / TotalRequests[1m].sum()

# Modulo
RequestCount[1m].sum() % 100
```

## Namespace-Specific Examples

### Compute Agent (`oci_computeagent`)
```mql
# CPU utilization with threshold
CpuUtilization[5m].mean() > 80

# Memory utilization by resource
MemoryUtilization[5m].max() by (resourceId)

# Network rate calculation
rate(NetworksBytesIn[1m])

# Disk I/O monitoring
DiskBytesRead[5m].sum() + DiskBytesWritten[5m].sum()

# Instance-specific monitoring
CpuUtilization[1m]{resourceDisplayName =~ "web*"}.percentile(95)
```

### Load Balancer (`oci_lbaas`)
```mql
# Request rate monitoring
RequestCount[1m].sum()

# Response time percentiles
ResponseTime[5m].percentile(95)

# Backend health monitoring
HealthyBackendCount[1m].min() >= 1

# Connection monitoring
ActiveConnections[1m].mean() by (backendSetName)

# Load balancer performance
RequestCount[1m].sum() / ActiveConnections[1m].mean()
```

### VCN (`oci_vcn`)
```mql
# Network throughput
VnicBytesIn[1m].rate() + VnicBytesOut[1m].rate()

# Packet monitoring
PacketsIn[1m].sum() by (resourceId)

# Dropped packet detection
DroppedPacketsIn[5m].sum() > 100

# VNIC utilization
VnicBytesIn[1m].rate() / VnicBytesOut[1m].rate()
```

### Database (`oci_database`)
```mql
# Database CPU monitoring
CpuUtilization[5m].mean() > 75

# Connection monitoring
DatabaseConnections[1m].count() > 80

# Storage utilization
StorageUtilization[1h].max() > 85

# Database performance
CpuUtilization[5m].mean() && DatabaseConnections[1m].count() > 50
```

### Object Storage (`oci_objectstorage`)
```mql
# Request latency monitoring
TotalRequestLatency[1m].percentile(95) / 1000

# Request count by bucket
RequestCount[1m]{bucketName =~ "backup*"}.sum()

# Error rate calculation
(ErrorCount[1m].sum() / RequestCount[1m].sum()) * 100
```

## Advanced Patterns

### Complex Multi-Condition Alarms
```mql
# High resource utilization alarm
(CpuUtilization[5m].mean() > 80 && MemoryUtilization[5m].mean() > 70) || 
(DiskUtilization[5m].max() > 90)
```

### Performance Ratio Monitoring
```mql
# Error rate calculation
(ErrorCount[1m].sum() / RequestCount[1m].sum()) * 100 > 5

# Cache hit ratio
(CacheHits[1m].sum() / (CacheHits[1m].sum() + CacheMisses[1m].sum())) * 100 < 80
```

### Capacity Planning Queries
```mql
# Predict when disk will be full (simplified)
DiskUtilization[1h].max() + (DiskUtilization[1h].max() - DiskUtilization[24h].mean()) > 95

# Memory growth trend
MemoryUtilization[1h].mean() - MemoryUtilization[24h].mean() > 10
```

### Multi-Instance Monitoring
```mql
# Average across all web instances
CpuUtilization[5m]{resourceDisplayName =~ "web*"}.mean()

# Maximum across all database instances
MemoryUtilization[5m]{resourceDisplayName =~ "db*"}.max()

# Count of unhealthy instances
CpuUtilization[1m].absent(5m) by (resourceId)
```

### SLA Monitoring
```mql
# 99.9% availability target
(UptimeCount[1h].sum() / TotalCount[1h].sum()) * 100 > 99.9

# Response time SLA
ResponseTime[5m].percentile(99) < 200

# Error rate SLA
(ErrorCount[1h].sum() / RequestCount[1h].sum()) * 100 < 0.1
```

## Template Usage Examples

### Using Built-in Templates

#### Basic Metric Template
```json
{
  "templateName": "basic_metric",
  "variables": {
    "metricName": "CpuUtilization",
    "interval": "5m",
    "aggregation": "mean"
  }
}
```

#### Filtered Metric Template
```json
{
  "templateName": "filtered_metric",
  "variables": {
    "metricName": "CpuUtilization",
    "interval": "5m",
    "filters": "resourceDisplayName =~ \"prod*\"",
    "aggregation": "percentile(95)"
  }
}
```

#### Alarm Condition Template
```json
{
  "templateName": "alarm_condition",
  "variables": {
    "metricName": "MemoryUtilization",
    "interval": "5m",
    "filters": "",
    "aggregation": "max",
    "operator": ">",
    "threshold": "90"
  }
}
```

## Best Practices

### Query Optimization
1. **Use appropriate time windows**: Shorter windows for real-time monitoring, longer for trends
2. **Limit dimensions**: Only include necessary dimension filters
3. **Choose efficient aggregations**: Use `rate()` for counter metrics, `percentile()` for latency
4. **Group wisely**: Only group by dimensions you need for analysis

### Alarm Design
1. **Use percentiles for latency**: `percentile(95)` or `percentile(99)` for SLA monitoring
2. **Combine conditions**: Use `&&` and `||` for comprehensive alarm logic
3. **Set appropriate thresholds**: Based on baseline performance and business requirements
4. **Include absence detection**: Monitor for missing metrics with `.absent()`

### Template Variables
1. **Use descriptive names**: Make templates reusable and self-documenting
2. **Provide defaults**: Set reasonable default values for template variables
3. **Validate inputs**: Ensure template variables are properly validated

This comprehensive guide provides a foundation for creating effective OCI MQL queries. Combine these patterns based on your specific monitoring requirements and infrastructure setup.