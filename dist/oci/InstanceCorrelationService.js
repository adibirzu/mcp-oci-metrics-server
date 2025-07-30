/**
 * Instance Correlation Service
 * Maps OCI instance OCIDs, names, and IP addresses for Logan log correlation
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import { OCIRestClient } from './OCIRestClient.js';
const execAsync = promisify(exec);
export class InstanceCorrelationService {
    restClient = null;
    useRestAPI;
    instanceCache = new Map();
    correlationCache = new Map();
    cacheExpiry = 300000; // 5 minutes
    lastCacheUpdate = 0;
    constructor(useRestAPI = false) {
        this.useRestAPI = useRestAPI;
        if (this.useRestAPI) {
            try {
                this.restClient = new OCIRestClient();
            }
            catch (error) {
                console.error('Failed to initialize REST client for correlation service:', error);
                this.useRestAPI = false;
            }
        }
    }
    /**
     * Get all compute instances in the compartment
     */
    async getComputeInstances(compartmentId) {
        const targetCompartmentId = compartmentId || process.env.OCI_COMPARTMENT_ID;
        if (!targetCompartmentId) {
            throw new Error('Compartment ID is required for instance discovery');
        }
        // Check cache first
        if (this.isCacheValid()) {
            return Array.from(this.instanceCache.values());
        }
        let instances = [];
        if (this.useRestAPI && this.restClient) {
            try {
                instances = await this.getInstancesViaREST(targetCompartmentId);
            }
            catch (error) {
                console.error('REST API failed, falling back to CLI:', error);
                instances = await this.getInstancesViaCLI(targetCompartmentId);
            }
        }
        else {
            instances = await this.getInstancesViaCLI(targetCompartmentId);
        }
        // Update cache
        this.instanceCache.clear();
        instances.forEach(instance => {
            this.instanceCache.set(instance.ocid, instance);
        });
        this.lastCacheUpdate = Date.now();
        return instances;
    }
    /**
     * Get instances via REST API
     */
    async getInstancesViaREST(compartmentId) {
        if (!this.restClient) {
            throw new Error('REST client not initialized');
        }
        try {
            // Get compute instances
            const instancesResponse = await this.restClient['httpClient'].get(`https://iaas.${this.restClient.getRegion()}.oraclecloud.com/20160918/instances?compartmentId=${compartmentId}&limit=1000`);
            const instances = [];
            if (instancesResponse.data && Array.isArray(instancesResponse.data)) {
                for (const instanceData of instancesResponse.data) {
                    // Get VNIC attachments for IP addresses
                    const vnicResponse = await this.restClient['httpClient'].get(`https://iaas.${this.restClient.getRegion()}.oraclecloud.com/20160918/vnicAttachments?compartmentId=${compartmentId}&instanceId=${instanceData.id}&limit=100`);
                    let privateIp;
                    let publicIp;
                    if (vnicResponse.data && Array.isArray(vnicResponse.data)) {
                        for (const vnicAttachment of vnicResponse.data) {
                            if (vnicAttachment.vnicId) {
                                // Get VNIC details
                                const vnicDetailResponse = await this.restClient['httpClient'].get(`https://iaas.${this.restClient.getRegion()}.oraclecloud.com/20160918/vnics/${vnicAttachment.vnicId}`);
                                if (vnicDetailResponse.data) {
                                    privateIp = vnicDetailResponse.data.privateIp || privateIp;
                                    publicIp = vnicDetailResponse.data.publicIp || publicIp;
                                }
                            }
                        }
                    }
                    instances.push({
                        ocid: instanceData.id,
                        displayName: instanceData.displayName || 'Unknown',
                        privateIp,
                        publicIp,
                        shape: instanceData.shape || 'Unknown',
                        state: instanceData.lifecycleState || 'Unknown',
                        availabilityDomain: instanceData.availabilityDomain || 'Unknown',
                        compartmentId: instanceData.compartmentId,
                        timeCreated: instanceData.timeCreated,
                        freeformTags: instanceData.freeformTags,
                        definedTags: instanceData.definedTags
                    });
                }
            }
            return instances;
        }
        catch (error) {
            console.error('Failed to get instances via REST API:', error);
            throw error;
        }
    }
    /**
     * Get instances via OCI CLI
     */
    async getInstancesViaCLI(compartmentId) {
        try {
            // Get compute instances
            const instancesCommand = `oci compute instance list --compartment-id "${compartmentId}" --output json --limit 1000`;
            const { stdout: instancesOutput } = await execAsync(instancesCommand);
            const instancesResponse = JSON.parse(instancesOutput);
            const instances = [];
            if (instancesResponse.data && Array.isArray(instancesResponse.data)) {
                for (const instanceData of instancesResponse.data) {
                    let privateIp;
                    let publicIp;
                    try {
                        // Get VNIC attachments
                        const vnicCommand = `oci compute vnic-attachment list --compartment-id "${compartmentId}" --instance-id "${instanceData.id}" --output json`;
                        const { stdout: vnicOutput } = await execAsync(vnicCommand);
                        const vnicResponse = JSON.parse(vnicOutput);
                        if (vnicResponse.data && Array.isArray(vnicResponse.data)) {
                            for (const vnicAttachment of vnicResponse.data) {
                                if (vnicAttachment['vnic-id']) {
                                    // Get VNIC details
                                    const vnicDetailCommand = `oci network vnic get --vnic-id "${vnicAttachment['vnic-id']}" --output json`;
                                    const { stdout: vnicDetailOutput } = await execAsync(vnicDetailCommand);
                                    const vnicDetailResponse = JSON.parse(vnicDetailOutput);
                                    if (vnicDetailResponse.data) {
                                        privateIp = vnicDetailResponse.data['private-ip'] || privateIp;
                                        publicIp = vnicDetailResponse.data['public-ip'] || publicIp;
                                    }
                                }
                            }
                        }
                    }
                    catch (vnicError) {
                        console.error(`Failed to get VNIC info for instance ${instanceData.id}:`, vnicError);
                    }
                    instances.push({
                        ocid: instanceData.id,
                        displayName: instanceData['display-name'] || 'Unknown',
                        privateIp,
                        publicIp,
                        shape: instanceData.shape || 'Unknown',
                        state: instanceData['lifecycle-state'] || 'Unknown',
                        availabilityDomain: instanceData['availability-domain'] || 'Unknown',
                        compartmentId: instanceData['compartment-id'],
                        timeCreated: instanceData['time-created'],
                        freeformTags: instanceData['freeform-tags'],
                        definedTags: instanceData['defined-tags']
                    });
                }
            }
            return instances;
        }
        catch (error) {
            console.error('Failed to get instances via CLI:', error);
            throw error;
        }
    }
    /**
     * Generate correlation mappings for Logan integration
     */
    async generateCorrelationMappings(compartmentId) {
        const instances = await this.getComputeInstances(compartmentId);
        const correlations = [];
        for (const instance of instances) {
            const ipAddresses = [];
            const identifiers = [];
            const searchPatterns = [];
            // Add IP addresses
            if (instance.privateIp) {
                ipAddresses.push(instance.privateIp);
                searchPatterns.push(instance.privateIp);
            }
            if (instance.publicIp) {
                ipAddresses.push(instance.publicIp);
                searchPatterns.push(instance.publicIp);
            }
            // Add identifiers
            identifiers.push(instance.ocid);
            identifiers.push(instance.displayName);
            // Add search patterns for Logan
            searchPatterns.push(instance.ocid);
            searchPatterns.push(instance.displayName);
            searchPatterns.push(instance.displayName.toLowerCase());
            searchPatterns.push(instance.displayName.replace(/[^a-zA-Z0-9]/g, ''));
            // Add shape-based patterns
            searchPatterns.push(instance.shape);
            const correlation = {
                ocid: instance.ocid,
                instanceName: instance.displayName,
                privateIp: instance.privateIp || null,
                publicIp: instance.publicIp || null,
                shape: instance.shape,
                state: instance.state,
                compartmentId: instance.compartmentId,
                loganCorrelationData: {
                    ipAddresses,
                    identifiers,
                    searchPatterns: [...new Set(searchPatterns)] // Remove duplicates
                }
            };
            correlations.push(correlation);
        }
        // Update correlation cache
        this.correlationCache.clear();
        correlations.forEach(correlation => {
            this.correlationCache.set(correlation.ocid, correlation);
        });
        return correlations;
    }
    /**
     * Find instances by IP address
     */
    async findInstancesByIP(ipAddresses, compartmentId) {
        const correlations = await this.generateCorrelationMappings(compartmentId);
        return correlations.filter(correlation => ipAddresses.some(ip => correlation.loganCorrelationData.ipAddresses.includes(ip)));
    }
    /**
     * Find instances by name pattern
     */
    async findInstancesByName(namePattern, compartmentId) {
        const correlations = await this.generateCorrelationMappings(compartmentId);
        const pattern = namePattern.toLowerCase();
        return correlations.filter(correlation => correlation.instanceName.toLowerCase().includes(pattern) ||
            correlation.loganCorrelationData.searchPatterns.some(searchPattern => searchPattern.toLowerCase().includes(pattern)));
    }
    /**
     * Get instance by OCID
     */
    async getInstanceByOCID(ocid, compartmentId) {
        const correlations = await this.generateCorrelationMappings(compartmentId);
        return correlations.find(correlation => correlation.ocid === ocid) || null;
    }
    /**
     * Generate Logan-compatible correlation data
     */
    async generateLoganCorrelationData(timeRange, compartmentId) {
        const correlations = await this.generateCorrelationMappings(compartmentId);
        const loganData = [];
        for (const correlation of correlations) {
            // Add correlation entry for each IP address
            correlation.loganCorrelationData.ipAddresses.forEach(ip => {
                loganData.push({
                    timestamp: timeRange.startTime,
                    type: 'oci_instance_correlation',
                    instanceOCID: correlation.ocid,
                    instanceName: correlation.instanceName,
                    ipAddress: ip,
                    ipType: ip === correlation.privateIp ? 'private' : 'public',
                    shape: correlation.shape,
                    state: correlation.state,
                    compartmentId: correlation.compartmentId,
                    searchPatterns: correlation.loganCorrelationData.searchPatterns,
                    correlationMetadata: {
                        service: 'OCI Compute',
                        correlationType: 'instance_mapping',
                        loganCompatible: true,
                        timestampFormat: 'ISO 8601 UTC'
                    }
                });
            });
        }
        return loganData;
    }
    /**
     * Check if cache is valid
     */
    isCacheValid() {
        return (Date.now() - this.lastCacheUpdate) < this.cacheExpiry;
    }
    /**
     * Clear caches
     */
    clearCache() {
        this.instanceCache.clear();
        this.correlationCache.clear();
        this.lastCacheUpdate = 0;
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            instances: this.instanceCache.size,
            correlations: this.correlationCache.size,
            lastUpdate: this.lastCacheUpdate,
            isValid: this.isCacheValid()
        };
    }
}
//# sourceMappingURL=InstanceCorrelationService.js.map