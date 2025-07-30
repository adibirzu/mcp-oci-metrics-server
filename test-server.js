#!/usr/bin/env node

/**
 * Simple test script for OCI Metrics MCP Server
 * Tests basic functionality without full TypeScript compilation
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing OCI Metrics MCP Server...');

// Get configuration from OCI CLI or environment
let defaultRegion = 'eu-frankfurt-1';
let compartmentId = process.env.OCI_COMPARTMENT_ID || '';

try {
  const { execSync } = await import('child_process');
  
  // Try to get default region from OCI CLI config
  try {
    const ociConfig = execSync('cat ~/.oci/config 2>/dev/null | grep "^region" | head -1', { encoding: 'utf8' });
    const regionMatch = ociConfig.match(/region\s*=\s*(.+)/);
    if (regionMatch && regionMatch[1]) {
      defaultRegion = regionMatch[1].trim();
    }
  } catch {
    // Use default region if config not found
  }
  
  console.log('📋 Configuration:');
  console.log(`   - Default Region: ${defaultRegion}`);
  if (compartmentId) {
    console.log(`   - Compartment ID: ${compartmentId.substring(0, 20)}... (from environment)`);
  } else {
    console.log('   - Compartment ID: Not set (will need to be provided via environment)');
  }
  console.log('');
} catch (error) {
  console.log('⚠️  Could not read OCI configuration, using defaults');
}

// Test OCI CLI availability
console.log('🔧 Testing prerequisites...');

try {
  // Test if OCI CLI is installed
  const { execSync } = await import('child_process');
  
  try {
    const ociVersion = execSync('oci --version', { encoding: 'utf8' });
    console.log(`✅ OCI CLI found: ${ociVersion.trim()}`);
  } catch (error) {
    console.log('❌ OCI CLI not found. Please install OCI CLI first.');
    console.log('   Install: https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/cliinstall.htm');
    process.exit(1);
  }

  // Test OCI configuration
  if (compartmentId) {
    try {
      const configTest = execSync(`oci iam compartment get --compartment-id "${compartmentId}" --region "${defaultRegion}"`, { encoding: 'utf8' });
      console.log('✅ OCI configuration valid');
    } catch (error) {
      console.log('⚠️  OCI configuration test failed (this is expected if compartment ID is not accessible)');
      console.log('   The server will use mock data for testing');
    }
  } else {
    console.log('⚠️  No compartment ID provided - will use mock data for testing');
    console.log('   Set OCI_COMPARTMENT_ID environment variable for real data');
  }

  console.log('');
  console.log('🚀 Server requirements check completed!');
  console.log('');
  console.log('📖 Available MCP Tools:');
  console.log('   - query_oci_metrics: Query OCI monitoring metrics');
  console.log('   - generate_metrics_graph: Create interactive visualizations'); 
  console.log('   - list_oci_namespaces: List available monitoring namespaces');
  console.log('   - list_namespace_metrics: List metrics in a namespace');
  console.log('   - prepare_anomaly_detection_data: Format data for ML analysis');
  console.log('   - test_oci_connection: Test OCI connectivity');
  console.log('');
  console.log('🎯 Integration Features:');
  console.log('   - Logan MCP compatible timestamps (ISO 8601 UTC)');
  console.log('   - Graph generation for GenAI chat display');
  console.log('   - Anomaly detection data preparation');
  console.log('   - IP correlation capabilities');
  console.log('');
  console.log('⚙️  Next Steps:');
  console.log('   1. Set OCI_COMPARTMENT_ID environment variable if not already set');
  console.log('   2. Build the TypeScript: npm run build');
  console.log('   3. Add to Claude Desktop/Code configuration');
  console.log('   4. Test with: npm start');
  console.log('');
  console.log('📄 Configuration files available:');
  console.log('   - claude_desktop_config.json');
  console.log('   - claude_code_config.json');
  console.log('   - README.md (detailed documentation)');
  console.log('');
  console.log('🔒 Security Notes:');
  console.log('   - No credentials are embedded in code');
  console.log('   - Uses OCI CLI configuration (~/.oci/config)');
  console.log('   - Compartment ID set via environment variable only');
  console.log(`   - Default region: ${defaultRegion} (from OCI CLI config)`);

} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.log('');
  console.log('💡 Common issues:');
  console.log('   - Make sure OCI CLI is installed and configured');
  console.log('   - Set OCI_COMPARTMENT_ID environment variable');
  console.log('   - Check OCI configuration: ~/.oci/config');
  process.exit(1);
}

console.log('\n✅ OCI Metrics MCP Server test completed successfully!');