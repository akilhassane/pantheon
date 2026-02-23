# Pantheon AI Platform - One-Click Installation Script (Windows PowerShell)
# This script sets up the entire Pantheon platform with zero configuration

$ErrorActionPreference = "Stop"

# Banner
Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "                                                                                " -ForegroundColor Cyan
Write-Host "                            PANTHEON AI PLATFORM                                " -ForegroundColor Cyan
Write-Host "                                                                                " -ForegroundColor Cyan
Write-Host "                Multi-Agentic AI Platform for OS Interaction                    " -ForegroundColor Cyan
Write-Host "                                                                                " -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Starting Pantheon installation..." -ForegroundColor Green
Write-Host ""

# Step 1: Check prerequisites
Write-Host "[1/7] Checking prerequisites..." -ForegroundColor Cyan

# Check Docker
try {
    $dockerVersion = docker --version
    Write-Host "[OK] Docker installed: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "Error: Docker is not installed." -ForegroundColor Red
    Write-Host "Please install Docker Desktop from: https://docs.docker.com/desktop/install/windows-install/" -ForegroundColor Yellow
    exit 1
}

# Check Docker Compose
try {
    docker compose version | Out-Null
    Write-Host "[OK] Docker Compose installed" -ForegroundColor Green
} catch {
    Write-Host "Error: Docker Compose is not available." -ForegroundColor Red
    Write-Host "Please ensure Docker Desktop is properly installed." -ForegroundColor Yellow
    exit 1
}

# Check if Docker daemon is running
try {
    docker info | Out-Null
    Write-Host "[OK] Docker daemon is running" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "Error: Docker daemon is not running." -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Yellow
    exit 1
}

# Step 2: Check if environment already exists
Write-Host "[2/7] Checking existing installation..." -ForegroundColor Cyan

$existingContainers = docker ps -a --filter "name=pantheon-" --format "{{.Names}}"
$containerCount = ($existingContainers | Measure-Object -Line).Lines

if ($containerCount -gt 0) {
    Write-Host "Found existing Pantheon containers." -ForegroundColor Yellow
    Write-Host "Environment is already set up!" -ForegroundColor Green
    
    # Check if containers are running
    $runningContainers = docker ps --filter "name=pantheon-" --format "{{.Names}}"
    $runningCount = ($runningContainers | Measure-Object -Line).Lines
    
    if ($runningCount -eq $containerCount) {
        Write-Host "[OK] All containers are running" -ForegroundColor Green
        Write-Host ""
        Write-Host "================================================================================" -ForegroundColor Green
        Write-Host "                                                                                " -ForegroundColor Green
        Write-Host "  Installation Complete! Pantheon is ready to use!                            " -ForegroundColor Green
        Write-Host "                                                                                " -ForegroundColor Green
        Write-Host "  Access the platform at: http://localhost:3000                               " -ForegroundColor Green
        Write-Host "                                                                                " -ForegroundColor Green
        Write-Host "================================================================================" -ForegroundColor Green
        Write-Host ""
        exit 0
    } else {
        Write-Host "Some containers are not running. Starting them..." -ForegroundColor Yellow
        docker compose -f docker-compose.production.yml up -d
        Write-Host "[OK] Containers started" -ForegroundColor Green
        Write-Host ""
        Write-Host "================================================================================" -ForegroundColor Green
        Write-Host "                                                                                " -ForegroundColor Green
        Write-Host "  Installation Complete! Pantheon is ready to use!                            " -ForegroundColor Green
        Write-Host "                                                                                " -ForegroundColor Green
        Write-Host "  Access the platform at: http://localhost:3000                               " -ForegroundColor Green
        Write-Host "                                                                                " -ForegroundColor Green
        Write-Host "================================================================================" -ForegroundColor Green
        Write-Host ""
        exit 0
    }
}

Write-Host "[OK] No existing installation found. Proceeding with fresh install..." -ForegroundColor Green
Write-Host ""

# Step 3: Download configuration file
Write-Host "[3/7] Downloading configuration..." -ForegroundColor Cyan

