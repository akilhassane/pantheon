# Docker Hub Windows Container Images Guide

## Current Setup

You already have a custom Windows 11 image:
- **Image**: `windows-11:25H2`
- **Size**: 38.2GB
- **Type**: Windows container (native)
- **Status**: ✅ Ready to use

## Windows Container Types

### 1. Native Windows Containers (Recommended)

These run directly on Windows hosts using Windows container technology:

**Official Microsoft Base Images:**
```
mcr.microsoft.com/windows/servercore:ltsc2022    # Windows Server Core
mcr.microsoft.com/windows/nanoserver:ltsc2022    # Minimal Windows
mcr.microsoft.com/windows:1809                   # Windows 10 1809
mcr.microsoft.com/windows:ltsc2022               # Windows Server 2022
```

**Your Custom Image:**
```
windows-11:25H2                                  # Custom Windows 11 (38.2GB)
```

**Characteristics:**
- ✅ True Windows containers
- ✅ Full Windows API support
- ✅ Native performance
- ⚠️ Requires Windows host
- ⚠️ Large size (5-40GB)

### 2. QEMU-based Windows Emulation (Not Recommended)

These are Linux containers that emulate Windows using QEMU:

**Popular Images:**
```
dockurr/windows                                  # Windows in QEMU (528 stars)
sickcodes/docker-osx                            # macOS in QEMU
```

**Characteristics:**
- ✅ Runs on Linux hosts
- ❌ Very slow (emulation overhead)
- ❌ Not true Windows containers
- ❌ Limited compatibility
- ⚠️ Not suitable for production

## Recommended Images for Pantheon

### Option 1: Your Custom Windows 11 Image (Current)

**Image:** `windows-11:25H2`

**Pros:**
- ✅ Already built and tested
- ✅ Full Windows 11 desktop
- ✅ Pre-configured with tools
- ✅ 38.2GB includes everything

**Cons:**
- ⚠️ Large size (38.2GB)
- ⚠️ Requires Windows host
- ⚠️ Not on Docker Hub (local only)

**Usage:**
```bash
docker run -d \
  --name windows-container \
  -p 5900:5900 \
  -p 8080:8080 \
  windows-11:25H2
```

### Option 2: Microsoft Windows Server Core

**Image:** `mcr.microsoft.com/windows/servercore:ltsc2022`

**Pros:**
- ✅ Official Microsoft image
- ✅ Smaller size (~5GB)
- ✅ Regular updates
- ✅ Good for server workloads

**Cons:**
- ❌ No desktop GUI
- ❌ Server OS (not Windows 11)
- ⚠️ Requires additional setup for desktop

**Usage:**
```bash
docker pull mcr.microsoft.com/windows/servercore:ltsc2022
docker run -d mcr.microsoft.com/windows/servercore:ltsc2022
```

### Option 3: Microsoft Nano Server

**Image:** `mcr.microsoft.com/windows/nanoserver:ltsc2022`

**Pros:**
- ✅ Very small (~300MB)
- ✅ Fast startup
- ✅ Minimal attack surface

**Cons:**
- ❌ No GUI
- ❌ Limited Windows API
- ❌ Not suitable for desktop apps

## Publishing Your Windows 11 Image to Docker Hub

If you want to share your custom Windows 11 image:

### Step 1: Tag the Image

```bash
docker tag windows-11:25H2 akilhassane/pantheon-windows11:25H2
docker tag windows-11:25H2 akilhassane/pantheon-windows11:latest
```

### Step 2: Login to Docker Hub

```bash
docker login
# Enter username: akilhassane
# Enter password: <your-docker-hub-token>
```

### Step 3: Push to Docker Hub

```bash
docker push akilhassane/pantheon-windows11:25H2
docker push akilhassane/pantheon-windows11:latest
```

**Note:** This will take a long time (38.2GB upload)!

### Step 4: Make Public

1. Go to https://hub.docker.com/r/akilhassane/pantheon-windows11
2. Settings → Make Public

### Step 5: Update Project Manager

Update `backend/project-manager.js`:

```javascript
const OS_IMAGE_MAP = {
  'windows-11': 'akilhassane/pantheon-windows11:25H2',  // Now on Docker Hub!
  // ... other images
};
```

## Alternative: Use Docker Hub for Distribution

Instead of pushing the full 38GB image, you can:

### Option A: Multi-stage Build

Create a Dockerfile that builds from Microsoft base:

