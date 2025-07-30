# OCI Metrics MCP Server - Installation Guide

This guide provides step-by-step instructions for installing and configuring the OCI Metrics MCP Server.

## Prerequisites

### System Requirements

- **Operating System**: Linux, macOS, or Windows with WSL2
- **Node.js**: Version 18.0 or higher
- **Python**: Version 3.8 or higher (for FastMCP server)
- **Git**: For cloning the repository
- **Internet Access**: For downloading dependencies and accessing OCI APIs

### OCI Account Requirements

- Valid Oracle Cloud Infrastructure account
- Access to a compartment with monitoring permissions
- OCI CLI configured with API keys

## Step 1: Install OCI CLI

### On Linux/macOS

```bash
# Download and install OCI CLI
bash -c "$(curl -L https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh)"

# Add to PATH (if not automatically added)
echo 'export PATH=$PATH:~/bin' >> ~/.bashrc
source ~/.bashrc
```

### On Windows (WSL2)

```bash
# Same as Linux/macOS
bash -c "$(curl -L https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh)"
```

### Verify Installation

```bash
oci --version
# Should output: Oracle Cloud Infrastructure CLI 3.x.x
```

## Step 2: Configure OCI CLI

### Generate API Key

1. Log into OCI Console
2. Go to **User Settings** → **API Keys**
3. Click **Add API Key**
4. Choose **Generate API Key Pair**
5. Download both public and private keys
6. Note the Configuration File Preview

### Configure CLI

```bash
# Interactive configuration
oci setup config

# You'll be prompted for:
# - Location of config file [~/.oci/config]: Press Enter
# - User OCID: ocid1.user.oc1..your-user-id
# - Tenancy OCID: ocid1.tenancy.oc1..your-tenancy-id  
# - Region: us-ashburn-1 (or your preferred region)
# - Location of private key: /path/to/your/private-key.pem
# - Passphrase: (if your key has one)
```

### Test OCI Connection

```bash
# Test basic connectivity
oci iam compartment list

# Should return list of compartments you have access to
```

## Step 3: Clone and Setup Project

### Clone Repository

```bash
# Clone the repository
git clone https://github.com/your-username/mcp-oci-metrics-server.git
cd mcp-oci-metrics-server

# Verify files
ls -la
```

### Install Dependencies

```bash
# Install Node.js dependencies
npm install

# For FastMCP server (optional)
pip install -r requirements.txt
```

## Step 4: Configure Environment

### Create Environment File

```bash
# Copy template
cp .env.example .env

# Edit with your values
nano .env  # or use your preferred editor
```

### Required Environment Variables

```bash
# Required: Your compartment OCID
OCI_COMPARTMENT_ID=ocid1.compartment.oc1..aaaaaaaa...

# Required: Your OCI region  
OCI_REGION=us-ashburn-1

# Optional: Custom OCI config file location
OCI_CONFIG_FILE=~/.oci/config

# Optional: OCI profile to use
OCI_CONFIG_PROFILE=DEFAULT

# Optional: Runtime environment
NODE_ENV=production

# Optional: Enable debug logging
DEBUG=false
```

### Find Your Compartment OCID

```bash
# List compartments to find the OCID
oci iam compartment list --compartment-id-in-subtree true

# Look for the compartment you want to monitor
# Copy the "id" field (starts with ocid1.compartment.oc1..)
```

## Step 5: Build and Test

### Build TypeScript

```bash
# Compile TypeScript to JavaScript
npm run build

# Verify build output
ls -la dist/
```

### Test Server

```bash
# Run basic server test
node test-server.js

# Expected output:
# ✅ OCI connection successful
# ✅ Server started successfully
```

### Test Individual Components

```bash
# Test visualization
node test-llm-visualization.js

# Test core services (if available)
python test_core_services.py
```

## Step 6: Configure Claude Desktop

### Locate Configuration File

**macOS:**
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```bash
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```bash
~/.config/Claude/claude_desktop_config.json
```

### Update Configuration

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "oci-metrics": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-oci-metrics-server/dist/index.js"
      ],
      "env": {
        "OCI_COMPARTMENT_ID": "ocid1.compartment.oc1..your-actual-ocid",
        "OCI_REGION": "us-ashburn-1",
        "NODE_ENV": "production"
      }
    }
  }
}
```

**Important:** Replace `/absolute/path/to/mcp-oci-metrics-server` with your actual path!

### Get Absolute Path

```bash
# Get current directory path
pwd
# Use this output in the config above
```

## Step 7: Set Up Permissions

