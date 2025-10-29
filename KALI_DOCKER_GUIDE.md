# Kali Linux Docker Container Guide

## Overview

This guide explains how to build, deploy, and use the Kali Linux Docker container from the `akilhassane/mcp-pentest-forge` repository on Docker Hub.

## Quick Start

### Prerequisites
- Docker installed (version 20.10+)
- Docker Hub account (for pushing images)

### Pull and Run Pre-built Image

```bash
# Pull the image from Docker Hub
docker pull akilhassane/mcp-pentest-forge:kali-latest

# Run the container
docker run -it \
  -p 7681:7681 \
  -p 2222:2222 \
  akilhassane/mcp-pentest-forge:kali-latest
```

## Access Methods

### 1. Web Terminal (ttyd)
- **URL**: `http://localhost:7681`
- **Port**: 7681
- **Features**: Full terminal access via web browser
- **No authentication required**

### 2. SSH Access
```bash
# Using SSH
ssh -p 2222 pentester@localhost

# Credentials
Username: pentester
Password: pentester
```

## Building Locally

### Using the Build Script (PowerShell - Windows)

```powershell
# Run the build script
.\build_and_push.ps1 -Version "1.0"

# Or use default (latest)
.\build_and_push.ps1
```

### Using the Build Script (Bash - Linux/macOS)

```bash
# Run the build script
./build_and_push.sh 1.0

# Or use default (latest)
./build_and_push.sh
```

### Manual Build Command

```bash
# Build the image
docker build -f Dockerfile.kali -t akilhassane/mcp-pentest-forge:kali-latest .

# Tag for Docker Hub
docker tag akilhassane/mcp-pentest-forge:kali-latest akilhassane/mcp-pentest-forge:kali-1.0
```

## Pushing to Docker Hub

### Authenticate
```bash
docker login
# Enter your Docker Hub credentials
```

### Push Image
```bash
# Push latest tag
docker push akilhassane/mcp-pentest-forge:kali-latest

# Push versioned tag
docker push akilhassane/mcp-pentest-forge:kali-1.0
```

## Container Features

### Pre-installed Tools
- **Pentesting Frameworks**: Metasploit Framework, Burp Suite
- **Network Tools**: nmap, masscan, nikto, gobuster, dirb
- **Exploitation**: sqlmap, hydra, john, hashcat, wireshark
- **Enumeration**: enum4linux, smbclient, netexec
- **Web Terminal**: ttyd for browser-based terminal access
- **SSH Server**: Remote command execution capability
- **Python 3**: With impacket, requests, beautifulsoup4
- **Development**: Build tools, Git, Node.js, npm

### Ports Exposed
| Port | Service | Purpose |
|------|---------|---------|
| 22 | SSH | SSH Server (default) |
| 2222 | SSH | Alternate SSH port |
| 7681 | ttyd | Web-based Terminal |

## Docker Compose Usage

### Full Stack Deployment

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Services Included
1. **mcp-pentest-forge** - Main server (port 8811, 3001)
2. **kali-pentest** - Kali Linux environment (port 7681, 2222)

## Advanced Usage

### Running with Custom Volumes

```bash
# Mount local workspace
docker run -it \
  -p 7681:7681 \
  -p 2222:2222 \
  -v $(pwd)/workspace:/workspace \
  -v $(pwd)/tools:/tools \
  akilhassane/mcp-pentest-forge:kali-latest
```

### Running with Docker Socket (for container access)

```bash
# Enable Docker-in-Docker capabilities
docker run -it \
  -p 7681:7681 \
  -p 2222:2222 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  akilhassane/mcp-pentest-forge:kali-latest
```

### Network Capabilities

```bash
# Run with network access for tools like nmap
docker run -it \
  --cap-add=NET_RAW \
  --cap-add=NET_ADMIN \
  -p 7681:7681 \
  -p 2222:2222 \
  akilhassane/mcp-pentest-forge:kali-latest
```

## Troubleshooting

### Build Issues

**Issue**: CMake errors for ttyd dependencies
```
Solution: Ensure zlib1g-dev and libcjson-dev are installed during build
```

**Issue**: Image too large
```
Solution: Use docker image prune to remove dangling images
docker image prune -a
```

### Runtime Issues

**Issue**: Can't connect to SSH
```bash
# Check if container is running
docker ps

# Check SSH service logs
docker exec <container-id> service ssh status

# Restart container
docker restart <container-id>
```

**Issue**: Web terminal (ttyd) not accessible
```bash
# Check if port is in use
netstat -an | findstr 7681  # Windows
lsof -i :7681               # Linux/macOS

# Map to different port
docker run -p 7682:7681 akilhassane/mcp-pentest-forge:kali-latest
```

## Security Considerations

⚠️ **Warning**: This container includes penetration testing tools and should only be used in authorized environments.

- **Default Credentials**: pentester/pentester - Change after deployment
- **Network Exposure**: Be cautious when exposing ports externally
- **Data Persistence**: Use volumes to persist tools and results
- **Resource Limits**: Consider setting memory and CPU limits for production use

```bash
# Run with resource limits
docker run -it \
  --memory="4g" \
  --cpus="2" \
  -p 7681:7681 \
  -p 2222:2222 \
  akilhassane/mcp-pentest-forge:kali-latest
```

## Docker Hub Repository

🔗 **Repository**: https://hub.docker.com/r/akilhassane/mcp-pentest-forge

### Available Tags
- `kali-latest` - Latest Kali Linux pentesting environment
- `kali-1.0`, `kali-1.1`, etc. - Versioned releases

## Health Checks

The container includes a health check that monitors the ttyd service:

```bash
# Check container health
docker ps --format "table {{.Names}}\t{{.Status}}"

# Should show: "healthy" in status
```

## Support & Documentation

- **GitHub**: https://github.com/akilhassane/mcp-pentest-forge
- **Docker Hub**: https://hub.docker.com/r/akilhassane/mcp-pentest-forge
- **Issues**: Report issues on GitHub

## Next Steps

1. ✅ Build the image locally
2. ✅ Test web terminal access (http://localhost:7681)
3. ✅ Test SSH access (ssh -p 2222 pentester@localhost)
4. ✅ Push to Docker Hub
5. ✅ Document your deployment

---

**Last Updated**: October 2025
**Version**: 1.0
**Maintainer**: akilhassane