if (-not (Test-Path "docker-compose.production.yml")) {
    Write-Host "Downloading docker-compose.production.yml from GitHub..." -ForegroundColor Yellow
    try {
        Invoke-WebRequest -Uri "https://raw.githubusercontent.com/akilhassane/pantheon/main/docker-compose.production.yml" -OutFile "docker-compose.production.yml"
        Write-Host "[OK] Configuration downloaded" -ForegroundColor Green
        Write-Host ""
    } catch {
        Write-Host "Error: Failed to download configuration file." -ForegroundColor Red
        Write-Host "Please check your internet connection and try again." -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "[OK] Configuration file already exists" -ForegroundColor Green
    Write-Host ""
}

# Step 4: Create .env file with defaults
Write-Host "[4/7] Creating environment configuration..." -ForegroundColor Cyan

if (-not (Test-Path ".env")) {
    $envContent = @"
# Pantheon AI Platform - Environment Configuration
# Generated automatically by install script

# Supabase Configuration (Optional - uses local PostgreSQL by default)
SUPABASE_URL=http://localhost:5432
SUPABASE_SERVICE_ROLE_KEY=default-service-key
SUPABASE_ANON_KEY=default-anon-key
NEXT_PUBLIC_SUPABASE_URL=http://localhost:5432
NEXT_PUBLIC_SUPABASE_ANON_KEY=default-anon-key

# AI Provider API Keys (Add your keys here to enable AI features)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
OPENROUTER_API_KEY=
GEMINI_API_KEY=
MISTRAL_API_KEY=
COHERE_API_KEY=

# MCP Configuration
MCP_MASTER_SECRET=default-master-secret

# Server Configuration
DEBUG=false
ANALYTICS_ID=

# Windows VM Configuration
HOST_WINDOWS_VM_FILES_PATH=/app/windows-vm-files
"@
    $envContent | Out-File -FilePath ".env" -Encoding UTF8
    Write-Host "[OK] Environment file created (.env)" -ForegroundColor Green
    Write-Host "Note: You can add your AI provider API keys to .env later" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "[OK] Environment file already exists" -ForegroundColor Green
    Write-Host ""
}

# Step 5: Pull Docker images
Write-Host "[5/7] Pulling Docker images from Docker Hub..." -ForegroundColor Cyan
Write-Host "This may take a few minutes depending on your internet speed..." -ForegroundColor Yellow
Write-Host ""

try {
    docker compose -f docker-compose.production.yml pull
    Write-Host ""
    Write-Host "[OK] All images pulled successfully" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "Error: Failed to pull Docker images." -ForegroundColor Red
    Write-Host "Please check your internet connection and try again." -ForegroundColor Yellow
    exit 1
}

# Step 6: Start containers
Write-Host "[6/7] Starting Pantheon containers..." -ForegroundColor Cyan
Write-Host "This will create and start all services..." -ForegroundColor Yellow
Write-Host ""

try {
    docker compose -f docker-compose.production.yml up -d
    Write-Host ""
    Write-Host "[OK] All containers started" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "Error: Failed to start containers." -ForegroundColor Red
    Write-Host "Check the logs with: docker compose -f docker-compose.production.yml logs" -ForegroundColor Yellow
    exit 1
}

# Step 7: Wait for services to be healthy
Write-Host "[7/7] Waiting for services to be ready..." -ForegroundColor Cyan
Write-Host "This may take up to 2 minutes..." -ForegroundColor Yellow
Write-Host ""

# Wait for backend to be healthy
Write-Host "Waiting for backend... " -NoNewline
for ($i = 1; $i -le 60; $i++) {
    try {
        $result = docker exec pantheon-backend wget -q --spider http://localhost:3002/health 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK]" -ForegroundColor Green
            break
        }
    } catch {}
    Start-Sleep -Seconds 2
    Write-Host "." -NoNewline
}
Write-Host ""

# Wait for frontend to be ready
Write-Host "Waiting for frontend... " -NoNewline
for ($i = 1; $i -le 60; $i++) {
    try {
        $result = docker exec pantheon-frontend wget -q --spider http://localhost:3000 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK]" -ForegroundColor Green
            break
        }
    } catch {}
    Start-Sleep -Seconds 2
    Write-Host "." -NoNewline
}
Write-Host ""
Write-Host ""

# Final status check
Write-Host "Checking container status..." -ForegroundColor Cyan
Write-Host ""
docker compose -f docker-compose.production.yml ps

# Success message
Write-Host ""
Write-Host "================================================================================" -ForegroundColor Green
Write-Host "                                                                                " -ForegroundColor Green
Write-Host "  Installation Complete!                                                       " -ForegroundColor Green
Write-Host "                                                                                " -ForegroundColor Green
Write-Host "  Pantheon AI Platform is now running!                                        " -ForegroundColor Green
Write-Host "                                                                                " -ForegroundColor Green
Write-Host "  Frontend:        http://localhost:3000                                       " -ForegroundColor Green
Write-Host "  Backend API:     http://localhost:3002                                       " -ForegroundColor Green
Write-Host "  Keycloak:        http://localhost:8080                                       " -ForegroundColor Green
Write-Host "  PostgreSQL:      localhost:5432                                              " -ForegroundColor Green
Write-Host "  Windows Tools:   http://localhost:8090                                       " -ForegroundColor Green
Write-Host "                                                                                " -ForegroundColor Green
Write-Host "  Next Steps:                                                                  " -ForegroundColor Green
Write-Host "  1. Open http://localhost:3000 in your browser                                " -ForegroundColor Green
Write-Host "  2. Add your AI provider API keys to .env file                                " -ForegroundColor Green
Write-Host "  3. Restart: docker compose -f docker-compose.production.yml restart          " -ForegroundColor Green
Write-Host "                                                                                " -ForegroundColor Green
Write-Host "  Documentation: https://github.com/akilhassane/pantheon                       " -ForegroundColor Green
Write-Host "                                                                                " -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Green
Write-Host ""

# Useful commands
Write-Host "Useful Commands:" -ForegroundColor Cyan
Write-Host "  View logs:      docker compose -f docker-compose.production.yml logs -f"
Write-Host "  Stop:           docker compose -f docker-compose.production.yml stop"
Write-Host "  Start:          docker compose -f docker-compose.production.yml start"
Write-Host "  Restart:        docker compose -f docker-compose.production.yml restart"
Write-Host "  Remove:         docker compose -f docker-compose.production.yml down"
Write-Host "  Remove + data:  docker compose -f docker-compose.production.yml down -v"
Write-Host ""
