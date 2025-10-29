# Quick Push to Docker Hub Guide

## 🚀 One-Command Build & Push

### PowerShell (Windows)
```powershell
# Simple - uses defaults
.\build_and_push.ps1

# With version
.\build_and_push.ps1 -Version "1.0"
```

### Bash (Linux/macOS)
```bash
# Simple - uses defaults
./build_and_push.sh

# With version
./build_and_push.sh 1.0
```

## 📋 Step-by-Step Manual Process

### Step 1: Build Image
```bash
docker build -f Dockerfile.kali -t akilhassane/mcp-pentest-forge:kali-latest .
```

### Step 2: Tag Image
```bash
# Tag with version
docker tag akilhassane/mcp-pentest-forge:kali-latest akilhassane/mcp-pentest-forge:kali-1.0

# Or multiple tags
docker tag akilhassane/mcp-pentest-forge:kali-latest akilhassane/mcp-pentest-forge:kali-v1.0.0
```

### Step 3: Login to Docker Hub
```bash
docker login
# Enter username: akilhassane
# Enter password: (your Docker Hub password)
```

### Step 4: Push to Docker Hub
```bash
# Push latest
docker push akilhassane/mcp-pentest-forge:kali-latest

# Push versioned
docker push akilhassane/mcp-pentest-forge:kali-1.0
docker push akilhassane/mcp-pentest-forge:kali-v1.0.0
```

## ✅ Verify Build Success

### Check Image Exists
```bash
docker images | grep mcp-pentest-forge
```

Expected output:
```
akilhassane/mcp-pentest-forge   kali-latest   <IMAGE_ID>   <SIZE>   <CREATED>
akilhassane/mcp-pentest-forge   kali-1.0      <IMAGE_ID>   <SIZE>   <CREATED>
```

### Test Container
```bash
# Quick test
docker run --rm -it -p 7681:7681 akilhassane/mcp-pentest-forge:kali-latest

# Then visit: http://localhost:7681
```

## 🔍 Verify on Docker Hub

1. Go to: https://hub.docker.com/r/akilhassane/mcp-pentest-forge
2. Check "Tags" tab
3. You should see: `kali-latest`, `kali-1.0`, etc.

## 📊 Image Information

| Property | Value |
|----------|-------|
| Repository | akilhassane/mcp-pentest-forge |
| Latest Tag | kali-latest |
| Base Image | kalilinux/kali-rolling:latest |
| Size | ~3-4 GB |
| OS | Kali Linux (Debian-based) |
| Architecture | amd64 |

## 🛠️ Troubleshooting

### Build stuck or slow?
```bash
# Check system resources
docker stats

# Increase Docker memory limit (Windows)
# Docker Desktop > Settings > Resources > Memory > Increase to 8GB+
```

### Authentication failed?
```bash
docker logout
docker login
```

### Image push failed?
```bash
# Check image exists
docker images | grep kali

# Re-tag if needed
docker tag <IMAGE_ID> akilhassane/mcp-pentest-forge:kali-latest

# Try push again
docker push akilhassane/mcp-pentest-forge:kali-latest
```

### Out of disk space?
```bash
# Clean up old images
docker system prune -a

# Or manually remove images
docker rmi <IMAGE_ID>
```

## 📝 Version Tagging Strategy

For semantic versioning:
- `kali-latest` - Most recent version
- `kali-1.0` - Major release
- `kali-1.0.1` - Patch release
- `kali-stable` - Stable version (optional)

Example tagging:
```bash
docker tag mcp-pentest-forge:build akilhassane/mcp-pentest-forge:kali-latest
docker tag mcp-pentest-forge:build akilhassane/mcp-pentest-forge:kali-1.0
docker tag mcp-pentest-forge:build akilhassane/mcp-pentest-forge:kali-stable
```

## 🎯 After Push Complete

### Share the image
```
Docker Hub URL: https://hub.docker.com/r/akilhassane/mcp-pentest-forge

Users can pull with:
docker pull akilhassane/mcp-pentest-forge:kali-latest
```

### Update documentation
- [ ] README.md - Add pull instructions
- [ ] Update version numbers
- [ ] Document new features/tools

### Distribute usage instructions
```bash
# Quick start command
docker run -it -p 7681:7681 -p 2222:2222 akilhassane/mcp-pentest-forge:kali-latest

# Access:
# Web Terminal: http://localhost:7681
# SSH: ssh -p 2222 pentester@localhost (password: pentester)
```

## 💡 Pro Tips

1. **Automate with CI/CD**: Set up GitHub Actions to build and push automatically
2. **Use build context efficiently**: Minimize unnecessary layers
3. **Monitor image size**: Check for bloat with `docker inspect <IMAGE>`
4. **Document changes**: Keep changelog of what's in each version
5. **Test locally first**: Always verify container runs before pushing

## 📞 Support

- Docker Hub: https://hub.docker.com/r/akilhassane/mcp-pentest-forge
- GitHub: https://github.com/akilhassane/mcp-pentest-forge
- Kali Linux: https://www.kali.org/

---

**Quick Reference Created**: October 25, 2025


