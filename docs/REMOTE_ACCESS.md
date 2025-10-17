# Remote Access Guide 🌐

Complete guide to accessing **MCP-Pentest-Forge** remotely from anywhere in the world.

## Table of Contents

- [Overview](#overview)
- [Access Methods](#access-methods)
- [ngrok Setup (Easiest)](#ngrok-setup-easiest)
- [VPS Deployment](#vps-deployment)
- [VPN Access](#vpn-access)
- [SSH Tunneling](#ssh-tunneling)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

## Overview

MCP-Pentest-Forge can be accessed remotely for:
- **Mobile pentesting** - Use from your phone/tablet
- **Team collaboration** - Multiple pentesters working together
- **Cloud deployments** - Run on powerful cloud servers
- **Remote engagements** - Access from anywhere

### Access Methods Comparison

| Method | Difficulty | Cost | Security | Speed | Best For |
|--------|-----------|------|----------|-------|----------|
| ngrok | Easy | Free/Paid | Medium | Fast | Quick testing, demos |
| VPS | Medium | $5-50/mo | High | Fast | Production use |
| VPN | Hard | Free/Paid | Highest | Fast | Secure team access |
| SSH Tunnel | Medium | Free | High | Medium | Personal use |

## ngrok Setup (Easiest)

**⏱️ Setup Time: 5 minutes**

ngrok creates a secure tunnel to your local server, making it accessible via a public URL.

### Step 1: Install ngrok

**Windows:**
1. Download from [ngrok.com/download](https://ngrok.com/download)
2. Extract `ngrok.exe` to a folder
3. Add to PATH (optional)

**macOS:**
```bash
brew install ngrok
```

**Linux:**
```bash
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && \
  echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  sudo tee /etc/apt/sources.list.d/ngrok.list && \
  sudo apt update && sudo apt install ngrok
```

### Step 2: Get Auth Token

1. Sign up at [ngrok.com](https://ngrok.com)
2. Get your auth token from [dashboard](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Configure:
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```

### Step 3: Start Tunnel

```bash
# Enable HTTP mode in MCP server
echo "HTTP_PORT=3000" > .env
docker-compose restart

# Start ngrok tunnel
ngrok http 3000
```

You'll see output like:
```
Forwarding    https://abc123.ngrok-free.app -> http://localhost:3000
```

### Step 4: Test Access

```bash
# Test from anywhere
curl https://abc123.ngrok-free.app/ \
  -H "ngrok-skip-browser-warning: true"

# Execute command
curl -X POST https://abc123.ngrok-free.app/api/tools/kali_execute \
  -H "Content-Type: application/json" \
  -H "ngrok-skip-browser-warning: true" \
  -d '{"arguments": {"command": "whoami"}}'
```

### Step 5: Update n8n Workflow

If using n8n, update the "Execute Command" node URL:
```
https://abc123.ngrok-free.app/api/tools/kali_execute
```

### ngrok Pro Features

Upgrade for:
- **Custom domains**: `pentest.yourdomain.com`
- **Reserved URLs**: Same URL every time
- **IP whitelisting**: Restrict access by IP
- **OAuth**: Add Google/GitHub authentication

**See detailed guide**: [ngrok Setup Guide](NGROK_SETUP.md)

## VPS Deployment

**⏱️ Setup Time: 30 minutes**

Deploy MCP-Pentest-Forge on a cloud server for permanent access.

### Recommended Providers

| Provider | Cost | Best For |
|----------|------|----------|
| DigitalOcean | $6/mo | Beginners, simple setup |
| Linode | $5/mo | Best value |
| Vultr | $6/mo | Global locations |
| AWS EC2 | Variable | Enterprise, advanced features |
| Hetzner | €4/mo | Europe, cheapest |

### Step 1: Create VPS

1. Sign up with provider
2. Create a new server:
   - **OS**: Ubuntu 22.04 LTS
   - **Size**: 2GB RAM minimum, 4GB recommended
   - **Location**: Closest to you

### Step 2: Install Docker

SSH into your server:
```bash
ssh root@your-server-ip
```

Install Docker:
```bash
# Update packages
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Verify installation
docker --version
docker-compose --version
```

### Step 3: Deploy MCP-Pentest-Forge

```bash
# Clone repository
git clone https://github.com/akilhassane/mcp-pentest-forge.git
cd mcp-pentest-forge

# Enable HTTP mode
cat > .env << 'EOF'
HTTP_PORT=3000
EOF

# Start containers
docker-compose up -d

# Check status
docker ps
```

### Step 4: Configure Firewall

```bash
# Allow SSH (important!)
ufw allow 22/tcp

# Allow API port
ufw allow 3000/tcp

# Enable firewall
ufw enable

# Check status
ufw status
```

### Step 5: Set Up Reverse Proxy (Optional but Recommended)

Install nginx for HTTPS:

```bash
# Install nginx
apt install nginx -y

# Install certbot for SSL
apt install certbot python3-certbot-nginx -y

# Create nginx config
cat > /etc/nginx/sites-available/mcp-pentest << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/mcp-pentest /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# Get SSL certificate
certbot --nginx -d your-domain.com
```

### Step 6: Add Authentication

Protect your API with basic auth:

```bash
# Install apache2-utils
apt install apache2-utils -y

# Create password file
htpasswd -c /etc/nginx/.htpasswd admin

# Update nginx config
cat > /etc/nginx/sites-available/mcp-pentest << 'EOF'
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        auth_basic "Restricted Access";
        auth_basic_user_file /etc/nginx/.htpasswd;
        
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

# Reload nginx
nginx -t && systemctl reload nginx
```

### Step 7: Test Remote Access

From your local machine:
```bash
# Test basic access
curl https://your-domain.com/

# Test with authentication
curl https://your-domain.com/api/tools/kali_execute \
  -u admin:your_password \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"command": "whoami"}}'
```

## VPN Access

**⏱️ Setup Time: 1 hour**

Most secure option - creates encrypted network connection.

### WireGuard VPN (Recommended)

```bash
# On your VPS
curl -O https://raw.githubusercontent.com/angristan/wireguard-install/master/wireguard-install.sh
chmod +x wireguard-install.sh
./wireguard-install.sh

# Follow prompts to:
# 1. Install WireGuard
# 2. Create client configuration
# 3. Download config file

# On your local machine:
# Install WireGuard from wireguard.com
# Import the config file
# Connect to VPN
# Access via internal IP: http://10.8.0.1:3000
```

### Tailscale (Easiest VPN)

```bash
# On your VPS
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up

# On your local machine
# Install Tailscale from tailscale.com
# Log in with same account
# Access via Tailscale IP: http://100.x.x.x:3000
```

## SSH Tunneling

**⏱️ Setup Time: 2 minutes**

Quick and secure, perfect for temporary access.

### Local Port Forwarding

```bash
# Forward remote port 3000 to local port 8000
ssh -L 8000:localhost:3000 user@your-server-ip

# Now access at http://localhost:8000
# In another terminal:
curl http://localhost:8000/
```

### Reverse SSH Tunnel

Make local server accessible from remote machine:

```bash
# From local machine (behind NAT)
ssh -R 3000:localhost:3000 user@your-vps-ip

# On VPS, access via http://localhost:3000
```

### AutoSSH (Persistent Tunnel)

```bash
# Install autossh
apt install autossh -y

# Create persistent tunnel
autossh -M 0 -f -N -L 8000:localhost:3000 user@your-server-ip

# Tunnel stays alive even if connection drops
```

## Security Considerations

### ⚠️ CRITICAL: Do Not Expose Without Protection

**Never** expose MCP-Pentest-Forge to the internet without:

1. **Authentication**
   - Basic auth (nginx/Apache)
   - API keys
   - OAuth (Google, GitHub)

2. **Encryption**
   - HTTPS/TLS only
   - Valid SSL certificates
   - No self-signed certs in production

3. **Firewall**
   - Restrict by IP when possible
   - Use fail2ban for brute force protection
   - Close unused ports

4. **Monitoring**
   - Log all access
   - Set up alerts for suspicious activity
   - Regular security audits

### Best Practices

1. **Use VPN when possible**
   - Most secure option
   - Encrypted traffic
   - No public exposure

2. **Keep software updated**
   ```bash
   apt update && apt upgrade -y
   docker-compose pull
   docker-compose up -d
   ```

3. **Use strong passwords**
   ```bash
   # Generate strong password
   openssl rand -base64 32
   ```

4. **Enable 2FA**
   - On your VPS provider
   - On ngrok account
   - On domain registrar

5. **Regular backups**
   ```bash
   # Backup configuration
   tar -czf mcp-backup-$(date +%Y%m%d).tar.gz mcp-pentest-forge/
   ```

### Network Scanning Considerations

When running remotely:

1. **Legal concerns**: Ensure you have authorization
2. **IP attribution**: Scans will come from your VPS IP
3. **Provider ToS**: Some providers ban pentesting
4. **GDPR/Privacy**: Be aware of data protection laws

## Troubleshooting

### Can't Connect to Remote Server

**Check firewall:**
```bash
# On server
ufw status

# Allow port if needed
ufw allow 3000/tcp
```

**Check Docker:**
```bash
# Verify containers running
docker ps

# Check logs
docker logs mcp-pentest-forge
```

**Check service:**
```bash
# Test locally on server
curl http://localhost:3000/

# If works locally but not remotely, it's a firewall issue
```

### ngrok Tunnel Errors

**"Tunnel not found":**
- Auth token not configured
- Run: `ngrok config add-authtoken YOUR_TOKEN`

**"Account limit exceeded":**
- Free plan allows 1 tunnel
- Upgrade to paid plan or stop other tunnels

**"Tunnel closed":**
- Session timeout (reconnect)
- Network issues (check connection)

### SSL Certificate Issues

**"Certificate not valid":**
```bash
# Renew certificate
certbot renew

# Force renewal
certbot renew --force-renewal
```

**"Can't obtain certificate":**
- DNS not pointing to server
- Port 80 blocked (certbot needs it)
- Domain not propagated (wait 24-48h)

### Performance Issues

**Slow response:**
1. Increase VPS resources
2. Use CDN for static content
3. Enable caching
4. Check server load: `htop`

**High memory usage:**
```bash
# Check memory
free -h

# Restart containers
docker-compose restart

# Limit container memory
# Edit docker-compose.yml:
services:
  kali-pentest:
    mem_limit: 2g
```

## Cost Optimization

### Free Options

1. **ngrok Free Plan**
   - ✅ Good for: Testing, demos
   - ❌ Limits: Random URL, 1 tunnel, rate limits

2. **Oracle Cloud Free Tier**
   - ✅ Good for: Permanent free VPS
   - ❌ Limits: Limited availability, complex setup

3. **Tailscale Free Plan**
   - ✅ Good for: Personal use, small teams
   - ❌ Limits: 20 devices, 100 users

### Budget Options

1. **Linode - $5/mo**
   - 1GB RAM, 25GB storage
   - Good for light use

2. **Hetzner - €4/mo**
   - 2GB RAM, 40GB storage
   - Best value in Europe

3. **ngrok Pro - $8/mo**
   - Custom domains, reserved URLs
   - No need for VPS

## Next Steps

- **ngrok Detailed Setup**: [ngrok Setup Guide](NGROK_SETUP.md)
- **n8n Integration**: [n8n Integration Guide](N8N_INTEGRATION.md)
- **API Reference**: [API Reference](API_REFERENCE.md)

---

**Stay secure! 🔒**

