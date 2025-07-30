/**
 * OCI Core Services Client
 * Provides compute instance lifecycle management, networking, and storage operations
 */
export interface InstanceDetails {
    id: string;
    displayName: string;
    shape: string;
    lifecycleState: string;
    availabilityDomain: string;
    compartmentId: string;
    timeCreated: string;
    imageId?: string;
    metadata?: Record<string, string>;
    extendedMetadata?: Record<string, any>;
    freeformTags?: Record<string, string>;
    definedTags?: Record<string, any>;
    faultDomain?: string;
    launchMode?: string;
    ipxeScript?: string;
    dedicatedVmHostId?: string;
    launchOptions?: any;
    instanceOptions?: any;
    availabilityConfig?: any;
    preemptibleInstanceConfig?: any;
    agentConfig?: any;
}
export interface VolumeAttachment {
    id: string;
    displayName: string;
    instanceId: string;
    volumeId: string;
    device?: string;
    lifecycleState: string;
    isReadOnly: boolean;
    isPvEncryptionInTransitEnabled: boolean;
    attachmentType: string;
}
export interface VnicAttachment {
    id: string;
    displayName: string;
    instanceId: string;
    vnicId: string;
    lifecycleState: string;
    nicIndex: number;
    subnetId: string;
    vlanId?: string;
}
export interface VnicDetails {
    id: string;
    displayName: string;
    privateIp: string;
    publicIp?: string;
    hostname?: string;
    isPrimary: boolean;
    macAddress: string;
    subnetId: string;
    lifecycleState: string;
    skipSourceDestCheck: boolean;
    timeCreated: string;
    nsgIds?: string[];
}
export interface InstanceAction {
    action: 'START' | 'STOP' | 'RESET' | 'SOFTSTOP' | 'SOFTRESET';
    instanceId: string;
    result: {
        success: boolean;
        message: string;
        previousState?: string;
        newState?: string;
        timeRequested: string;
    };
}
export declare class CoreServicesClient {
    private restClient;
    private useRestAPI;
    private region;
    constructor(useRestAPI?: boolean);
    /**
     * Detect region from OCI CLI config
     */
    private detectRegion;
    /**
     * Get Core Services endpoint
     */
    private getCoreServicesEndpoint;
    /**
     * Get detailed instance information
     */
    getInstanceDetails(instanceId: string): Promise<InstanceDetails>;
    /**
     * Get instance details via REST API
     */
    private getInstanceDetailsREST;
    /**
     * Get instance details via OCI CLI
     */
    private getInstanceDetailsCLI;
    /**
     * Perform instance action (start, stop, restart, etc.)
     */
    performInstanceAction(instanceId: string, action: string): Promise<InstanceAction>;
    /**
     * Perform instance action via REST API
     */
    private performInstanceActionREST;
    /**
     * Perform instance action via OCI CLI
     */
    private performInstanceActionCLI;
    /**
     * Get volume attachments for an instance
     */
    getVolumeAttachments(instanceId: string, compartmentId: string): Promise<VolumeAttachment[]>;
    /**
     * Get volume attachments via REST API
     */
    private getVolumeAttachmentsREST;
    /**
     * Get volume attachments via OCI CLI
     */
    private getVolumeAttachmentsCLI;
    /**
     * Get VNIC attachments for an instance
     */
    getVnicAttachments(instanceId: string, compartmentId: string): Promise<VnicAttachment[]>;
    /**
     * Get VNIC attachments via REST API
     */
    private getVnicAttachmentsREST;
    /**
     * Get VNIC attachments via OCI CLI
     */
    private getVnicAttachmentsCLI;
    /**
     * Get VNIC details
     */
    getVnicDetails(vnicId: string): Promise<VnicDetails>;
    /**
     * Get VNIC details via REST API
     */
    private getVnicDetailsREST;
    /**
     * Get VNIC details via OCI CLI
     */
    private getVnicDetailsCLI;
    /**
     * Wait for instance to reach desired state
     */
    waitForInstanceState(instanceId: string, desiredState: string, maxWaitTimeMinutes?: number): Promise<{
        success: boolean;
        currentState: string;
        message: string;
    }>;
    /**
     * List all instances in compartment with basic information
     */
    listInstances(compartmentId?: string, lifecycleState?: string): Promise<InstanceDetails[]>;
    /**
     * List instances via REST API
     */
    private listInstancesREST;
    /**
     * List instances via OCI CLI
     */
    private listInstancesCLI;
    /**
     * List instances with complete network information
     */
    listInstancesWithNetworkInfo(compartmentId?: string, lifecycleState?: string): Promise<Array<InstanceDetails & {
        networkInfo: Array<{
            isPrimary: boolean;
            privateIp: string;
            publicIp?: string;
            hostname?: string;
            macAddress: string;
            nicIndex: number;
        }>;
        primaryPrivateIp?: string;
        primaryPublicIp?: string;
        hostname?: string;
    }>>;
    /**
     * Get comprehensive instance information including attachments
     */
    getInstanceFullDetails(instanceId: string, compartmentId?: string): Promise<{
        instance: InstanceDetails;
        volumeAttachments: VolumeAttachment[];
        vnicAttachments: VnicAttachment[];
        vnicDetails: VnicDetails[];
    }>;
}
//# sourceMappingURL=CoreServicesClient.d.ts.map