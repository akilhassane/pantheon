# Pantheon AI Platform - Complete Installation Guide

![Pantheon Logo](../assets/pantheon-logo.png)
<!-- TODO: Add Pantheon logo image -->

## Table of Contents

1. [Overview](#overview)
2. [System Requirements](#system-requirements)
3. [Pre-Installation Checklist](#pre-installation-checklist)
4. [Installation Methods](#installation-methods)
   - [Automated Installation (Recommended)](#automated-installation-recommended)
   - [Manual Installation](#manual-installation)
5. [Post-Installation Configuration](#post-installation-configuration)
6. [Verification](#verification)
7. [Troubleshooting](#troubleshooting)
8. [Next Steps](#next-steps)

---

## Overview

**Pantheon** is a multi-agentic AI platform that enables AI models to interact with operating systems through a unified interface. Currently supporting Windows projects with plans for Linux and macOS support.

### Key Features

- 🤖 **Multi-AI Provider Support**: OpenAI, Anthropic, Google Gemini, OpenRouter, and more
- 🪟 **Windows OS Integration**: Full Windows automation and control
- 🔄 **Real-time Collaboration**: Multiple users can work on the same project
- 📊 **Project Management**: Isolated environments for each project
- 🔐 **Secure**: Per-project API keys and encrypted communication
- 🌐 **Web-Based**: Access from any browser

---

## System Requirements

### Minimum Requirements

| Component | Requirement |
|-----------|-------------|
| **Operating System** | Windows 10/11, macOS 10.15+, Ubuntu 20.04+, or any Linux with Docker support |
| **Docker** | Version 20.10 or higher |
| **Docker Compose** | Version 2.0 or higher |
| **RAM** | 8GB minimum, 16GB recommended |
| **Disk Space** | 20GB free space |
| **CPU** | 4 cores minimum, 8 cores recommended |
| **Internet** | Stable broadband connection |

### Software Prerequisites

- **Docker Desktop** (Windows/macOS) or **Docker Engine** (Linux)
- **Docker Compose** (usually included with Docker Desktop)
- **Web Browser**: Chrome, Firefox, Edge, or Safari (latest version)

---

## Pre-Installation Checklist

Before installing Pantheon, ensure you have:

- [ ] Docker and Docker Compose installed and running
- [ ] At least 20GB of free disk space
- [ ] A Supabase account (free tier works) - [Sign up here](https://supabase.com)
- [ ] At least one AI provider API key:
  - [ ] OpenAI API key ([Get it here](https://platform.openai.com/api-keys))
  - [ ] Anthropic API key ([Get it here](https://console.anthropic.com/))
  - [ ] Google Gemini API key ([Get it here](https://makersuite.google.com/app/apikey))
  - [ ] OpenRouter API key ([Get it here](https://openrouter.ai/keys))
- [ ] Basic command line knowledge
- [ ] Administrator/sudo access (for Docker)

---

## Installation Methods

### Automated Installation (Recommended)

The automated installer handles everything for you.

#### On Linux/macOS

![Terminal Installation Demo](../assets/install-demo-linux.gif)
<!-- TODO: Add GIF showing Linux installation process -->

```bash
# Download the installer
curl -O https://raw.githubusercontent.com/akilhassane/pantheon/main/install-pantheon.sh

# Make it executable
chmod +x install-pantheon.sh

# Run the installer
bash install-pantheon.sh
```

#### On Windows

![PowerShell Installation Demo](../assets/install-demo-windows.gif)
<!-- TODO: Add GIF showing Windows installation process -->

```powershell
# Download the installer
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/akilhassane/pantheon/main/install-pantheon.ps1" -OutFile "install-pantheon.ps1"

# Run the installer (as Administrator)
powershell -ExecutionPolicy Bypass -File install-pantheon.ps1
```

#### What the Installer Does

1. ✅ Checks system requirements
2. ✅ Creates environment configuration file
3. ✅ Pulls Docker images from Docker Hub
4. ✅ Starts all services
5. ✅ Runs health checks
6. ✅ Displays access URLs

**Installation time**: 10-20 minutes (depending on internet speed)

---

### Manual Installation

If you prefer manual control or the automated installer fails:

#### Step 1: Clone the Repository

```bash
git clone https://github.com/akilhassane/pantheon.git
cd pantheon
```

#### Step 2: Create Environment File

```bash
# Copy the example environment file
cp .env.example .env

# Edit the file with your favorite editor
nano .env  # or vim, code, notepad, etc.
```

Add your credentials (see [Configuration](#post-installation-configuration) section below).

#### Step 3: Pull Docker Images

```bash
# Pull all required images
docker pull akilhassane/pantheon:frontend
docker pull akilhassane/pantheon:backend
docker pull akilhassane/pantheon:windows-tools-api
```

#### Step 4: Start Services

```bash
# Start all services
docker-compose -f docker-compose.production.yml up -d

# Check status
docker-compose -f docker-compose.production.yml ps
```

#### Step 5: Verify Installation

```bash
# Check logs
docker-compose -f docker-compose.production.yml logs -f

# Test endpoints
curl http://localhost:3000  # Frontend
curl http://localhost:3002/health  # Backend
curl http://localhost:3003/health  # Windows Tools
```

---

## Post-Installation Configuration

### 1. Configure Supabase

![Supabase Configuration](../assets/supabase-config.png)
<!-- TODO: Add screenshot of Supabase dashboard showing where to find credentials -->

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project (or use existing)
3. Go to **Settings** → **API**
4. Copy the following values to your `.env` file:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Also update the public variables
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Add AI Provider API Keys

Add at least one AI provider API key:

```env
# OpenAI (Recommended)
OPENAI_API_KEY=sk-proj-...

# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini
GEMINI_API_KEY=AIza...

# OpenRouter (supports multiple models)
OPENROUTER_API_KEY=sk-or-v1-...
```

### 3. Generate MCP Master Secret

This is used for per-project API key encryption:

```bash
# Generate a random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add it to `.env`:

```env
MCP_MASTER_SECRET=your-generated-secret-here
```

### 4. Restart Services

After editing `.env`, restart the services:

```bash
docker-compose -f docker-compose.production.yml restart
```

---

## Verification

### 1. Check Service Status

![Service Status Check](../assets/service-status.png)
<!-- TODO: Add screenshot showing healthy services -->

```bash
# Check all containers are running
docker-compose -f docker-compose.production.yml ps

# Expected output:
# NAME                    STATUS
# pantheon-frontend       Up (healthy)
# pantheon-backend        Up (healthy)
# pantheon-windows-tools  Up (healthy)
```

### 2. Access the Web Interface

![Pantheon Login Screen](../assets/login-screen.png)
<!-- TODO: Add screenshot of Pantheon login page -->

Open your browser and navigate to:

```
http://localhost:3000
```

You should see the Pantheon login page.

### 3. Create Your First Account

![Account Creation](../assets/account-creation.png)
<!-- TODO: Add screenshot of account creation form -->

1. Click **Sign Up**
2. Enter your email and password
3. Verify your email (check spam folder)
4. Log in to Pantheon

### 4. Test API Endpoints

```bash
# Test backend health
curl http://localhost:3002/health

# Expected response:
# {"status":"ok","timestamp":"2024-01-22T..."}

# Test Windows Tools API
curl http://localhost:3003/health

# Expected response:
# {"status":"healthy","service":"windows-tools-api"}
```

---

## Troubleshooting

### Common Issues

#### Issue 1: Docker Not Running

**Symptoms**: `Cannot connect to the Docker daemon`

**Solution**:
```bash
# On Windows/macOS: Start Docker Desktop
# On Linux:
sudo systemctl start docker
```

#### Issue 2: Port Already in Use

**Symptoms**: `Bind for 0.0.0.0:3000 failed: port is already allocated`

**Solution**:
```bash
# Find what's using the port
# Linux/macOS:
lsof -i :3000

# Windows:
netstat -ano | findstr :3000

# Kill the process or change Pantheon's port in docker-compose.production.yml
```

#### Issue 3: Images Won't Pull

**Symptoms**: `Error response from daemon: pull access denied`

**Solution**:
```bash
# Check internet connection
ping google.com

# Try pulling manually
docker pull akilhassane/pantheon:frontend

# If still failing, check Docker Hub status
```

#### Issue 4: Services Unhealthy

**Symptoms**: Container status shows `unhealthy`

**Solution**:
```bash
# Check logs for errors
docker-compose -f docker-compose.production.yml logs backend

# Common fixes:
# 1. Verify .env file is configured correctly
# 2. Check Supabase credentials
# 3. Ensure API keys are valid
# 4. Restart services
docker-compose -f docker-compose.production.yml restart
```

#### Issue 5: Frontend Shows Connection Error

**Symptoms**: "Cannot connect to backend" error in browser

**Solution**:
1. Check backend is running: `docker ps | grep pantheon-backend`
2. Verify backend health: `curl http://localhost:3002/health`
3. Check browser console for errors (F12)
4. Ensure `NEXT_PUBLIC_API_URL` in `.env` is correct

### Getting Help

If you're still having issues:

1. **Check the logs**:
   ```bash
   docker-compose -f docker-compose.production.yml logs -f
   ```

2. **Run diagnostics**:
   ```bash
   bash test-installation.sh
   ```

3. **Report an issue**:
   - GitHub Issues: [Create new issue](https://github.com/akilhassane/pantheon/issues/new)
   - Include diagnostic report and logs
   - Describe steps to reproduce

---

## Next Steps

Congratulations! Pantheon is now installed. Here's what to do next:

### 1. Create Your First Project

![Create Project](../assets/create-project.png)
<!-- TODO: Add screenshot of project creation modal -->

1. Log in to Pantheon
2. Click **New Project**
3. Choose **Windows** as the OS type
4. Give it a name and description
5. Click **Create**

### 2. Configure AI Settings

![AI Settings](../assets/ai-settings.png)
<!-- TODO: Add screenshot of AI settings page -->

1. Go to **Settings** → **AI Providers**
2. Select your preferred AI model
3. Adjust temperature and other parameters
4. Save settings

### 3. Start Using Pantheon

![Pantheon Interface](../assets/main-interface.png)
<!-- TODO: Add screenshot of main Pantheon interface -->

- **Chat with AI**: Ask the AI to perform tasks on Windows
- **View Terminal**: See real-time command execution
- **Collaborate**: Invite team members to your project
- **Monitor Usage**: Track API usage and costs

### 4. Explore Documentation

- 📖 [User Guide](./USER_GUIDE.md) - Learn how to use Pantheon
- 🔧 [API Reference](./API_REFERENCE.md) - Integrate with Pantheon's API
- 🎓 [Tutorials](./TUTORIALS.md) - Step-by-step guides
- 🏗️ [Architecture](./ARCHITECTURE.md) - Understand how Pantheon works

---

## Video Tutorial

![Installation Video Thumbnail](../assets/video-thumbnail.png)
<!-- TODO: Add video tutorial -->

Watch our complete installation guide:

[![Pantheon Installation Tutorial](../assets/video-thumbnail.png)](https://youtube.com/watch?v=YOUR_VIDEO_ID)
<!-- TODO: Record and upload installation video -->

---

## Support

Need help? We're here for you:

- 🐛 **GitHub Issues**: [Report bugs](https://github.com/akilhassane/pantheon/issues)
- 📚 **Documentation**: Check the guides in the `docs/` folder

---

## License

Pantheon is released under the MIT License. See [LICENSE](../LICENSE) for details.

---

**Built with ❤️ by the Pantheon Team**

[⬆ Back to Top](#pantheon-ai-platform---complete-installation-guide)
