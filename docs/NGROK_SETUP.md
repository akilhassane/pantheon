# ngrok Setup Guide ⚡

Quick and detailed guide to exposing **MCP-Pentest-Forge** to the internet using ngrok.

## Table of Contents

- [What is ngrok?](#what-is-ngrok)
- [Quick Start (5 Minutes)](#quick-start-5-minutes)
- [Detailed Setup](#detailed-setup)
- [Configuration](#configuration)
- [n8n Integration](#n8n-integration)
- [Advanced Features](#advanced-features)
- [Troubleshooting](#troubleshooting)
- [Security](#security)

## What is ngrok?

ngrok creates secure tunnels from public internet to your local machine. Perfect for:
- **Quick testing** - No VPS needed
- **Demos** - Share with team instantly
- **Webhooks** - Receive callbacks from services
- **Mobile access** - Use from anywhere

### How it Works

```
Internet → ngrok.com → ngrok agent → localhost:3000 → MCP Server
```

## Quick Start (5 Minutes)

### 1. Install ngrok

**Windows:**
- Download from [ngrok.com/download](https://ngrok.com/download)
- Extract `ngrok.exe` to any folder

**macOS:**
```bash
brew install ngrok
```

**Linux:**
```bash
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok
```

### 2. Get Auth Token

1. Sign up at [ngrok.com](https://ngrok.com)
2. Copy your auth token from [dashboard](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Configure ngrok:

**Windows:**
```powershell
.\ngrok.exe config add-authtoken YOUR_AUTH_TOKEN_HERE
```

**macOS/Linux:**
```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
```

### 3. Start MCP Server

```bash
# Make sure MCP containers are running
cd mcp-pentest-forge
docker-compose up -d

# Enable HTTP mode
echo "HTTP_PORT=3000" > .env
docker-compose restart

# Verify it's working
curl http://localhost:3000/
```

### 4. Start ngrok Tunnel

**Windows:**
```powershell
.\ngrok.exe http 3000
```

**macOS/Linux:**
```bash
ngrok http 3000
```

### 5. Get Your Public URL

You'll see output like:
```
ngrok

Session Status                online
Account                       your@email.com (Plan: Free)
Version                       3.5.0
Region                        United States (us)
Latency                       25ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok-free.app -> http://localhost:3000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

**Your public URL**: `https://abc123.ngrok-free.app`

### 6. Test Remote Access

From any device connected to the internet:

```bash
# Test basic connectivity
curl https://abc123.ngrok-free.app/ \
  -H "ngrok-skip-browser-warning: true"

# Test command execution
curl -X POST https://abc123.ngrok-free.app/api/tools/kali_execute \
  -H "Content-Type: application/json" \
  -H "ngrok-skip-browser-warning: true" \
  -d '{"arguments": {"command": "whoami"}}'
```

**✅ Done!** Your MCP server is now accessible from anywhere!

## Detailed Setup

### Prerequisites

1. **MCP-Pentest-Forge installed and running**
   ```bash
   docker ps | grep mcp-pentest-forge
   ```

2. **HTTP mode enabled**
   ```bash
   cat .env | grep HTTP_PORT
   # Should show: HTTP_PORT=3000
   ```

3. **Port 3000 accessible locally**
   ```bash
   curl http://localhost:3000/
   ```

### Installation Steps

#### Windows Detailed

1. **Download ngrok**
   - Go to [ngrok.com/download](https://ngrok.com/download)
   - Click "Download For Windows"
   - Extract ZIP to `C:\ngrok\` (or any folder)

2. **Add to PATH (Optional)**
   - Right-click "This PC" → Properties
   - Advanced system settings → Environment Variables
   - Edit "Path" → New → `C:\ngrok`
   - Now you can run `ngrok` from anywhere

3. **Sign up and get token**
   - Visit [ngrok.com/signup](https://ngrok.com/signup)
   - Copy auth token from dashboard
   - Open PowerShell:
     ```powershell
     cd C:\ngrok
     .\ngrok.exe config add-authtoken YOUR_TOKEN
     ```

4. **Start tunnel**
   ```powershell
   .\ngrok.exe http 3000
   ```

#### macOS Detailed

1. **Install with Homebrew**
   ```bash
   # Install Homebrew if needed
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   
   # Install ngrok
   brew install ngrok
   ```

2. **Alternative: Manual install**
   ```bash
   curl -o ngrok.zip https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-darwin-amd64.zip
   unzip ngrok.zip
   sudo mv ngrok /usr/local/bin/
   ```

3. **Configure auth token**
   ```bash
   ngrok config add-authtoken YOUR_TOKEN
   ```

4. **Start tunnel**
   ```bash
   ngrok http 3000
   ```

#### Linux Detailed

1. **Install via apt (Ubuntu/Debian)**
   ```bash
   curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
     sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
   
   echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
     sudo tee /etc/apt/sources.list.d/ngrok.list
   
   sudo apt update
   sudo apt install ngrok
   ```

2. **Alternative: Manual install**
   ```bash
   wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
   tar xvzf ngrok-v3-stable-linux-amd64.tgz
   sudo mv ngrok /usr/local/bin/
   ```

3. **Configure auth token**
   ```bash
   ngrok config add-authtoken YOUR_TOKEN
   ```

4. **Start tunnel**
   ```bash
   ngrok http 3000
   ```

## Configuration

### Basic Configuration

ngrok config file location:
- **Windows**: `%USERPROFILE%\.ngrok2\ngrok.yml`
- **macOS/Linux**: `~/.ngrok2/ngrok.yml`

Basic config:
```yaml
version: "2"
authtoken: YOUR_AUTH_TOKEN
region: us
console_ui: true
log_level: info
log_format: json
```

### Custom Domain (Pro/Business)

```yaml
tunnels:
  mcp:
    proto: http
    addr: 3000
    domain: pentest.yourdomain.com
```

Start with:
```bash
ngrok start mcp
```

### Multiple Tunnels

```yaml
tunnels:
  mcp-api:
    proto: http
    addr: 3000
  
  n8n:
    proto: http
    addr: 5678
```

Start all:
```bash
ngrok start --all
```

### IP Whitelisting (Pro/Business)

```yaml
tunnels:
  mcp:
    proto: http
    addr: 3000
    ip_restriction:
      allow_cidrs:
        - 1.2.3.4/32
        - 5.6.7.0/24
```

### OAuth Protection (Pro/Business)

```yaml
tunnels:
  mcp:
    proto: http
    addr: 3000
    oauth:
      provider: google
      allow_domains:
        - yourdomain.com
      allow_emails:
        - admin@yourdomain.com
```

## n8n Integration

### Update Workflow URL

1. Open your n8n workflow
2. Find the **"Execute Command"** HTTP Request node
3. Update the URL to your ngrok URL:
   ```
   https://your-subdomain.ngrok-free.app/api/tools/kali_execute
   ```

### Add ngrok Headers

In the HTTP Request node, add header:
```json
{
  "ngrok-skip-browser-warning": "true"
}
```

This prevents ngrok's browser warning page.

### Test Integration

1. Activate the workflow
2. Send a test message: "whoami"
3. Should receive response from Kali container

### Persistent URL (Paid Plan)

With ngrok Pro, you can have the same URL every time:

1. Reserve domain in ngrok dashboard
2. Update config:
   ```yaml
   tunnels:
     mcp:
       proto: http
       addr: 3000
       domain: your-reserved-subdomain.ngrok-free.app
   ```
3. URL never changes - no need to update workflow!

## Advanced Features

### Web Interface

ngrok provides a web interface at `http://localhost:4040`

Features:
- **Request Inspector**: See all HTTP requests
- **Replay Requests**: Resend previous requests
- **Status**: Tunnel status and metrics

### Logging

Enable detailed logging:
```bash
# To file
ngrok http 3000 --log=stdout > ngrok.log

# With specific log level
ngrok http 3000 --log-level=debug
```

### Background Mode

**Windows:**
```powershell
Start-Process -NoNewWindow -FilePath "ngrok.exe" -ArgumentList "http", "3000"
```

**macOS/Linux:**
```bash
nohup ngrok http 3000 &
```

### Auto-restart on Failure

**Using systemd (Linux):**

1. Create service file:
   ```bash
   sudo nano /etc/systemd/system/ngrok.service
   ```

2. Add content:
   ```ini
   [Unit]
   Description=ngrok tunnel
   After=network.target
   
   [Service]
   Type=simple
   User=youruser
   ExecStart=/usr/local/bin/ngrok http 3000
   Restart=always
   RestartSec=10
   
   [Install]
   WantedBy=multi-user.target
   ```

3. Enable and start:
   ```bash
   sudo systemctl enable ngrok
   sudo systemctl start ngrok
   ```

### API Access

Get tunnel URL programmatically:

```bash
# Get tunnels info
curl http://localhost:4040/api/tunnels

# Parse public URL
curl -s http://localhost:4040/api/tunnels | \
  jq -r '.tunnels[0].public_url'
```

**Python example:**
```python
import requests

def get_ngrok_url():
    response = requests.get('http://localhost:4040/api/tunnels')
    tunnels = response.json()['tunnels']
    for tunnel in tunnels:
        if tunnel['proto'] == 'https':
            return tunnel['public_url']
    return None

url = get_ngrok_url()
print(f"MCP Server URL: {url}")
```

## Troubleshooting

### "Invalid authtoken"

**Problem**: Auth token not configured or incorrect

**Solution**:
```bash
# Reconfigure token
ngrok config add-authtoken YOUR_NEW_TOKEN

# Verify config
cat ~/.ngrok2/ngrok.yml  # macOS/Linux
type %USERPROFILE%\.ngrok2\ngrok.yml  # Windows
```

### "Account limit exceeded"

**Problem**: Free plan allows only 1 tunnel at a time

**Solutions**:
1. Stop other ngrok tunnels
2. Upgrade to paid plan
3. Use ngrok API to check active tunnels:
   ```bash
   ngrok api tunnels list
   ```

### "Failed to bind to port"

**Problem**: Port 3000 already in use or MCP server not running

**Solution**:
```bash
# Check if port is in use
netstat -ano | findstr :3000  # Windows
lsof -i :3000  # macOS/Linux

# Verify MCP server is running
docker ps | grep mcp-pentest-forge

# Check if HTTP mode enabled
curl http://localhost:3000/
```

### "Tunnel not found" or "Tunnel closed"

**Problem**: Session timeout or network issue

**Solution**:
1. Simply restart ngrok
2. For persistent tunnel, upgrade to paid plan
3. Check network connectivity

### ngrok Browser Warning

**Problem**: Browser shows warning page before accessing site

**Solution**:
Add header to all requests:
```http
ngrok-skip-browser-warning: true
```

Or visit the URL in browser once and click "Visit Site"

### Slow Performance

**Problem**: Requests are slow through ngrok

**Solutions**:
1. **Change region** to closest to you:
   ```bash
   ngrok http 3000 --region=eu  # Europe
   ngrok http 3000 --region=ap  # Asia Pacific
   ngrok http 3000 --region=au  # Australia
   ngrok http 3000 --region=sa  # South America
   ```

2. **Use paid plan** for better performance
3. **Check local network** - might be local issue

## Security

### ⚠️ Security Warning

ngrok exposes your local server to the entire internet. Take precautions:

### 1. Use Strong Authentication

Add basic auth in server.js:
```javascript
app.use('/api', (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${process.env.API_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

### 2. IP Whitelisting (Pro Plan)

```yaml
ip_restriction:
  allow_cidrs:
    - YOUR_IP/32
```

### 3. OAuth (Pro Plan)

```yaml
oauth:
  provider: google
  allow_emails:
    - your@email.com
```

### 4. Monitor Access

Check ngrok web interface at `http://localhost:4040` for:
- All incoming requests
- Source IPs
- Request details

### 5. Rate Limiting

Add rate limiting in nginx or in your application

### 6. Time-Limited Access

Only run ngrok when needed:
```bash
# Start tunnel
ngrok http 3000

# When done, press Ctrl+C to stop
```

### 7. Use Temporary URLs

Free plan gives random URLs each time - harder to find

Paid reserved URLs are convenient but more discoverable

## Cost Comparison

### Free Plan
- ✅ Random URLs
- ✅ 40 connections/minute
- ✅ Basic features
- ❌ Custom domains
- ❌ Reserved URLs
- ❌ IP whitelisting

### Personal Plan ($8/mo)
- ✅ Custom domains
- ✅ Reserved URLs
- ✅ 120 connections/minute
- ✅ 3 simultaneous tunnels
- ❌ IP whitelisting

### Pro Plan ($20/mo)
- ✅ Everything in Personal
- ✅ IP whitelisting
- ✅ OAuth
- ✅ 10 tunnels
- ✅ Priority support

## Next Steps

- **n8n Integration**: [n8n Integration Guide](N8N_INTEGRATION.md)
- **Remote Access Options**: [Remote Access Guide](REMOTE_ACCESS.md)
- **API Usage**: [API Reference](API_REFERENCE.md)

---

**Share your pentests with the world! 🌍**

