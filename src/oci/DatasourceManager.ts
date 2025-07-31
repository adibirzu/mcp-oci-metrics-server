/**
 * Enhanced Datasource Manager with Multi-tenancy Support
 * Based on OCI Grafana plugin architecture patterns
 */

import { execSync } from 'child_process';
import path from 'path';
import os from 'os';

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

export class DatasourceManager {
  private config: DatasourceConfig;
  private authConfigs: Map<string, AuthConfig> = new Map();
  private configFilePath: string;

  constructor(configPath?: string) {
    this.configFilePath = configPath || path.join(os.homedir(), '.oci', 'config');
    this.config = this.initializeDefaultConfig();
    this.loadTenancyConfigs();
  }

  /**
   * Initialize default datasource configuration
   */
  private initializeDefaultConfig(): DatasourceConfig {
    return {
      name: 'oci-metrics-enhanced',
      tenancies: [],
      defaultRegion: 'us-ashburn-1',
      maxConcurrentQueries: 10,
      queryTimeout: 30000,
      enableTemplateVariables: true,
      enableCustomMetrics: true,
      cacheEnabled: true,
      cacheTTL: 300 // 5 minutes
    };
  }

  /**
   * Load tenancy configurations from OCI config file
   * Similar to Grafana plugin's multi-tenancy approach
   */
  private loadTenancyConfigs(): void {
    try {
      const configContent = execSync(`cat "${this.configFilePath}" 2>/dev/null || echo ""`, { encoding: 'utf8' });
      
      if (!configContent.trim()) {
        // No config file found, create default single-tenancy config
        this.createDefaultTenancyConfig();
        return;
      }

      const profiles = this.parseOCIConfig(configContent);
      let defaultProfileFound = false;

      profiles.forEach((profile, index) => {
        const isDefault = profile.name === 'DEFAULT' || index === 0;
        if (isDefault) defaultProfileFound = true;

        const tenancyConfig: TenancyConfig = {
          id: profile.name.toLowerCase(),
          name: profile.name,
          tenancyOCID: profile.tenancy || '',
          region: profile.region || this.config.defaultRegion,
          compartmentId: process.env.OCI_COMPARTMENT_ID,
          authMethod: 'user_principal',
          configProfile: profile.name,
          isDefault: isDefault
        };

        const authConfig: AuthConfig = {
          method: 'user_principal',
          profile: profile.name,
          tenancyOCID: profile.tenancy,
          userOCID: profile.user,
          fingerprint: profile.fingerprint,
          keyFile: profile.key_file,
          region: profile.region
        };

        this.config.tenancies.push(tenancyConfig);
        this.authConfigs.set(tenancyConfig.id, authConfig);
      });

      // If no default profile, make the first one default
      if (!defaultProfileFound && this.config.tenancies.length > 0) {
        this.config.tenancies[0].isDefault = true;
      }

      // Check for instance principal support
      this.detectInstancePrincipalAuth();

    } catch (error) {
      console.error('Error loading tenancy configs:', error);
      this.createDefaultTenancyConfig();
    }
  }

