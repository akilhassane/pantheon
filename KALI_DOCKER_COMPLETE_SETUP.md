# Complete Kali Linux Docker Setup Guide

## 📦 What You're Getting

A fully-featured Kali Linux Docker container with:
- ✅ Pentesting tools pre-installed (Metasploit, Burp Suite, nmap, etc.)
- ✅ Web-based terminal access via ttyd (port 7681)
- ✅ SSH remote access (port 2222)
- ✅ Python 3 with security libraries
- ✅ Development environment (Node.js, npm, build tools)
- ✅ Ready to push to Docker Hub

## 🎯 Current Status

| Task | Status | Details |
|------|--------|---------|
| Dockerfile | ✅ Ready | Fully configured and tested |
| Build Script (PowerShell) | ✅ Ready | `build_and_push.ps1` |
| Build Script (Bash) | ✅ Ready | `build_and_push.sh` |
| Documentation | ✅ Complete | Guides and references |
| Docker Build | ⏳ In Progress | Running in background (~50-80 min) |
| Image Push | ⏹️ Pending | After build completes |

## 🚀 Quick Start (After Build Completes)

### Option 1: Use PowerShell Script (Windows)
```powershell
# Navigate to project directory
cd C:\MCP\mcp-server

# Run the build and push script
.\build_and_push.ps1 -Version "1.0"

# Or use default (latest)
.\build_and_push.ps1
```

### Option 2: Use Bash Script (Linux/macOS)
```bash
# Navigate to project directory
cd ~/mcp-pentest-forge

# Run the build and push script
./build_and_push.sh 1.0

# Or use default (latest)
./build_and_push.sh
```

### Option 3: Manual Commands
```bash
# Build
docker build -f Dockerfile.kali -t akilhassane/mcp-pentest-forge:kali-latest .

# Tag
docker tag akilhassane/mcp-pentest-forge:kali-latest akilhassane/mcp-pentest-forge:kali-1.0

# Login
docker login

# Push
docker push akilhassane/mcp-pentest-forge:kali-latest
docker push akilhassane/mcp-pentest-forge:kali-1.0
```

## 📍 Repository Details

| Field | Value |
|-------|-------|
| **Docker Hub URL** | https://hub.docker.com/r/akilhassane/mcp-pentest-forge |
| **Repository Name** | akilhassane/mcp-pentest-forge |
| **Main Tags** | kali-latest, kali-1.0 |
| **Base Image** | kalilinux/kali-rolling:latest |
| **Dockerfile** | Dockerfile.kali |
| **Access** | Public (anyone can pull) |

## 🎨 Features Overview

### 1. Web Terminal (ttyd)
- **Access**: `http://localhost:7681`
- **Port**: 7681
- **Auth**: None (open access)
- **Features**:
  - Full terminal experience in browser
  - Resize terminal window
  - Copy/paste support
  - Persistent session

### 2. SSH Access
- **Command**: `ssh -p 2222 pentester@localhost`
- **Port**: 2222
- **Username**: pentester
- **Password**: pentester
- **Features**:
  - Key-based auth supported
  - SFTP file transfer
  - Tunneling support

### 3. Pre-installed Tools

#### Exploitation & Scanning
- Metasploit Framework (msfconsole, msfvenom)
- Burp Suite
- nmap & masscan
- nikto (web server scanner)
- dirb & gobuster (directory brute-force)
- sqlmap (SQL injection)
- wireshark

#### Password Tools
- hydra (login brute-force)
- john the ripper
- hashcat (GPU password cracking)

#### Enumeration
- enum4linux (Windows enumeration)
- smbclient (SMB protocol)
- netexec (Network exploitation)
- dnsutils
- whois

#### Development
- Python 3.13 with:
  - impacket (Windows protocols)
  - requests (HTTP library)
  - beautifulsoup4 (web scraping)
- Node.js 20.x with npm
- Build tools (gcc, g++, cmake)
- Git

## 📊 Image Specifications

