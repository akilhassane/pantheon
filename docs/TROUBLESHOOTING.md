# Pantheon Troubleshooting Guide

This guide helps you diagnose and fix common issues with Pantheon.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Installation Issues](#installation-issues)
3. [Container Issues](#container-issues)
4. [Network Issues](#network-issues)
5. [Configuration Issues](#configuration-issues)
6. [Performance Issues](#performance-issues)
7. [Windows Project Issues](#windows-project-issues)
8. [AI Provider Issues](#ai-provider-issues)
9. [Database Issues](#database-issues)
10. [Getting Help](#getting-help)

---

## Quick Diagnostics

Run the automated diagnostic script:

```bash
bash test-installation.sh
```

This will check:
- Docker installation and status
- Container health
- Port availability
- Configuration
- API endpoints

---

## Installation Issues

### Issue: Docker Not Installed

**Symptoms**:
```
bash: docker: command not found
```

**Solution**:

**Linux**:
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Log out and back in

# Verify
docker --version
```

**macOS**:
```bash
# Install Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop
```

**Windows**:
```powershell
# Install Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop
# Enable WSL2 backend
```

---

### Issue: Docker Daemon Not Running

**Symptoms**:
```
Cannot connect to the Docker daemon at unix:///var/run/docker.sock
```

**Solution**:

**Linux**:
```bash
sudo systemctl start docker
sudo systemctl enable docker
```

**macOS/Windows**:
- Start Docker Desktop application
- Wait for it to fully start (whale icon in system tray)

---

### Issue: Permission Denied

**Symptoms**:
```
Got permission denied while trying to connect to the Docker daemon socket
```

**Solution**:

```bash
# Add your user to docker group
sudo usermod -aG docker $USER

# Log out and back in, or run:
newgrp docker

# Verify
docker ps
```

---

### Issue: Port Already in Use

**Symptoms**:
```
Bind for 0.0.0.0:3000 failed: port is already allocated
```

**Solution**:

**Find what's using the port**:

```bash
# Linux/macOS
lsof -i :3000

# Windows
netstat -ano | findstr :3000
```

**Option 1: Kill the process**:
```bash
# Linux/macOS
kill -9 <PID>

# Windows
taskkill /PID <PID> /F
```

**Option 2: Change Pantheon's port**:

Edit `docker-compose.production.yml`:
```yaml
services:
  frontend:
    ports:
      - "3001:3000"  # Change 3000 to 3001
```

Then restart:
```bash
docker-compose -f docker-compose.production.yml restart
```

---

## Container Issues

### Issue: Container Won't Start

**Symptoms**:
```
Container pantheon-backend exited with code 1
```

**Diagnosis**:

```bash
# Check logs
docker-compose -f docker-compose.production.yml logs backend

# Check container status
docker ps -a | grep pantheon
```

**Common Causes**:

1. **Missing environment variables**:
   - Check `.env` file exists
   - Verify all required variables are set
   - Restart: `docker-compose -f docker-compose.production.yml restart`

2. **Port conflict**:
   - See [Port Already in Use](#issue-port-already-in-use)

3. **Out of memory**:
   - Check: `docker stats`
   - Increase Docker memory limit in Docker Desktop settings

4. **Corrupted image**:
   ```bash
   docker-compose -f docker-compose.production.yml down
   docker rmi akilhassane/pantheon:backend
   docker pull akilhassane/pantheon:backend
   docker-compose -f docker-compose.production.yml up -d
   ```

---

### Issue: Container Unhealthy

**Symptoms**:
```
Container status: Up (unhealthy)
```

**Diagnosis**:

```bash
# Check health check logs
docker inspect pantheon-backend | grep -A 10 Health

# Check application logs
docker logs pantheon-backend --tail 100
```

**Solutions**:

1. **Wait longer**: Health checks may take 30-60 seconds
2. **Check configuration**: Verify `.env` file
3. **Restart container**:
   ```bash
   docker-compose -f docker-compose.production.yml restart backend
   ```

---

### Issue: Container Keeps Restarting

**Symptoms**:
```
Container pantheon-backend restarting continuously
```

**Diagnosis**:

```bash
# Watch logs in real-time
docker logs -f pantheon-backend

# Check restart count
docker ps -a | grep pantheon-backend
```

**Common Causes**:

1. **Application crash**: Check logs for errors
2. **Database connection failure**: Verify Supabase credentials
3. **Missing dependencies**: Pull latest image
4. **Resource limits**: Increase Docker resources

---

## Network Issues

### Issue: Cannot Access Frontend

**Symptoms**:
- Browser shows "This site can't be reached"
- `curl http://localhost:3000` fails

**Diagnosis**:

```bash
# Check if container is running
docker ps | grep pantheon-frontend

# Check if port is exposed
docker port pantheon-frontend

# Test from inside container
docker exec pantheon-frontend curl http://localhost:3000
```

**Solutions**:

1. **Container not running**:
   ```bash
   docker-compose -f docker-compose.production.yml up -d frontend
   ```

2. **Port not exposed**:
   - Check `docker-compose.production.yml` has correct port mapping
   - Restart services

3. **Firewall blocking**:
   ```bash
   # Linux
   sudo ufw allow 3000
   
   # Windows
   # Add firewall rule in Windows Defender Firewall
   ```

---

### Issue: Backend Connection Failed

**Symptoms**:
- Frontend shows "Cannot connect to backend"
- API requests fail

**Diagnosis**:

```bash
# Test backend directly
curl http://localhost:3002/health

# Check backend logs
docker logs pantheon-backend --tail 50

# Check network
docker network inspect pantheon-network
```

**Solutions**:

1. **Backend not running**: Start it
2. **Wrong API URL**: Check `NEXT_PUBLIC_API_URL` in `.env`
3. **Network issue**: Recreate network
   ```bash
   docker-compose -f docker-compose.production.yml down
   docker network rm pantheon-network
   docker-compose -f docker-compose.production.yml up -d
   ```

---

### Issue: Containers Can't Communicate

**Symptoms**:
- Frontend can't reach backend
- Backend can't reach Windows Tools

**Diagnosis**:

```bash
# Check network
docker network inspect pantheon-network

# Test connectivity
docker exec pantheon-frontend ping pantheon-backend
docker exec pantheon-backend ping pantheon-windows-tools
```

**Solution**:

```bash
# Recreate network
docker-compose -f docker-compose.production.yml down
docker network prune
docker-compose -f docker-compose.production.yml up -d
```

---

## Configuration Issues

### Issue: Supabase Connection Failed

**Symptoms**:
```
Error: Invalid Supabase URL or key
```

**Diagnosis**:

```bash
# Check .env file
cat .env | grep SUPABASE

# Test Supabase connection
curl -H "apikey: YOUR_ANON_KEY" https://your-project.supabase.co/rest/v1/
```

**Solution**:

1. **Verify credentials**:
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Settings → API
   - Copy correct values to `.env`

2. **Check format**:
   ```env
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. **Restart services**:
   ```bash
   docker-compose -f docker-compose.production.yml restart
   ```

---

### Issue: AI Provider API Key Invalid

**Symptoms**:
```
Error: Invalid API key
Error: Unauthorized
```

**Solution**:

1. **Verify API key**:
   - Check key format (starts with `sk-` for OpenAI, `sk-ant-` for Anthropic, etc.)
   - Test key directly:
   
   ```bash
   # OpenAI
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_API_KEY"
   
   # Anthropic
   curl https://api.anthropic.com/v1/messages \
     -H "x-api-key: YOUR_API_KEY" \
     -H "anthropic-version: 2023-06-01"
   ```

2. **Check billing**:
   - Ensure you have credits/billing set up
   - Check usage limits

3. **Update .env and restart**:
   ```bash
   docker-compose -f docker-compose.production.yml restart backend
   ```

---

## Performance Issues

### Issue: Slow Response Times

**Symptoms**:
- AI responses take too long
- UI is sluggish
- High CPU/memory usage

**Diagnosis**:

```bash
# Check resource usage
docker stats

# Check logs for errors
docker-compose -f docker-compose.production.yml logs --tail 100
```

**Solutions**:

1. **Increase Docker resources**:
   - Docker Desktop → Settings → Resources
   - Increase CPU and Memory limits

2. **Check AI provider status**:
   - OpenAI: https://status.openai.com
   - Anthropic: https://status.anthropic.com

3. **Optimize database**:
   - Check Supabase dashboard for slow queries
   - Add indexes if needed

4. **Clear old data**:
   ```bash
   # Clean up old containers and images
   docker system prune -a
   ```

---

### Issue: High Memory Usage

**Symptoms**:
```
Container using 90%+ memory
System becomes unresponsive
```

**Solution**:

```bash
# Check memory usage
docker stats --no-stream

# Restart containers
docker-compose -f docker-compose.production.yml restart

# Increase Docker memory limit
# Docker Desktop → Settings → Resources → Memory
```

---

## Windows Project Issues

### Issue: Windows Container Won't Start

**Symptoms**:
- Windows project creation fails
- VNC connection refused

**Diagnosis**:

```bash
# Check Windows Tools API
curl http://localhost:3003/health

# Check logs
docker logs pantheon-windows-tools
```

**Solution**:

1. **Ensure KVM is available** (Linux only):
   ```bash
   # Check KVM
   ls -l /dev/kvm
   
   # If missing, enable virtualization in BIOS
   ```

2. **Check disk space**:
   - Windows containers need 20GB+ per project
   - Run: `df -h`

3. **Restart Windows Tools API**:
   ```bash
   docker-compose -f docker-compose.production.yml restart windows-tools-api
   ```

---

### Issue: VNC Not Working

**Symptoms**:
- Black screen in VNC viewer
- Connection refused

**Solution**:

1. **Check VNC port**:
   ```bash
   docker ps | grep windows
   # Look for port mapping (e.g., 5900:5900)
   ```

2. **Test VNC connection**:
   ```bash
   # Install VNC viewer
   # Connect to: localhost:5900
   ```

3. **Check Windows container logs**:
   ```bash
   docker logs <windows-container-name>
   ```

---

## AI Provider Issues

### Issue: Model Not Available

**Symptoms**:
```
Error: Model not found
Error: Model not supported
```

**Solution**:

1. **Check model name**: Ensure correct model ID
2. **Verify API access**: Some models require special access
3. **Try different provider**: Use OpenRouter as fallback

---

### Issue: Rate Limit Exceeded

**Symptoms**:
```
Error: Rate limit exceeded
Error: Too many requests
```

**Solution**:

1. **Wait**: Rate limits reset after time period
2. **Upgrade plan**: Increase rate limits with provider
3. **Use different provider**: Switch to alternative
4. **Implement queuing**: Add delays between requests

---

## Database Issues

### Issue: Database Connection Failed

**Symptoms**:
```
Error: Could not connect to database
Error: Connection timeout
```

**Solution**:

1. **Check Supabase status**: https://status.supabase.com
2. **Verify credentials**: See [Supabase Connection Failed](#issue-supabase-connection-failed)
3. **Check network**: Ensure internet connection
4. **Restart backend**:
   ```bash
   docker-compose -f docker-compose.production.yml restart backend
   ```

---

### Issue: Database Migration Failed

**Symptoms**:
```
Error: Migration failed
Error: Table already exists
```

**Solution**:

1. **Check Supabase logs**: Dashboard → Logs
2. **Manual migration**: Run SQL in Supabase SQL Editor
3. **Reset database**: (⚠️ This deletes all data)
   ```sql
   -- In Supabase SQL Editor
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   ```

---

## Getting Help

If you're still having issues:

### 1. Collect Diagnostic Information

```bash
# Run diagnostic script
bash test-installation.sh > diagnostic-report.txt

# Collect logs
docker-compose -f docker-compose.production.yml logs > logs.txt

# System information
docker version >> diagnostic-report.txt
docker-compose version >> diagnostic-report.txt
uname -a >> diagnostic-report.txt  # Linux/macOS
```

### 2. Check Documentation

- [Installation Guide](./INSTALLATION_GUIDE.md)
- [User Guide](./USER_GUIDE.md)
- [API Reference](./API_REFERENCE.md)
- [Architecture](./ARCHITECTURE.md)

### 3. Search Existing Issues

- [GitHub Issues](https://github.com/akilhassane/pantheon/issues)
- Search for your error message

### 4. Ask for Help

**GitHub Issues**:
- [Create new issue](https://github.com/akilhassane/pantheon/issues/new)
- Include diagnostic report and logs
- Describe steps to reproduce

**Discord**:
- Join our [Discord server](#) <!-- TODO: Add Discord link -->
- Ask in #support channel

**Email**:
- support@pantheon.ai
- Include diagnostic information

---

## Debug Mode

Enable debug mode for more detailed logs:

1. Edit `.env`:
   ```env
   DEBUG=true
   NODE_ENV=development
   ```

2. Restart services:
   ```bash
   docker-compose -f docker-compose.production.yml restart
   ```

3. View detailed logs:
   ```bash
   docker-compose -f docker-compose.production.yml logs -f
   ```

---

## Common Error Messages

### "ECONNREFUSED"

**Meaning**: Cannot connect to service

**Fix**: Check service is running and port is correct

### "EADDRINUSE"

**Meaning**: Port already in use

**Fix**: See [Port Already in Use](#issue-port-already-in-use)

### "ENOSPC"

**Meaning**: No disk space left

**Fix**: Free up disk space or increase Docker disk limit

### "ETIMEDOUT"

**Meaning**: Connection timeout

**Fix**: Check network connection and firewall

### "Invalid API key"

**Meaning**: AI provider API key is wrong

**Fix**: See [AI Provider API Key Invalid](#issue-ai-provider-api-key-invalid)

---

## Emergency Recovery

If everything is broken:

```bash
# Stop all containers
docker-compose -f docker-compose.production.yml down

# Remove all Pantheon data (⚠️ This deletes everything)
docker volume rm pantheon-data pantheon-windows-files pantheon-workspaces

# Remove images
docker rmi akilhassane/pantheon:frontend
docker rmi akilhassane/pantheon:backend
docker rmi akilhassane/pantheon:windows-tools-api

# Clean Docker system
docker system prune -a --volumes

# Reinstall
bash install-pantheon.sh
```

---

**Still need help? Contact us at support@pantheon.ai**

[⬆ Back to Top](#pantheon-troubleshooting-guide)
