#!/usr/bin/env python3
"""
OCI Metrics FastMCP Server with Python SDK

A FastMCP server that provides OCI monitoring metrics and compute instance management
using the official OCI Python SDK with CLI fallback.

Prerequisites:
- OCI CLI installed and configured
- OCI config file at ~/.oci/config
- OCI Python SDK installed
- Appropriate OCI permissions for compute and monitoring services
"""

import os
import sys
import json
import asyncio
import subprocess
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import logging

try:
    import oci
    from oci.config import from_file, validate_config
    from oci.core import ComputeClient
    from oci.monitoring import MonitoringClient
    from oci.core.models import Instance
    from oci.monitoring.models import SummarizeMetricsDataDetails
except ImportError as e:
    print(f"ERROR: OCI Python SDK not installed: {e}")
    print("Install with: pip install oci")
    sys.exit(1)

try:
    from fastmcp import FastMCP
except ImportError as e:
    print(f"ERROR: FastMCP not installed: {e}")
    print("Install with: pip install fastmcp")
    sys.exit(1)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize FastMCP server
mcp = FastMCP("OCI Metrics and Compute Server")

class OCIClientManager:
    """Manages OCI SDK clients with fallback to CLI"""
    
    def __init__(self):
        self.config = None
        self.compute_client = None
        self.monitoring_client = None
        self.network_client = None
        self._initialize_clients()
    
    def _initialize_clients(self):
        """Initialize OCI SDK clients"""
        try:
            # Load OCI config from default location
            self.config = from_file()
            validate_config(self.config)
            
            # Initialize clients
            self.compute_client = ComputeClient(self.config)
            self.monitoring_client = MonitoringClient(self.config)
            
            # Import network client for VNIC operations
            from oci.core import VirtualNetworkClient
            self.network_client = VirtualNetworkClient(self.config)
            
            logger.info("✅ OCI SDK clients initialized successfully")
            logger.info(f"Region: {self.config.get('region', 'Not specified')}")
            logger.info(f"Tenancy: {self.config.get('tenancy', 'Not specified')[:20]}...")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize OCI SDK clients: {e}")
            logger.warning("Will fall back to CLI commands")
            self.config = None
            self.compute_client = None
            self.monitoring_client = None
            self.network_client = None
    
    def get_compartment_id(self) -> str:
        """Get compartment ID from environment or config"""
        compartment_id = os.environ.get('OCI_COMPARTMENT_ID')
        if not compartment_id and self.config:
            # Use tenancy as default compartment if no specific compartment set
            compartment_id = self.config.get('tenancy')
        return compartment_id
    
    async def list_instances_sdk(self, compartment_id: str, lifecycle_state: str = "RUNNING") -> List[Dict]:
        """List instances using OCI Python SDK"""
        if not self.compute_client:
            raise Exception("OCI SDK not available")
        
        try:
            logger.info(f"Listing instances with SDK - Compartment: {compartment_id}, State: {lifecycle_state}")
            
            # List instances using SDK
            response = self.compute_client.list_instances(
                compartment_id=compartment_id,
                lifecycle_state=lifecycle_state
            )
            
            instances = []
            for instance in response.data:
                instance_data = {
                    'id': instance.id,
                    'displayName': instance.display_name,
                    'shape': instance.shape,
                    'lifecycleState': instance.lifecycle_state,
                    'availabilityDomain': instance.availability_domain,
                    'compartmentId': instance.compartment_id,
                    'timeCreated': instance.time_created.isoformat() if instance.time_created else None,
                    'region': self.config.get('region', 'unknown'),
                    'imageId': instance.image_id,
                    'faultDomain': instance.fault_domain,
                    'metadata': instance.metadata or {},
                    'freeformTags': instance.freeform_tags or {},
                    'definedTags': instance.defined_tags or {}
                }
                instances.append(instance_data)
            
            logger.info(f"✅ Found {len(instances)} instances via SDK")
            return instances
            
        except Exception as e:
            logger.error(f"SDK failed: {e}")
            raise
    
    async def get_instance_details_sdk(self, instance_id: str) -> Dict:
        """Get instance details using OCI Python SDK"""
        if not self.compute_client:
            raise Exception("OCI SDK not available")
        
        try:
            logger.info(f"Getting instance details via SDK: {instance_id}")
            
            response = self.compute_client.get_instance(instance_id=instance_id)
            instance = response.data
            
            instance_data = {
                'id': instance.id,
                'displayName': instance.display_name,
                'shape': instance.shape,
                'lifecycleState': instance.lifecycle_state,
                'availabilityDomain': instance.availability_domain,
                'compartmentId': instance.compartment_id,
                'timeCreated': instance.time_created.isoformat() if instance.time_created else None,
                'region': self.config.get('region', 'unknown'),
                'imageId': instance.image_id,
                'faultDomain': instance.fault_domain,
                'metadata': instance.metadata or {},
                'extendedMetadata': instance.extended_metadata or {},
                'freeformTags': instance.freeform_tags or {},
                'definedTags': instance.defined_tags or {},
                'launchOptions': instance.launch_options.__dict__ if instance.launch_options else {},
                'instanceOptions': instance.instance_options.__dict__ if instance.instance_options else {},
                'availabilityConfig': instance.availability_config.__dict__ if instance.availability_config else {},
                'preemptibleInstanceConfig': instance.preemptible_instance_config.__dict__ if instance.preemptible_instance_config else {},
                'agentConfig': instance.agent_config.__dict__ if instance.agent_config else {}
            }
            
            logger.info(f"✅ Retrieved instance details via SDK")
            return instance_data
            
        except Exception as e:
            logger.error(f"SDK failed: {e}")
            raise
    
    async def get_vnic_attachments_sdk(self, instance_id: str, compartment_id: str) -> List[Dict]:
        """Get VNIC attachments using OCI Python SDK"""
        if not self.compute_client:
            raise Exception("OCI SDK not available")
        
        try:
            response = self.compute_client.list_vnic_attachments(
                compartment_id=compartment_id,
                instance_id=instance_id
            )
            
            vnics = []
            for vnic_attachment in response.data:
                vnic_data = {
                    'id': vnic_attachment.id,
                    'displayName': vnic_attachment.display_name,
                    'instanceId': vnic_attachment.instance_id,
                    'vnicId': vnic_attachment.vnic_id,
                    'lifecycleState': vnic_attachment.lifecycle_state,
                    'nicIndex': vnic_attachment.nic_index,
                    'subnetId': vnic_attachment.subnet_id,
                    'vlanId': vnic_attachment.vlan_id
                }
                vnics.append(vnic_data)
            
            return vnics
            
        except Exception as e:
            logger.error(f"Failed to get VNIC attachments: {e}")
            return []
    
    async def get_vnic_details_sdk(self, vnic_id: str) -> Optional[Dict]:
        """Get VNIC details using OCI Python SDK"""
        if not self.network_client:
            raise Exception("OCI Network client not available")
        
        try:
            response = self.network_client.get_vnic(vnic_id=vnic_id)
            vnic = response.data
            
            vnic_data = {
                'id': vnic.id,
                'displayName': vnic.display_name,
                'privateIp': vnic.private_ip,
                'publicIp': vnic.public_ip,
                'hostname': vnic.hostname_label,
                'isPrimary': vnic.is_primary,
                'macAddress': vnic.mac_address,
                'subnetId': vnic.subnet_id,
                'lifecycleState': vnic.lifecycle_state,
                'skipSourceDestCheck': vnic.skip_source_dest_check,
                'timeCreated': vnic.time_created.isoformat() if vnic.time_created else None,
                'nsgIds': vnic.nsg_ids or []
            }
            
            return vnic_data
            
        except Exception as e:
            logger.error(f"Failed to get VNIC details: {e}")
            return None
    
    async def list_instances_with_network_sdk(self, compartment_id: str, lifecycle_state: str = "RUNNING") -> List[Dict]:
        """List instances with network information using OCI Python SDK"""
        instances = await self.list_instances_sdk(compartment_id, lifecycle_state)
        
        # Enhance with network information
        for instance in instances:
            try:
                # Get VNIC attachments
                vnic_attachments = await self.get_vnic_attachments_sdk(instance['id'], compartment_id)
                
                # Get network details for each VNIC
                network_info = []
                for vnic_attachment in vnic_attachments:
                    vnic_details = await self.get_vnic_details_sdk(vnic_attachment['vnicId'])
                    if vnic_details:
                        network_info.append({
                            'isPrimary': vnic_details['isPrimary'],
                            'privateIp': vnic_details['privateIp'],
                            'publicIp': vnic_details['publicIp'],
                            'hostname': vnic_details['hostname'],
                            'macAddress': vnic_details['macAddress'],
                            'nicIndex': vnic_attachment['nicIndex']
                        })
                
                instance['networkInfo'] = network_info
                
                # Add primary IP addresses for easy access
                primary_vnic = next((ni for ni in network_info if ni['isPrimary']), None)
                if primary_vnic:
                    instance['primaryPrivateIp'] = primary_vnic['privateIp']
                    instance['primaryPublicIp'] = primary_vnic['publicIp']
                    instance['hostname'] = primary_vnic['hostname']
                else:
                    instance['primaryPrivateIp'] = None
                    instance['primaryPublicIp'] = None
                    instance['hostname'] = None
                    
            except Exception as e:
                logger.warning(f"Failed to get network info for instance {instance['id']}: {e}")
                instance['networkInfo'] = []
                instance['primaryPrivateIp'] = None
                instance['primaryPublicIp'] = None
                instance['hostname'] = None
        
        return instances
    
    async def query_metrics_sdk(self, namespace: str, metric_name: str, start_time: datetime, 
                               end_time: datetime, compartment_id: str, dimensions: Dict[str, str] = None) -> Dict:
        """Query metrics using OCI Python SDK"""
        if not self.monitoring_client:
            raise Exception("OCI Monitoring client not available")
        
        try:
            # Build MQL query string
            dimension_filters = ""
            if dimensions:
                filters = [f'{key}="{value}"' for key, value in dimensions.items()]
                dimension_filters = "{" + ", ".join(filters) + "}"
            
            mql_query = f"{metric_name}{dimension_filters}[1m].mean()"
            
            # Create summarize request
            details = SummarizeMetricsDataDetails(
                namespace=namespace,
                query=mql_query,
                start_time=start_time,
                end_time=end_time,
                resolution="PT1M"
            )
            
            response = self.monitoring_client.summarize_metrics_data(
                compartment_id=compartment_id,
                summarize_metrics_data_details=details
            )
            
            # Process response
            metrics_data = []
            for metric in response.data:
                for datapoint in metric.aggregated_datapoints:
                    metrics_data.append({
                        'timestamp': datapoint.timestamp.isoformat(),
                        'value': datapoint.value,
                        'dimensions': dimensions or {}
                    })
            
            return {
                'namespace': namespace,
                'metricName': metric_name,
                'dimensions': dimensions or {},
                'aggregatedDatapoints': metrics_data,
                'retrievedAt': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to query metrics via SDK: {e}")
            raise
    
    async def list_instances_cli_fallback(self, compartment_id: str, lifecycle_state: str = "RUNNING") -> List[Dict]:
        """Fallback to CLI for listing instances"""
        try:
            logger.info(f"Using CLI fallback for listing instances")
            
            cmd = [
                'oci', 'compute', 'instance', 'list',
                '--compartment-id', compartment_id,
                '--lifecycle-state', lifecycle_state,
                '--output', 'json'
            ]
            
            env = os.environ.copy()
            env['SUPPRESS_LABEL_WARNING'] = 'True'
            
            result = subprocess.run(cmd, capture_output=True, text=True, env=env)
            
            if result.returncode != 0:
                raise Exception(f"CLI command failed: {result.stderr}")
            
            if not result.stdout.strip():
                return []
            
            response = json.loads(result.stdout)
            instances = []
            
            for instance_data in response.get('data', []):
                instance = {
                    'id': instance_data.get('id', ''),
                    'displayName': instance_data.get('display-name', 'Unknown'),
                    'shape': instance_data.get('shape', 'Unknown'),
                    'lifecycleState': instance_data.get('lifecycle-state', 'Unknown'),
                    'availabilityDomain': instance_data.get('availability-domain', 'Unknown'),
                    'compartmentId': instance_data.get('compartment-id', ''),
                    'timeCreated': instance_data.get('time-created', ''),
                    'region': 'unknown',  # CLI doesn't return region directly
                    'imageId': instance_data.get('image-id', ''),
                    'faultDomain': instance_data.get('fault-domain', ''),
                    'metadata': instance_data.get('metadata', {}),
                    'freeformTags': instance_data.get('freeform-tags', {}),
                    'definedTags': instance_data.get('defined-tags', {})
                }
                instances.append(instance)
            
            logger.info(f"✅ Found {len(instances)} instances via CLI")
            return instances
            
        except Exception as e:
            logger.error(f"CLI fallback failed: {e}")
            raise

# Initialize OCI client manager
oci_manager = OCIClientManager()

@mcp.tool()
async def list_compute_instances(compartment_id: str = None, lifecycle_state: str = "RUNNING") -> Dict[str, Any]:
    """
    List all compute instances in the compartment with basic details.
    
    Args:
        compartment_id: OCI compartment ID (uses default if not provided)
        lifecycle_state: Filter instances by lifecycle state (RUNNING, STOPPED, etc.)
    
    Returns:
        Dictionary with 'summary' (human-readable text), 'instance_count', 'instances' (detailed data), 'method', and 'success'
    """
    try:
        target_compartment = compartment_id or oci_manager.get_compartment_id()
        if not target_compartment:
            raise Exception("Compartment ID is required")
        
        # Prefer SDK, fallback to CLI
        try:
            instances = await oci_manager.list_instances_sdk(target_compartment, lifecycle_state)
        except Exception as sdk_error:
            logger.warning(f"SDK failed, trying CLI: {sdk_error}")
            instances = await oci_manager.list_instances_cli_fallback(target_compartment, lifecycle_state)
        
        # Create LLM-friendly summary
        summary_lines = [
            f"Found {len(instances)} running compute instances in Frankfurt (eu-frankfurt-1):",
            ""
        ]
        
        for i, instance in enumerate(instances, 1):
            summary_lines.append(f"{i:2d}. {instance['displayName']} ({instance['shape']}) - {instance['lifecycleState']}")
        
        summary_lines.extend([
            "",
            f"Retrieved using: {'OCI Python SDK' if oci_manager.compute_client else 'OCI CLI'}",
            f"Compartment: {target_compartment}",
            f"Retrieved at: {datetime.utcnow().isoformat()}"
        ])
        
        summary_text = "\n".join(summary_lines)
        
        # Return both human-readable summary and structured data
        response = {
            'summary': summary_text,
            'instance_count': len(instances),
            'instances': instances,
            'method': 'SDK' if oci_manager.compute_client else 'CLI',
            'success': True
        }
        
        return response
        
    except Exception as e:
        logger.error(f"Error listing compute instances: {e}")
        error_message = f"❌ Failed to list compute instances: {str(e)}"
        return {
            'summary': error_message,
            'instance_count': 0,
            'instances': [],
            'method': 'Error',
            'success': False,
            'error': str(e)
        }

@mcp.tool()
async def list_instances_with_network(compartment_id: str = None, lifecycle_state: str = "RUNNING") -> Dict[str, Any]:
    """
    List compute instances with complete network information including IP addresses.
    
    Args:
        compartment_id: OCI compartment ID (uses default if not provided)
        lifecycle_state: Filter instances by lifecycle state (RUNNING, STOPPED, etc.)
    
    Returns:
        Dictionary with 'summary' (human-readable text with network details), 'instance_count', 'instances' (detailed data), 'includes_network_info', 'method', and 'success'
    """
    try:
        target_compartment = compartment_id or oci_manager.get_compartment_id()
        if not target_compartment:
            raise Exception("Compartment ID is required")
        
        # This requires SDK for VNIC details, CLI fallback limited
        if oci_manager.compute_client and oci_manager.network_client:
            instances = await oci_manager.list_instances_with_network_sdk(target_compartment, lifecycle_state)
            method = 'SDK'
        else:
            logger.warning("Network information requires OCI SDK, falling back to basic instance list")
            instances = await oci_manager.list_instances_cli_fallback(target_compartment, lifecycle_state)
            # Add empty network info for CLI fallback
            for instance in instances:
                instance['networkInfo'] = []
                instance['primaryPrivateIp'] = None
                instance['primaryPublicIp'] = None
                instance['hostname'] = None
            method = 'CLI (limited)'
        
        # Create LLM-friendly summary with network info
        summary_lines = [
            f"Found {len(instances)} compute instances with network information:",
            ""
        ]
        
        for i, instance in enumerate(instances, 1):
            name = instance['displayName']
            shape = instance['shape']
            private_ip = instance.get('primaryPrivateIp', 'N/A')
            public_ip = instance.get('primaryPublicIp', 'None')
            hostname = instance.get('hostname', 'N/A')
            
            summary_lines.append(f"{i:2d}. {name} ({shape})")
            summary_lines.append(f"    Private IP: {private_ip}")
            summary_lines.append(f"    Public IP: {public_ip}")
            summary_lines.append(f"    Hostname: {hostname}")
            summary_lines.append("")
        
        summary_lines.extend([
            f"Network info included: {'Yes' if oci_manager.network_client else 'No (requires SDK)'}",
            f"Retrieved using: {method}",
            f"Retrieved at: {datetime.utcnow().isoformat()}"
        ])
        
        summary_text = "\n".join(summary_lines)
        
        response = {
            'summary': summary_text,
            'instance_count': len(instances),
            'instances': instances,
            'includes_network_info': oci_manager.network_client is not None,
            'method': method,
            'success': True
        }
        
        return response
        
    except Exception as e:
        logger.error(f"Error listing instances with network info: {e}")
        error_message = f"❌ Failed to list instances with network info: {str(e)}"
        return {
            'summary': error_message,
            'instance_count': 0,
            'instances': [],
            'includes_network_info': False,
            'method': 'Error',
            'success': False,
            'error': str(e)
        }

@mcp.tool()
async def get_instance_details(instance_id: str, compartment_id: str = None, include_network: bool = True) -> Dict[str, Any]:
    """
    Get comprehensive instance details including configuration and network info.
    
    Args:
        instance_id: OCI Compute instance OCID
        compartment_id: OCI compartment ID (uses default if not provided)
        include_network: Include network interface details
    
    Returns:
        Dictionary containing detailed instance information
    """
    try:
        target_compartment = compartment_id or oci_manager.get_compartment_id()
        
        # Get instance details
        if oci_manager.compute_client:
            instance = await oci_manager.get_instance_details_sdk(instance_id)
            method = 'SDK'
        else:
            # CLI fallback would require additional implementation
            raise Exception("Instance details require OCI SDK")
        
        # Add network information if requested and available
        if include_network and oci_manager.network_client:
            try:
                vnic_attachments = await oci_manager.get_vnic_attachments_sdk(instance_id, target_compartment)
                network_info = []
                
                for vnic_attachment in vnic_attachments:
                    vnic_details = await oci_manager.get_vnic_details_sdk(vnic_attachment['vnicId'])
                    if vnic_details:
                        network_info.append({
                            'isPrimary': vnic_details['isPrimary'],
                            'privateIp': vnic_details['privateIp'],
                            'publicIp': vnic_details['publicIp'],
                            'hostname': vnic_details['hostname'],
                            'macAddress': vnic_details['macAddress'],
                            'nicIndex': vnic_attachment['nicIndex']
                        })
                
                instance['networkInfo'] = network_info
                
                # Add primary IP addresses
                primary_vnic = next((ni for ni in network_info if ni['isPrimary']), None)
                if primary_vnic:
                    instance['primaryPrivateIp'] = primary_vnic['privateIp']
                    instance['primaryPublicIp'] = primary_vnic['publicIp']
                    instance['hostname'] = primary_vnic['hostname']
                
            except Exception as e:
                logger.warning(f"Failed to get network info: {e}")
                instance['networkInfo'] = []
        
        response = {
            'instance': instance,
            'includesNetworkInfo': include_network and oci_manager.network_client is not None,
            'method': method,
            'loganCompatible': True,
            'retrievedAt': datetime.utcnow().isoformat(),
            'service': 'OCI Core Services',
            'operationType': 'get_instance_details'
        }
        
        return response
        
    except Exception as e:
        logger.error(f"Error getting instance details: {e}")
        return {
            'error': f"Failed to get instance details: {str(e)}",
            'success': False,
            'retrievedAt': datetime.utcnow().isoformat()
        }

@mcp.tool()
async def query_compute_metrics(instance_id: str, metric_name: str, start_time: str, 
                               end_time: str = None, compartment_id: str = None) -> Dict[str, Any]:
    """
    Query OCI Compute Agent metrics for a specific instance.
    
    Args:
        instance_id: OCI Compute instance OCID
        metric_name: Metric name (e.g., CpuUtilization, MemoryUtilization)
        start_time: Start time (ISO 8601 or relative like "1h", "24h")
        end_time: End time (ISO 8601, defaults to now)
        compartment_id: OCI compartment ID (uses default if not provided)
    
    Returns:
        Dictionary containing metric data points
    """
    try:
        target_compartment = compartment_id or oci_manager.get_compartment_id()
        if not target_compartment:
            raise Exception("Compartment ID is required")
        
        # Parse time parameters
        if start_time.endswith('h'):
            hours = int(start_time[:-1])
            start_dt = datetime.utcnow() - timedelta(hours=hours)
        elif start_time.endswith('d'):
            days = int(start_time[:-1])
            start_dt = datetime.utcnow() - timedelta(days=days)
        else:
            start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
        
        end_dt = datetime.utcnow() if not end_time else datetime.fromisoformat(end_time.replace('Z', '+00:00'))
        
        # Query metrics using SDK
        if oci_manager.monitoring_client:
            dimensions = {'resourceId': instance_id}
            metrics = await oci_manager.query_metrics_sdk(
                namespace='oci_computeagent',
                metric_name=metric_name,
                start_time=start_dt,
                end_time=end_dt,
                compartment_id=target_compartment,
                dimensions=dimensions
            )
            method = 'SDK'
        else:
            raise Exception("Metrics querying requires OCI SDK")
        
        response = {
            'metrics': metrics,
            'query': {
                'instanceId': instance_id,
                'metricName': metric_name,
                'namespace': 'oci_computeagent',
                'startTime': start_dt.isoformat(),
                'endTime': end_dt.isoformat(),
                'compartmentId': target_compartment
            },
            'method': method,
            'loganCompatible': True,
            'retrievedAt': datetime.utcnow().isoformat(),
            'service': 'OCI Monitoring',
            'operationType': 'query_compute_metrics'
        }
        
        return response
        
    except Exception as e:
        logger.error(f"Error querying compute metrics: {e}")
        return {
            'error': f"Failed to query compute metrics: {str(e)}",
            'success': False,
            'retrievedAt': datetime.utcnow().isoformat()
        }

@mcp.tool()
async def test_oci_connection() -> Dict[str, Any]:
    """
    Test connectivity to OCI services and validate configuration.
    
    Returns:
        Dictionary containing connection test results
    """
    try:
        results = {
            'timestamp': datetime.utcnow().isoformat(),
            'service': 'OCI Connection Test',
            'tests': {}
        }
        
        # Test SDK availability
        if oci_manager.config:
            results['tests']['sdk_config'] = {
                'status': 'success',
                'message': 'OCI SDK configuration loaded',
                'region': oci_manager.config.get('region', 'unknown'),
                'tenancy': oci_manager.config.get('tenancy', '')[:20] + '...'
            }
        else:
            results['tests']['sdk_config'] = {
                'status': 'failed',
                'message': 'OCI SDK configuration not available'
            }
        
        # Test compute client
        if oci_manager.compute_client:
            try:
                compartment_id = oci_manager.get_compartment_id()
                if compartment_id:
                    instances = await oci_manager.list_instances_sdk(compartment_id, "RUNNING")
                    results['tests']['compute_service'] = {
                        'status': 'success',
                        'message': f'Compute service accessible - found {len(instances)} running instances',
                        'instance_count': len(instances)
                    }
                else:
                    results['tests']['compute_service'] = {
                        'status': 'warning',
                        'message': 'Compute client available but no compartment ID configured'
                    }
            except Exception as e:
                results['tests']['compute_service'] = {
                    'status': 'failed',
                    'message': f'Compute service test failed: {str(e)[:100]}...'
                }
        else:
            results['tests']['compute_service'] = {
                'status': 'failed',
                'message': 'Compute client not available'
            }
        
        # Test monitoring client
        if oci_manager.monitoring_client:
            results['tests']['monitoring_service'] = {
                'status': 'success',
                'message': 'Monitoring client available'
            }
        else:
            results['tests']['monitoring_service'] = {
                'status': 'failed',
                'message': 'Monitoring client not available'
            }
        
        # Overall status
        failed_tests = [test for test in results['tests'].values() if test['status'] == 'failed']
        if not failed_tests:
            results['overall_status'] = 'success'
            results['message'] = 'All OCI services accessible'
        else:
            results['overall_status'] = 'partial' if len(failed_tests) < len(results['tests']) else 'failed'
            results['message'] = f'{len(failed_tests)} out of {len(results["tests"])} tests failed'
        
        return results
        
    except Exception as e:
        logger.error(f"Connection test failed: {e}")
        return {
            'overall_status': 'failed',
            'message': f'Connection test failed: {str(e)}',
            'timestamp': datetime.utcnow().isoformat(),
            'error': str(e)
        }

if __name__ == "__main__":
    # Print startup information
    print("🚀 Starting OCI FastMCP Server with Python SDK...", file=sys.stderr)
    print("📋 Available tools:", file=sys.stderr)
    print("   - list_compute_instances: List instances with basic details", file=sys.stderr)
    print("   - list_instances_with_network: List instances with network information", file=sys.stderr)
    print("   - get_instance_details: Get comprehensive instance details", file=sys.stderr)
    print("   - query_compute_metrics: Query Compute Agent metrics", file=sys.stderr)
    print("   - test_oci_connection: Test OCI connectivity", file=sys.stderr)
    print("", file=sys.stderr)
    print("⚙️  Configuration:", file=sys.stderr)
    print(f"   - OCI SDK Available: {'✅' if oci_manager.compute_client else '❌'}", file=sys.stderr)
    print(f"   - Region: {oci_manager.config.get('region', 'Not configured') if oci_manager.config else 'Not configured'}", file=sys.stderr)
    print(f"   - Compartment ID: {oci_manager.get_compartment_id() or '❌ Not set'}", file=sys.stderr)
    print("", file=sys.stderr)
    
    # Run the FastMCP server
    mcp.run()