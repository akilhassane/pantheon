# Troubleshooting Guide

Common issues and solutions for Pantheon.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Docker Issues](#docker-issues)
- [Authentication Issues](#authentication-issues)
- [Project Issues](#project-issues)
- [Windows VM Issues](#windows-vm-issues)
- [AI Model Issues](#ai-model-issues)
- [Network Issues](#network-issues)
- [Database Issues](#database-issues)
- [Performance Issues](#performance-issues)

## Installation Issues

### Docker Not Running

**Symptoms:**
- Error: "Cannot connect to the Docker daemon"
- Deployment script fails immediately

**Solutions:**

Windows:
```powershell
# Start Docker Desktop
# Check if running
docker ps
```

Linux:
```bash
# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Verify
docker ps
```

Mac:
```bash
# Start Docker Desktop from Applications
# Verify
docker ps
```

### Port Already in Use

**Symptoms:**
- Error: "port is already allocated"
- Service fails to start

**Solutions:**

Find process using port:
```bash
# Windows
netstat -ano | findstr :3000

# Linux/Mac
lsof -i :3000
```

Stop conflicting service or change port in `docker-compose.production.yml`.

### Image Pull Failed

**Symptoms:**
- Error: "pull access denied"
- Error: "manifest unknown"

**Solutions:**

```bash
# Login to DockerHub
docker login

# Verify images exist
docker pull akilhassane/pantheon-backend:latest

# Retry deployment
./deploy.sh
```

### Environment Variables Missing

**Symptoms:**
- Error: "OPENROUTER_API_KEY is required"
- Services fail health checks

**Solutions:**

1. Verify `.env` file exists
2. Check all required variables:
   ```env
   OPENROUTER_API_KEY=sk-or-v1-...
   GEMINI_API_KEY=AIzaSy...
   MCP_MASTER_SECRET=...
   POSTGRES_PASSWORD=...
   ```
3. Restart services:
   ```bash
   docker-compose -f docker-compose.production.yml restart
   ```

## Docker Issues

### Container Keeps Restarting

**Symptoms:**
- Container status shows "Restarting"
- Service unavailable

**Solutions:**

Check logs:
```bash
docker logs pantheon-backend
docker logs pantheon-postgres
docker logs pantheon-keycloak
```

Common causes:
1. Database connection failed
2. Invalid environment variables
3. Port conflict
4. Insufficient resources

### Container Unhealthy

**Symptoms:**
- Health check fails
- Service shows "unhealthy" status

**Solutions:**

```bash
# Check health status
docker inspect pantheon-backend --format='{{.State.Health.Status}}'

# View health check logs
docker inspect pantheon-backend --format='{{range .State.Health.Log}}{{.Output}}{{end}}'

# Restart container
docker restart pantheon-backend
```

### Out of Disk Space

**Symptoms:**
- Error: "no space left on device"
- Containers fail to start

**Solutions:**

```bash
# Check disk usage
docker system df

# Clean up unused resources
docker system prune -a

# Remove old volumes
docker volume prune

# Remove old images
docker image prune -a
```

## Authentication Issues

### Cannot Login

**Symptoms:**
- OAuth redirect fails
- "Invalid redirect URI" error

**Solutions:**

1. Verify Keycloak is running:
   ```bash
   docker logs pantheon-keycloak
   curl http://localhost:8080/health/ready
   ```

2. Check OAuth provider configuration in Keycloak
3. Verify redirect URIs match:
   - Google: `http://localhost:8080/realms/master/broker/google/endpoint`
   - Microsoft: `http://localhost:8080/realms/master/broker/microsoft/endpoint`

For detailed OAuth setup, see [Keycloak Setup Guide](KEYCLOAK_SETUP.md).

### Token Expired

**Symptoms:**
- Error: "Token expired"
- Forced logout

**Solutions:**

1. Refresh page to get new token
2. Check token lifespan in Keycloak:
   - Navigate to Realm Settings → Tokens
   - Increase "Access Token Lifespan" if needed
3. Verify system time is synchronized

### User Not Created in Database

**Symptoms:**
- Login successful but user not in database
- Features not working

**Solutions:**

```bash
# Check backend logs
docker logs pantheon-backend | grep "user creation"

# Verify database connection
docker exec pantheon-backend node -e "require('./config/postgres-client').query('SELECT 1')"

# Check user mappers in Keycloak
# Navigate to Identity Providers → Google → Mappers
```

## Project Issues

### Project Creation Fails

**Symptoms:**
- Error during project creation
- Project stuck in "provisioning" status

**Solutions:**

```bash
# Check backend logs
docker logs pantheon-backend

# Verify Docker socket access
docker exec pantheon-backend ls -la /var/run/docker.sock

# Check available resources
docker info | grep -E "CPUs|Memory"

# Retry project creation
```

### Cannot Access Project

**Symptoms:**
- Project not loading
- 404 error

**Solutions:**

1. Verify project exists:
   ```bash
   # Check database
   docker exec pantheon-postgres psql -U postgres -d ai_backend -c "SELECT id, name, status FROM projects;"
   ```

2. Check project network:
   ```bash
   docker network ls | grep project
   docker network inspect project-{id}-network
   ```

3. Verify containers running:
   ```bash
   docker ps | grep project
   ```

### Project Deletion Fails

**Symptoms:**
- Error deleting project
- Resources not cleaned up

**Solutions:**

```bash
# Manual cleanup
docker stop windows-vm-{id}
docker rm windows-vm-{id}
docker network rm project-{id}-network
docker volume rm project-{id}-shared

# Check for orphaned resources
docker ps -a | grep {id}
docker network ls | grep {id}
docker volume ls | grep {id}
```

## Windows VM Issues

### Cannot Connect to VM

**Symptoms:**
- RDP connection fails
- VM not accessible

**Solutions:**

1. Check VM status:
   ```bash
   docker ps | grep windows-vm
   docker logs windows-vm-{id}
   ```

2. Verify VM IP:
   ```bash
   docker inspect windows-vm-{id} | grep IPAddress
   ```

3. Test connectivity:
   ```bash
   docker exec pantheon-backend ping 172.30.x.2
   ```

4. Restart VM:
   ```bash
   docker restart windows-vm-{id}
   ```

### Shared Folder Not Accessible

**Symptoms:**
- Cannot access `\\172.30.x.1:8888\shared`
- Files not syncing

**Solutions:**

1. Check shared folder container:
   ```bash
   docker ps | grep shared-folder
   docker logs shared-folder-{id}
   ```

2. Verify nginx is running:
   ```bash
   docker exec shared-folder-{id} ps aux | grep nginx
   ```

3. Test from Windows VM:
   ```powershell
   # In Windows VM
   Test-NetConnection -ComputerName 172.30.x.3 -Port 8888
   ```

4. Restart shared folder:
   ```bash
   docker restart shared-folder-{id}
   ```

### VM Performance Issues

**Symptoms:**
- Slow response
- High CPU usage
- Memory issues

**Solutions:**

1. Check resource usage:
   ```bash
   docker stats windows-vm-{id}
   ```

2. Increase resources in project settings
3. Stop unused projects
4. Restart VM:
   ```bash
   docker restart windows-vm-{id}
   ```

## AI Model Issues

### Model Not Responding

**Symptoms:**
- No response from AI
- Timeout errors

**Solutions:**

1. Check API key validity:
   ```bash
   # Test OpenRouter
   curl https://openrouter.ai/api/v1/models \
     -H "Authorization: Bearer $OPENROUTER_API_KEY"
   ```

2. Verify model selection in settings
3. Check usage limits on provider dashboard
4. Try different model
5. Check backend logs:
   ```bash
   docker logs pantheon-backend | grep "AI request"
   ```

For model configuration, see [Model Configuration Guide](MODEL_CONFIGURATION.md).

### High Latency

**Symptoms:**
- Slow AI responses
- Long wait times

**Solutions:**

1. Use faster model (GPT-3.5 instead of GPT-4)
2. Reduce max_tokens parameter
3. Check network connection
4. Try different provider
5. Monitor provider status pages

### Rate Limit Exceeded

**Symptoms:**
- Error: "Rate limit exceeded"
- 429 HTTP status

**Solutions:**

1. Check provider rate limits
2. Implement request queuing
3. Upgrade provider plan
4. Use multiple API keys
5. Reduce request frequency

### Unexpected Responses

**Symptoms:**
- Poor quality responses
- Incorrect information
- Inconsistent behavior

**Solutions:**

1. Adjust temperature (lower for consistency)
2. Improve prompt engineering
3. Try different model
4. Check model parameters
5. Review chat history for context issues

## Network Issues

### Cannot Connect to Backend

**Symptoms:**
- Frontend cannot reach backend
- API requests fail

**Solutions:**

1. Verify backend is running:
   ```bash
   docker ps | grep pantheon-backend
   curl http://localhost:3002/health
   ```

2. Check network configuration:
   ```bash
   docker network inspect mcp-server_ai-network
   ```

3. Verify IP addresses:
   ```bash
   docker inspect pantheon-backend | grep IPAddress
   docker inspect pantheon-frontend | grep IPAddress
   ```

4. Restart services:
   ```bash
   docker restart pantheon-backend pantheon-frontend
   ```

For network architecture details, see [Network Architecture](NETWORK.md).

### DNS Resolution Fails

**Symptoms:**
- Error: "getaddrinfo ENOTFOUND postgres"
- Services cannot find each other

**Solutions:**

```bash
# Test DNS from backend
docker exec pantheon-backend nslookup postgres
docker exec pantheon-backend nslookup keycloak

# Check network aliases
docker network inspect mcp-server_ai-network | grep Aliases

# Restart Docker daemon (last resort)
sudo systemctl restart docker
```

### Project Network Isolation Issues

**Symptoms:**
- Projects can access each other
- Network leakage

**Solutions:**

1. Verify network isolation:
   ```bash
   # From project 1 VM, should NOT reach project 2
   docker exec windows-vm-1 ping 172.30.2.2
   ```

2. Check network configuration:
   ```bash
   docker network inspect project-1-network
   docker network inspect project-2-network
   ```

3. Recreate networks if needed

## Database Issues

### Connection Failed

**Symptoms:**
- Error: "Connection refused"
- Services cannot connect to database

**Solutions:**

1. Check PostgreSQL is running:
   ```bash
   docker ps | grep pantheon-postgres
   docker logs pantheon-postgres
   ```

2. Test connection:
   ```bash
   docker exec pantheon-postgres psql -U postgres -c "SELECT 1"
   ```

3. Verify credentials in `.env`
4. Check network connectivity:
   ```bash
   docker exec pantheon-backend ping postgres
   ```

5. Restart PostgreSQL:
   ```bash
   docker restart pantheon-postgres
   ```

### Migration Failed

**Symptoms:**
- Database schema outdated
- Features not working

**Solutions:**

```bash
# Check migration status
docker exec pantheon-postgres psql -U postgres -d ai_backend -c "SELECT * FROM schema_migrations;"

# Run migrations manually
docker exec pantheon-backend node database/apply-migration.js

# Check logs
docker logs pantheon-backend | grep migration
```

### Data Loss

**Symptoms:**
- Projects disappeared
- User data missing

**Solutions:**

1. Check volume exists:
   ```bash
   docker volume ls | grep pantheon-postgres-data
   ```

2. Verify volume mount:
   ```bash
   docker inspect pantheon-postgres | grep Mounts -A 10
   ```

3. Restore from backup if available
4. Check database logs:
   ```bash
   docker logs pantheon-postgres
   ```

## Performance Issues

### High CPU Usage

**Symptoms:**
- System slow
- High CPU in Task Manager/top

**Solutions:**

```bash
# Check container resource usage
docker stats

# Identify problematic container
# Restart if needed
docker restart {container-name}

# Limit resources in docker-compose.yml
```

### High Memory Usage

**Symptoms:**
- System running out of memory
- Containers being killed

**Solutions:**

```bash
# Check memory usage
docker stats

# Clean up unused resources
docker system prune -a

# Increase Docker memory limit (Docker Desktop)
# Settings → Resources → Memory

# Stop unused projects
```

### Slow Response Times

**Symptoms:**
- UI sluggish
- API requests slow

**Solutions:**

1. Check backend logs for errors
2. Monitor database performance
3. Verify network connectivity
4. Check disk I/O
5. Restart services:
   ```bash
   docker-compose -f docker-compose.production.yml restart
   ```

## Getting Help

If issues persist:

1. **Collect Information:**
   ```bash
   # System info
   docker version
   docker-compose version
   
   # Container status
   docker ps -a
   
   # Logs
   docker logs pantheon-backend > backend.log
   docker logs pantheon-postgres > postgres.log
   docker logs pantheon-keycloak > keycloak.log
   ```

2. **Check Documentation:**
   - [Installation Guide](INSTALLATION.md)
   - [Usage Guide](USAGE.md)
   - [Network Architecture](NETWORK.md)
   - [API Documentation](API.md)

3. **Community Support:**
   - [GitHub Issues](https://github.com/akilhassane/pantheon/issues)
   - [Discussions](https://github.com/akilhassane/pantheon/discussions)

4. **Report Bug:**
   - Include system information
   - Provide steps to reproduce
   - Attach relevant logs
   - Describe expected vs actual behavior

[Back to README](../README.md)