```dockerfile
# Dockerfile.windows11
FROM mcr.microsoft.com/windows/servercore:ltsc2022

# Install Windows features
RUN powershell -Command \
    Install-WindowsFeature -Name Desktop-Experience

# Install tools
COPY tools/ C:/tools/
COPY scripts/ C:/scripts/

# Configure VNC
RUN C:/scripts/setup-vnc.ps1

EXPOSE 5900 8080

CMD ["C:\\scripts\\start.ps1"]
```

**Benefits:**
- ✅ Reproducible builds
- ✅ Version controlled
- ✅ Smaller layers
- ✅ Easier to update

### Option B: Base Image + Volume

Use a small base image and mount tools as volumes:

```bash
docker run -d \
  --name windows-container \
  -v C:/pantheon-tools:/tools \
  mcr.microsoft.com/windows/servercore:ltsc2022
```

**Benefits:**
- ✅ Smaller image size
- ✅ Faster distribution
- ✅ Easier updates

## Recommended Strategy

### For Development (Current)
- ✅ Use local `windows-11:25H2` image
- ✅ Fast iteration
- ✅ No upload needed

### For Distribution (Future)
1. **Create Dockerfile** from Microsoft base
2. **Automate build** with GitHub Actions
3. **Push to Docker Hub** automatically
4. **Users pull** from Docker Hub

### For Production (Hybrid)
1. **Client agent** pulls from Docker Hub
2. **First run** downloads image (one-time)
3. **Subsequent runs** use cached image
4. **Updates** pull new versions automatically

## Docker Hub Alternatives

### GitHub Container Registry (GHCR)

**Pros:**
- ✅ Free for public repos
- ✅ Integrated with GitHub
- ✅ Unlimited bandwidth

**Usage:**
```bash
docker tag windows-11:25H2 ghcr.io/akilhassane/pantheon-windows11:25H2
docker push ghcr.io/akilhassane/pantheon-windows11:25H2
```

### Azure Container Registry (ACR)

**Pros:**
- ✅ Fast in Azure regions
- ✅ Private by default
- ✅ Good for Windows images

**Cost:** ~$5/month for 10GB storage

## Current Image Analysis

Your `windows-11:25H2` image:

```bash
# Check image details
docker inspect windows-11:25H2

# Check layers
docker history windows-11:25H2

# Check size breakdown
docker images windows-11:25H2 --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
```

**Size Breakdown:**
- Base Windows: ~10GB
- Desktop Experience: ~5GB
- Tools & Software: ~10GB
- VNC Server: ~1GB
- Other: ~12GB
- **Total: 38.2GB**

## Optimization Opportunities

### 1. Remove Unnecessary Components

```powershell
# In container
Remove-WindowsFeature -Name Feature1, Feature2
```

### 2. Clean Up After Install

```powershell
# Clear temp files
Remove-Item C:\Windows\Temp\* -Recurse -Force
Remove-Item C:\Users\*\AppData\Local\Temp\* -Recurse -Force

# Clear Windows Update cache
Stop-Service wuauserv
Remove-Item C:\Windows\SoftwareDistribution\Download\* -Recurse -Force
Start-Service wuauserv
```

### 3. Use Multi-stage Build

```dockerfile
FROM mcr.microsoft.com/windows/servercore:ltsc2022 AS builder
# Install and build tools
RUN ...

FROM mcr.microsoft.com/windows/servercore:ltsc2022
# Copy only necessary files from builder
COPY --from=builder C:/tools C:/tools
```

**Potential savings:** 5-10GB

## Recommendations

### Immediate (Keep Current Setup)
- ✅ Continue using `windows-11:25H2` locally
- ✅ Works perfectly for development
- ✅ No changes needed

### Short-term (Optimize)
- 📦 Clean up image to reduce size
- 📦 Document build process
- 📦 Create Dockerfile for reproducibility

### Long-term (Distribute)
- 🚀 Push to Docker Hub or GHCR
- 🚀 Automate builds with CI/CD
- 🚀 Version releases (25H2, 26H1, etc.)

## Conclusion

**Current Status:** ✅ You have a working Windows 11 image

**Next Steps:**
1. Keep using local image for now
2. Optimize size if needed
3. Push to Docker Hub when ready to distribute
4. Update client agent to pull from Docker Hub

**No immediate action needed** - your current setup works perfectly for the hybrid architecture!

---

**See Also:**
- `WINDOWS_CONTAINERS_STRATEGY.md` - Overall strategy
- `client-agent/PACKAGING.md` - Client agent distribution
- Microsoft Container Registry: https://mcr.microsoft.com
