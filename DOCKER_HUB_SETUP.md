# 🐳 Build & Publish Kali Docker Image to Docker Hub

## Overview

This guide walks through building a production-ready Kali Linux Docker image with:
- ✅ ttyd Web Terminal (port 7681)
- ✅ SSH Server (port 2222)
- ✅ All Kali pentesting tools pre-installed
- ✅ Proper service startup and health checks

---

## 🚀 Quick Build & Push

### Option 1: Automated Script (Recommended)

```bash
# Make script executable
chmod +x build_and_push.sh

# Build and push to Docker Hub
./build_and_push.sh v1.0

# Or just use 'latest'
./build_and_push.sh
```

### Option 2: Manual Commands

```bash
# Build image
docker build -f Dockerfile.kali -t akilhassane/mcp-pentest-forge:kali-latest .

# Test locally
docker run -it -p 7681:7681 akilhassane/mcp-pentest-forge:kali-latest

# Login to Docker Hub
docker login

# Push to Docker Hub
docker push akilhassane/mcp-pentest-forge:kali-latest
```

---

## 📋 Prerequisites

1. **Docker installed** - `docker --version`
2. **Docker Hub account** - https://hub.docker.com
3. **Logged in to Docker Hub** - `docker login`

---

## 🔨 Building the Image

### Step 1: Verify Dockerfile

```bash
# Check Dockerfile.kali exists and is correct
cat Dockerfile.kali | head -20
```

Should show:
```
# Kali Linux Container for Pentesting with Web Terminal
FROM kalilinux/kali-rolling:latest
```

### Step 2: Build

```bash
docker build -f Dockerfile.kali -t akilhassane/mcp-pentest-forge:kali-latest .
```

**First build takes 10-15 minutes** (downloading Kali base + installing packages)

Monitor progress:
```bash
# In another terminal
docker ps  # See the build container
```

### Step 3: Verify Build

```bash
# Check image exists
docker images | grep kali

# Should show something like:
# akilhassane/mcp-pentest-forge  kali-latest  abc123def456  10 minutes ago  3.5GB
```

---

## ✅ Testing Locally

### Quick Test

```bash
# Run container
docker run -it -p 7681:7681 akilhassane/mcp-pentest-forge:kali-latest
```

**Expected output:**
```
🚀 Starting Kali Linux with ttyd Web Terminal...
Starting ttyd on port 7681...
Starting SSH server on port 2222...
✅ Services started:
   - ttyd Web Terminal: http://localhost:7681
   - SSH Server: localhost:2222

Ready for connections! Press Ctrl+C to stop.
```

### Verify Services

**In another terminal:**

```bash
# Test ttyd web terminal
curl -I http://localhost:7681
# Should return: HTTP/1.1 200 OK

# Test SSH
ssh -p 2222 pentester@localhost  # password: pentester
# Should connect

# Test a Kali tool
docker exec <container_id> nmap --version
```

### Stop Container

```
Ctrl+C in the container terminal
```

---

## 📤 Pushing to Docker Hub

### Step 1: Login

```bash
docker login
# Enter your Docker Hub username and password
```

### Step 2: Tag Image

```bash
# Tag with version
docker tag akilhassane/mcp-pentest-forge:kali-latest akilhassane/mcp-pentest-forge:kali-v1.0

# List tags
docker images akilhassane/mcp-pentest-forge
```

### Step 3: Push

```bash
# Push latest
docker push akilhassane/mcp-pentest-forge:kali-latest

# Push versioned
docker push akilhassane/mcp-pentest-forge:kali-v1.0
```

**Monitor progress:**
```bash
# View Docker Hub online
# https://hub.docker.com/r/akilhassane/mcp-pentest-forge
```

---

## 🎯 Using the Published Image

### Pull from Docker Hub

```bash
docker pull akilhassane/mcp-pentest-forge:kali-latest
```

### Run with Docker Compose

Update your `docker-compose.yml`:

```yaml
services:
  kali-pentest:
    image: akilhassane/mcp-pentest-forge:kali-latest
    container_name: kali-pentest
    hostname: kali-pentest
    stdin_open: true
    tty: true
    restart: unless-stopped
    ports:
      - "7681:7681"  # ttyd web terminal
      - "2222:2222"  # SSH
    volumes:
      - ./workspace:/workspace
      - ./tools:/tools
```

Then:
```bash
docker-compose up -d
```

### Run Standalone

```bash
docker run -it \
  -p 7681:7681 \
  -p 2222:2222 \
  -v $(pwd)/workspace:/workspace \
  akilhassane/mcp-pentest-forge:kali-latest
```

---

## 🎨 Image Features

### What's Included

- ✅ Kali Linux Rolling
- ✅ ttyd Web Terminal (port 7681)
- ✅ SSH Server (port 2222)
- ✅ All Kali top 10 tools
- ✅ Pentesting tools: nmap, metasploit, sqlmap, hashcat, etc.
- ✅ Python 3 with security libraries
- ✅ Network tools: wireshark, tcpdump, etc.

### Ports

| Port | Service | Purpose |
|------|---------|---------|
| 7681 | ttyd | Web-based terminal access |
| 2222 | SSH | Remote SSH access |

### Default User

- **Username**: pentester
- **Password**: pentester
- **Root**: Can use `sudo` without password

### Directories

- `/workspace` - Your working directory
- `/tools` - Tools and scripts directory

---

## 🛠️ Customization

### Modify Dockerfile

Edit `Dockerfile.kali` to:
- Add more tools
- Change default ports
- Adjust startup scripts

Then rebuild:
```bash
docker build -f Dockerfile.kali -t akilhassane/mcp-pentest-forge:kali-custom .
```

### Add More Tools

In `Dockerfile.kali`, add to the apt-get install line:

```dockerfile
RUN apt-get update && apt-get install -y \
    # ... existing packages ...
    # Add your new packages here:
    tool-name-1 \
    tool-name-2 \
    ...
```

---

## 📊 Image Size

- **Base Kali Image**: ~2GB
- **With tools**: ~3.5GB
- **Compressed on Docker Hub**: ~1.2GB

---

## 🐛 Troubleshooting

### Build Fails

```bash
# Clean and rebuild
docker system prune -a
docker build --no-cache -f Dockerfile.kali -t akilhassane/mcp-pentest-forge:kali-latest .
```

### ttyd Not Starting

```bash
# Check container logs
docker logs <container_id>

# Should see:
# ✅ Services started:
#    - ttyd Web Terminal: http://localhost:7681
```

### Can't Connect to Docker Hub

```bash
# Verify logged in
docker info

# Should show your username

# Re-login if needed
docker logout
docker login
```

### Port Already in Use

```bash
# Use different port
docker run -it -p 9999:7681 akilhassane/mcp-pentest-forge:kali-latest

# Then access at http://localhost:9999
```

---

## 📚 Resources

- Dockerfile reference: https://docs.docker.com/engine/reference/builder/
- Docker Hub: https://hub.docker.com/r/akilhassane/mcp-pentest-forge
- Kali Linux: https://hub.docker.com/r/kalilinux
- ttyd: https://github.com/tsl0922/ttyd

---

## ✨ Next Steps

1. ✅ Build the image
2. ✅ Test it locally
3. ✅ Push to Docker Hub
4. ✅ Use in your MCP project
5. ✅ Integrate with frontend (port 7681)

---

**Your production-ready Kali Docker image is ready!** 🎉

For questions, check the troubleshooting section or review the Dockerfile comments.



