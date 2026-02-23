# Pantheon AI Backend

A comprehensive AI-powered backend system with Windows VM integration, featuring multi-model AI support, OAuth authentication, and containerized deployment.

## Features

- **Multi-Model AI Support**: OpenRouter, Gemini, OpenAI, Anthropic
- **Windows VM Integration**: Automated Windows 11 VM management with MCP protocol
- **OAuth Authentication**: Keycloak-based authentication and authorization
- **PostgreSQL Database**: Persistent storage for users, projects, and AI interactions
- **Docker-based Deployment**: Fully containerized with static IP networking
- **Project Isolation**: Each Windows project runs in its own isolated network
- **Shared Folder Access**: Secure file sharing between host and Windows VMs

## Architecture

### Services

- **Frontend** (Port 3000): Next.js web application
- **Backend** (Port 3002): Node.js API service with Docker socket access
- **Keycloak** (Port 8080): OAuth/OIDC authentication server
- **PostgreSQL** (Port 5432): Primary database
- **Windows Tools API** (Port 8090): Windows VM management service

### Network Configuration

All services run on a dedicated network (`mcp-server_ai-network`) with static IPs:

- Backend: `10.0.1.2`
- Keycloak: `10.0.1.3`
- PostgreSQL: `10.0.1.4`
- Frontend: `10.0.1.5`
- Windows Tools API: `10.0.1.6`

Each Windows project gets its own isolated network (e.g., `project-{id}-network`) with subnet `172.30.x.0/24`.

## Quick Start

### Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- 8GB+ RAM recommended
- 50GB+ free disk space (for Windows VM images)

### Installation

#### Windows

```powershell
# Clone the repository
git clone https://github.com/akilhassane/pantheon.git
cd pantheon

# Copy environment file and configure
cp .env.example .env
# Edit .env with your API keys

# Deploy
.\deploy.ps1
```

#### Linux/Mac

```bash
# Clone the repository
git clone https://github.com/akilhassane/pantheon.git
cd pantheon

# Copy environment file and configure
cp .env.example .env
# Edit .env with your API keys

# Make scripts executable
chmod +x deploy.sh build-and-push.sh

# Deploy
./deploy.sh
```

### Configuration

Edit `.env` file with your credentials:

```env
# Required: AI Provider API Keys
OPENROUTER_API_KEY=your_openrouter_key
GEMINI_API_KEY=your_gemini_key

# Optional: Additional AI Providers
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Required: MCP Master Secret (generate a random string)
MCP_MASTER_SECRET=your_random_secret_key

# Optional: Database Password (defaults to 'postgres')
POSTGRES_PASSWORD=postgres

# Optional: Keycloak Admin Password (defaults to 'admin')
KEYCLOAK_ADMIN_PASSWORD=admin
```

### Access

After deployment:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3002
- **Keycloak Admin**: http://localhost:8080 (admin/admin)
- **PostgreSQL**: localhost:5432

## Development

### Building Images

To build and push images to DockerHub:

#### Windows
```powershell
.\build-and-push.ps1
```

#### Linux/Mac
```bash
./build-and-push.sh
```

### Project Structure

```
pantheon/
├── backend/              # Backend API service
│   ├── config/          # Configuration files
│   ├── database/        # Database migrations
│   └── Dockerfile       # Backend container image
├── frontend/            # Next.js frontend
│   └── Dockerfile       # Frontend container image
├── docker/              # Docker utilities
│   └── windows-tools-api/  # Windows VM management
├── windows-vm-files/    # Windows project files
├── docker-compose.yml   # Development compose file
├── docker-compose.production.yml  # Production compose file
├── deploy.ps1          # Windows deployment script
├── deploy.sh           # Linux/Mac deployment script
├── build-and-push.ps1  # Windows build script
└── build-and-push.sh   # Linux/Mac build script
```

### Useful Commands

```bash
# View logs
docker-compose -f docker-compose.production.yml logs -f

# View specific service logs
docker-compose -f docker-compose.production.yml logs -f backend

# Restart services
docker-compose -f docker-compose.production.yml restart

# Stop services
docker-compose -f docker-compose.production.yml stop

# Remove everything (including volumes)
docker-compose -f docker-compose.production.yml down -v

# Check service health
docker ps --format "table {{.Names}}\t{{.Status}}"
```

## Windows VM Projects

### Creating a Windows Project

1. Log in to the frontend at http://localhost:3000
2. Navigate to "Projects" → "Create New Project"
3. Select "Windows 11" as the project type
4. Wait for the VM to initialize (2-5 minutes)

### Project Network Isolation

Each Windows project runs in its own isolated Docker network:

- **Windows VM**: `172.30.x.2` (where x is project-specific)
- **Windows Tools API**: `172.30.x.1`
- **Shared Folder**: `172.30.x.20`
- **Backend**: `172.30.x.3` (multi-homed)

The Windows VM can access:
- Shared folder at `http://172.30.0.1:8888` (via socat proxy)
- Tools API at `http://172.30.x.1:8090`

### Shared Folder Access

Files are shared between host and Windows VM via nginx container:

- Host path: `./windows-vm-files/{project-id}/`
- Windows VM access: `http://172.30.0.1:8888/`
- Contains `.env` file with MCP configuration

## Database Schema

### Main Tables

- `users`: User accounts and profiles
- `projects`: Windows VM projects
- `chat_messages`: AI conversation history
- `model_usage`: AI model usage tracking
- `user_api_keys`: User-specific API keys
- `user_settings`: User preferences and custom modes

### Migrations

Database migrations are located in `backend/database/migrations/` and are automatically applied on startup.

## Security

- **Network Isolation**: Each project runs in isolated Docker network
- **No Host Port Binding**: Shared folders only accessible within project network
- **OAuth Authentication**: Keycloak-based user authentication
- **API Key Encryption**: User API keys encrypted in database
- **Row-Level Security**: PostgreSQL RLS policies enforce data isolation

## Troubleshooting

### Services Not Starting

```bash
# Check Docker is running
docker info

# Check service logs
docker-compose -f docker-compose.production.yml logs

# Restart services
docker-compose -f docker-compose.production.yml restart
```

### Database Connection Issues

```bash
# Check PostgreSQL is healthy
docker inspect pantheon-postgres --format='{{.State.Health.Status}}'

# Check database logs
docker logs pantheon-postgres

# Verify network connectivity
docker exec pantheon-backend ping -c 3 postgres
```

### Windows VM Not Accessible

```bash
# Check Windows container is running
docker ps | grep windows-project

# Check socat proxy is running
docker exec windows-project-{id} ps aux | grep socat

# Restart socat proxy
docker exec windows-project-{id} /usr/local/bin/start-socat-proxy.sh
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
- GitHub Issues: https://github.com/akilhassane/pantheon/issues
- Documentation: https://github.com/akilhassane/pantheon/wiki

## Acknowledgments

- OpenRouter for multi-model AI access
- Keycloak for authentication
- Docker for containerization
- PostgreSQL for database
- Next.js for frontend framework
