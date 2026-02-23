# Pantheon Quick Start Guide

Get Pantheon up and running in 5 minutes!

## Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- 8GB+ RAM
- 50GB+ free disk space

## Step 1: Clone Repository

```bash
git clone https://github.com/akilhassane/pantheon.git
cd pantheon
```

## Step 2: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your favorite editor
# Required fields:
#   - OPENROUTER_API_KEY
#   - GEMINI_API_KEY
#   - MCP_MASTER_SECRET (any random string)
```

### Example .env

```env
OPENROUTER_API_KEY=sk-or-v1-xxxxx
GEMINI_API_KEY=AIzaSyxxxxx
MCP_MASTER_SECRET=my-super-secret-key-12345
POSTGRES_PASSWORD=postgres
KEYCLOAK_ADMIN_PASSWORD=admin
```

## Step 3: Deploy

### Windows

```powershell
.\deploy.ps1
```

### Linux/Mac

```bash
chmod +x deploy.sh
./deploy.sh
```

## Step 4: Access Services

Wait 1-2 minutes for services to start, then access:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3002/health
- **Keycloak**: http://localhost:8080 (admin/admin)

## Step 5: Create Your First Project

1. Open http://localhost:3000
2. Click "Sign In" and create an account
3. Navigate to "Projects" → "New Project"
4. Select "Windows 11" and wait for initialization
5. Access your Windows VM!

## Troubleshooting

### Services Not Starting

```bash
# Check logs
docker-compose -f docker-compose.production.yml logs -f

# Restart services
docker-compose -f docker-compose.production.yml restart
```

### Port Already in Use

If ports 3000, 3002, 5432, or 8080 are in use:

1. Stop conflicting services
2. Or edit `docker-compose.production.yml` to use different ports

### Docker Not Running

- **Windows/Mac**: Start Docker Desktop
- **Linux**: `sudo systemctl start docker`

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Check [Architecture Documentation](docs/architecture.md) for system design
- Explore [API Documentation](docs/api.md) for backend endpoints

## Clean Uninstall

```bash
# Stop and remove everything
docker-compose -f docker-compose.production.yml down -v

# Remove images (optional)
docker rmi akilhassane/pantheon-backend:latest
docker rmi akilhassane/pantheon-frontend:latest
docker rmi akilhassane/pantheon-postgres:latest
docker rmi akilhassane/pantheon-keycloak:latest
docker rmi akilhassane/pantheon-windows-tools-api:latest
```

## Support

- GitHub Issues: https://github.com/akilhassane/pantheon/issues
- Documentation: https://github.com/akilhassane/pantheon/wiki
