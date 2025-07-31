/**
 * Enhanced Datasource Manager with Multi-tenancy Support
 * Based on OCI Grafana plugin architecture patterns
 */
export interface TenancyConfig {
    id: string;
    name: string;
    tenancyOCID: string;
    region: string;
    compartmentId?: string;
    authMethod: 'instance_principal' | 'user_principal';
    configProfile?: string;
    isDefault?: boolean;
}
export interface DatasourceConfig {
    name: string;
    tenancies: TenancyConfig[];
    defaultRegion: string;
    maxConcurrentQueries: number;
    queryTimeout: number;
    enableTemplateVariables: boolean;
    enableCustomMetrics: boolean;
    cacheEnabled: boolean;
    cacheTTL: number;
}
export interface AuthConfig {
    method: 'instance_principal' | 'user_principal';
    profile?: string;
    tenancyOCID?: string;
    userOCID?: string;
    fingerprint?: string;
    keyFile?: string;
    region?: string;
}
export declare class DatasourceManager {
    private config;
    private authConfigs;
    private configFilePath;
    constructor(configPath?: string);
    /**
     * Initialize default datasource configuration
     */
    private initializeDefaultConfig;
    /**
     * Load tenancy configurations from OCI config file
     * Similar to Grafana plugin's multi-tenancy approach
     */
    private loadTenancyConfigs;
    /**
     * Parse OCI configuration file content
     */
    private parseOCIConfig;
    /**
     * Detect if instance principal authentication is available
     */
    private detectInstancePrincipalAuth;
    /**
     * Create default single-tenancy configuration
     */
    private createDefaultTenancyConfig;
    /**
     * Get all configured tenancies
     */
    getTenancies(): TenancyConfig[];
    /**
     * Get specific tenancy configuration
     */
    getTenancy(tenancyId: string): TenancyConfig | undefined;
    /**
     * Get default tenancy
     */
    getDefaultTenancy(): TenancyConfig | undefined;
    /**
     * Get authentication configuration for tenancy
     */
    getAuthConfig(tenancyId: string): AuthConfig | undefined;
    /**
     * Add new tenancy configuration
     */
    addTenancy(tenancy: TenancyConfig, authConfig: AuthConfig): void;
    /**
     * Remove tenancy configuration
     */
    removeTenancy(tenancyId: string): boolean;
    /**
     * Set default tenancy
     */
    setDefaultTenancy(tenancyId: string): boolean;
    /**
     * Get datasource configuration
     */
    getConfig(): DatasourceConfig;
    /**
     * Update datasource configuration
     */
    updateConfig(updates: Partial<DatasourceConfig>): void;
    /**
     * Test tenancy connectivity
     */
    testTenancyConnection(tenancyId: string): Promise<{
        success: boolean;
        message: string;
        details?: any;
    }>;
    /**
     * Test all tenancy connections
     */
    testAllConnections(): Promise<Array<{
        tenancyId: string;
        tenancyName: string;
        success: boolean;
        message: string;
        details?: any;
    }>>;
    /**
     * Get available regions for a tenancy
     */
    getAvailableRegions(tenancyId: string): Promise<string[]>;
    /**
     * Validate tenancy configuration
     */
    validateTenancyConfig(tenancy: TenancyConfig): {
        valid: boolean;
        errors: string[];
    };
    /**
     * Export configuration for backup/migration
     */
    exportConfig(): string;
    /**
     * Import configuration from backup
     */
    importConfig(configJson: string): {
        success: boolean;
        errors: string[];
    };
}
//# sourceMappingURL=DatasourceManager.d.ts.map