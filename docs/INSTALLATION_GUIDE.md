# Installation Guide

Complete installation instructions for Pantheon AI Platform.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation Methods](#installation-methods)
- [Configuration](#configuration)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Operating System**: Linux, macOS, or Windows 10/11
- **RAM**: Minimum 8GB, recommended 16GB+
- **Disk Space**: 64GB free space
- **CPU**: 4+ cores recommended

### Required Software

1. **Docker** (version 20.10 or higher)
   - [Install Docker Desktop](https://www.docker.com/products/docker-desktop)
   - Ensure Docker is running before installation

2. **Docker Compose** (version 2.0 or higher)
   - Included with Docker Desktop
   - Linux users: [Install Docker Compose](https://docs.docker.com/compose/install/)

### Required Accounts

1. **Supabase Account** (free tier available)
   - Sign up at [supabase.com](https://supabase.com)
   - Create a new project
   - Note your project URL and anon key

2. **AI Provider API Key** (at least one)
   - [OpenAI](https://platform.openai.com/api-keys)
   - [Anthropic Claude](https://console.anthropic.com/)
   - [Google Gemini](https://makersuite.google.com/app/apikey)

## Installation Methods

### Method 1: Quick Install (Recommended)

#### Linux/macOS

```bash
# Download the installer
curl -O https://raw.githubusercontent.com/akilhassane/pantheon/main/install-pantheon.sh

# Make it executable
chmod +x install-pantheon.sh

# Run the installer
bash install-pantheon.sh
```

#### Windows (PowerShell)

```powershell
# Download the installer
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/akilhassane/pantheon/main/install-pantheon.ps1" -OutFile "install-pantheon.ps1"

# Run the installer
powershell -ExecutionPolicy Bypass -File install-pantheon.ps1
```

### Method 2: Manual Installation

```bash
# Clone the repository
git clone https://github.com/akilhassane/pantheon.git
cd pantheon

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env  # or use your preferred editor

# Pull Docker images
docker-compose -f docker-compose.production.yml pull

# Start services
docker-compose -f docker-compose.production.yml up -d
```

## Configuration

### Environment Variables

Edit the `.env` file with your credentials:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Provider API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Application Settings
NODE_ENV=production
FRONTEND_PORT=3000
BACKEND_PORT=3002
```

### Port Configuration

Default ports:
- Frontend: `3000`
- Backend: `3002`
- Windows Tools API: `3003`

To change ports, edit the `docker-compose.production.yml` file.

## Verification

### Check Services

```bash
# View running containers
docker ps

# Check logs
docker-compose -f docker-compose.production.yml logs -f
```

### Access the Application

1. Open your browser
2. Navigate to `http://localhost:3000`
3. You should see the Pantheon login page

### Test API Connection

```bash
# Test backend health
curl http://localhost:3002/health

# Expected response: {"status":"ok"}
```

## Troubleshooting

### Docker Issues

**Problem**: Docker daemon not running
```bash
# Linux
sudo systemctl start docker

# macOS/Windows
# Start Docker Desktop application
```

**Problem**: Port already in use
```bash
# Find process using port 3000
lsof -i :3000  # Linux/macOS
netstat -ano | findstr :3000  # Windows

# Kill the process or change Pantheon's port
```

### Installation Issues

**Problem**: Permission denied
```bash
# Linux - Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

**Problem**: Out of disk space
```bash
# Clean up Docker
docker system prune -a
```

### Connection Issues

**Problem**: Cannot connect to Supabase
- Verify your Supabase URL and keys in `.env`
- Check your internet connection
- Ensure Supabase project is active

**Problem**: AI provider errors
- Verify API keys are correct
- Check API key has sufficient credits
- Ensure API key has proper permissions

## Next Steps

- Read the [User Guide](./USER_GUIDE.md) to learn how to use Pantheon
- Follow the [Quick Start Tutorial](./QUICK_START.md) for a guided walkthrough
- Check the [API Reference](./API_REFERENCE.md) for integration options

## Getting Help

- [GitHub Issues](https://github.com/akilhassane/pantheon/issues)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)

---

[← Back to README](../README.md)
