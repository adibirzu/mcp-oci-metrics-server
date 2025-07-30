# Security Policy

## Security Features

This MCP server implements several security measures to protect your OCI environment:

### ✅ Secure Authentication
- Uses OCI CLI configuration with API key authentication
- No hardcoded credentials in source code
- Private key-based signing for all API requests
- Supports multiple OCI profiles for environment separation

### ✅ Environment Isolation
- All sensitive configuration via environment variables
- Compartment-based access control
- No credential storage in application code
- Secure file permissions for key files

### ✅ Read-Only Operations
- Server provides read-only access to metrics
- No write/modify capabilities to OCI resources
- Limited to monitoring and telemetry data only
- Cannot create, delete, or modify infrastructure

### ✅ Network Security
- HTTPS-only communication with OCI APIs
- Certificate validation enabled
- No insecure HTTP connections
- Proper timeout and retry configurations

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | ✅ Yes    |
| < 1.0   | ❌ No     |

## Reporting Security Vulnerabilities

**DO NOT** create public GitHub issues for security vulnerabilities.

Instead, please report security issues privately:

1. **Email**: Send details to [security@yourcompany.com]
2. **Include**: 
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Suggested mitigation (if any)

We will acknowledge receipt within 48 hours and provide a detailed response within 7 days.

## Security Best Practices

### 1. OCI Configuration Security

```bash
# Secure your OCI private key
chmod 600 ~/.oci/your-private-key.pem

# Secure your config file
chmod 600 ~/.oci/config

# Never commit these files
echo "*.pem" >> .gitignore
echo ".oci/" >> .gitignore
```

### 2. Environment Variables

```bash
# Use environment variables for all sensitive data
export OCI_COMPARTMENT_ID="ocid1.compartment.oc1..your-id"
export OCI_REGION="us-ashburn-1"

# Never hardcode OCIDs or credentials
# ❌ BAD: const compartmentId = "ocid1.compartment..."
# ✅ GOOD: const compartmentId = process.env.OCI_COMPARTMENT_ID
```

### 3. IAM Policies

Create minimal IAM policies with least-privilege access:

```json
{
  "name": "mcp-metrics-readonly",
  "statements": [
    "allow group mcp-users to read metrics in compartment your-compartment",
    "allow group mcp-users to read compartments in tenancy"
  ]
}
```

**Do NOT grant:**
- `manage` permissions
- `use` permissions on compute/network resources
- Admin access to compartments
- Tenancy-level permissions (unless required)

### 4. Network Security

- Use HTTPS endpoints only
- Validate SSL certificates
- Implement request timeouts
- Use OCI's regional endpoints

### 5. Monitoring and Auditing

- Enable OCI Audit service
- Monitor API key usage
- Set up alerts for unusual activity
- Regular security reviews

## Security Configuration Checklist

- [ ] OCI CLI configured with API keys (not username/password)
- [ ] Private key files have 600 permissions
- [ ] No credentials committed to git
- [ ] Environment variables used for all config
- [ ] IAM policies follow least-privilege principle
- [ ] Audit logging enabled in OCI
- [ ] Regular API key rotation scheduled
- [ ] Monitoring set up for unusual access patterns

## Secure Deployment

### Production Environment

```bash
# Use separate compartments
OCI_COMPARTMENT_ID_PROD="ocid1.compartment.oc1..prod"
OCI_COMPARTMENT_ID_DEV="ocid1.compartment.oc1..dev"

# Use different API keys per environment
# ~/.oci/config with [PRODUCTION] and [DEVELOPMENT] profiles

# Restrict network access
# Use OCI Security Lists/NSGs to limit API access
```

### Development Environment

```bash
# Use minimal test data
# Separate development compartment
# Limited time-range queries
# Non-production regions when possible
```

## Incident Response

If you suspect a security incident:

1. **Immediate Actions**:
   - Rotate affected API keys
   - Review OCI Audit logs
   - Check for unauthorized access
   - Document the timeline

2. **Investigation**:
   - Analyze server logs
   - Review recent configuration changes
   - Check network access patterns
   - Validate IAM policies

3. **Recovery**:
   - Update security configurations
   - Apply security patches
   - Review and improve monitoring
   - Update incident response procedures

## Compliance

This server is designed to support:

- **SOC 2 Type II** compliance requirements
- **ISO 27001** security standards
- **PCI DSS** (when applicable)
- **GDPR** data protection requirements

## Security Updates

- Subscribe to OCI security bulletins
- Monitor this repository for security updates
- Keep dependencies updated regularly
- Follow semantic versioning for security patches

## Threat Model

### Assets
- OCI API credentials
- Monitoring data
- Configuration files
- Server logs

### Threats
- Credential theft
- Unauthorized data access
- API key compromise
- Configuration tampering

### Mitigations
- Strong authentication (API keys)
- Encryption in transit (HTTPS)
- Access logging and monitoring
- Principle of least privilege
- Environment variable isolation
- Secure file permissions

## Contact

For security-related questions or concerns:
- Email: security@yourcompany.com
- Response time: 48 hours for acknowledgment
- Escalation: Critical issues within 24 hours

---

**Last Updated**: 2024-01-15  
**Version**: 1.0.0