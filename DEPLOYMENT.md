# Pantheon Deployment Guide

Complete guide for deploying Pantheon to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Building Images](#building-images)
3. [Pushing to DockerHub](#pushing-to-dockerhub)
4. [Deploying to Production](#deploying-to-production)
5. [GitHub Repository](#github-repository)
6. [Network Architecture](#network-architecture)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- 8GB+ RAM (16GB recommended)
- 50GB+ free disk space
- Git (for version control)
- DockerHub account (for image hosting)

### Required Accounts

1. **DockerHub**: https://hub.docker.com/signup
2. **GitHub**: https://github.com/signup
3. **AI Provider API Keys**:
   - OpenRouter: https://openrouter.ai/
   - Google Gemini: https://makersuite.google.com/app/apikey

## Building Images

### Step 1: Verify Setup

Run the verification script to ensure everything is ready:

**Windows:**
```powershell
.\verify-setup.ps1
```

**Linux/Mac:**
```bash
chmod +x verify-setup.sh
./verify-setup.sh
```

### Step 2: Build and Commit Images

This process commits the current running containers to Docker images:

**Windows:**
```powershell
.\build-and-push.ps1 -SkipPush
```

**Linux/Mac:**
```bash
chmod +x build-and-push.sh
./build-and-push.sh --skip-push
```

This will:
1. Commit `pantheon-backend` container → `akilhassane/pantheon-backend:latest`
2. Commit `pantheon-frontend` container → `akilhassane/pantheon-frontend:latest`
3. Commit `windows-tools-api` container → `akilhassane/pantheon-windows-tools-api:latest`
4. Tag `postgres:16-alpine` → `akilhassane/pantheon-postgres:latest`
5. Tag `quay.io/keycloak/keycloak:23.0` → `akilhassane/pantheon-keycloak:latest`

## Pushing to DockerHub

### Step 1: Login to DockerHub

```bash
docker login
```

Enter your DockerHub username and password.

### Step 2: Push Images

**Windows:**
```powershell
.\build-and-push.ps1
```

**Linux/Mac:**
```bash
./build-and-push.sh
```

This will push all images to DockerHub under `akilhassane/pantheon-*`.

### Verify Images

Check your images at: https://hub.docker.com/u/akilhassane

## Deploying to Production

### Step 1: Prepare Environment

1. Clone the repository:
```bash
git clone https://github.com/akilhassane/pantheon.git
cd pantheon
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Edit `.env` with your credentials:
```env
OPENROUTER_API_KEY=sk-or-v1-xxxxx
GEMINI_API_KEY=AIzaSyxxxxx
MCP_MASTER_SECRET=your-random-secret-key
POSTGRES_PASSWORD=secure-password
KEYCLOAK_ADMIN_PASSWORD=secure-password
```

### Step 2: Deploy

**Windows:**
```powershell
.\deploy.ps1
```

**Linux/Mac:**
```bash
chmod +x deploy.sh
./deploy.sh
```

### Step 3: Verify Deployment

Check service health:
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

All services should show "healthy" status.

### Step 4: Access Services

- Frontend: http://localhost:3000
- Backend: http://localhost:3002
- Keycloak: http://localhost:8080 (admin/admin)

## GitHub Repository

### Step 1: Initialize Git

If not already initialized:
```bash
git init
git remote add origin https://github.com/akilhassane/pantheon.git
```

### Step 2: Push to GitHub

**Windows:**
```powershell
.\git-push.ps1
```

**Linux/Mac:**
```bash
chmod +x git-push.sh
./git-push.sh
```

This will:
1. Add all files (respecting `.gitignore`)
2. Commit changes
3. Push to GitHub

### What Gets Committed

The `.gitignore` excludes:
- Test files (`test-*.js`, `*-test.*`)
- Log files (`*.log`, `*-logs.txt`)
- Temporary files (`temp-*`, `*.tmp`)
- VM files (`windows-vm-files/*/`)
- Screenshots and media
- Build artifacts
- Environment files (`.env`)
- Markdown files (except `README.md`)

## Network Architecture

### Main Network: `mcp-server_ai-network`

Subnet: `10.0.1.0/24`

| Service | IP | Aliases |
|---------|-------|---------|
| Backend | 10.0.1.2 | - |
| Keycloak | 10.0.1.3 | keycloak |
| PostgreSQL | 10.0.1.4 | postgres |
| Frontend | 10.0.1.5 | - |
| Windows Tools API | 10.0.1.6 | - |

### Project Networks

Each Windows project gets an isolated network:

**Network Name**: `project-{id}-network`  
**Subnet**: `172.30.x.0/24` (x varies per project)

| Component | IP | Description |
|-----------|-------|-------------|
| Windows Tools API | 172.30.x.1 | VM management |
| Windows VM | 172.30.x.2 | Windows 11 container |
| Backend | 172.30.x.3 | Multi-homed connection |
| Shared Folder | 172.30.x.20 | File sharing |

**Windows VM Access**:
- Shared folder: `http://172.30.0.1:8888` (via socat proxy)
- Tools API: `http://172.30.x.1:8090`

## Troubleshooting

### Images Not Found on DockerHub

**Problem**: `docker pull` fails with "not found"

**Solution**:
1. Verify images exist: https://hub.docker.com/u/akilhassane
2. Check image names match exactly
3. Ensure images are public (not private)

### Container Health Check Failing

**Problem**: Container shows "unhealthy" status

**Solution**:
```bash
# Check logs
docker logs <container-name>

# Restart container
docker restart <container-name>

# Check health endpoint
curl http://localhost:<port>/health
```

### Port Already in Use

**Problem**: "port is already allocated"

**Solution**:
1. Find process using port:
   ```bash
   # Windows
   netstat -ano | findstr :<port>
   
   # Linux/Mac
   lsof -i :<port>
   ```

2. Stop conflicting service or change port in `docker-compose.production.yml`

### Database Connection Failed

**Problem**: Backend can't connect to PostgreSQL

**Solution**:
1. Check PostgreSQL is healthy:
   ```bash
   docker inspect pantheon-postgres --format='{{.State.Health.Status}}'
   ```

2. Verify network connectivity:
   ```bash
   docker exec pantheon-backend ping -c 3 postgres
   ```

3. Check database credentials in `.env`

### Windows VM Not Accessible

**Problem**: Can't access Windows VM or shared folder

**Solution**:
1. Check Windows container is running:
   ```bash
   docker ps | grep windows-project
   ```

2. Verify socat proxy:
   ```bash
   docker exec windows-project-{id} ps aux | grep socat
   ```

3. Restart socat proxy:
   ```bash
   docker exec windows-project-{id} /usr/local/bin/start-socat-proxy.sh
   ```

### Clean Reinstall

If all else fails, perform a clean reinstall:

**Windows:**
```powershell
.\deploy.ps1 -CleanInstall
```

**Linux/Mac:**
```bash
./deploy.sh --clean
```

This removes all containers, volumes, and data, then reinstalls from scratch.

## Production Considerations

### Security

1. **Change Default Passwords**:
   - Keycloak admin password
   - PostgreSQL password
   - MCP master secret

2. **Use HTTPS**:
   - Set up reverse proxy (nginx/traefik)
   - Obtain SSL certificates (Let's Encrypt)

3. **Firewall Rules**:
   - Only expose necessary ports
   - Use Docker network isolation

### Scaling

1. **Database**:
   - Use external PostgreSQL for production
   - Enable connection pooling
   - Regular backups

2. **Backend**:
   - Run multiple backend instances
   - Use load balancer
   - Enable horizontal scaling

3. **Storage**:
   - Use external volume for `windows-vm-files`
   - Regular backups of project data

### Monitoring

1. **Logs**:
   ```bash
   docker-compose -f docker-compose.production.yml logs -f
   ```

2. **Health Checks**:
   ```bash
   curl http://localhost:3002/health
   curl http://localhost:8080/health/ready
   ```

3. **Resource Usage**:
   ```bash
   docker stats
   ```

## Support

- GitHub Issues: https://github.com/akilhassane/pantheon/issues
- Documentation: https://github.com/akilhassane/pantheon/wiki
- Email: support@pantheon.ai (if available)
