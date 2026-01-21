# Pantheon AI Platform - Complete Installation Guide

## 📋 Table of Contents

1. [Overview](#overview)
2. [System Requirements](#system-requirements)
3. [Prerequisites](#prerequisites)
4. [Quick Installation](#quick-installation)
5. [Detailed Installation Steps](#detailed-installation-steps)
6. [Configuration](#configuration)
7. [First Run](#first-run)
8. [Troubleshooting](#troubleshooting)
9. [Advanced Configuration](#advanced-configuration)

---

## 🎯 Overview

Pantheon is a multi-OS AI assistant platform that provides:
- **AI-powered chat interface** with multiple AI providers (OpenAI, Anthropic, Google, etc.)
- **Multi-OS project environments** (Windows 11, Ubuntu 24, Kali Linux, macOS)
- **Visual desktop access** via VNC for all OS environments
- **Terminal access** for command-line operations
- **File sharing** between host and containers
- **Isolated project workspaces** with dedicated resources

**Total Installation Time:** 30-60 minutes (depending on internet speed)  
**Total Disk Space Required:** ~50GB (100GB+ recommended for Windows projects)

---

## 💻 System Requirements

### Minimum Requirements
- **OS:** Windows 10/11, macOS 10.15+, or Linux (Ubuntu 20.04+, Debian 10+, Fedora 33+)
- **RAM:** 8GB (16GB+ recommended for Windows projects)
- **Disk Space:** 50GB free (100GB+ recommended)
- **CPU:** 4 cores (8+ recommended)
- **Internet:** Stable broadband connection for image downloads

### Recommended Requirements
- **RAM:** 16GB+ (32GB for multiple Windows projects)
- **Disk Space:** 200GB+ SSD
- **CPU:** 8+ cores with virtualization support
- **Internet:** 50+ Mbps download speed

### Platform-Specific Requirements

#### Windows
- **Windows 10 Pro/Enterprise** or **Windows 11** (Home editions work but may have limitations)
- **WSL2** enabled (for Docker Desktop)
- **Hyper-V** enabled (for Docker Desktop)
- **Virtualization** enabled in BIOS

#### macOS
- **macOS 10.15 Catalina** or later
- **Apple Silicon (M1/M2/M3)** or **Intel** processor
- **Rosetta 2** (for Apple Silicon Macs)

#### Linux
- **Kernel 4.4+** with KVM support
- **systemd** init system
- **KVM/QEMU** for hardware virtualization

---

## 📦 Prerequisites

### 1. Docker & Docker Compose

#### Windows
1. Download [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
2. Run installer and follow prompts
3. Enable WSL2 backend when prompted
4. Restart computer
5. Verify installation:
   ```powershell
   docker --version
   docker-compose --version
   ```

#### macOS
1. Download [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop)
2. Drag Docker.app to Applications folder
3. Launch Docker Desktop
4. Wait for Docker to start (whale icon in menu bar)
5. Verify installation:
   ```bash
   docker --version
   docker-compose --version
   ```

#### Linux (Ubuntu/Debian)
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login for group changes to take effect
# Then verify:
docker --version
docker-compose --version
```

### 2. Node.js (Optional, for development)

Download and install from [nodejs.org](https://nodejs.org/) (LTS version recommended)

Verify installation:
```bash
node --version  # Should be v18.0.0 or higher
npm --version
```

### 3. Supabase Account (Required)

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with GitHub, Google, or email
4. Create a new project:
   - Choose a project name
   - Set a strong database password (save this!)
   - Select a region close to you
   - Wait 2-3 minutes for project creation

5. Get your API keys:
   - Go to Project Settings → API
   - Copy **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - Copy **anon public** key (starts with `eyJ...`)
   - Copy **service_role** key (starts with `eyJ...`)

⚠️ **IMPORTANT:** Keep your `service_role` key secret! Never commit it to version control.

### 4. AI Provider API Keys (At least one required)

#### OpenAI (Recommended)
1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Go to API Keys section
4. Click "Create new secret key"
5. Copy the key (starts with `sk-...`)
6. Add billing information (required for API access)

#### Anthropic (Claude)
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Go to API Keys
4. Create new key
5. Copy the key (starts with `sk-ant-...`)

#### OpenRouter (Optional, for multiple models)
1. Go to [openrouter.ai](https://openrouter.ai)
2. Sign up with Google or email
3. Go to Keys section
4. Create new key
5. Copy the key (starts with `sk-or-v1-...`)

---

## 🚀 Quick Installation

### One-Command Installation

#### Windows (PowerShell as Administrator)
```powershell
irm https://raw.githubusercontent.com/akilhassane/pantheon/main/install.ps1 | iex
```

#### macOS/Linux
```bash
curl -fsSL https://raw.githubusercontent.com/akilhassane/pantheon/main/install.sh | bash
```

### Manual Installation

#### Step 1: Download Installation Script

**Windows:**
```powershell
# Download installer
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/akilhassane/pantheon/main/install.ps1" -OutFile "install.ps1"

# Run installer
.\install.ps1
```

**macOS/Linux:**
```bash
# Download installer
curl -O https://raw.githubusercontent.com/akilhassane/pantheon/main/install.sh

# Make executable
chmod +x install.sh

# Run installer
./install.sh
```

#### Step 2: Follow Installation Prompts

The installer will:
1. ✅ Check system requirements
2. ✅ Verify Docker installation
3. ✅ Create project directory
4. ✅ Generate configuration files
5. ✅ Pull Docker images from Docker Hub
6. ✅ Create helper scripts

**Expected Installation Time:**
- Frontend image: ~5 minutes (3.8GB)
- Backend image: ~2 minutes (431MB)
- Windows Tools API: ~3 minutes (1.2GB)
- Windows 11 image: ~20-40 minutes (38.2GB) - Optional

#### Step 3: Configure Environment Variables

Edit the `.env` file created in the `pantheon-ai` directory:

```bash
# Navigate to project directory
cd pantheon-ai

# Edit .env file
# Windows: notepad .env
# macOS: open -e .env
# Linux: nano .env
```

Replace all `your_*_here` placeholders with your actual keys:

```env
# Supabase Configuration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Public Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# AI Provider API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-v1-...
```

#### Step 4: Initialize Database

Run the database initialization script:

**Windows:**
```powershell
.\init-database.ps1
```

**macOS/Linux:**
```bash
./init-database.sh
```

This will create all necessary database tables and policies in your Supabase project.

#### Step 5: Start the Platform

**Windows:**
```powershell
.\start.ps1
```

**macOS/Linux:**
```bash
./start.sh
```

#### Step 6: Access the Platform

Open your browser and navigate to:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3002
- **API Documentation:** http://localhost:3002/api-docs

---

## 📝 Detailed Installation Steps

### Option 1: Using Pre-built Docker Images (Recommended)

This is the fastest method using images from Docker Hub.

1. **Create project directory:**
   ```bash
   mkdir pantheon-ai
   cd pantheon-ai
   ```

2. **Download docker-compose.yml:**
   ```bash
   curl -O https://raw.githubusercontent.com/akilhassane/pantheon/main/docker-compose.production.yml
   mv docker-compose.production.yml docker-compose.yml
   ```

3. **Create .env file:**
   ```bash
   curl -O https://raw.githubusercontent.com/akilhassane/pantheon/main/.env.example
   mv .env.example .env
   ```

4. **Edit .env with your keys** (see Configuration section)

5. **Pull images:**
   ```bash
   docker-compose pull
   ```

6. **Start services:**
   ```bash
   docker-compose up -d
   ```

### Option 2: Building from Source

For developers who want to modify the code.

1. **Clone repository:**
   ```bash
   git clone https://github.com/akilhassane/pantheon.git
   cd pantheon
   ```

2. **Install dependencies:**
   ```bash
   # Backend
   cd backend
   npm install
   cd ..

   # Frontend
   cd frontend
   npm install
   cd ..
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your keys
   ```

4. **Build Docker images:**
   ```bash
   cd docker
   docker-compose build
   ```

5. **Start services:**
   ```bash
   docker-compose up -d
   ```

---

## ⚙️ Configuration

### Environment Variables

#### Required Variables

```env
# Supabase (Required)
SUPABASE_URL=                    # Your Supabase project URL
SUPABASE_ANON_KEY=               # Public anon key
SUPABASE_SERVICE_ROLE_KEY=       # Service role key (keep secret!)
NEXT_PUBLIC_SUPABASE_URL=        # Same as SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Same as SUPABASE_ANON_KEY

# AI Provider (At least one required)
OPENAI_API_KEY=                  # OpenAI API key
ANTHROPIC_API_KEY=               # Anthropic (Claude) API key
OPENROUTER_API_KEY=              # OpenRouter API key
```

#### Optional Variables

```env
# Google Gemini
GEMINI_API_KEY=                  # Google Gemini API key

# Mistral
MISTRAL_API_KEY=                 # Mistral API key

# Cohere
COHERE_API_KEY=                  # Cohere API key

# Server Configuration
PORT=3002                        # Backend port
NODE_ENV=production              # Environment mode

# Debug
DEBUG=false                      # Enable debug logging
```

### Docker Compose Configuration

The `docker-compose.yml` file defines all services. You can customize:

#### Port Mappings

```yaml
services:
  frontend:
    ports:
      - "3000:3000"  # Change left number to use different host port
  
  backend:
    ports:
      - "3002:3002"  # Change left number to use different host port
```

#### Resource Limits

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
```

---

## 🎬 First Run

### 1. Start the Platform

**Windows:**
```powershell
.\start.ps1
```

**macOS/Linux:**
```bash
./start.sh
```

### 2. Check Service Status

```bash
docker-compose ps
```

You should see all services running:
```
NAME                    STATUS              PORTS
pantheon-frontend       Up 2 minutes        0.0.0.0:3000->3000/tcp
pantheon-backend        Up 2 minutes        0.0.0.0:3002->3002/tcp
pantheon-windows-tools  Up 2 minutes        0.0.0.0:3003->3003/tcp
```

### 3. View Logs

**All services:**
```bash
docker-compose logs -f
```

**Specific service:**
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 4. Access the Web Interface

1. Open browser: http://localhost:3000
2. Click "Sign Up" to create an account
3. Verify your email (check spam folder)
4. Log in with your credentials

### 5. Create Your First Project

1. Click "New Project" button
2. Choose an OS type:
   - **Ubuntu 24** - Fast, lightweight Linux environment
   - **Kali Linux** - Security testing and penetration testing
   - **Windows 11** - Full Windows desktop (requires large download)
   - **macOS** - macOS environment (experimental)

3. Enter project name and description
4. Click "Create Project"
5. Wait for container to start (30-60 seconds)
6. Access your project:
   - **Desktop:** Click "Open Desktop" for VNC access
   - **Terminal:** Click "Open Terminal" for command-line
   - **Chat:** Use AI assistant to control the environment

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Docker Not Running

**Symptoms:**
```
Cannot connect to the Docker daemon
```

**Solution:**
- **Windows/macOS:** Start Docker Desktop application
- **Linux:** `sudo systemctl start docker`

#### 2. Port Already in Use

**Symptoms:**
```
Error: bind: address already in use
```

**Solution:**
Edit `docker-compose.yml` and change the port mapping:
```yaml
ports:
  - "3001:3000"  # Changed from 3000:3000
```

#### 3. Images Failed to Pull

**Symptoms:**
```
Error response from daemon: pull access denied
```

**Solution:**
1. Check internet connection
2. Verify Docker Hub is accessible
3. Try pulling manually:
   ```bash
   docker pull akilhassane/pantheon:frontend
   docker pull akilhassane/pantheon:backend
   ```

#### 4. Database Connection Failed

**Symptoms:**
```
Error: Failed to connect to Supabase
```

**Solution:**
1. Verify Supabase credentials in `.env`
2. Check Supabase project is active
3. Ensure database tables are created:
   ```bash
   ./init-database.sh  # or init-database.ps1 on Windows
   ```

#### 5. Frontend Shows "API Error"

**Symptoms:**
- Frontend loads but shows connection errors
- Chat doesn't work

**Solution:**
1. Check backend is running:
   ```bash
   docker-compose ps backend
   ```

2. Check backend logs:
   ```bash
   docker-compose logs backend
   ```

3. Verify environment variables:
   ```bash
   docker-compose exec backend env | grep SUPABASE
   ```

#### 6. Windows Project Won't Start

**Symptoms:**
- Windows project creation hangs
- VNC shows black screen

**Solution:**
1. Ensure KVM is available (Linux) or Hyper-V is enabled (Windows)
2. Check system has enough RAM (16GB+ recommended)
3. Verify Windows image is pulled:
   ```bash
   docker images | grep windows
   ```

4. Check container logs:
   ```bash
   docker logs <container-name>
   ```

### Debug Mode

Enable debug logging for more detailed information:

1. Edit `.env`:
   ```env
   DEBUG=true
   NODE_ENV=development
   ```

2. Restart services:
   ```bash
   docker-compose restart
   ```

3. View detailed logs:
   ```bash
   docker-compose logs -f
   ```

### Getting Help

If you encounter issues not covered here:

1. **Check logs:** `docker-compose logs -f`
2. **Search issues:** [GitHub Issues](https://github.com/akilhassane/pantheon/issues)
3. **Create issue:** Include:
   - Operating system and version
   - Docker version
   - Error messages
   - Relevant logs
   - Steps to reproduce

---

## 🔐 Advanced Configuration

### Custom Docker Network

Create a custom network for better isolation:

```yaml
networks:
  pantheon-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.25.0.0/16
```

### Persistent Storage

Configure volumes for data persistence:

```yaml
volumes:
  pantheon-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /path/to/storage
```

### Reverse Proxy (Nginx)

For production deployments with SSL:

```nginx
server {
    listen 80;
    server_name pantheon.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name pantheon.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

### Environment-Specific Configurations

Create multiple environment files:

- `.env.development` - Development settings
- `.env.staging` - Staging settings
- `.env.production` - Production settings

Load specific environment:
```bash
docker-compose --env-file .env.production up -d
```

---

## 📚 Next Steps

After successful installation:

1. **Read the User Guide:** See `USER_GUIDE.md` for detailed usage instructions
2. **Explore Features:** Try creating different OS projects
3. **Configure AI Models:** Set up your preferred AI providers
4. **Customize Settings:** Adjust project templates and defaults
5. **Join Community:** Share feedback and get help

---

## 📄 License

MIT License - See LICENSE file for details

---

**Need Help?** Open an issue on [GitHub](https://github.com/akilhassane/pantheon/issues)
