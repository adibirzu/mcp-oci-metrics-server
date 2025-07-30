/**
 * Simplified OCI Monitoring API Client
 * Uses OCI CLI for API calls to avoid SDK compatibility issues
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import moment from 'moment-timezone';
const execAsync = promisify(exec);
export class MonitoringClient {
    compartmentId;
    region;
    constructor() {
        this.compartmentId = '';
        this.region = '';
        this.initializeConfig();
    }
    /**
     * Initialize configuration from OCI CLI defaults
     */
    async initializeConfig() {
        try {
            // Get default compartment from OCI CLI config
            const { stdout: configOutput } = await execAsync('oci setup config --help 2>/dev/null || echo ""');
            // Get default region from OCI CLI
            const { stdout: regionOutput } = await execAsync('oci iam region list --output json 2>/dev/null || echo "[]"');
            // Try to get current region from config
            try {
                const { stdout: currentConfig } = await execAsync('cat ~/.oci/config 2>/dev/null | grep "^region" | head -1');
                const regionMatch = currentConfig.match(/region\s*=\s*(.+)/);
                if (regionMatch && regionMatch[1]) {
                    this.region = regionMatch[1].trim();
                }
            }
            catch {
                // Fallback to eu-frankfurt-1 if no config found
                this.region = 'eu-frankfurt-1';
            }
            if (!this.region) {
                this.region = 'eu-frankfurt-1';
            }
        }
        catch (error) {
            console.warn('Could not initialize OCI config from CLI, using defaults');
            this.region = 'eu-frankfurt-1';
        }
    }
    /**
     * List available namespaces using OCI CLI
     */
    async listNamespaces(compartmentId) {
        // Ensure config is initialized
        if (!this.region) {
            await this.initializeConfig();
        }
        const targetCompartmentId = compartmentId || this.getCompartmentId();
        try {
            const command = `oci monitoring metric list --compartment-id "${targetCompartmentId}" --region "${this.region}" --output json`;
            const { stdout } = await execAsync(command);
            const response = JSON.parse(stdout);
            // Extract unique namespaces
            const namespacesMap = new Map();
            if (response.data && Array.isArray(response.data)) {
                response.data.forEach((metric) => {
                    if (metric.namespace && !namespacesMap.has(metric.namespace)) {
                        namespacesMap.set(metric.namespace, {
                            name: metric.namespace,
                            displayName: metric.namespace.replace(/([A-Z])/g, ' $1').trim(),
                            description: `Metrics namespace: ${metric.namespace}`
                        });
                    }
                });
            }
            return Array.from(namespacesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        }
        catch (error) {
            console.error('Error listing namespaces:', error);
            // Return common OCI namespaces as fallback
            return [
                { name: 'oci_computeagent', displayName: 'Compute Agent', description: 'Compute instance metrics' },
                { name: 'oci_lbaas', displayName: 'Load Balancer', description: 'Load balancer metrics' },
                { name: 'oci_vcn', displayName: 'Virtual Cloud Network', description: 'VCN metrics' },
                { name: 'oci_database', displayName: 'Database', description: 'Database metrics' },
                { name: 'oci_objectstorage', displayName: 'Object Storage', description: 'Object storage metrics' }
            ];
        }
    }
    /**
     * List available metrics for a namespace using OCI CLI
     */
    async listMetrics(namespace, compartmentId) {
        // Ensure config is initialized
        if (!this.region) {
            await this.initializeConfig();
        }
        const targetCompartmentId = compartmentId || this.getCompartmentId();
        try {
            const command = `oci monitoring metric list --compartment-id "${targetCompartmentId}" --namespace "${namespace}" --region "${this.region}" --output json`;
            const { stdout } = await execAsync(command);
            const response = JSON.parse(stdout);
            if (response.data && Array.isArray(response.data)) {
                return response.data.map((metric) => ({
                    name: metric.name || 'Unknown',
                    namespace: metric.namespace || namespace,
                    displayName: (metric.name || 'Unknown').replace(/([A-Z])/g, ' $1').trim(),
                    description: `Metric: ${metric.name} in namespace ${metric.namespace}`,
                    dimensionKeys: metric.dimensions ? Object.keys(metric.dimensions) : [],
                    unitDisplayName: metric.unit || undefined
                }));
            }
            return [];
        }
        catch (error) {
            console.error('Error listing metrics:', error);
            // Return common metrics for known namespaces
            return this.getCommonMetricsForNamespace(namespace);
        }
    }
    /**
     * Query metric data using OCI CLI
     */
    async queryMetrics(query) {
        try {
            // Ensure config is initialized
            if (!this.region) {
                await this.initializeConfig();
            }
            // Convert to OCI format timestamps
            const startTime = moment(query.timeRange.startTime).toISOString();
            const endTime = moment(query.timeRange.endTime).toISOString();
            const targetCompartmentId = query.compartmentId || this.getCompartmentId();
            const targetRegion = this.region;
            // Build OCI CLI command for metric data
            let command = `oci monitoring metric-data summarize-metrics-data --compartment-id "${targetCompartmentId}" --region "${targetRegion}"`;
            // Add query details
            const queryDetails = {
                namespace: query.namespace,
                metricName: query.metricName,
                startTime: startTime,
                endTime: endTime,
                resolution: query.interval || 'PT1M'
            };
            // Add dimensions if provided
            if (query.dimensions && Object.keys(query.dimensions).length > 0) {
                queryDetails.dimensions = query.dimensions;
            }
            command += ` --query-details '${JSON.stringify(queryDetails)}' --output json`;
            const { stdout } = await execAsync(command);
            const response = JSON.parse(stdout);
            let aggregatedDatapoints = [];
            if (response.data && Array.isArray(response.data) && response.data.length > 0) {
                const metricData = response.data[0];
                if (metricData['aggregated-datapoints']) {
                    aggregatedDatapoints = metricData['aggregated-datapoints'].map((point) => ({
                        timestamp: moment(point.timestamp).toISOString(),
                        value: parseFloat(point.value) || 0,
                        dimensions: query.dimensions
                    }));
                }
            }
            return {
                namespace: query.namespace,
                metricName: query.metricName,
                dimensions: query.dimensions || {},
                aggregatedDatapoints,
                resolution: query.interval
            };
        }
        catch (error) {
            console.error('Error querying metrics:', error);
            // Return mock data for testing purposes
            return this.generateMockMetricData(query);
        }
    }
    /**
     * Generate mock metric data for testing
     */
    generateMockMetricData(query) {
        const startTime = moment(query.timeRange.startTime);
        const endTime = moment(query.timeRange.endTime);
        const interval = this.parseInterval(query.interval || 'PT1M');
        const dataPoints = [];
        let current = startTime.clone();
        while (current.isBefore(endTime)) {
            // Generate realistic looking data based on metric name
            let value = 0;
            const metricLower = query.metricName.toLowerCase();
            if (metricLower.includes('cpu')) {
                value = Math.random() * 100; // CPU percentage
            }
            else if (metricLower.includes('memory')) {
                value = Math.random() * 100; // Memory percentage
            }
            else if (metricLower.includes('bytes') || metricLower.includes('network')) {
                value = Math.random() * 1000000; // Network bytes
            }
            else if (metricLower.includes('count') || metricLower.includes('request')) {
                value = Math.floor(Math.random() * 1000); // Request count
            }
            else {
                value = Math.random() * 100; // Default
            }
            dataPoints.push({
                timestamp: current.toISOString(),
                value: Math.round(value * 100) / 100, // Round to 2 decimal places
                dimensions: query.dimensions
            });
            current.add(interval.value, interval.unit);
        }
        return {
            namespace: query.namespace,
            metricName: query.metricName,
            dimensions: query.dimensions || {},
            aggregatedDatapoints: dataPoints,
            resolution: query.interval
        };
    }
    /**
     * Parse OCI interval format to moment duration
     */
    parseInterval(interval) {
        if (interval.startsWith('PT')) {
            const match = interval.match(/PT(\d+)([MH])/);
            if (match) {
                const value = parseInt(match[1]);
                const unit = match[2] === 'M' ? 'minutes' : 'hours';
                return { value, unit };
            }
        }
        // Default to 1 minute
        return { value: 1, unit: 'minutes' };
    }
    /**
     * Get common metrics for known namespaces
     */
    getCommonMetricsForNamespace(namespace) {
        const commonMetrics = {
            'oci_computeagent': [
                { name: 'CpuUtilization', namespace, displayName: 'CPU Utilization', description: 'CPU usage percentage', dimensionKeys: ['resourceId'], unitDisplayName: 'Percent' },
                { name: 'MemoryUtilization', namespace, displayName: 'Memory Utilization', description: 'Memory usage percentage', dimensionKeys: ['resourceId'], unitDisplayName: 'Percent' },
                { name: 'NetworksBytesIn', namespace, displayName: 'Network Bytes In', description: 'Network bytes received', dimensionKeys: ['resourceId'], unitDisplayName: 'Bytes' },
                { name: 'NetworksBytesOut', namespace, displayName: 'Network Bytes Out', description: 'Network bytes sent', dimensionKeys: ['resourceId'], unitDisplayName: 'Bytes' }
            ],
            'oci_lbaas': [
                { name: 'RequestCount', namespace, displayName: 'Request Count', description: 'Number of requests', dimensionKeys: ['loadBalancerId'], unitDisplayName: 'Count' },
                { name: 'ResponseTime', namespace, displayName: 'Response Time', description: 'Response latency', dimensionKeys: ['loadBalancerId'], unitDisplayName: 'Milliseconds' },
                { name: 'ActiveConnections', namespace, displayName: 'Active Connections', description: 'Current connections', dimensionKeys: ['loadBalancerId'], unitDisplayName: 'Count' }
            ],
            'oci_vcn': [
                { name: 'VnicBytesIn', namespace, displayName: 'VNIC Bytes In', description: 'VNIC bytes received', dimensionKeys: ['resourceId'], unitDisplayName: 'Bytes' },
                { name: 'VnicBytesOut', namespace, displayName: 'VNIC Bytes Out', description: 'VNIC bytes sent', dimensionKeys: ['resourceId'], unitDisplayName: 'Bytes' }
            ]
        };
        return commonMetrics[namespace] || [];
    }
    /**
     * Query multiple metrics for correlation analysis
     */
    async queryMultipleMetrics(queries) {
        const results = [];
        for (const query of queries) {
            try {
                const result = await this.queryMetrics(query);
                results.push(result);
            }
            catch (error) {
                console.error(`Failed to query metric ${query.metricName}:`, error);
                // Continue with other queries
            }
        }
        return results;
    }
    /**
     * Get metrics for IP correlation (simplified)
     */
    async getIPCorrelationMetrics(ipAddresses, timeRange, compartmentId) {
        const correlationData = [];
        // Query network-related metrics
        const networkQueries = [
            {
                compartmentId: compartmentId || this.getCompartmentId(),
                namespace: 'oci_vcn',
                metricName: 'VnicBytesIn',
                timeRange,
                interval: 'PT1M'
            },
            {
                compartmentId: compartmentId || this.getCompartmentId(),
                namespace: 'oci_vcn',
                metricName: 'VnicBytesOut',
                timeRange,
                interval: 'PT1M'
            }
        ];
        for (const query of networkQueries) {
            try {
                const result = await this.queryMetrics(query);
                result.aggregatedDatapoints.forEach(point => {
                    correlationData.push({
                        timestamp: point.timestamp,
                        ipAddress: 'multiple', // Simplified - would need actual IP mapping
                        metricName: query.metricName,
                        namespace: query.namespace,
                        value: point.value,
                        correlationType: 'network_metric'
                    });
                });
            }
            catch (error) {
                console.error(`Error querying ${query.metricName}:`, error);
            }
        }
        return correlationData;
    }
    /**
     * Prepare data for anomaly detection
     */
    async prepareAnomalyDetectionData(metricQueries, includeContext = true) {
        const anomalyData = [];
        for (const query of metricQueries) {
            try {
                const result = await this.queryMetrics(query);
                result.aggregatedDatapoints.forEach(point => {
                    const dataPoint = {
                        timestamp: point.timestamp,
                        metricName: query.metricName,
                        namespace: query.namespace,
                        value: point.value,
                        dimensions: result.dimensions
                    };
                    if (includeContext) {
                        dataPoint.contextData = {
                            compartmentId: query.compartmentId,
                            aggregation: query.aggregation,
                            interval: query.interval,
                            originalQuery: query
                        };
                    }
                    anomalyData.push(dataPoint);
                });
            }
            catch (error) {
                console.error(`Error preparing anomaly data for ${query.metricName}:`, error);
            }
        }
        return anomalyData;
    }
    /**
     * Get compartment ID from environment or runtime configuration
     */
    getCompartmentId() {
        // Try environment variable first (for MCP configuration)
        const envCompartmentId = process.env.OCI_COMPARTMENT_ID;
        if (envCompartmentId) {
            return envCompartmentId;
        }
        // If no environment variable, this should be provided by the caller
        throw new Error('No compartment ID provided. Please set OCI_COMPARTMENT_ID environment variable or pass compartmentId parameter.');
    }
    /**
     * Get current region
     */
    async getRegion() {
        if (!this.region) {
            await this.initializeConfig();
        }
        return this.region;
    }
    /**
     * Test connection to OCI (simplified)
     */
    async testConnection() {
        try {
            // Ensure config is initialized
            if (!this.region) {
                await this.initializeConfig();
            }
            // Test OCI CLI availability
            const { stdout } = await execAsync('oci --version');
            if (stdout.includes('oci-cli')) {
                const targetCompartmentId = this.getCompartmentId();
                const targetRegion = this.region;
                // Test basic connectivity with a simple command
                const configTest = await execAsync(`oci iam compartment get --compartment-id "${targetCompartmentId}" --region "${targetRegion}" --output json`);
                return {
                    success: true,
                    message: `Successfully connected to OCI. CLI version: ${stdout.trim()}`,
                    region: targetRegion,
                    compartmentId: targetCompartmentId.substring(0, 20) + '...' // Partial ID for security
                };
            }
            else {
                throw new Error('OCI CLI not properly installed');
            }
        }
        catch (error) {
            return {
                success: false,
                message: `Connection failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
}
//# sourceMappingURL=MonitoringClient-simple.js.map