  /**
   * Parse OCI configuration file content
   */
  private parseOCIConfig(content: string): Array<{
    name: string;
    tenancy?: string;
    user?: string;
    fingerprint?: string;
    key_file?: string;
    region?: string;
  }> {
    const profiles: Array<any> = [];
    const lines = content.split('\n');
    let currentProfile: any = null;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Profile header
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        if (currentProfile) {
          profiles.push(currentProfile);
        }
        currentProfile = {
          name: trimmed.slice(1, -1)
        };
      } else if (currentProfile && trimmed.includes('=')) {
        // Profile property
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
   * Detect if instance principal authentication is available
   */
  private detectInstancePrincipalAuth(): void {
    try {
      // Check if running on OCI compute instance
      const metadataUrl = 'http://169.254.169.254/opc/v1/instance/';
      execSync(`curl -s --connect-timeout 2 "${metadataUrl}" > /dev/null 2>&1`);
      
      // If successful, add instance principal tenancy
      const instanceTenancy: TenancyConfig = {
        id: 'instance_principal',
        name: 'Instance Principal',
        tenancyOCID: 'auto-detected',
        region: 'auto-detected',
        authMethod: 'instance_principal',
        isDefault: this.config.tenancies.length === 0
      };

      this.config.tenancies.unshift(instanceTenancy);
      
      const instanceAuthConfig: AuthConfig = {
        method: 'instance_principal'
      };
      
      this.authConfigs.set('instance_principal', instanceAuthConfig);

    } catch (error) {
      // Not running on OCI instance or instance principal not available
    }
  }

  /**
   * Create default single-tenancy configuration
   */
  private createDefaultTenancyConfig(): void {
    const defaultTenancy: TenancyConfig = {
      id: 'default',
      name: 'Default',
      tenancyOCID: process.env.OCI_TENANCY_ID || '',
      region: process.env.OCI_REGION || this.config.defaultRegion,
      compartmentId: process.env.OCI_COMPARTMENT_ID,
      authMethod: 'user_principal',
      configProfile: 'DEFAULT',
      isDefault: true
    };

    this.config.tenancies.push(defaultTenancy);
    
    const defaultAuthConfig: AuthConfig = {
      method: 'user_principal',
      profile: 'DEFAULT'
    };
    
    this.authConfigs.set('default', defaultAuthConfig);
  }

  /**
   * Get all configured tenancies
   */
  getTenancies(): TenancyConfig[] {
    return this.config.tenancies;
  }

  /**
   * Get specific tenancy configuration
   */
  getTenancy(tenancyId: string): TenancyConfig | undefined {
    return this.config.tenancies.find(t => t.id === tenancyId);
  }

  /**
   * Get default tenancy
   */
  getDefaultTenancy(): TenancyConfig | undefined {
    return this.config.tenancies.find(t => t.isDefault) || this.config.tenancies[0];
  }

  /**
   * Get authentication configuration for tenancy
   */
  getAuthConfig(tenancyId: string): AuthConfig | undefined {
    return this.authConfigs.get(tenancyId);
  }

  /**
   * Add new tenancy configuration
   */
  addTenancy(tenancy: TenancyConfig, authConfig: AuthConfig): void {
    // Ensure unique ID
    const existingIndex = this.config.tenancies.findIndex(t => t.id === tenancy.id);
    if (existingIndex >= 0) {
      this.config.tenancies[existingIndex] = tenancy;
    } else {
      this.config.tenancies.push(tenancy);
    }
    
    this.authConfigs.set(tenancy.id, authConfig);
  }

  /**
   * Remove tenancy configuration
   */
  removeTenancy(tenancyId: string): boolean {
    const index = this.config.tenancies.findIndex(t => t.id === tenancyId);
    if (index >= 0) {
      this.config.tenancies.splice(index, 1);
      this.authConfigs.delete(tenancyId);
      
      // If removed tenancy was default, make another one default
      if (this.config.tenancies.length > 0 && !this.config.tenancies.some(t => t.isDefault)) {
        this.config.tenancies[0].isDefault = true;
      }
      
      return true;
    }
    return false;
  }

  /**
   * Set default tenancy
   */
  setDefaultTenancy(tenancyId: string): boolean {
    const tenancy = this.getTenancy(tenancyId);
    if (tenancy) {
      // Remove default flag from all tenancies
      this.config.tenancies.forEach(t => t.isDefault = false);
      // Set new default
      tenancy.isDefault = true;
      return true;
    }
    return false;
  }

  /**
   * Get datasource configuration
   */
  getConfig(): DatasourceConfig {
    return { ...this.config };
  }

  /**
   * Update datasource configuration
   */
  updateConfig(updates: Partial<DatasourceConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Test tenancy connectivity
   */
  async testTenancyConnection(tenancyId: string): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    const tenancy = this.getTenancy(tenancyId);
    const authConfig = this.getAuthConfig(tenancyId);

    if (!tenancy || !authConfig) {
      return {
        success: false,
        message: 'Tenancy or auth configuration not found'
      };
    }

    try {
      let testCommand: string;

      if (authConfig.method === 'instance_principal') {
        testCommand = `oci iam region list --auth instance_principal --region ${tenancy.region} --output json`;
      } else {
        const profile = authConfig.profile || 'DEFAULT';
        testCommand = `oci iam region list --profile ${profile} --region ${tenancy.region} --output json`;
      }

      const result = execSync(testCommand, { encoding: 'utf8', timeout: 10000 });
      const regions = JSON.parse(result);

      return {
        success: true,
        message: `Successfully connected to ${tenancy.name}`,
        details: {
          tenancyId: tenancy.id,
          region: tenancy.region,
          authMethod: authConfig.method,
          availableRegions: regions.data?.length || 0
        }
      };

    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : String(error)}`,
        details: {
          tenancyId: tenancy.id,
          authMethod: authConfig.method
        }
      };
    }
  }

  /**
   * Test all tenancy connections
   */
  async testAllConnections(): Promise<Array<{
    tenancyId: string;
    tenancyName: string;
    success: boolean;
    message: string;
    details?: any;
  }>> {
    const results: Array<any> = [];

    for (const tenancy of this.config.tenancies) {
      const result = await this.testTenancyConnection(tenancy.id);
      results.push({
        tenancyId: tenancy.id,
        tenancyName: tenancy.name,
        ...result
      });
    }

    return results;
  }

  /**
   * Get available regions for a tenancy
   */
  async getAvailableRegions(tenancyId: string): Promise<string[]> {
    const tenancy = this.getTenancy(tenancyId);
    const authConfig = this.getAuthConfig(tenancyId);

    if (!tenancy || !authConfig) {
      throw new Error('Tenancy or auth configuration not found');
    }

    try {
      let command: string;

      if (authConfig.method === 'instance_principal') {
        command = `oci iam region list --auth instance_principal --output json`;
      } else {
        const profile = authConfig.profile || 'DEFAULT';
        command = `oci iam region list --profile ${profile} --output json`;
      }

      const result = execSync(command, { encoding: 'utf8', timeout: 10000 });
      const response = JSON.parse(result);

      if (response.data && Array.isArray(response.data)) {
        return response.data.map((region: any) => region.name);
      }

      return [tenancy.region]; // Fallback to configured region

    } catch (error) {
      console.error('Error getting available regions:', error);
      return [tenancy.region];
    }
  }

  /**
   * Validate tenancy configuration
   */
  validateTenancyConfig(tenancy: TenancyConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!tenancy.id || tenancy.id.trim() === '') {
      errors.push('Tenancy ID is required');
    }

    if (!tenancy.name || tenancy.name.trim() === '') {
      errors.push('Tenancy name is required');
    }

    if (tenancy.authMethod === 'user_principal' && !tenancy.configProfile) {
      errors.push('Config profile is required for user principal authentication');
    }

    if (!tenancy.region || tenancy.region.trim() === '') {
      errors.push('Region is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Export configuration for backup/migration
   */
  exportConfig(): string {
    return JSON.stringify({
      config: this.config,
      authConfigs: Object.fromEntries(this.authConfigs.entries())
    }, null, 2);
  }

  /**
   * Import configuration from backup
   */
  importConfig(configJson: string): { success: boolean; errors: string[] } {
    try {
      const imported = JSON.parse(configJson);
      const errors: string[] = [];

      if (imported.config) {
        // Validate imported configuration
        if (imported.config.tenancies && Array.isArray(imported.config.tenancies)) {
          for (const tenancy of imported.config.tenancies) {
            const validation = this.validateTenancyConfig(tenancy);
            if (!validation.valid) {
              errors.push(`Tenancy ${tenancy.name || 'unknown'}: ${validation.errors.join(', ')}`);
            }
          }
        }

        if (errors.length === 0) {
          this.config = imported.config;
          
          if (imported.authConfigs) {
            this.authConfigs = new Map(Object.entries(imported.authConfigs));
          }

          return { success: true, errors: [] };
        }
      } else {
        errors.push('Invalid configuration format');
      }

      return { success: false, errors };

    } catch (error) {
      return {
        success: false,
        errors: [`Failed to parse configuration: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }
}