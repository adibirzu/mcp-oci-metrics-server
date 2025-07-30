/**
 * OCI Core Services Client
 * Provides compute instance lifecycle management, networking, and storage operations
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import moment from 'moment-timezone';
import { OCIRestClient } from './OCIRestClient.js';
const execAsync = promisify(exec);
export class CoreServicesClient {
    restClient = null;
    useRestAPI;
    region;
    constructor(useRestAPI = false) {
        this.useRestAPI = useRestAPI;
        this.region = this.detectRegion();
        if (this.useRestAPI) {
            try {
                this.restClient = new OCIRestClient();
            }
            catch (error) {
                console.error('Failed to initialize REST client for Core Services:', error);
                this.useRestAPI = false;
            }
        }
    }
    /**
     * Detect region from OCI CLI config
     */
    detectRegion() {
        try {
            const { execSync } = require('child_process');
            const configContent = execSync('cat ~/.oci/config 2>/dev/null | grep "^region" | head -1', { encoding: 'utf8' });
            const regionMatch = configContent.match(/region\s*=\s*(.+)/);
            return regionMatch?.[1]?.trim() || 'eu-frankfurt-1';
        }
        catch {
            return 'eu-frankfurt-1';
        }
    }
    /**
     * Get Core Services endpoint
     */
    getCoreServicesEndpoint() {
        return `https://iaas.${this.region}.oraclecloud.com`;
    }
    /**
     * Get detailed instance information
     */
    async getInstanceDetails(instanceId) {
        if (this.useRestAPI && this.restClient) {
            try {
                return await this.getInstanceDetailsREST(instanceId);
            }
            catch (error) {
                console.error('REST API failed, falling back to CLI:', error);
            }
        }
        return this.getInstanceDetailsCLI(instanceId);
    }
    /**
     * Get instance details via REST API
     */
    async getInstanceDetailsREST(instanceId) {
        if (!this.restClient) {
            throw new Error('REST client not initialized');
        }
        try {
            const response = await this.restClient['httpClient'].get(`${this.getCoreServicesEndpoint()}/20160918/instances/${instanceId}`);
            if (response.data) {
                return {
                    id: response.data.id,
                    displayName: response.data.displayName,
                    shape: response.data.shape,
                    lifecycleState: response.data.lifecycleState,
                    availabilityDomain: response.data.availabilityDomain,
                    compartmentId: response.data.compartmentId,
                    timeCreated: response.data.timeCreated,
                    imageId: response.data.imageId,
                    metadata: response.data.metadata,
                    extendedMetadata: response.data.extendedMetadata,
                    freeformTags: response.data.freeformTags,
                    definedTags: response.data.definedTags,
                    faultDomain: response.data.faultDomain,
                    launchMode: response.data.launchMode,
                    ipxeScript: response.data.ipxeScript,
                    dedicatedVmHostId: response.data.dedicatedVmHostId,
                    launchOptions: response.data.launchOptions,
                    instanceOptions: response.data.instanceOptions,
                    availabilityConfig: response.data.availabilityConfig,
                    preemptibleInstanceConfig: response.data.preemptibleInstanceConfig,
                    agentConfig: response.data.agentConfig
                };
            }
            throw new Error('No instance data received');
        }
        catch (error) {
            console.error('Failed to get instance details via REST API:', error);
            throw error;
        }
    }
    /**
     * Get instance details via OCI CLI
     */
    async getInstanceDetailsCLI(instanceId) {
        try {
            const command = `oci compute instance get --instance-id "${instanceId}" --output json`;
            const { stdout } = await execAsync(command);
            const response = JSON.parse(stdout);
            if (response.data) {
                return {
                    id: response.data.id,
                    displayName: response.data['display-name'],
                    shape: response.data.shape,
                    lifecycleState: response.data['lifecycle-state'],
                    availabilityDomain: response.data['availability-domain'],
                    compartmentId: response.data['compartment-id'],
                    timeCreated: response.data['time-created'],
                    imageId: response.data['image-id'],
                    metadata: response.data.metadata,
                    extendedMetadata: response.data['extended-metadata'],
                    freeformTags: response.data['freeform-tags'],
                    definedTags: response.data['defined-tags'],
                    faultDomain: response.data['fault-domain'],
                    launchMode: response.data['launch-mode'],
                    ipxeScript: response.data['ipxe-script'],
                    dedicatedVmHostId: response.data['dedicated-vm-host-id'],
                    launchOptions: response.data['launch-options'],
                    instanceOptions: response.data['instance-options'],
                    availabilityConfig: response.data['availability-config'],
                    preemptibleInstanceConfig: response.data['preemptible-instance-config'],
                    agentConfig: response.data['agent-config']
                };
            }
            throw new Error('No instance data received');
        }
        catch (error) {
            console.error('Failed to get instance details via CLI:', error);
            throw error;
        }
    }
    /**
     * Perform instance action (start, stop, restart, etc.)
     */
    async performInstanceAction(instanceId, action) {
        // Get current instance state
        const currentInstance = await this.getInstanceDetails(instanceId);
        const previousState = currentInstance.lifecycleState;
        if (this.useRestAPI && this.restClient) {
            try {
                return await this.performInstanceActionREST(instanceId, action, previousState);
            }
            catch (error) {
                console.error('REST API failed, falling back to CLI:', error);
            }
        }
        return this.performInstanceActionCLI(instanceId, action, previousState);
    }
    /**
     * Perform instance action via REST API
     */
    async performInstanceActionREST(instanceId, action, previousState) {
        if (!this.restClient) {
            throw new Error('REST client not initialized');
        }
        try {
            const payload = { action: action.toUpperCase() };
            const response = await this.restClient['httpClient'].post(`${this.getCoreServicesEndpoint()}/20160918/instances/${instanceId}/actions/${action.toLowerCase()}`, payload);
            return {
                action: action.toUpperCase(),
                instanceId,
                result: {
                    success: true,
                    message: `Instance action ${action.toUpperCase()} initiated successfully`,
                    previousState,
                    newState: response.data?.lifecycleState || 'TRANSITIONING',
                    timeRequested: moment().toISOString()
                }
            };
        }
        catch (error) {
            console.error('Failed to perform instance action via REST API:', error);
            return {
                action: action.toUpperCase(),
                instanceId,
                result: {
                    success: false,
                    message: `Failed to perform ${action.toUpperCase()}: ${error instanceof Error ? error.message : String(error)}`,
                    previousState,
                    timeRequested: moment().toISOString()
                }
            };
        }
    }
    /**
     * Perform instance action via OCI CLI
     */
    async performInstanceActionCLI(instanceId, action, previousState) {
        try {
            const actionMap = {
                'START': 'start',
                'STOP': 'stop',
                'RESET': 'reset',
                'SOFTSTOP': 'softstop',
                'SOFTRESET': 'softreset'
            };
            const cliAction = actionMap[action.toUpperCase()];
            if (!cliAction) {
                throw new Error(`Unsupported action: ${action}`);
            }
            const command = `oci compute instance action --action ${cliAction} --instance-id "${instanceId}" --output json`;
            const { stdout } = await execAsync(command);
            const response = JSON.parse(stdout);
            return {
                action: action.toUpperCase(),
                instanceId,
                result: {
                    success: true,
                    message: `Instance action ${action.toUpperCase()} initiated successfully`,
                    previousState,
                    newState: response.data?.['lifecycle-state'] || 'TRANSITIONING',
                    timeRequested: moment().toISOString()
                }
            };
        }
        catch (error) {
            console.error('Failed to perform instance action via CLI:', error);
            return {
                action: action.toUpperCase(),
                instanceId,
                result: {
                    success: false,
                    message: `Failed to perform ${action.toUpperCase()}: ${error instanceof Error ? error.message : String(error)}`,
                    previousState,
                    timeRequested: moment().toISOString()
                }
            };
        }
    }
    /**
     * Get volume attachments for an instance
     */
    async getVolumeAttachments(instanceId, compartmentId) {
        if (this.useRestAPI && this.restClient) {
            try {
                return await this.getVolumeAttachmentsREST(instanceId, compartmentId);
            }
            catch (error) {
                console.error('REST API failed, falling back to CLI:', error);
            }
        }
        return this.getVolumeAttachmentsCLI(instanceId, compartmentId);
    }
    /**
     * Get volume attachments via REST API
     */
    async getVolumeAttachmentsREST(instanceId, compartmentId) {
        if (!this.restClient) {
            throw new Error('REST client not initialized');
        }
        try {
            const response = await this.restClient['httpClient'].get(`${this.getCoreServicesEndpoint()}/20160918/volumeAttachments?compartmentId=${compartmentId}&instanceId=${instanceId}&limit=1000`);
            const attachments = [];
            if (response.data && Array.isArray(response.data)) {
                response.data.forEach((attachment) => {
                    attachments.push({
                        id: attachment.id,
                        displayName: attachment.displayName || 'Unknown',
                        instanceId: attachment.instanceId,
                        volumeId: attachment.volumeId,
                        device: attachment.device,
                        lifecycleState: attachment.lifecycleState,
                        isReadOnly: attachment.isReadOnly || false,
                        isPvEncryptionInTransitEnabled: attachment.isPvEncryptionInTransitEnabled || false,
                        attachmentType: attachment.attachmentType || 'iscsi'
                    });
                });
            }
            return attachments;
        }
        catch (error) {
            console.error('Failed to get volume attachments via REST API:', error);
            throw error;
        }
    }
    /**
     * Get volume attachments via OCI CLI
     */
    async getVolumeAttachmentsCLI(instanceId, compartmentId) {
        try {
            const command = `oci compute volume-attachment list --compartment-id "${compartmentId}" --instance-id "${instanceId}" --output json`;
            const { stdout } = await execAsync(command);
            const response = JSON.parse(stdout);
            const attachments = [];
            if (response.data && Array.isArray(response.data)) {
                response.data.forEach((attachment) => {
                    attachments.push({
                        id: attachment.id,
                        displayName: attachment['display-name'] || 'Unknown',
                        instanceId: attachment['instance-id'],
                        volumeId: attachment['volume-id'],
                        device: attachment.device,
                        lifecycleState: attachment['lifecycle-state'],
                        isReadOnly: attachment['is-read-only'] || false,
                        isPvEncryptionInTransitEnabled: attachment['is-pv-encryption-in-transit-enabled'] || false,
                        attachmentType: attachment['attachment-type'] || 'iscsi'
                    });
                });
            }
            return attachments;
        }
        catch (error) {
            console.error('Failed to get volume attachments via CLI:', error);
            throw error;
        }
    }
    /**
     * Get VNIC attachments for an instance
     */
    async getVnicAttachments(instanceId, compartmentId) {
        if (this.useRestAPI && this.restClient) {
            try {
                return await this.getVnicAttachmentsREST(instanceId, compartmentId);
            }
            catch (error) {
                console.error('REST API failed, falling back to CLI:', error);
            }
        }
        return this.getVnicAttachmentsCLI(instanceId, compartmentId);
    }
    /**
     * Get VNIC attachments via REST API
     */
    async getVnicAttachmentsREST(instanceId, compartmentId) {
        if (!this.restClient) {
            throw new Error('REST client not initialized');
        }
        try {
            const response = await this.restClient['httpClient'].get(`${this.getCoreServicesEndpoint()}/20160918/vnicAttachments?compartmentId=${compartmentId}&instanceId=${instanceId}&limit=1000`);
            const attachments = [];
            if (response.data && Array.isArray(response.data)) {
                response.data.forEach((attachment) => {
                    attachments.push({
                        id: attachment.id,
                        displayName: attachment.displayName || 'Unknown',
                        instanceId: attachment.instanceId,
                        vnicId: attachment.vnicId,
                        lifecycleState: attachment.lifecycleState,
                        nicIndex: attachment.nicIndex || 0,
                        subnetId: attachment.subnetId,
                        vlanId: attachment.vlanId
                    });
                });
            }
            return attachments;
        }
        catch (error) {
            console.error('Failed to get VNIC attachments via REST API:', error);
            throw error;
        }
    }
    /**
     * Get VNIC attachments via OCI CLI
     */
    async getVnicAttachmentsCLI(instanceId, compartmentId) {
        try {
            const command = `oci compute vnic-attachment list --compartment-id "${compartmentId}" --instance-id "${instanceId}" --output json`;
            const { stdout } = await execAsync(command);
            const response = JSON.parse(stdout);
            const attachments = [];
            if (response.data && Array.isArray(response.data)) {
                response.data.forEach((attachment) => {
                    attachments.push({
                        id: attachment.id,
                        displayName: attachment['display-name'] || 'Unknown',
                        instanceId: attachment['instance-id'],
                        vnicId: attachment['vnic-id'],
                        lifecycleState: attachment['lifecycle-state'],
                        nicIndex: attachment['nic-index'] || 0,
                        subnetId: attachment['subnet-id'],
                        vlanId: attachment['vlan-id']
                    });
                });
            }
            return attachments;
        }
        catch (error) {
            console.error('Failed to get VNIC attachments via CLI:', error);
            throw error;
        }
    }
    /**
     * Get VNIC details
     */
    async getVnicDetails(vnicId) {
        if (this.useRestAPI && this.restClient) {
            try {
                return await this.getVnicDetailsREST(vnicId);
            }
            catch (error) {
                console.error('REST API failed, falling back to CLI:', error);
            }
        }
        return this.getVnicDetailsCLI(vnicId);
    }
    /**
     * Get VNIC details via REST API
     */
    async getVnicDetailsREST(vnicId) {
        if (!this.restClient) {
            throw new Error('REST client not initialized');
        }
        try {
            const response = await this.restClient['httpClient'].get(`${this.getCoreServicesEndpoint()}/20160918/vnics/${vnicId}`);
            if (response.data) {
                return {
                    id: response.data.id,
                    displayName: response.data.displayName,
                    privateIp: response.data.privateIp,
                    publicIp: response.data.publicIp,
                    hostname: response.data.hostname,
                    isPrimary: response.data.isPrimary || false,
                    macAddress: response.data.macAddress,
                    subnetId: response.data.subnetId,
                    lifecycleState: response.data.lifecycleState,
                    skipSourceDestCheck: response.data.skipSourceDestCheck || false,
                    timeCreated: response.data.timeCreated,
                    nsgIds: response.data.nsgIds
                };
            }
            throw new Error('No VNIC data received');
        }
        catch (error) {
            console.error('Failed to get VNIC details via REST API:', error);
            throw error;
        }
    }
    /**
     * Get VNIC details via OCI CLI
     */
    async getVnicDetailsCLI(vnicId) {
        try {
            const command = `oci network vnic get --vnic-id "${vnicId}" --output json`;
            const { stdout } = await execAsync(command);
            const response = JSON.parse(stdout);
            if (response.data) {
                return {
                    id: response.data.id,
                    displayName: response.data['display-name'],
                    privateIp: response.data['private-ip'],
                    publicIp: response.data['public-ip'],
                    hostname: response.data.hostname,
                    isPrimary: response.data['is-primary'] || false,
                    macAddress: response.data['mac-address'],
                    subnetId: response.data['subnet-id'],
                    lifecycleState: response.data['lifecycle-state'],
                    skipSourceDestCheck: response.data['skip-source-dest-check'] || false,
                    timeCreated: response.data['time-created'],
                    nsgIds: response.data['nsg-ids']
                };
            }
            throw new Error('No VNIC data received');
        }
        catch (error) {
            console.error('Failed to get VNIC details via CLI:', error);
            throw error;
        }
    }
    /**
     * Wait for instance to reach desired state
     */
    async waitForInstanceState(instanceId, desiredState, maxWaitTimeMinutes = 10) {
        const startTime = Date.now();
        const maxWaitTime = maxWaitTimeMinutes * 60 * 1000; // Convert to milliseconds
        while (Date.now() - startTime < maxWaitTime) {
            try {
                const instance = await this.getInstanceDetails(instanceId);
                if (instance.lifecycleState === desiredState) {
                    return {
                        success: true,
                        currentState: instance.lifecycleState,
                        message: `Instance reached desired state: ${desiredState}`
                    };
                }
                // If instance is in a terminal error state, don't wait
                if (instance.lifecycleState.includes('FAILED') || instance.lifecycleState.includes('ERROR')) {
                    return {
                        success: false,
                        currentState: instance.lifecycleState,
                        message: `Instance entered error state: ${instance.lifecycleState}`
                    };
                }
                // Wait 10 seconds before checking again
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
            catch (error) {
                console.error('Error checking instance state:', error);
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
        // Timeout reached
        const finalInstance = await this.getInstanceDetails(instanceId);
        return {
            success: false,
            currentState: finalInstance.lifecycleState,
            message: `Timeout waiting for state ${desiredState}. Current state: ${finalInstance.lifecycleState}`
        };
    }
    /**
     * List all instances in compartment with basic information
     */
    async listInstances(compartmentId, lifecycleState = 'RUNNING') {
        if (this.useRestAPI && this.restClient) {
            try {
                return await this.listInstancesREST(compartmentId, lifecycleState);
            }
            catch (error) {
                console.error('REST API failed, falling back to CLI:', error);
            }
        }
        return this.listInstancesCLI(compartmentId, lifecycleState);
    }
    /**
     * List instances via REST API
     */
    async listInstancesREST(compartmentId, lifecycleState = 'RUNNING') {
        if (!this.restClient) {
            throw new Error('REST client not initialized');
        }
        const targetCompartmentId = compartmentId || process.env.OCI_COMPARTMENT_ID;
        if (!targetCompartmentId) {
            throw new Error('Compartment ID is required');
        }
        try {
            const response = await this.restClient['httpClient'].get(`${this.getCoreServicesEndpoint()}/20160918/instances?compartmentId=${encodeURIComponent(targetCompartmentId)}&lifecycleState=${lifecycleState}&limit=1000`);
            const instances = [];
            if (response.data && Array.isArray(response.data)) {
                response.data.forEach((instanceData) => {
                    instances.push({
                        id: instanceData.id,
                        displayName: instanceData.displayName,
                        shape: instanceData.shape,
                        lifecycleState: instanceData.lifecycleState,
                        availabilityDomain: instanceData.availabilityDomain,
                        compartmentId: instanceData.compartmentId,
                        timeCreated: instanceData.timeCreated,
                        imageId: instanceData.imageId,
                        metadata: instanceData.metadata,
                        extendedMetadata: instanceData.extendedMetadata,
                        freeformTags: instanceData.freeformTags,
                        definedTags: instanceData.definedTags,
                        faultDomain: instanceData.faultDomain,
                        launchMode: instanceData.launchMode,
                        ipxeScript: instanceData.ipxeScript,
                        dedicatedVmHostId: instanceData.dedicatedVmHostId,
                        launchOptions: instanceData.launchOptions,
                        instanceOptions: instanceData.instanceOptions,
                        availabilityConfig: instanceData.availabilityConfig,
                        preemptibleInstanceConfig: instanceData.preemptibleInstanceConfig,
                        agentConfig: instanceData.agentConfig
                    });
                });
            }
            return instances;
        }
        catch (error) {
            console.error('Failed to list instances via REST API:', error);
            throw error;
        }
    }
    /**
     * List instances via OCI CLI
     */
    async listInstancesCLI(compartmentId, lifecycleState = 'RUNNING') {
        const targetCompartmentId = compartmentId || process.env.OCI_COMPARTMENT_ID;
        if (!targetCompartmentId) {
            throw new Error('Compartment ID is required');
        }
        try {
            const command = `oci compute instance list --compartment-id "${targetCompartmentId}" --lifecycle-state ${lifecycleState} --output json`;
            const { stdout } = await execAsync(command);
            const response = JSON.parse(stdout);
            const instances = [];
            if (response.data && Array.isArray(response.data)) {
                response.data.forEach((instanceData) => {
                    instances.push({
                        id: instanceData.id,
                        displayName: instanceData['display-name'],
                        shape: instanceData.shape,
                        lifecycleState: instanceData['lifecycle-state'],
                        availabilityDomain: instanceData['availability-domain'],
                        compartmentId: instanceData['compartment-id'],
                        timeCreated: instanceData['time-created'],
                        imageId: instanceData['image-id'],
                        metadata: instanceData.metadata,
                        extendedMetadata: instanceData['extended-metadata'],
                        freeformTags: instanceData['freeform-tags'],
                        definedTags: instanceData['defined-tags'],
                        faultDomain: instanceData['fault-domain'],
                        launchMode: instanceData['launch-mode'],
                        ipxeScript: instanceData['ipxe-script'],
                        dedicatedVmHostId: instanceData['dedicated-vm-host-id'],
                        launchOptions: instanceData['launch-options'],
                        instanceOptions: instanceData['instance-options'],
                        availabilityConfig: instanceData['availability-config'],
                        preemptibleInstanceConfig: instanceData['preemptible-instance-config'],
                        agentConfig: instanceData['agent-config']
                    });
                });
            }
            return instances;
        }
        catch (error) {
            console.error('Failed to list instances via CLI:', error);
            throw error;
        }
    }
    /**
     * List instances with complete network information
     */
    async listInstancesWithNetworkInfo(compartmentId, lifecycleState = 'RUNNING') {
        const instances = await this.listInstances(compartmentId, lifecycleState);
        const targetCompartmentId = compartmentId || process.env.OCI_COMPARTMENT_ID;
        // Enhance instances with network information
        const enhancedInstances = await Promise.all(instances.map(async (instance) => {
            try {
                // Get VNIC attachments
                const vnicAttachments = await this.getVnicAttachments(instance.id, targetCompartmentId);
                // Get network details for each VNIC
                const networkInfo = [];
                for (const vnicAttachment of vnicAttachments) {
                    try {
                        const vnicDetails = await this.getVnicDetails(vnicAttachment.vnicId);
                        if (vnicDetails) {
                            networkInfo.push({
                                isPrimary: vnicDetails.isPrimary,
                                privateIp: vnicDetails.privateIp,
                                publicIp: vnicDetails.publicIp,
                                hostname: vnicDetails.hostname,
                                macAddress: vnicDetails.macAddress,
                                nicIndex: vnicAttachment.nicIndex
                            });
                        }
                    }
                    catch (error) {
                        console.error(`Failed to get VNIC details for ${vnicAttachment.vnicId}:`, error);
                    }
                }
                // Add primary IP addresses for easy access
                const primaryVnic = networkInfo.find(ni => ni.isPrimary);
                return {
                    ...instance,
                    networkInfo,
                    primaryPrivateIp: primaryVnic?.privateIp,
                    primaryPublicIp: primaryVnic?.publicIp,
                    hostname: primaryVnic?.hostname
                };
            }
            catch (error) {
                console.error(`Failed to get network info for instance ${instance.id}:`, error);
                return {
                    ...instance,
                    networkInfo: [],
                    primaryPrivateIp: undefined,
                    primaryPublicIp: undefined,
                    hostname: undefined
                };
            }
        }));
        return enhancedInstances;
    }
    /**
     * Get comprehensive instance information including attachments
     */
    async getInstanceFullDetails(instanceId, compartmentId) {
        const targetCompartmentId = compartmentId || process.env.OCI_COMPARTMENT_ID;
        if (!targetCompartmentId) {
            throw new Error('Compartment ID is required');
        }
        // Get instance details
        const instance = await this.getInstanceDetails(instanceId);
        // Get volume attachments
        const volumeAttachments = await this.getVolumeAttachments(instanceId, targetCompartmentId);
        // Get VNIC attachments
        const vnicAttachments = await this.getVnicAttachments(instanceId, targetCompartmentId);
        // Get VNIC details for each attachment
        const vnicDetails = [];
        for (const vnicAttachment of vnicAttachments) {
            try {
                const vnic = await this.getVnicDetails(vnicAttachment.vnicId);
                vnicDetails.push(vnic);
            }
            catch (error) {
                console.error(`Failed to get VNIC details for ${vnicAttachment.vnicId}:`, error);
            }
        }
        return {
            instance,
            volumeAttachments,
            vnicAttachments,
            vnicDetails
        };
    }
}
//# sourceMappingURL=CoreServicesClient.js.map