# Pantheon AI Platform - Installation Guide

## Quick Start (Recommended)

### One-Line Installation

#### Linux/macOS
```bash
curl -fsSL https://raw.githubusercontent.com/akilhassane/pantheon/main/install-pantheon.sh | bash
```

#### Windows (PowerShell - Run as Administrator)
```powershell
irm https://raw.githubusercontent.com/akilhassane/pantheon/main/install-pantheon.ps1 | iex
```

That's it! The script will:
1. ✅ Check prerequisites (Docker, Docker Compose)
2. ✅ Download configuration files
3. ✅ Pull all Docker images from Docker Hub
4. ✅ Create default environment configuration
5. ✅ Start all services
6. ✅ Wait for services to be ready
7. ✅ Display access URLs

## Manual Installation

If you prefer to install manually:

### Step 1: Download Files

```bash
# Download docker-compose file
curl -O https://raw.githubusercontent.com/akilhassane/pantheon/main/docker-compose.production.yml

# Download installation script (optional)
curl -O https://raw.githubusercontent.com/akilhassane/pantheon/main/install-pantheon.sh
chmod +x install-pantheon.sh
```

### Step 2: Create Environment File

Create a `.env` file:

```bash
cat > .env << 'EOF'
# Supabase Configuration (Optional)
SUPABASE_URL=http://localhost:5432
SUPABASE_SERVICE_ROLE_KEY=default-service-key
SUPABASE_ANON_KEY=default-anon-key
NEXT_PUBLIC_SUPABASE_URL=http://localhost:5432
NEXT_PUBLIC_SUPABASE_ANON_KEY=default-anon-key

# AI Provider API Keys (Add your keys)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
OPENROUTER_API_KEY=
GEMINI_API_KEY=

# MCP Configuration
MCP_MASTER_SECRET=default-master-secret

# Server Configuration
DEBUG=false
EOF
```

### Step 3: Pull Images and Start

```bash
# Pull all images
docker compose -f docker-compose.production.yml pull

# Start all services
docker compose -f docker-compose.production.yml up -d

# Check status
docker compose -f docker-compose.production.yml ps
```

### Step 4: Access the Platform

Open your browser and navigate to:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3002
- **Keycloak**: http://localhost:8080

## Prerequisites

### Required
- **Docker**: 20.10 or higher
- **Docker Compose**: 2.0 or higher
- **Disk Space**: 10GB free space
- **RAM**: 4GB minimum (8GB recommended)
- **Internet**: For pulling Docker images

### Installation Links
- Docker Desktop: https://docs.docker.com/get-docker/
- Docker Compose: https://docs.docker.com/compose/install/

## Docker Images

All images are hosted on Docker Hub under `akilhassane/pantheon`:

| Image | Description | Size |
|-------|-------------|------|
| `akilhassane/pantheon:frontend` | Next.js web application | ~235MB |
| `akilhassane/pantheon:backend` | Node.js API server | ~276MB |
| `akilhassane/pantheon:postgres` | PostgreSQL database | ~240MB |
| `akilhassane/pantheon:keycloak` | Authentication server | ~650MB |
| `akilhassane/pantheon:windows-tools-api` | Windows automation tools | ~180MB |

**Total**: ~1.6GB

## Configuration

### Adding AI Provider API Keys

Edit the `.env` file and add your API keys:

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-...

# OpenRouter (supports multiple models)
OPENROUTER_API_KEY=sk-or-v1-...

# Google Gemini
GEMINI_API_KEY=...
```

After adding keys, restart the services:

```bash
docker compose -f docker-compose.production.yml restart
```

### Customizing Ports

Edit `docker-compose.production.yml` to change ports:

```yaml
services:
  frontend:
    ports:
      - "3000:3000"  # Change first number to desired port
  
  backend:
    ports:
      - "3002:3002"  # Change first number to desired port
```

## Useful Commands

### View Logs
```bash
# All services
docker compose -f docker-compose.production.yml logs -f

# Specific service
docker compose -f docker-compose.production.yml logs -f backend
```

### Stop Services
```bash
docker compose -f docker-compose.production.yml stop
```

### Start Services
```bash
docker compose -f docker-compose.production.yml start
```

### Restart Services
```bash
docker compose -f docker-compose.production.yml restart
```

### Remove Everything
```bash
# Remove containers (keeps data)
docker compose -f docker-compose.production.yml down

# Remove containers and data
docker compose -f docker-compose.production.yml down -v
```

### Update to Latest Version
```bash
# Pull latest images
docker compose -f docker-compose.production.yml pull

# Restart with new images
docker compose -f docker-compose.production.yml up -d
```

## Troubleshooting

### Port Already in Use

If you get "port already in use" errors:

```bash
# Check what's using the port
# Linux/macOS
lsof -i :3000

# Windows
netstat -ano | findstr :3000

# Change the port in docker-compose.production.yml
```

### Docker Daemon Not Running

**Linux/macOS**:
```bash
sudo systemctl start docker
```

**Windows**:
- Start Docker Desktop from Start Menu

### Permission Denied (Linux)

Add your user to the docker group:
```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Services Not Starting

Check logs for errors:
```bash
docker compose -f docker-compose.production.yml logs
```

### Out of Disk Space

Clean up Docker:
```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything unused
docker system prune -a --volumes
```

## Uninstallation

To completely remove Pantheon:

```bash
# Stop and remove containers
docker compose -f docker-compose.production.yml down -v

# Remove images
docker rmi akilhassane/pantheon:frontend
docker rmi akilhassane/pantheon:backend
docker rmi akilhassane/pantheon:postgres
docker rmi akilhassane/pantheon:keycloak
docker rmi akilhassane/pantheon:windows-tools-api

# Remove configuration files
rm docker-compose.production.yml .env
```

## Support

- **Documentation**: https://github.com/akilhassane/pantheon
- **Issues**: https://github.com/akilhassane/pantheon/issues
- **Discussions**: https://github.com/akilhassane/pantheon/discussions

## Next Steps

After installation:

1. **Add API Keys**: Edit `.env` and add your AI provider API keys
2. **Create Project**: Open http://localhost:3000 and create your first project
3. **Explore Features**: Try the Windows automation capabilities
4. **Read Documentation**: Check the GitHub repository for detailed guides

## Security Notes

- Default credentials are used for local development
- Change default passwords in production environments
- Keep your API keys secure and never commit them to version control
- Use environment variables for sensitive configuration

## License

MIT License - See LICENSE file for details