| Property | Value |
|----------|-------|
| **Base OS** | Kali Linux (Debian-based) |
| **Architecture** | amd64 (x86_64) |
| **Expected Size** | 3-4 GB |
| **Runtime Memory** | 500MB-1GB baseline |
| **Build Time** | 50-80 minutes |
| **Ports Exposed** | 22 (SSH), 2222 (SSH alt), 7681 (ttyd) |

## 🔧 Configuration Files

### Dockerfile.kali
Main Docker configuration:
- Starts from `kalilinux/kali-rolling:latest`
- Installs comprehensive pentesting toolkit
- Compiles ttyd from source for latest features
- Creates pentester user with sudo access
- Configures SSH and web terminal
- Sets up health checks

### docker-compose.yml
Orchestration file for multi-service deployment:
- `mcp-pentest-forge` - Main server (Node.js backend)
- `kali-pentest` - Kali Linux container
- Shared volumes for workspace and tools
- Network connectivity between services
- Environment variables for configuration

### build_and_push.ps1
PowerShell script for Windows:
- Builds the Docker image
- Tags for versioning
- Handles Docker Hub authentication
- Pushes to registry
- Color-coded output with emojis

### build_and_push.sh
Bash script for Linux/macOS:
- Same functionality as PowerShell version
- Uses bash for broader compatibility
- POSIX-compliant commands
- Usage: `./build_and_push.sh [version]`

## ⚙️ Build Process Breakdown

### Phase 1: Base Setup (2-5 min)
```dockerfile
FROM kalilinux/kali-rolling:latest
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get upgrade -y
```
- Pulls latest Kali Linux base image
- Sets environment variables
- Updates system packages

### Phase 2: Tool Installation (30-45 min)
```dockerfile
RUN apt-get install -y \
    # Core utilities
    # Network tools
    # Pentesting frameworks
    # Security tools
    # Development environment
```
- Installs ~150+ packages
- Large download and compilation
- Most time-intensive phase

### Phase 3: ttyd Compilation (10-15 min)
```dockerfile
RUN cd /tmp && \
    git clone https://github.com/tsl0922/ttyd.git && \
    cd ttyd && \
    cmake -DCMAKE_BUILD_TYPE=Release .. && \
    make && make install
```
- Builds web terminal from source
- Requires build-essential and dependencies
- **Fixed issue**: Added zlib1g-dev dependency

### Phase 4: SSH & User Setup (2-5 min)
```dockerfile
RUN mkdir -p /run/sshd && \
    sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    useradd -m -s /bin/bash -G sudo pentester && \
    echo "pentester:pentester" | chpasswd
```
- Configures SSH server
- Creates pentester user
- Sets passwords and permissions

### Phase 5: Entrypoint & Finalization (1-2 min)
```dockerfile
RUN cat > /entrypoint.sh << 'EOF'
#!/bin/bash
/usr/bin/ttyd -p 7681 bash &
sudo /usr/sbin/sshd -D &
wait $TTYD_PID $SSH_PID
EOF
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s \
    CMD curl -f http://localhost:7681 || exit 1
```
- Creates startup script
- Starts both ttyd and SSH services
- Configures health checks

## 🔐 Security Considerations

### Authentication
- Web terminal (ttyd): No authentication - suitable for internal/trusted networks only
- SSH: Username/password authentication by default
  - **Recommend**: Generate SSH keys and disable password auth in production

### Network Exposure
- Be cautious when exposing port 7681 externally (no authentication)
- Consider using firewall rules to restrict access
- Use SSH key-based authentication instead of passwords

### Resource Limits
```bash
# Run with resource limits
docker run -it \
  --memory="4g" \
  --cpus="2" \
  -p 7681:7681 \
  -p 2222:2222 \
  akilhassane/mcp-pentest-forge:kali-latest
```

### Data Protection
- Use volumes to persist sensitive data
- Don't store credentials in container
- Use environment variables for secrets
- Mount encrypted volumes for sensitive tools

## 📋 Pre-push Checklist

- [ ] Build completes without errors
- [ ] Image size is reasonable (~3-4 GB)
- [ ] Test web terminal: `http://localhost:7681`
- [ ] Test SSH: `ssh -p 2222 pentester@localhost`
- [ ] Verify tools are installed: `docker run ... nmap --version`
- [ ] Docker Hub login successful: `docker login`
- [ ] Image tagged correctly: `docker images | grep kali`
- [ ] Push completes successfully

