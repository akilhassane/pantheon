# Installation Guide

Complete installation instructions for Pantheon AI Backend.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation Methods](#installation-methods)
- [Quick Installation](#quick-installation)
- [Manual Installation](#manual-installation)
- [Verification](#verification)
- [Post-Installation](#post-installation)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before installing Pantheon, ensure your system meets the requirements.

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 8GB | 16GB+ |
| Storage | 50GB free | 100GB+ SSD |
| OS | Windows 10, macOS 10.15, Ubuntu 20.04 | Latest versions |

### Software Requirements

1. **Docker**
   - Windows: [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
   - Mac: [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
   - Linux: [Docker Engine](https://docs.docker.com/engine/install/)

2. **Git**
   - Windows: [Git for Windows](https://git-scm.com/download/win)
   - Mac: `brew install git`
   - Linux: `sudo apt-get install git`

### Required API Keys

Obtain API keys before installation:

1. **OpenRouter** (Required)
   - Visit: [https://openrouter.ai](https://openrouter.ai)
   - Sign up and navigate to API Keys
   - Create new API key
   - Copy key (starts with `sk-or-v1-`)

2. **Google Gemini** (Required)
   - Visit: [https://makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
   - Sign in with Google account
   - Create API key
   - Copy key (starts with `AIzaSy`)

3. **OpenAI** (Optional)
   - Visit: [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Create API key
   - Copy key (starts with `sk-`)

4. **Anthropic** (Optional)
   - Visit: [https://console.anthropic.com](https://console.anthropic.com)
   - Navigate to API Keys
   - Create key
   - Copy key (starts with `sk-ant-`)

## Installation Methods

### Method 1: Quick Installation (Recommended)

Automated installation using deployment scripts.

**Time**: 5-10 minutes

[See Quick Installation](#quick-installation)

### Method 2: Manual Installation

Step-by-step manual installation for advanced users.

**Time**: 15-20 minutes

[See Manual Installation](#manual-installation)

### Method 3: Docker Compose

Direct Docker Compose deployment.

**Time**: 10-15 minutes

[See Docker Compose Installation](#docker-compose-installation)

## Quick Installation

### Step 1: Clone Repository

```bash
git clone https://github.com/akilhassane/pantheon.git
cd pantheon
```

### Step 2: Configure Environment

```bash
# Copy environment template
cp .env.example .env
```

Edit `.env` file with your API keys:

```env
# Required: AI Provider API Keys
OPENROUTER_API_KEY=sk-or-v1-your-key-here
GEMINI_API_KEY=AIzaSy-your-key-here

# Required: Security
MCP_MASTER_SECRET=generate-random-64-character-string-here

# Required: Database
POSTGRES_PASSWORD=choose-secure-password-here

# Optional: Additional AI Providers
OPENAI_API_KEY=sk-your-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Optional: Keycloak Admin
KEYCLOAK_ADMIN_PASSWORD=admin
```

### Step 3: Run Deployment Script

**Windows PowerShell:**
```powershell
.\deploy.ps1
```

**Linux/Mac:**
```bash
chmod +x deploy.sh
./deploy.sh
```

The script will:
1. Verify Docker is running
2. Check environment configuration
3. Pull Docker images from DockerHub
4. Create Docker networks
5. Start all services
6. Wait for health checks
7. Display service URLs

### Step 4: Verify Installation

```bash
# Check all services are running
docker ps

# Expected output: 5 containers running
# - pantheon-frontend
# - pantheon-backend
# - pantheon-postgres
# - pantheon-keycloak
# - windows-tools-api
```

Access services:
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend: [http://localhost:3002/health](http://localhost:3002/health)
- Keycloak: [http://localhost:8080](http://localhost:8080)

## Manual Installation

### Step 1: Clone Repository

```bash
git clone https://github.com/akilhassane/pantheon.git
cd pantheon
```

### Step 2: Create Environment File

```bash
cp .env.example .env
```

Edit `.env` with required values (see Quick Installation Step 2).

### Step 3: Create Docker Network

```bash
docker network create \
  --driver bridge \
  --subnet 10.0.1.0/24 \
  --gateway 10.0.1.1 \
  mcp-server_ai-network
```

### Step 4: Start PostgreSQL

```bash
docker run -d \
  --name pantheon-postgres \
  --network mcp-server_ai-network \
  --ip 10.0.1.4 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=${POSTGRES_PASSWORD} \
  -e POSTGRES_DB=ai_backend \
  -p 5432:5432 \
  -v pantheon-postgres-data:/var/lib/postgresql/data \
  --restart unless-stopped \
  akilhassane/pantheon-postgres:latest
```

### Step 5: Start Keycloak

```bash
docker run -d \
  --name pantheon-keycloak \
  --network mcp-server_ai-network \
  --ip 10.0.1.3 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=${KEYCLOAK_ADMIN_PASSWORD:-admin} \
  -e KC_DB=postgres \
  -e KC_DB_URL=jdbc:postgresql://postgres:5432/keycloak \
  -e KC_DB_USERNAME=postgres \
  -e KC_DB_PASSWORD=${POSTGRES_PASSWORD} \
  -p 8080:8080 \
  --restart unless-stopped \
  akilhassane/pantheon-keycloak:latest \
  start-dev
```

### Step 6: Start Backend

```bash
docker run -d \
  --name pantheon-backend \
  --network mcp-server_ai-network \
  --ip 10.0.1.2 \
  -e OPENROUTER_API_KEY=${OPENROUTER_API_KEY} \
  -e GEMINI_API_KEY=${GEMINI_API_KEY} \
  -e MCP_MASTER_SECRET=${MCP_MASTER_SECRET} \
  -e DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/ai_backend \
  -e KEYCLOAK_URL=http://keycloak:8080 \
  -p 3002:3002 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v pantheon-windows-files:/app/windows-vm-files \
  --restart unless-stopped \
  akilhassane/pantheon-backend:latest
```

### Step 7: Start Frontend

```bash
docker run -d \
  --name pantheon-frontend \
  --network mcp-server_ai-network \
  --ip 10.0.1.5 \
  -e NEXT_PUBLIC_API_URL=http://localhost:3002 \
  -e NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8080 \
  -p 3000:3000 \
  --restart unless-stopped \
  akilhassane/pantheon-frontend:latest
```

### Step 8: Start Windows Tools API

```bash
docker run -d \
  --name windows-tools-api \
  --network mcp-server_ai-network \
  --ip 10.0.1.6 \
  -e PORT=8090 \
  -e DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/ai_backend \
  -e MCP_MASTER_SECRET=${MCP_MASTER_SECRET} \
  -p 8090:8090 \
  --restart unless-stopped \
  akilhassane/pantheon-windows-tools-api:latest
```

## Docker Compose Installation

### Using Production Configuration

```bash
# Start all services
docker-compose -f docker-compose.production.yml up -d

# View logs
docker-compose -f docker-compose.production.yml logs -f

# Stop services
docker-compose -f docker-compose.production.yml stop

# Remove everything
docker-compose -f docker-compose.production.yml down -v
```

## Verification

### Check Service Health

```bash
# All containers
docker ps --format "table {{.Names}}\t{{.Status}}"

# Individual health checks
docker inspect pantheon-backend --format='{{.State.Health.Status}}'
docker inspect pantheon-postgres --format='{{.State.Health.Status}}'
docker inspect pantheon-frontend --format='{{.State.Health.Status}}'
```

Expected output: `healthy` for all services

### Test Service Endpoints

```bash
# Frontend
curl http://localhost:3000

# Backend health
curl http://localhost:3002/health

# Keycloak
curl http://localhost:8080/health/ready
```

### Check Logs

```bash
# All services
docker-compose -f docker-compose.production.yml logs

# Specific service
docker logs pantheon-backend

# Follow logs
docker logs -f pantheon-backend
```

## Post-Installation

### 1. Configure Keycloak

Follow the [Keycloak Setup Guide](KEYCLOAK_SETUP.md) to:
- Configure OAuth providers (Google, Microsoft)
- Set up user authentication
- Configure client applications

### 2. Configure AI Models

Follow the [Model Configuration Guide](MODEL_CONFIGURATION.md) to:
- Select default AI models
- Configure model parameters
- Add custom models

### 3. Create First Project

Follow the [Usage Guide](USAGE.md) to:
- Create your first Windows VM project
- Access the Windows environment
- Use AI agents

### 4. Security Hardening

For production deployments:

1. **Change Default Passwords**
   ```env
   POSTGRES_PASSWORD=strong-random-password
   KEYCLOAK_ADMIN_PASSWORD=strong-random-password
   ```

2. **Generate Secure Master Secret**
   ```bash
   # Linux/Mac
   openssl rand -hex 32
   
   # Windows PowerShell
   -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | % {[char]$_})
   ```

3. **Configure Firewall**
   - Only expose necessary ports
   - Use reverse proxy for HTTPS
   - Enable rate limiting

4. **Enable SSL/TLS**
   - Use Let's Encrypt certificates
   - Configure nginx/traefik reverse proxy
   - Update environment URLs to HTTPS

## Troubleshooting

### Docker Not Running

**Error**: `Cannot connect to the Docker daemon`

**Solution**:
```bash
# Windows/Mac: Start Docker Desktop
# Linux:
sudo systemctl start docker
sudo systemctl enable docker
```

### Port Already in Use

**Error**: `port is already allocated`

**Solution**:
```bash
# Find process using port
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Linux/Mac

# Stop conflicting service or change port in docker-compose.yml
```

### Image Pull Failed

**Error**: `Error response from daemon: pull access denied`

**Solution**:
```bash
# Login to DockerHub
docker login

# Retry deployment
./deploy.sh
```

### Database Connection Failed

**Error**: `getaddrinfo ENOTFOUND postgres`

**Solution**:
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check network
docker network inspect mcp-server_ai-network

# Restart backend
docker restart pantheon-backend
```

### Services Not Healthy

**Error**: Container shows `unhealthy` status

**Solution**:
```bash
# Check logs
docker logs pantheon-backend

# Check health endpoint
curl http://localhost:3002/health

# Restart service
docker restart pantheon-backend
```

For more troubleshooting, see [Troubleshooting Guide](TROUBLESHOOTING.md).

## Next Steps

- [Configure Keycloak](KEYCLOAK_SETUP.md)
- [Set up AI Models](MODEL_CONFIGURATION.md)
- [Create Your First Project](USAGE.md)
- [Read API Documentation](API.md)

## Support

- [GitHub Issues](https://github.com/akilhassane/pantheon/issues)
- [Documentation](https://github.com/akilhassane/pantheon/wiki)
- [Discussions](https://github.com/akilhassane/pantheon/discussions)
