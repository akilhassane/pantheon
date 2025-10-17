# Complete Setup Guide 🚀

This guide will walk you through setting up **MCP-Pentest-Forge** from scratch on any platform.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration Options](#configuration-options)
  - [Claude Desktop Setup](#claude-desktop-setup)
  - [Cursor IDE Setup](#cursor-ide-setup)
  - [n8n Integration](#n8n-integration)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

1. **Docker Desktop**
   - Windows: [Download Docker Desktop](https://www.docker.com/products/docker-desktop/)
     - Enable WSL2 backend in settings
   - macOS: [Download Docker Desktop](https://www.docker.com/products/docker-desktop/)
   - Linux: Install Docker Engine and Docker Compose
     ```bash
     # Ubuntu/Debian
     sudo apt-get update
     sudo apt-get install docker.io docker-compose
     
     # Add your user to docker group
     sudo usermod -aG docker $USER
     newgrp docker
     ```

2. **Git**
   - Windows: [Download Git for Windows](https://git-scm.com/download/win)
   - macOS: `brew install git` or [Download](https://git-scm.com/download/mac)
   - Linux: `sudo apt-get install git` (Ubuntu/Debian)

3. **Node.js** (Optional - only if running server directly)
   - Download from [nodejs.org](https://nodejs.org/) (LTS version recommended)
   - Not required if using Docker (recommended method)

### System Requirements

- **RAM**: 4GB minimum, 8GB recommended
- **Disk Space**: 5GB minimum for Docker images
- **Network**: Internet connection for initial setup

## Installation

### Step 1: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/akilhassane/mcp-pentest-forge.git

# Navigate to the directory
cd mcp-pentest-forge
```

### Step 2: Build and Start Containers

```bash
# Build and start both containers (MCP server + Kali Linux)
docker-compose up -d

# This will:
# - Pull/build the Kali Linux image (~2GB)
# - Build the MCP server image
# - Start both containers in the background
```

### Step 3: Verify Installation

```bash
# Check containers are running
docker ps

# You should see two containers:
# - mcp-pentest-forge (MCP server)
# - kali-pentest (Kali Linux environment)

# View logs
docker-compose logs -f

# Test Kali Linux access
docker exec -it kali-pentest bash
```

## Configuration Options

You have three main ways to use MCP-Pentest-Forge:

### Claude Desktop Setup

Claude Desktop provides the most integrated AI pentesting experience.

#### Step 1: Locate Configuration File

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Linux**: `~/.config/Claude/claude_desktop_config.json`

#### Step 2: Add MCP Server Configuration

Open the config file and add:

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

If you already have other MCP servers configured, just add `"pentest-forge"` to your existing `mcpServers` object.

#### Step 3: Restart Claude Desktop

1. Completely quit Claude Desktop
2. Start Claude Desktop again
3. Look for the 🔨 (hammer) icon in the chat interface
4. You should see "pentest-forge" listed with the `kali_execute` tool

#### Step 4: Test It

In Claude Desktop, try:
```
"Show me my current username and hostname"
"Discover all devices on my network"
"What tools are available in this Kali environment?"
```

### Cursor IDE Setup

Cursor IDE integration allows you to use pentesting tools while coding.

#### Step 1: Open Cursor Settings

- Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
- Type "MCP" and select "Open MCP Settings"

Or manually edit: `.cursor/mcp_config.json` in your workspace

#### Step 2: Add Configuration

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

#### Step 3: Reload Cursor

- Press `Ctrl+Shift+P` / `Cmd+Shift+P`
- Type "Reload Window" and press Enter

#### Step 4: Test It

In Cursor's AI chat, try:
```
"Use pentest-forge to scan localhost"
"Check what pentesting tools are available"
```

### n8n Integration

For automation workflows and remote access, use n8n integration.

**See detailed guide:** [n8n Integration Guide](docs/N8N_INTEGRATION.md)

**Quick overview:**

1. Enable HTTP mode by creating `.env`:
   ```bash
   HTTP_PORT=3000
   ```

2. Restart containers:
   ```bash
   docker-compose restart
   ```

3. Import the workflow from `workflows/workflow-iterative.json`

4. Configure OpenAI credentials

5. Test the workflow

## Verification

### Test Basic Functionality

```bash
# 1. Check containers are running
docker ps

# 2. Access Kali shell directly
docker exec -it kali-pentest bash

# 3. Inside Kali, test a tool
whoami
hostname -I
nmap --version
```

### Test MCP Server

```bash
# Test HTTP endpoint (if enabled)
curl http://localhost:3000/

# Test tool execution
curl -X POST http://localhost:3000/api/tools/kali_execute \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"command": "whoami"}}'
```

### Test with MCP Client

In Claude Desktop or Cursor:
```
"Execute: whoami"
"What's my IP address?"
"List available pentesting tools"
```

## Troubleshooting

### Containers Won't Start

**Issue**: Docker containers fail to start

**Solutions**:
```bash
# Check Docker is running
docker --version

# View detailed logs
docker-compose logs

# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check for port conflicts
netstat -ano | findstr :3000  # Windows
lsof -i :3000  # macOS/Linux
```

### Claude Desktop Can't Find Server

**Issue**: Claude Desktop doesn't show the pentest-forge tool

**Solutions**:
1. Verify containers are running: `docker ps`
2. Check config file path is correct
3. Ensure JSON syntax is valid (use [jsonlint.com](https://jsonlint.com))
4. Completely quit and restart Claude Desktop (not just close window)
5. Check Claude Desktop logs:
   - Windows: `%APPDATA%\Claude\logs`
   - macOS: `~/Library/Logs/Claude`
   - Linux: `~/.config/Claude/logs`

### Network Scanning Issues

**Issue**: Can't scan local network devices

**Solutions**:
1. Ensure host network mode is enabled in `docker-compose.yml`
2. On Windows, verify WSL2 backend is enabled in Docker Desktop
3. Check firewall isn't blocking scans
4. For Windows: You may need to scan from WSL2 network perspective

### Permission Denied Errors

**Issue**: Docker permission errors on Linux

**Solutions**:
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Refresh group membership
newgrp docker

# Or run with sudo (not recommended)
sudo docker-compose up -d
```

### Out of Memory Errors

**Issue**: Containers crash or fail to start

**Solutions**:
1. Increase Docker memory limit:
   - Docker Desktop → Settings → Resources → Memory
   - Increase to at least 4GB, preferably 8GB
2. Close other applications
3. Restart Docker Desktop

### Connection Refused (n8n)

**Issue**: n8n can't connect to MCP server

**Solutions**:
1. Ensure HTTP mode is enabled (`.env` with `HTTP_PORT=3000`)
2. Restart containers after changing .env
3. Check firewall settings
4. For remote access, set up ngrok (see [ngrok Setup Guide](docs/NGROK_SETUP.md))

### WSL2 Issues (Windows)

**Issue**: Docker networking problems on Windows

**Solutions**:
1. Enable WSL2 backend in Docker Desktop settings
2. Update WSL2: `wsl --update`
3. Restart Docker Desktop
4. For network scanning, consider using Docker Desktop with WSL2 Ubuntu

## Advanced Configuration

### Environment Variables

Create a `.env` file for custom configuration:

```env
# HTTP Server Port (for n8n integration)
HTTP_PORT=3000

# Kali Container Name
KALI_CONTAINER_NAME=kali-pentest

# Custom network settings
# (Advanced users only)
```

### Custom Tool Catalogs

Edit catalog files in `catalogs/` directory to customize available tools.

### Resource Limits

Edit `docker-compose.yml` to adjust resource limits:

```yaml
services:
  kali-pentest:
    mem_limit: 4g
    cpus: 2
```

## Next Steps

- **For n8n workflows**: [n8n Integration Guide](docs/N8N_INTEGRATION.md)
- **For remote access**: [Remote Access Guide](docs/REMOTE_ACCESS.md)
- **For internet exposure**: [ngrok Setup Guide](docs/NGROK_SETUP.md)
- **API documentation**: [API Reference](docs/API_REFERENCE.md)
- **Video tutorials**: [YouTube Resources](docs/YOUTUBE_RESOURCES.md)

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/akilhassane/mcp-pentest-forge/issues)
- **Discussions**: [GitHub Discussions](https://github.com/akilhassane/mcp-pentest-forge/discussions)
- **Security Issues**: Email privately (see README for contact)

---

**Ready to start pentesting? Try your first command!** 🎯