### Required OCI IAM Policies

Create these policies in your OCI tenancy:

```json
{
  "name": "mcp-metrics-policy",
  "statements": [
    "allow group mcp-users to read metrics in compartment your-compartment-name",
    "allow group mcp-users to read compartments in tenancy",
    "allow group mcp-users to inspect tenancies in tenancy"
  ]
}
```

### File Permissions

```bash
# Ensure private key is secure
chmod 600 ~/.oci/your-private-key.pem

# Verify config permissions
chmod 600 ~/.oci/config
```

## Step 8: Start and Verify

### Start Claude Desktop

1. Restart Claude Desktop application
2. Open a new conversation
3. The OCI Metrics server should now be available

### Test in Claude

Try these commands in Claude:

```
Can you list the available OCI namespaces?
```

```
Show me CPU utilization metrics for the last hour
```

```
Generate a graph of memory usage trends
```

## Troubleshooting

### Common Issues

#### 1. "OCI config file not found"

**Solution:**
```bash
# Verify config file exists
ls -la ~/.oci/config

# If missing, run setup again
oci setup config
```

#### 2. "Permission denied" errors

**Solution:**
```bash
# Check IAM policies in OCI Console
# Ensure your user is in the correct group
# Verify compartment OCID is correct
```

#### 3. "Module not found" errors

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### 4. "Failed to authenticate with OCI"

**Solution:**
```bash
# Test OCI CLI directly
oci iam compartment list

# If this fails, reconfigure OCI CLI
oci setup config
```

#### 5. Claude Desktop doesn't show the server

**Solution:**
- Check the absolute path in config is correct
- Ensure environment variables are set
- Restart Claude Desktop completely
- Check Claude Desktop logs (if available)

### Debug Mode

Enable detailed logging:

```bash
# Set debug environment
DEBUG=true NODE_ENV=development node dist/index.js

# Or test directly
DEBUG=true node test-server.js
```

### Log Files

Check these locations for logs:

```bash
# MCP server logs
tail -f mcp-server.log

# OCI CLI logs
tail -f ~/.oci/log/oci_cli.log

# System logs (Linux)
journalctl -f -u your-service-name
```

## Security Best Practices

### Protect Credentials

```bash
# Secure private key
chmod 600 ~/.oci/your-private-key.pem

# Secure config file
chmod 600 ~/.oci/config

# Never commit credentials to git
echo "*.pem" >> .gitignore
echo ".env" >> .gitignore
```

### Network Security

- Use HTTPS endpoints only
- Keep OCI CLI updated
- Regularly rotate API keys
- Monitor access logs

### Compartment Isolation

- Use dedicated compartments for different environments
- Apply least-privilege access policies
- Monitor resource usage and costs

## Advanced Configuration

### Custom OCI Profiles

```bash
# Create additional profiles in ~/.oci/config
[PRODUCTION]
user=ocid1.user.oc1..prod-user
tenancy=ocid1.tenancy.oc1..prod-tenancy
region=us-ashburn-1
key_file=~/.oci/prod-key.pem
fingerprint=xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx

[DEVELOPMENT]
user=ocid1.user.oc1..dev-user
tenancy=ocid1.tenancy.oc1..dev-tenancy
region=us-phoenix-1
key_file=~/.oci/dev-key.pem
fingerprint=yy:yy:yy:yy:yy:yy:yy:yy:yy:yy:yy:yy:yy:yy:yy:yy
```

### Multiple Compartments

```bash
# Set different compartments per environment
OCI_COMPARTMENT_ID_PROD=ocid1.compartment.oc1..prod-compartment
OCI_COMPARTMENT_ID_DEV=ocid1.compartment.oc1..dev-compartment
```

### Performance Tuning

```bash
# Adjust timeouts and concurrency
OCI_REQUEST_TIMEOUT=30000
OCI_MAX_CONCURRENT_REQUESTS=10
```

## Next Steps

After successful installation:

1. **Explore Available Tools**: Use Claude to discover all available MCP tools
2. **Create Dashboards**: Generate interactive visualizations
3. **Set Up Monitoring**: Configure regular metric queries
4. **Integration**: Connect with other MCP servers (Logan, Data Science)
5. **Automation**: Create scheduled reports and alerts

## Support

If you encounter issues:

1. Check this installation guide
2. Review the main README.md
3. Test OCI CLI independently
4. Check file permissions and paths
5. Enable debug logging
6. Create GitHub issues for bugs

**Remember**: Never commit credentials or sensitive data to version control!