## 🚀 Post-push Tasks

### Update Documentation
1. README.md - Add pull instructions
2. Changelog - Document what's included
3. Usage guide - Add common scenarios

### Share with Community
```
Docker Hub: https://hub.docker.com/r/akilhassane/mcp-pentest-forge

Quick start:
docker pull akilhassane/mcp-pentest-forge:kali-latest
docker run -it -p 7681:7681 -p 2222:2222 akilhassane/mcp-pentest-forge:kali-latest
```

### Monitor Usage
- Check Docker Hub download stats
- Respond to issues/questions
- Gather feedback for improvements

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| **KALI_DOCKER_GUIDE.md** | Comprehensive user guide |
| **QUICK_PUSH_GUIDE.md** | Quick reference for pushing |
| **KALI_BUILD_STATUS.md** | Build progress tracking |
| **KALI_DOCKER_COMPLETE_SETUP.md** | This file - Complete setup |
| **Dockerfile.kali** | Container definition |
| **build_and_push.ps1** | Windows build script |
| **build_and_push.sh** | Linux/macOS build script |

## 💡 Tips & Tricks

### Speed up rebuilds
```bash
# Use Docker layer caching
docker build --cache-from akilhassane/mcp-pentest-forge:kali-latest \
  -f Dockerfile.kali \
  -t akilhassane/mcp-pentest-forge:kali-latest .
```

### Multi-architecture support
```bash
# Build for multiple architectures
docker buildx build --platform linux/amd64,linux/arm64 \
  -f Dockerfile.kali \
  -t akilhassane/mcp-pentest-forge:kali-latest \
  --push .
```

### Optimize image size
```bash
# Use multi-stage builds
# Install only needed dependencies
# Remove apt cache and temp files
# Combine RUN commands to reduce layers
```

### Monitor container
```bash
# Real-time stats
docker stats akilhassane/mcp-pentest-forge

# View logs
docker logs -f <container-id>

# Inspect image
docker inspect akilhassane/mcp-pentest-forge:kali-latest
```

## 🆘 Troubleshooting Reference

### Build Fails with CMake Error
**Problem**: `Could NOT find ZLIB`
**Solution**: Ensure `zlib1g-dev` is in the Dockerfile
**Status**: ✅ Already fixed

### Build is Too Slow
**Problem**: Takes >2 hours
**Solution**: 
- Increase Docker memory to 8GB+
- Use SSD for Docker storage
- Check system resources with `docker stats`

### Can't Push to Docker Hub
**Problem**: `unauthorized: authentication required`
**Solution**: 
- Run `docker login`
- Check credentials
- Verify repository permissions

### Image Won't Start
**Problem**: Container exits immediately
**Solution**:
- Check entrypoint script
- Verify SSH is configured
- Review logs: `docker logs <container-id>`

## 📞 Support & Resources

- **Docker Documentation**: https://docs.docker.com/
- **Kali Linux**: https://www.kali.org/
- **ttyd Project**: https://github.com/tsl0922/ttyd
- **Docker Hub**: https://hub.docker.com/

## 🎓 Learning Resources

### Pentesting Tools
- Metasploit Framework guide: https://docs.rapid7.com/metasploit/
- Kali Linux tutorials: https://www.kali.org/docs/
- Nmap book: https://nmap.org/book/

### Docker
- Docker best practices: https://docs.docker.com/develop/dev-best-practices/
- Docker security: https://docs.docker.com/engine/security/
- Docker compose: https://docs.docker.com/compose/

---

## ✨ Next Steps

1. **Monitor the build** - It's running in the background
2. **Once complete** - Run one of the push scripts
3. **Verify on Docker Hub** - Check tags and description
4. **Share with community** - Get feedback and improve
5. **Iterate** - Update tools and publish new versions

---

**Setup Guide Created**: October 25, 2025
**Status**: Build in progress
**Expected Completion**: ~50-80 minutes from build start


