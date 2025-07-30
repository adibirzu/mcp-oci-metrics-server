/**
 * Instance Correlation Service
 * Maps OCI instance OCIDs, names, and IP addresses for Logan log correlation
 */
export interface InstanceInfo {
    ocid: string;
    displayName: string;
    privateIp?: string;
    publicIp?: string;
    shape: string;
    state: string;
    availabilityDomain: string;
    compartmentId: string;
    timeCreated: string;
    freeformTags?: Record<string, string>;
    definedTags?: Record<string, any>;
}
export interface CorrelationMapping {
    ocid: string;
    instanceName: string;
    privateIp: string | null;
    publicIp: string | null;
    shape: string;
    state: string;
    compartmentId: string;
    loganCorrelationData: {
        ipAddresses: string[];
        identifiers: string[];
        searchPatterns: string[];
    };
}
export declare class InstanceCorrelationService {
    private restClient;
    private useRestAPI;
    private instanceCache;
    private correlationCache;
    private cacheExpiry;
    private lastCacheUpdate;
    constructor(useRestAPI?: boolean);
    /**
     * Get all compute instances in the compartment
     */
    getComputeInstances(compartmentId?: string): Promise<InstanceInfo[]>;
    /**
     * Get instances via REST API
     */
    private getInstancesViaREST;
    /**
     * Get instances via OCI CLI
     */
    private getInstancesViaCLI;
    /**
     * Generate correlation mappings for Logan integration
     */
    generateCorrelationMappings(compartmentId?: string): Promise<CorrelationMapping[]>;
    /**
     * Find instances by IP address
     */
    findInstancesByIP(ipAddresses: string[], compartmentId?: string): Promise<CorrelationMapping[]>;
    /**
     * Find instances by name pattern
     */
    findInstancesByName(namePattern: string, compartmentId?: string): Promise<CorrelationMapping[]>;
    /**
     * Get instance by OCID
     */
    getInstanceByOCID(ocid: string, compartmentId?: string): Promise<CorrelationMapping | null>;
    /**
     * Generate Logan-compatible correlation data
     */
    generateLoganCorrelationData(timeRange: {
        startTime: string;
        endTime: string;
    }, compartmentId?: string): Promise<any[]>;
    /**
     * Check if cache is valid
     */
    private isCacheValid;
    /**
     * Clear caches
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        instances: number;
        correlations: number;
        lastUpdate: number;
        isValid: boolean;
    };
}
//# sourceMappingURL=InstanceCorrelationService.d.ts.map