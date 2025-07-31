/**
 * Enhanced Authentication Manager
 * Supports both Instance Principal and User Principal authentication
 * Based on OCI Grafana plugin authentication patterns
 */
export interface AuthenticationConfig {
    method: 'instance_principal' | 'user_principal';
    profile?: string;
    configFile?: string;
    tenancyOCID?: string;
    userOCID?: string;
    fingerprint?: string;
    keyFile?: string;
    region?: string;
    passphraseFile?: string;
}
export interface AuthenticationContext {
    method: 'instance_principal' | 'user_principal';
    tenancyOCID: string;
    region: string;
    profile?: string;
    isValid: boolean;
    expires?: Date;
    metadata?: Record<string, any>;
}
export interface InstanceMetadata {
    instanceId: string;
    compartmentId: string;
    availabilityDomain: string;
    faultDomain: string;
    region: string;
    shape: string;
    displayName: string;
    timeCreated: string;
    lifecycleState: string;
}
export declare class AuthenticationManager {
    private contexts;
    private instanceMetadata;
    private metadataCache;
    private readonly CACHE_TTL;
    constructor();
    /**
     * Initialize authentication contexts
     */
    private initializeAuthentication;
    /**
     * Check if instance principal authentication is available
     */
    private isInstancePrincipalAvailable;
    /**
     * Setup instance principal authentication
     */
    private setupInstancePrincipal;
    /**
     * Get instance metadata from OCI metadata service
     */
    private getInstanceMetadata;
    /**
     * Get tenancy OCID from instance metadata
     */
    private getTenancyFromInstanceMetadata;
    /**
     * Load user principal configurations from OCI config file
     */
    private loadUserPrincipalConfigs;
    /**
     * Parse OCI configuration file
     */
    private parseOCIConfig;
    /**
     * Validate user principal configuration
     */
    private validateUserPrincipal;
    /**
     * Get authentication context for profile/method
     */
    getAuthContext(identifier: string): AuthenticationContext | undefined;
    /**
     * Get all available authentication contexts
     */
    getAllAuthContexts(): AuthenticationContext[];
    /**
     * Get preferred authentication context
     */
    getPreferredAuthContext(): AuthenticationContext | undefined;
    /**
     * Test authentication for a specific context
     */
    testAuthentication(identifier: string): Promise<{
        success: boolean;
        message: string;
        details?: any;
    }>;
    /**
     * Test all authentication contexts
     */
    testAllAuthentication(): Promise<Array<{
        identifier: string;
        method: string;
        success: boolean;
        message: string;
        details?: any;
    }>>;
    /**
     * Get OCI CLI command prefix for authentication
     */
    getOCICommandPrefix(identifier?: string): string;
    /**
     * Execute OCI CLI command with appropriate authentication
     */
    executeOCICommand(command: string, identifier?: string, options?: {
        timeout?: number;
    }): Promise<{
        stdout: string;
        stderr: string;
    }>;
    /**
     * Get instance metadata (cached)
     */
    getCachedInstanceMetadata(): Promise<InstanceMetadata | null>;
    /**
     * Get compartment access list for a context
     */
    getCompartmentAccess(identifier?: string): Promise<string[]>;
    /**
     * Refresh authentication contexts
     */
    refreshAuthContexts(): Promise<void>;
    /**
     * Add custom authentication context
     */
    addAuthContext(identifier: string, config: AuthenticationConfig): void;
    /**
     * Remove authentication context
     */
    removeAuthContext(identifier: string): boolean;
    /**
     * Export authentication configuration
     */
    exportConfig(): Record<string, any>;
    /**
     * Generate authentication report
     */
    getAuthenticationReport(): {
        totalContexts: number;
        validContexts: number;
        invalidContexts: number;
        instancePrincipalAvailable: boolean;
        userPrincipalProfiles: string[];
        preferredContext?: string;
    };
}
//# sourceMappingURL=AuthenticationManager.d.ts.map