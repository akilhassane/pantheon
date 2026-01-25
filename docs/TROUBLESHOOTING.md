# Troubleshooting Guide

Common issues and solutions for Pantheon AI Platform.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Connection Issues](#connection-issues)
- [Docker Issues](#docker-issues)
- [AI Provider Issues](#ai-provider-issues)
- [Performance Issues](#performance-issues)
- [Project Issues](#project-issues)

## Installation Issues

### Docker Not Found

**Problem**: `docker: command not found`

**Solution**:
```bash
# Install Docker
# Linux (Ubuntu/Debian)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# macOS
brew install --cask docker

# Windows
# Download Docker Desktop from docker.com
```

### Permission Denied

**Problem**: `permission denied while trying to connect to the Docker daemon`

**Solution**:
```bash
# Linux - Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker ps
```

### Port Already in Use

**Problem**: `Error starting userland proxy: listen tcp 0.0.0.0:3000: bind: address already in use`

**Solution**:
```bash
# Find process using the port
# Linux/macOS
lsof -i :3000
kill -9 <PID>

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or change Pantheon's port in docker-compose.production.yml
```

### Out of Disk Space

**Problem**: `no space left on device`

**Solution**:
```bash
# Clean up Docker
docker system prune -a --volumes

# Check disk space
df -h

# Free up space on your system
```

## Connection Issues

### Cannot Access Frontend

**Problem**: `http://localhost:3000` not loading

**Solution**:
```bash
# 1. Check if containers are running
docker ps

# 2. Check frontend logs
docker-compose -f docker-compose.production.yml logs frontend

# 3. Restart frontend
docker-compose -f docker-compose.production.yml restart frontend

# 4. Check if port is accessible
curl http://localhost:3000
```

### Backend API Not Responding

**Problem**: API calls failing with connection errors

**Solution**:
```bash
# 1. Check backend status
docker-compose -f docker-compose.production.yml ps backend

# 2. View backend logs
docker-compose -f docker-compose.production.yml logs backend

# 3. Test backend health
curl http://localhost:3002/health

# 4. Restart backend
docker-compose -f docker-compose.production.yml restart backend
```

### WebSocket Connection Failed

**Problem**: Real-time updates not working

**Solution**:
1. Check browser console for WebSocket errors
2. Verify backend is running: `docker ps`
3. Check firewall settings
4. Try disabling browser extensions
5. Clear browser cache and cookies

### Supabase Connection Error

**Problem**: `Error connecting to Supabase`

**Solution**:
1. Verify credentials in `.env`:
```bash
cat .env | grep SUPABASE
```

2. Test Supabase connection:
```bash
curl https://your-project.supabase.co/rest/v1/
```

3. Check Supabase project status at supabase.com
4. Verify API keys haven't expired
5. Check internet connection

## Docker Issues

### Container Won't Start

**Problem**: Container exits immediately after starting

**Solution**:
```bash
# View container logs
docker logs <container_id>

# Check container status
docker inspect <container_id>

# Remove and recreate
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d
```

### Container Out of Memory

**Problem**: `OOMKilled` in container status

**Solution**:
```bash
# Increase Docker memory limit
# Docker Desktop: Settings → Resources → Memory

# Or modify docker-compose.production.yml
services:
  backend:
    mem_limit: 4g
```

### Image Pull Failed

**Problem**: `Error pulling image`

**Solution**:
```bash
# Check internet connection
ping docker.io

# Try pulling manually
docker pull akilhassane/pantheon-frontend:latest

# Clear Docker cache
docker system prune -a

# Retry installation
```

### Network Issues

**Problem**: Containers can't communicate

**Solution**:
```bash
# Recreate network
docker-compose -f docker-compose.production.yml down
docker network prune
docker-compose -f docker-compose.production.yml up -d

# Check network
docker network ls
docker network inspect pantheon_default
```

## AI Provider Issues

### OpenAI API Error

**Problem**: `Invalid API key` or `Rate limit exceeded`

**Solution**:
1. Verify API key in Settings
2. Check key at platform.openai.com/api-keys
3. Verify account has credits
4. Check rate limits
5. Try a different model

### Anthropic Claude Error

**Problem**: `Authentication failed`

**Solution**:
1. Verify API key format: `sk-ant-...`
2. Check key at console.anthropic.com
3. Ensure API access is enabled
4. Try Claude 3 Haiku (cheaper, faster)

### Google Gemini Error

**Problem**: `API key not valid`

**Solution**:
1. Get key from makersuite.google.com/app/apikey
2. Enable Generative AI API in Google Cloud Console
3. Check API quotas
4. Verify billing is enabled (if required)

### Model Not Responding

**Problem**: AI takes too long or doesn't respond

**Solution**:
1. Check backend logs for errors
2. Verify API key is valid
3. Try a different model
4. Check provider status page
5. Reduce message length
6. Check internet connection

## Performance Issues

### Slow Response Times

**Problem**: AI responses are very slow

**Solution**:
1. Use faster models (GPT-3.5, Claude Haiku)
2. Reduce context length
3. Check system resources:
```bash
docker stats
```
4. Increase Docker resources
5. Close unused projects

### High Memory Usage

**Problem**: System running out of memory

**Solution**:
```bash
# Check memory usage
docker stats

# Restart containers
docker-compose -f docker-compose.production.yml restart

# Increase system memory
# Or reduce number of concurrent projects
```

### High CPU Usage

**Problem**: CPU at 100%

**Solution**:
1. Check which container is using CPU:
```bash
docker stats
```
2. Limit CPU usage in docker-compose.production.yml:
```yaml
services:
  backend:
    cpus: '2.0'
```
3. Close unused projects
4. Restart containers

### Disk Space Issues

**Problem**: Running out of disk space

**Solution**:
```bash
# Check Docker disk usage
docker system df

# Clean up
docker system prune -a --volumes

# Remove old images
docker image prune -a

# Check project storage
du -sh /var/lib/docker
```

## Project Issues

### Project Won't Create

**Problem**: Error creating new project

**Solution**:
1. Check backend logs:
```bash
docker-compose -f docker-compose.production.yml logs backend
```
2. Verify Docker has resources available
3. Check disk space
4. Try restarting backend
5. Check Supabase connection

### Project Stuck in "Initializing"

**Problem**: Project never becomes active

**Solution**:
1. Check container logs
2. Verify Windows container is running
3. Restart the project
4. Delete and recreate project
5. Check Docker resources

### Can't Delete Project

**Problem**: Project deletion fails

**Solution**:
```bash
# Force remove container
docker rm -f <container_id>

# Clean up volumes
docker volume prune

# Restart backend
docker-compose -f docker-compose.production.yml restart backend
```

### Screenshot Not Working

**Problem**: Screenshots fail or show black screen

**Solution**:
1. Check Windows container is running
2. Verify VNC is accessible
3. Check Windows Tools API logs
4. Restart Windows container
5. Verify graphics drivers in container

## Database Issues

### Migration Failed

**Problem**: Database migration errors

**Solution**:
```bash
# Check Supabase logs
# Go to supabase.com → Your Project → Logs

# Verify connection
curl https://your-project.supabase.co/rest/v1/

# Reset database (WARNING: deletes data)
# Go to supabase.com → Your Project → Database → Reset
```

### Connection Pool Exhausted

**Problem**: `Too many connections`

**Solution**:
1. Restart backend to release connections
2. Increase connection pool size in backend config
3. Check for connection leaks in logs
4. Upgrade Supabase plan if needed

## Browser Issues

### UI Not Loading

**Problem**: Blank page or loading forever

**Solution**:
1. Clear browser cache
2. Try incognito/private mode
3. Try different browser
4. Check browser console for errors
5. Disable browser extensions

### WebSocket Disconnecting

**Problem**: Frequent disconnections

**Solution**:
1. Check network stability
2. Disable VPN/proxy
3. Check firewall settings
4. Try different browser
5. Check backend logs

## Getting More Help

### Enable Debug Logging

```bash
# Edit .env
DEBUG=true
LOG_LEVEL=debug

# Restart services
docker-compose -f docker-compose.production.yml restart
```

### Collect Diagnostic Information

```bash
# System info
docker version
docker-compose version

# Container status
docker ps -a

# Logs
docker-compose -f docker-compose.production.yml logs > pantheon-logs.txt

# Resource usage
docker stats --no-stream > pantheon-stats.txt
```

### Report an Issue

When reporting issues, include:
1. Operating system and version
2. Docker version
3. Error messages
4. Steps to reproduce
5. Relevant logs
6. Screenshots if applicable

Create an issue at: https://github.com/akilhassane/pantheon/issues

## Additional Resources

- [Installation Guide](./INSTALLATION_GUIDE.md)
- [User Guide](./USER_GUIDE.md)
- [API Reference](./API_REFERENCE.md)
- [Architecture](./ARCHITECTURE.md)

---

[← Back to README](../README.md)
