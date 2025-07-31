/**
 * Enhanced Authentication Manager
 * Supports both Instance Principal and User Principal authentication
 * Based on OCI Grafana plugin authentication patterns
 */
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
const execAsync = promisify(exec);
export class AuthenticationManager {
    contexts = new Map();
    instanceMetadata = null;
    metadataCache = new Map();
    CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    constructor() {
        this.initializeAuthentication();
    }
    /**
     * Initialize authentication contexts
     */
    async initializeAuthentication() {
        try {
            // Check for instance principal first
            if (await this.isInstancePrincipalAvailable()) {
                await this.setupInstancePrincipal();
            }
            // Load user principal configurations
            await this.loadUserPrincipalConfigs();
        }
        catch (error) {
            console.error('Error initializing authentication:', error);
        }
    }
    /**
     * Check if instance principal authentication is available
     */
    async isInstancePrincipalAvailable() {
        try {
            // Check if running on OCI compute instance
            const metadataUrl = 'http://169.254.169.254/opc/v2/instance/';
            const result = await execAsync(`curl -s --connect-timeout 2 -H "Authorization: Bearer Oracle" "${metadataUrl}" | head -c 100`);
            return result.stdout.includes('instance') || result.stdout.includes('ocid');
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Setup instance principal authentication
     */
    async setupInstancePrincipal() {
        try {
            const metadata = await this.getInstanceMetadata();
            if (metadata) {
                this.instanceMetadata = metadata;
                const context = {
                    method: 'instance_principal',
                    tenancyOCID: await this.getTenancyFromInstanceMetadata(),
                    region: metadata.region,
                    isValid: true,
                    metadata: {
                        instanceId: metadata.instanceId,
                        compartmentId: metadata.compartmentId,
                        shape: metadata.shape
                    }
                };
                this.contexts.set('instance_principal', context);
            }
        }
        catch (error) {
            console.error('Error setting up instance principal:', error);
        }
    }
    /**
     * Get instance metadata from OCI metadata service
     */
    async getInstanceMetadata() {
        try {
            const baseUrl = 'http://169.254.169.254/opc/v2/instance/';
            const headers = '-H "Authorization: Bearer Oracle"';
            // Get instance data
            const { stdout } = await execAsync(`curl -s ${headers} "${baseUrl}"`);
            const instanceData = JSON.parse(stdout);
            return {
                instanceId: instanceData.id,
                compartmentId: instanceData.compartmentId,
                availabilityDomain: instanceData.availabilityDomain,
                faultDomain: instanceData.faultDomain || 'FAULT-DOMAIN-1',
                region: instanceData.region,
                shape: instanceData.shape,
                displayName: instanceData.displayName,
                timeCreated: instanceData.timeCreated,
                lifecycleState: instanceData.lifecycleState
            };
        }
        catch (error) {
            console.error('Error getting instance metadata:', error);
            return null;
        }
    }
    /**
     * Get tenancy OCID from instance metadata
     */
    async getTenancyFromInstanceMetadata() {
        try {
            // Try to get tenancy from instance compartment
            if (this.instanceMetadata) {
                // Extract tenancy from compartment OCID
                const compartmentId = this.instanceMetadata.compartmentId;
                const tenancyMatch = compartmentId.match(/^ocid1\.tenancy\.oc1\.\.([^.]+)/);
                if (tenancyMatch) {
                    return `ocid1.tenancy.oc1..${tenancyMatch[1]}`;
                }
                // Fallback: Try to get from principal info
                const { stdout } = await execAsync(`oci iam region list --auth instance_principal --output json | head -1`);
                // This would contain tenant info in the response headers or metadata
            }
            return 'auto-detected';
        }
        catch (error) {
            return 'auto-detected';
        }
    }
    /**
     * Load user principal configurations from OCI config file
     */
    async loadUserPrincipalConfigs() {
        try {
            const configPath = path.join(os.homedir(), '.oci', 'config');
            const configContent = execSync(`cat "${configPath}" 2>/dev/null || echo ""`, { encoding: 'utf8' });
            if (!configContent.trim()) {
                return;
            }
            const profiles = this.parseOCIConfig(configContent);
            for (const profile of profiles) {
                if (profile.tenancy && profile.user && profile.fingerprint && profile.key_file) {
                    const context = {
                        method: 'user_principal',
                        tenancyOCID: profile.tenancy,
                        region: profile.region || 'us-ashburn-1',
                        profile: profile.name,
                        isValid: await this.validateUserPrincipal(profile),
                        metadata: {
                            userOCID: profile.user,
                            fingerprint: profile.fingerprint,
                            keyFile: profile.key_file
                        }
                    };
                    this.contexts.set(profile.name, context);
                }
            }
        }
        catch (error) {
            console.error('Error loading user principal configs:', error);
        }
    }
    /**
     * Parse OCI configuration file
     */
    parseOCIConfig(content) {
        const profiles = [];
        const lines = content.split('\n');
        let currentProfile = null;
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                if (currentProfile) {
                    profiles.push(currentProfile);
                }
                currentProfile = {
                    name: trimmed.slice(1, -1)
                };
            }
            else if (currentProfile && trimmed.includes('=')) {
                const [key, value] = trimmed.split('=', 2);
                currentProfile[key.trim()] = value.trim();
            }
        }
        if (currentProfile) {
            profiles.push(currentProfile);
        }
        return profiles;
    }
    /**
     * Validate user principal configuration
     */
    async validateUserPrincipal(profile) {
        try {
            // Test authentication by making a simple API call
            const command = `oci iam user get --user-id "${profile.user}" --profile "${profile.name}" --output json`;
            await execAsync(command);
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get authentication context for profile/method
     */
    getAuthContext(identifier) {
        return this.contexts.get(identifier);
    }
    /**
     * Get all available authentication contexts
     */
    getAllAuthContexts() {
        return Array.from(this.contexts.values());
    }
    /**
     * Get preferred authentication context
     */
    getPreferredAuthContext() {
        // Prefer instance principal if available and valid
        const instancePrincipal = this.contexts.get('instance_principal');
        if (instancePrincipal?.isValid) {
            return instancePrincipal;
        }
        // Fall back to DEFAULT profile
        const defaultProfile = this.contexts.get('DEFAULT');
        if (defaultProfile?.isValid) {
            return defaultProfile;
        }
        // Return first valid context
        for (const context of this.contexts.values()) {
            if (context.isValid) {
                return context;
            }
        }
        return undefined;
    }
    /**
     * Test authentication for a specific context
     */
    async testAuthentication(identifier) {
        const context = this.contexts.get(identifier);
        if (!context) {
            return {
                success: false,
                message: 'Authentication context not found'
            };
        }
        try {
            let command;
            if (context.method === 'instance_principal') {
                command = `oci iam region list --auth instance_principal --region ${context.region} --output json`;
            }
            else {
                command = `oci iam region list --profile "${context.profile}" --region ${context.region} --output json`;
            }
            const { stdout } = await execAsync(command);
            const result = JSON.parse(stdout);
            // Update context validity
            context.isValid = true;
            return {
                success: true,
                message: `Authentication successful for ${context.method}`,
                details: {
                    method: context.method,
                    tenancy: context.tenancyOCID.substring(0, 20) + '...',
                    region: context.region,
                    regionsAvailable: result.data?.length || 0
                }
            };
        }
        catch (error) {
            // Update context validity
            context.isValid = false;
            return {
                success: false,
                message: `Authentication failed: ${error instanceof Error ? error.message : String(error)}`,
                details: {
                    method: context.method,
                    identifier
                }
            };
        }
    }
    /**
     * Test all authentication contexts
     */
    async testAllAuthentication() {
        const results = [];
        for (const [identifier, context] of this.contexts.entries()) {
            const result = await this.testAuthentication(identifier);
            results.push({
                identifier,
                method: context.method,
                ...result
            });
        }
        return results;
    }
    /**
     * Get OCI CLI command prefix for authentication
     */
    getOCICommandPrefix(identifier) {
        const context = identifier ? this.contexts.get(identifier) : this.getPreferredAuthContext();
        if (!context) {
            throw new Error('No valid authentication context available');
        }
        let prefix = 'oci';
        if (context.method === 'instance_principal') {
            prefix += ' --auth instance_principal';
        }
        else if (context.profile) {
            prefix += ` --profile "${context.profile}"`;
        }
        prefix += ` --region "${context.region}"`;
        return prefix;
    }
    /**
     * Execute OCI CLI command with appropriate authentication
     */
    async executeOCICommand(command, identifier, options) {
        const context = identifier ? this.contexts.get(identifier) : this.getPreferredAuthContext();
        if (!context || !context.isValid) {
            throw new Error('No valid authentication context available');
        }
        let fullCommand;
        if (context.method === 'instance_principal') {
            fullCommand = `oci ${command} --auth instance_principal --region "${context.region}" --output json`;
        }
        else {
            fullCommand = `oci ${command} --profile "${context.profile}" --region "${context.region}" --output json`;
        }
        try {
            const result = await execAsync(fullCommand, {
                timeout: options?.timeout || 30000
            });
            return result;
        }
        catch (error) {
            // Mark context as invalid if authentication fails
            if (error instanceof Error && error.message.includes('authentication')) {
                context.isValid = false;
            }
            throw error;
        }
    }
    /**
     * Get instance metadata (cached)
     */
    async getCachedInstanceMetadata() {
        const cacheKey = 'instance_metadata';
        const cached = this.metadataCache.get(cacheKey);
        if (cached && cached.expires > new Date()) {
            return cached.data;
        }
        const metadata = await this.getInstanceMetadata();
        if (metadata) {
            this.metadataCache.set(cacheKey, {
                data: metadata,
                expires: new Date(Date.now() + this.CACHE_TTL)
            });
        }
        return metadata;
    }
    /**
     * Get compartment access list for a context
     */
    async getCompartmentAccess(identifier) {
        try {
            const { stdout } = await this.executeOCICommand('iam compartment list', identifier);
            const result = JSON.parse(stdout);
            if (result.data && Array.isArray(result.data)) {
                return result.data.map((compartment) => compartment.id);
            }
            return [];
        }
        catch (error) {
            console.error('Error getting compartment access:', error);
            return [];
        }
    }
    /**
     * Refresh authentication contexts
     */
    async refreshAuthContexts() {
        // Clear existing contexts except instance principal
        const instancePrincipal = this.contexts.get('instance_principal');
        this.contexts.clear();
        if (instancePrincipal) {
            this.contexts.set('instance_principal', instancePrincipal);
        }
        // Reload configurations
        await this.initializeAuthentication();
    }
    /**
     * Add custom authentication context
     */
    addAuthContext(identifier, config) {
        const context = {
            method: config.method,
            tenancyOCID: config.tenancyOCID || '',
            region: config.region || 'us-ashburn-1',
            profile: config.profile,
            isValid: false, // Will be validated on first use
            metadata: {
                userOCID: config.userOCID,
                fingerprint: config.fingerprint,
                keyFile: config.keyFile
            }
        };
        this.contexts.set(identifier, context);
    }
    /**
     * Remove authentication context
     */
    removeAuthContext(identifier) {
        return this.contexts.delete(identifier);
    }
    /**
     * Export authentication configuration
     */
    exportConfig() {
        const config = {};
        for (const [identifier, context] of this.contexts.entries()) {
            config[identifier] = {
                method: context.method,
                tenancyOCID: context.tenancyOCID,
                region: context.region,
                profile: context.profile,
                isValid: context.isValid,
                metadata: context.metadata
            };
        }
        return config;
    }
    /**
     * Generate authentication report
     */
    getAuthenticationReport() {
        const contexts = Array.from(this.contexts.values());
        const validContexts = contexts.filter(c => c.isValid);
        const userProfiles = contexts
            .filter(c => c.method === 'user_principal' && c.profile)
            .map(c => c.profile);
        const preferred = this.getPreferredAuthContext();
        return {
            totalContexts: contexts.length,
            validContexts: validContexts.length,
            invalidContexts: contexts.length - validContexts.length,
            instancePrincipalAvailable: this.contexts.has('instance_principal'),
            userPrincipalProfiles: userProfiles,
            preferredContext: preferred ?
                Array.from(this.contexts.entries()).find(([, ctx]) => ctx === preferred)?.[0] :
                undefined
        };
    }
}
//# sourceMappingURL=AuthenticationManager.js.map