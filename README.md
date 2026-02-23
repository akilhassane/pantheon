# Pantheon AI Backend

Enterprise-grade AI backend system with Windows VM integration, multi-model AI support, and OAuth authentication.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Keycloak Setup](#keycloak-setup)
  - [Model Configuration](#model-configuration)
- [Deployment](#deployment)
- [Usage Guide](#usage-guide)
- [API Documentation](#api-documentation)
- [Network Architecture](#network-architecture)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Overview

Pantheon is a comprehensive AI backend platform that provides:

- Multi-model AI integration (OpenRouter, Gemini, OpenAI, Anthropic)
- Windows 11 VM management with MCP protocol
- OAuth 2.0 authentication via Keycloak
- PostgreSQL database with row-level security
- Docker-based deployment with network isolation
- Project-based resource management

## Features

### Core Capabilities

- **Multi-Model AI Support**: Integrate with multiple AI providers through a unified API
- **Windows VM Management**: Create and manage Windows 11 virtual machines for AI agents
- **Authentication**: Enterprise-grade OAuth 2.0 with Keycloak
- **Database**: PostgreSQL with automatic migrations and RLS policies
- **Network Isolation**: Each project runs in its own isolated Docker network
- **File Sharing**: Secure shared folders between host and Windows VMs
- **API Management**: User-specific API keys with usage tracking

### Technical Features

- Docker containerization with health checks
- Static IP addressing for reliable networking
- Multi-homed containers for cross-network communication
- Automatic database migrations
- Real-time collaboration support
- Comprehensive audit logging

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Main Network (10.0.1.0/24)              │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Frontend │  │ Backend  │  │ Keycloak │  │ Postgres │  │
│  │ :3000    │  │ :3002    │  │ :8080    │  │ :5432    │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Multi-homed
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Project Network (172.30.x.0/24)                │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Windows  │  │  Shared  │  │  Tools   │  │ Backend  │  │
│  │   VM     │  │  Folder  │  │   API    │  │(bridge)  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Network Configuration

**Main Network**: `mcp-server_ai-network` (10.0.1.0/24)
- Frontend: 10.0.1.5
- Backend: 10.0.1.2
- Keycloak: 10.0.1.3
- PostgreSQL: 10.0.1.4
- Windows Tools API: 10.0.1.6

**Project Networks**: `project-{id}-network` (172.30.x.0/24)
- Windows VM: 172.30.x.2
- Shared Folder: 172.30.x.20
- Tools API: 172.30.x.1 (multi-homed)
- Backend: 172.30.x.3 (multi-homed)

## Prerequisites

### System Requirements

- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- 8GB RAM minimum (16GB recommended)
- 50GB free disk space
- Git

### Required Accounts

- [DockerHub](https://hub.docker.com) account (for pulling images)
- [OpenRouter](https://openrouter.ai) API key
- [Google AI Studio](https://makersuite.google.com/app/apikey) API key (Gemini)
- Optional: OpenAI, Anthropic API keys

## Installation

### Quick Start

```bash
# Clone repository
git clone https://github.com/akilhassane/pantheon.git
cd pantheon

# Copy environment template
cp .env.example .env

# Edit .env with your API keys
nano .env  # or use your preferred editor

# Deploy
./deploy.sh  # Linux/Mac
# or
.\deploy.ps1  # Windows
```

### Manual Installation

1. **Clone Repository**
   ```bash
   git clone https://github.com/akilhassane/pantheon.git
   cd pantheon
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   ```

3. **Edit Configuration**
   
   Required variables in `.env`:
   ```env
   OPENROUTER_API_KEY=your_openrouter_key
   GEMINI_API_KEY=your_gemini_key
   MCP_MASTER_SECRET=your_random_secret_key
   POSTGRES_PASSWORD=secure_password
   ```

4. **Start Services**
   ```bash
   docker-compose -f docker-compose.production.yml up -d
   ```

5. **Verify Deployment**
   ```bash
   docker ps
   ```

## Configuration

### Environment Variables

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | OpenRouter API key | `sk-or-v1-...` |
| `GEMINI_API_KEY` | Google Gemini API key | `AIzaSy...` |
| `MCP_MASTER_SECRET` | Master encryption key | Random 32+ char string |

#### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | - |
| `ANTHROPIC_API_KEY` | Anthropic API key | - |
| `POSTGRES_PASSWORD` | Database password | `postgres` |
| `KEYCLOAK_ADMIN_PASSWORD` | Keycloak admin password | `admin` |

### Keycloak Setup

#### Initial Configuration

1. **Access Keycloak Admin Console**
   - URL: http://localhost:8080
   - Username: `admin`
   - Password: `admin` (or value from `KEYCLOAK_ADMIN_PASSWORD`)

2. **Configure Realm**
   - Realm: `master` (default)
   - Client ID: `pantheon-frontend`
   - Client Protocol: `openid-connect`

3. **Configure OAuth Providers**

   **Google OAuth**:
   - Navigate to: Identity Providers → Add provider → Google
   - Client ID: From [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Client Secret: From Google Cloud Console
   - Redirect URI: `http://localhost:8080/realms/master/broker/google/endpoint`

   **Microsoft OAuth**:
   - Navigate to: Identity Providers → Add provider → Microsoft
   - Application ID: From [Azure Portal](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps)
   - Client Secret: From Azure Portal
   - Redirect URI: `http://localhost:8080/realms/master/broker/microsoft/endpoint`

4. **Configure Client Scopes**
   - Add `email`, `profile`, `openid` scopes
   - Enable user attribute mappers

#### User Management

- Users are automatically created on first login via OAuth
- User profiles include: email, name, picture
- Session management: 30-minute idle timeout, 10-hour max session

### Model Configuration

#### Available Models

The system supports multiple AI providers:

1. **OpenRouter** (Primary)
   - Access to 100+ models
   - Unified API interface
   - Usage tracking included

2. **Google Gemini**
   - Gemini Pro
   - Gemini Pro Vision
   - Direct API access

3. **OpenAI** (Optional)
   - GPT-4, GPT-3.5
   - Requires separate API key

4. **Anthropic** (Optional)
   - Claude 3 family
   - Requires separate API key

#### Model Selection

Users can select models through:

1. **Frontend UI**
   - Navigate to Settings → Models
   - Select preferred model
   - Configure model parameters

2. **API**
   ```bash
   POST /api/user/settings
   {
     "preferred_model": "openai/gpt-4",
     "model_parameters": {
       "temperature": 0.7,
       "max_tokens": 2000
     }
   }
   ```

#### Custom Models

Add custom models by:

1. Navigate to Settings → Custom Models
2. Click "Add Model"
3. Configure:
   - Model ID
   - Provider
   - API endpoint
   - Parameters

## Deployment

### Production Deployment

1. **Update Environment**
   ```bash
   # Use strong passwords
   POSTGRES_PASSWORD=<strong-password>
   KEYCLOAK_ADMIN_PASSWORD=<strong-password>
   MCP_MASTER_SECRET=<random-64-char-string>
   ```

2. **Deploy Services**
   ```bash
   docker-compose -f docker-compose.production.yml up -d
   ```

3. **Verify Health**
   ```bash
   # Check all services are healthy
   docker ps --format "table {{.Names}}\t{{.Status}}"
   
   # Check logs
   docker-compose -f docker-compose.production.yml logs -f
   ```

4. **Configure Firewall**
   - Expose only necessary ports: 3000, 3002, 8080
   - Use reverse proxy (nginx/traefik) for HTTPS
   - Enable rate limiting

### Scaling

#### Horizontal Scaling

- Run multiple backend instances behind load balancer
- Use external PostgreSQL for shared state
- Configure session affinity for WebSocket connections

#### Vertical Scaling

- Increase Docker resource limits
- Allocate more RAM to PostgreSQL
- Use SSD storage for database

## Usage Guide

### Creating a Project

1. **Login**
   - Navigate to http://localhost:3000
   - Click "Sign In"
   - Authenticate via Google/Microsoft

2. **Create Project**
   - Click "New Project"
   - Select "Windows 11"
   - Enter project name
   - Click "Create"

3. **Wait for Initialization**
   - Windows VM creation: 2-5 minutes
   - Status shown in UI
   - Notification on completion

### Accessing Windows VM

1. **Via Frontend**
   - Navigate to Projects → [Your Project]
   - Click "Connect"
   - Use web-based VNC viewer

2. **Via MCP Protocol**
   - Windows VM accessible at `172.30.x.2`
   - MCP client pre-configured
   - API endpoint: `http://172.30.x.1:8090`

### Shared Folder Access

Files are shared between host and Windows VM:

- **Host Path**: `./windows-vm-files/{project-id}/`
- **Windows VM**: `http://172.30.0.1:8888/`
- **Contains**: `.env` file with MCP configuration

### Managing API Keys

1. **Add API Key**
   ```bash
   POST /api/user/api-keys
   {
     "name": "My API Key",
     "provider": "openrouter",
     "key": "sk-or-v1-..."
   }
   ```

2. **List API Keys**
   ```bash
   GET /api/user/api-keys
   ```

3. **Delete API Key**
   ```bash
   DELETE /api/user/api-keys/{key-id}
   ```

## API Documentation

### Authentication

All API requests require authentication:

```bash
Authorization: Bearer <keycloak-jwt-token>
```

### Endpoints

#### Projects

- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/{id}` - Get project details
- `DELETE /api/projects/{id}` - Delete project

#### Chat

- `POST /api/chat` - Send chat message
- `GET /api/chat/history` - Get chat history
- `DELETE /api/chat/history` - Clear chat history

#### User Settings

- `GET /api/user/settings` - Get user settings
- `PUT /api/user/settings` - Update user settings
- `GET /api/user/api-keys` - List API keys
- `POST /api/user/api-keys` - Add API key

### WebSocket API

Connect to WebSocket for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3002/ws');
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'project-updates'
}));
```

## Network Architecture

### Isolation Model

Each project runs in an isolated Docker network:

- **Security**: Projects cannot access each other
- **Resources**: Dedicated network namespace per project
- **Communication**: Only through backend API

### Multi-Homed Containers

Two containers bridge networks:

1. **Backend** (10.0.1.2 + 172.30.x.3)
   - Accesses main database
   - Communicates with Windows VMs

2. **Windows Tools API** (10.0.1.6 + 172.30.x.1)
   - Manages Windows VMs
   - Accesses main database

### DNS Configuration

- **Main Network**: `postgres`, `keycloak` aliases
- **Project Networks**: `windows-tools-api` alias
- **Resolution**: Docker internal DNS

## Troubleshooting

### Common Issues

#### Services Not Starting

```bash
# Check logs
docker-compose -f docker-compose.production.yml logs

# Restart services
docker-compose -f docker-compose.production.yml restart

# Check health
docker inspect pantheon-backend --format='{{.State.Health.Status}}'
```

#### Database Connection Failed

```bash
# Verify PostgreSQL is running
docker exec pantheon-postgres pg_isready -U postgres

# Check network connectivity
docker exec pantheon-backend ping -c 3 postgres

# Verify credentials in .env
```

#### Windows VM Not Accessible

```bash
# Check Windows container
docker ps | grep windows-project

# Verify socat proxy
docker exec windows-project-{id} ps aux | grep socat

# Restart proxy
docker exec windows-project-{id} /usr/local/bin/start-socat-proxy.sh
```

#### Port Conflicts

```bash
# Find process using port
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Linux/Mac

# Stop conflicting service or change port in docker-compose.yml
```

### Logs

View logs for debugging:

```bash
# All services
docker-compose -f docker-compose.production.yml logs -f

# Specific service
docker logs pantheon-backend -f

# Last 100 lines
docker logs pantheon-backend --tail 100
```

### Health Checks

```bash
# Frontend
curl http://localhost:3000

# Backend
curl http://localhost:3002/health

# Keycloak
curl http://localhost:8080/health/ready
```

## Contributing

### Development Setup

1. Fork repository
2. Create feature branch
3. Make changes
4. Run tests
5. Submit pull request

### Code Style

- JavaScript: ESLint configuration
- Commits: Conventional Commits format
- Documentation: Markdown with proper formatting

### Testing

```bash
# Run backend tests
cd backend
npm test

# Run frontend tests
cd frontend
npm test
```

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/akilhassane/pantheon/issues)
- **Documentation**: [Wiki](https://github.com/akilhassane/pantheon/wiki)
- **Discussions**: [GitHub Discussions](https://github.com/akilhassane/pantheon/discussions)

## Acknowledgments

- OpenRouter for multi-model AI access
- Keycloak for authentication
- Docker for containerization
- PostgreSQL for database
- Next.js for frontend framework
