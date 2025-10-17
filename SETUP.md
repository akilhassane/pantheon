# 🚀 Complete Setup Guide - MCP Pentest Forge

This comprehensive guide will walk you through setting up MCP Pentest Forge on your system. Follow the steps for your preferred integration method.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Docker)](#quick-start-docker)
3. [Claude Desktop Integration](#claude-desktop-integration)
4. [Cursor IDE Integration](#cursor-ide-integration)
5. [n8n Integration](#n8n-integration)
6. [Troubleshooting](#troubleshooting)
7. [Verification](#verification)

---

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

✅ **Docker Desktop** (Latest version)
- **Windows**: Download from [docker.com](https://www.docker.com/products/docker-desktop/)
  - Enable WSL2 backend during installation
  - Allocate at least 4GB RAM to Docker
- **macOS**: Download from [docker.com](https://www.docker.com/products/docker-desktop/)
- **Linux**: Install Docker and Docker Compose via package manager

✅ **Git** (for cloning the repository)
- Download from [git-scm.com](https://git-scm.com/downloads)

✅ **Terminal/Command Line Access**
- Windows: PowerShell or Command Prompt
- macOS/Linux: Terminal

### Optional Software (for specific integrations)

📦 **Claude Desktop** (for Claude integration)
- Download from [claude.ai](https://claude.ai/download)

📦 **Cursor IDE** (for Cursor integration)
- Download from [cursor.sh](https://cursor.sh/)

📦 **n8n** (for workflow automation)
- See [n8n Integration Guide](docs/N8N_INTEGRATION.md)

---

## Quick Start (Docker)

This is the fastest way to get MCP Pentest Forge up and running.

### Step 1: Clone the Repository

Open your terminal and run:

```bash
# Clone the repository
git clone https://github.com/akilhassane/mcp-pentest-forge.git

# Navigate to the directory
cd mcp-pentest-forge
```

### Step 2: Start the Containers

```bash
# Build and start both containers (MCP server + Kali Linux)
docker-compose up -d

# Wait 10-20 seconds for containers to fully start
```

### Step 3: Verify Containers are Running

```bash
# Check container status
docker ps

# You should see two containers:
# - mcp-pentest-forge
# - kali-pentest
```

Expected output:
```
CONTAINER ID   IMAGE                    STATUS         PORTS
abc123def456   mcp-pentest-forge        Up 2 minutes   8811/tcp
xyz789ghi012   kali-pentest             Up 2 minutes
```

### Step 4: Test the Installation

```bash
# Test Kali Linux container
docker exec -it kali-pentest whoami
# Expected output: pentester

# Test MCP server
docker logs mcp-pentest-forge
# You should see: "MCP Pentest Forge - HTTP Server Started"
```

✅ **Success!** Your Docker containers are now running. Proceed to integration setup below.

---

## Claude Desktop Integration

Integrate MCP Pentest Forge with Claude Desktop for AI-powered pentesting.

### Step 1: Locate Your Claude Desktop Config File

The configuration file location depends on your operating system:

- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
  - Full path: `C:\Users\YourUsername\AppData\Roaming\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### Step 2: Open the Config File

**Windows:**
```powershell
# Open in Notepad
notepad %APPDATA%\Claude\claude_desktop_config.json
```

**macOS/Linux:**
```bash
# Open in your default editor
nano ~/Library/Application\ Support/Claude/claude_desktop_config.json
# or
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

### Step 3: Add MCP Pentest Forge Configuration

If the file is **empty or doesn't exist**, paste this entire configuration:

```json
{
  "mcpServers": {
    "pentest-forge": {
      "command": "docker",
      "args": [
        "exec",
        "-i",
        "mcp-pentest-forge",
        "node",
        "/app/server.js"
      ]
    }
  }
}
```

If the file **already has content**, add the `pentest-forge` section inside the existing `mcpServers` object:

```json
{
  "mcpServers": {
    "existing-server": {
      ...existing configuration...
    },
    "pentest-forge": {
      "command": "docker",
      "args": [
        "exec",
        "-i",
        "mcp-pentest-forge",
        "node",
        "/app/server.js"
      ]
    }
  }
}
```

### Step 4: Restart Claude Desktop

1. **Completely quit Claude Desktop** (not just close the window)
   - Windows: Right-click the system tray icon → Exit
   - macOS: Cmd+Q
   - Linux: Close all windows and quit the app

2. **Relaunch Claude Desktop**

3. **Verify the integration**:
   - Start a new conversation
   - Look for the 🔌 hammer icon in the bottom right
   - Click it to see available MCP servers
   - You should see "pentest-forge" listed

### Step 5: Test the Integration

In Claude Desktop, try these commands:

```
Can you execute "whoami" in Kali Linux?
```

```
What tools are available in the Kali environment?
```

```
Scan my local network for devices
```

✅ **Success!** Claude Desktop is now connected to your Kali Linux environment!

---

## Cursor IDE Integration

Integrate MCP Pentest Forge with Cursor IDE for in-editor pentesting capabilities.

### Step 1: Open Cursor Settings

1. Open Cursor IDE
2. Go to **Settings** (File → Preferences → Settings)
3. Search for "MCP" or navigate to **Extensions → MCP Configuration**

### Step 2: Add MCP Server Configuration

1. Click on "Edit MCP Servers Configuration" or locate the config file:
   - **Windows**: `%APPDATA%\Cursor\User\mcp_config.json`
   - **macOS**: `~/Library/Application Support/Cursor/User/mcp_config.json`
   - **Linux**: `~/.config/Cursor/User/mcp_config.json`

2. Add the MCP Pentest Forge configuration:

```json
{
  "mcpServers": {
    "pentest-forge": {
      "command": "docker",
      "args": [
        "exec",
        "-i",
        "mcp-pentest-forge",
        "node",
        "/app/server.js"
      ]
    }
  }
}
```

### Step 3: Restart Cursor IDE

1. Completely quit Cursor IDE
2. Relaunch Cursor IDE
3. Open a new file or project

### Step 4: Verify the Integration

1. Open the command palette (Ctrl+Shift+P or Cmd+Shift+P)
2. Type "MCP" to see MCP-related commands
3. You should see "pentest-forge" as an available server

### Step 5: Test the Integration

In Cursor, use the AI assistant to test:

```
@pentest-forge Run "hostname -I" to show my IP address
```

✅ **Success!** Cursor IDE is now integrated with MCP Pentest Forge!

---

## n8n Integration

For advanced workflow automation with n8n, see the complete guide:

📘 **[n8n Integration Guide](docs/N8N_INTEGRATION.md)**

Quick overview:

1. **Enable HTTP Mode**: Set `HTTP_PORT=8811` in environment
2. **Access HTTP API**: Server runs on `http://localhost:8811`
3. **Configure n8n**: Use the MCP Client node with SSE endpoint
4. **Create Workflows**: Build automated security testing workflows

Example HTTP API call:

```bash
# Test the API
curl http://localhost:8811/

# Execute a command
curl -X POST http://localhost:8811/api/tools/kali_execute \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"command": "whoami"}}'
```

For remote access and ngrok setup:
- 📘 [Remote Access Guide](docs/REMOTE_ACCESS.md)
- 📘 [ngrok Quick Start](NGROK_QUICK_START.md)

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: "Container not found" error

**Solution:**
```bash
# Ensure containers are running
docker-compose up -d

# Verify container names
docker ps

# If containers have different names, update your config
```

#### Issue: Claude Desktop doesn't show the MCP server

**Solutions:**
1. **Verify JSON syntax** in config file (use [jsonlint.com](https://jsonlint.com/))
2. **Check file location** - ensure you're editing the correct config file
3. **Restart Claude Desktop** completely (quit, not just close)
4. **Check Docker** - ensure containers are running: `docker ps`

#### Issue: "Permission denied" errors

**Windows Solution:**
```powershell
# Run Docker Desktop as Administrator
# Right-click Docker Desktop icon → Run as Administrator
```

**Linux Solution:**
```bash
# Add your user to the docker group
sudo usermod -aG docker $USER

# Logout and login again for changes to take effect
```

#### Issue: Container fails to start

**Solution:**
```bash
# Check logs for errors
docker logs mcp-pentest-forge
docker logs kali-pentest

# Common fixes:
# 1. Restart Docker Desktop
# 2. Remove old containers and rebuild
docker-compose down
docker-compose up -d --build
```

#### Issue: Cannot access network from Kali container

**Solution:**
- Verify host networking mode in `docker-compose.yml`
- On Windows, ensure WSL2 backend is enabled in Docker Desktop
- Check firewall settings

#### Issue: MCP server shows "SSH connection failed"

**Solution:**
```bash
# Verify Kali container SSH service
docker exec -it kali-pentest systemctl status ssh

# Restart SSH if needed
docker exec -it kali-pentest systemctl restart ssh

# Verify SSH credentials (default: pentester/pentester)
```

---

## Verification

### Complete System Check

Run this verification script to ensure everything is working:

**Windows (PowerShell):**
```powershell
Write-Host "=== MCP Pentest Forge System Check ===" -ForegroundColor Cyan

Write-Host "`n1. Checking Docker..." -ForegroundColor Yellow
docker --version

Write-Host "`n2. Checking containers..." -ForegroundColor Yellow
docker ps | Select-String "mcp-pentest-forge|kali-pentest"

Write-Host "`n3. Testing Kali Linux..." -ForegroundColor Yellow
docker exec -it kali-pentest whoami
docker exec -it kali-pentest nmap --version

Write-Host "`n4. Testing MCP Server..." -ForegroundColor Yellow
docker logs --tail 5 mcp-pentest-forge

Write-Host "`n5. Testing HTTP API..." -ForegroundColor Yellow
curl http://localhost:8811/health

Write-Host "`n=== Verification Complete ===" -ForegroundColor Green
```

**macOS/Linux (Bash):**
```bash
#!/bin/bash
echo "=== MCP Pentest Forge System Check ==="

echo -e "\n1. Checking Docker..."
docker --version

echo -e "\n2. Checking containers..."
docker ps | grep -E "mcp-pentest-forge|kali-pentest"

echo -e "\n3. Testing Kali Linux..."
docker exec -it kali-pentest whoami
docker exec -it kali-pentest nmap --version

echo -e "\n4. Testing MCP Server..."
docker logs --tail 5 mcp-pentest-forge

echo -e "\n5. Testing HTTP API..."
curl http://localhost:8811/health

echo -e "\n=== Verification Complete ==="
```

### Expected Results

✅ All checks should pass:
- Docker version displayed
- Both containers listed as "Up"
- Kali commands execute successfully
- MCP server logs show "Server Started"
- HTTP API returns health status

---

## Next Steps

Once setup is complete, you can:

1. **Explore the tool capabilities**:
   ```
   "Show me what pentesting tools are available"
   "Discover all devices on my network"
   "Scan 192.168.1.1 for open ports"
   ```

2. **Read the documentation**:
   - 📘 [API Reference](docs/API_REFERENCE.md)
   - 📘 [YouTube Tutorials](docs/YOUTUBE_RESOURCES.md)
   - 📘 [n8n Integration](docs/N8N_INTEGRATION.md)

3. **Join the community**:
   - ⭐ Star the repo on [GitHub](https://github.com/akilhassane/mcp-pentest-forge)
   - 🐛 Report issues
   - 🤝 Contribute improvements

---

## Security Notice

⚠️ **IMPORTANT**: This tool provides **unrestricted access** to a Kali Linux environment with 200+ pentesting tools.

**Usage Requirements:**
- ✅ Obtain written authorization before testing any systems
- ✅ Only use on systems you own or have permission to test
- ✅ Follow responsible disclosure practices
- ✅ Comply with all applicable laws and regulations

**Never use this tool for:**
- ❌ Unauthorized access to systems or networks
- ❌ Malicious activities or attacks
- ❌ Violating terms of service or laws

---

## Support

Need help? Here's how to get support:

1. **Check the documentation** in the `docs/` folder
2. **Review troubleshooting** section above
3. **Search existing issues** on [GitHub](https://github.com/akilhassane/mcp-pentest-forge/issues)
4. **Open a new issue** if your problem isn't covered

---

**Happy (ethical) hacking! 🔒⚡**

Built with ❤️ by [akilhassane](https://github.com/akilhassane)

