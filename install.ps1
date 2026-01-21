# Pantheon AI Platform - Automated Installation Script
# This script installs and configures the entire Pantheon platform from Docker Hub

param(
    [switch]$Debug,
    [switch]$SkipDocker,
    [switch]$SkipSupabase
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Color functions
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }
function Write-Debug { if ($Debug) { Write-Host "[DEBUG] $args" -ForegroundColor Magenta } }

# Banner
Write-Host @"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║              PANTHEON AI PLATFORM INSTALLER                   ║
║                                                               ║
║  Multi-OS AI Assistant with Windows/Linux/macOS Support      ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

Write-Info "`nStarting installation process...`n"

# Step 1: Check system requirements
Write-Info "Step 1/8: Checking system requirements..."
Write-Debug "Checking OS version"

$osInfo = Get-CimInstance Win32_OperatingSystem
Write-Success "✓ Operating System: $($osInfo.Caption) $($osInfo.Version)"

$memory = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 2)
if ($memory -lt 16) {
    Write-Warning "⚠ Warning: System has ${memory}GB RAM. Recommended: 16GB+ for Windows projects"
} else {
    Write-Success "✓ Memory: ${memory}GB RAM"
}

$disk = Get-PSDrive C | Select-Object -ExpandProperty Free
$diskGB = [math]::Round($disk / 1GB, 2)
if ($diskGB -lt 100) {
    Write-Warning "⚠ Warning: Only ${diskGB}GB free disk space. Recommended: 100GB+ for Windows images"
} else {
    Write-Success "✓ Disk Space: ${diskGB}GB available"
}

# Step 2: Check Docker installation
Write-Info "`nStep 2/8: Checking Docker installation..."
Write-Debug "Looking for Docker executable"

if (-not $SkipDocker) {
    try {
        $dockerVersion = docker --version
        Write-Success "✓ Docker installed: $dockerVersion"
        
        # Check if Docker is running
        Write-Debug "Checking if Docker daemon is running"
        $dockerInfo = docker info 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "✗ Docker is installed but not running. Please start Docker Desktop."
            exit 1
        }
        Write-Success "✓ Docker daemon is running"
        
        # Check Docker Compose
        Write-Debug "Checking Docker Compose"
        $composeVersion = docker-compose --version
        Write-Success "✓ Docker Compose installed: $composeVersion"
        
    } catch {
        Write-Error "✗ Docker is not installed or not in PATH"
        Write-Info "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop"
        exit 1
    }
} else {
    Write-Warning "⚠ Skipping Docker check (--SkipDocker flag)"
}

# Step 3: Check Node.js installation
Write-Info "`nStep 3/8: Checking Node.js installation..."
Write-Debug "Looking for Node.js"

try {
    $nodeVersion = node --version
    Write-Success "✓ Node.js installed: $nodeVersion"
    
    $npmVersion = npm --version
    Write-Success "✓ npm installed: $npmVersion"
} catch {
    Write-Error "✗ Node.js is not installed"
    Write-Info "Please install Node.js 18+ from: https://nodejs.org/"
    exit 1
}

# Step 4: Create project directory structure
Write-Info "`nStep 4/8: Creating project directory structure..."
Write-Debug "Current directory: $(Get-Location)"

$projectName = "pantheon-ai"
if (Test-Path $projectName) {
    Write-Warning "⚠ Directory '$projectName' already exists"
    $response = Read-Host "Do you want to continue? This will overwrite configuration files (y/n)"
    if ($response -ne 'y') {
        Write-Info "Installation cancelled"
        exit 0
    }
} else {
    New-Item -ItemType Directory -Path $projectName | Out-Null
    Write-Success "✓ Created project directory: $projectName"
}

Set-Location $projectName
Write-Debug "Changed to directory: $(Get-Location)"

# Step 5: Create docker-compose.yml
Write-Info "`nStep 5/8: Creating Docker Compose configuration..."
Write-Debug "Writing docker-compose.yml"

$dockerCompose = @"
version: '3.8'

services:
  frontend:
    image: akilhassane/pantheon:frontend
    container_name: pantheon-frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=\${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=\${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - NEXT_PUBLIC_API_URL=http://localhost:3002
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - pantheon-network

  backend:
    image: akilhassane/pantheon:backend
    container_name: pantheon-backend
    ports:
      - "3002:3002"
    environment:
      - SUPABASE_URL=\${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=\${SUPABASE_SERVICE_ROLE_KEY}
      - SUPABASE_ANON_KEY=\${SUPABASE_ANON_KEY}
      - OPENAI_API_KEY=\${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=\${ANTHROPIC_API_KEY}
      - OPENROUTER_API_KEY=\${OPENROUTER_API_KEY}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - pantheon-data:/app/data
    restart: unless-stopped
    networks:
      - pantheon-network

  windows-tools-api:
    image: akilhassane/pantheon:windows-tools-api
    container_name: pantheon-windows-tools
    ports:
      - "3003:3003"
    restart: unless-stopped
    networks:
      - pantheon-network

networks:
  pantheon-network:
    driver: bridge

volumes:
  pantheon-data:
"@

$dockerCompose | Out-File -FilePath "docker-compose.yml" -Encoding UTF8
Write-Success "✓ Created docker-compose.yml"

# Step 6: Create .env file
Write-Info "`nStep 6/8: Creating environment configuration..."
Write-Debug "Writing .env file"

$envContent = @"
# Supabase Configuration
# Get these from your Supabase project settings: https://supabase.com/dashboard
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Public Supabase Configuration (for frontend)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# AI Provider API Keys (at least one required)
# OpenAI: https://platform.openai.com/api-keys
OPENAI_API_KEY=your_openai_api_key_here

# Anthropic (Claude): https://console.anthropic.com/
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# OpenRouter (optional, for additional models): https://openrouter.ai/
OPENROUTER_API_KEY=your_openrouter_api_key_here
"@

$envContent | Out-File -FilePath ".env" -Encoding UTF8
Write-Success "✓ Created .env file"
Write-Warning "⚠ IMPORTANT: You must edit .env file with your API keys before starting!"

# Step 7: Pull Docker images
Write-Info "`nStep 7/8: Pulling Docker images from Docker Hub..."
Write-Info "This may take 10-30 minutes depending on your internet connection..."
Write-Info "Total download size: ~43GB (Frontend: 3.8GB, Backend: 431MB, Windows Tools: 1.2GB, Windows 11: 38.2GB)"

if (-not $SkipDocker) {
    Write-Debug "Pulling frontend image"
    Write-Info "`nPulling frontend image (3.8GB)..."
    docker pull akilhassane/pantheon:frontend
    if ($LASTEXITCODE -ne 0) {
        Write-Error "✗ Failed to pull frontend image"
        exit 1
    }
    Write-Success "✓ Frontend image pulled"
    
    Write-Debug "Pulling backend image"
    Write-Info "`nPulling backend image (431MB)..."
    docker pull akilhassane/pantheon:backend
    if ($LASTEXITCODE -ne 0) {
        Write-Error "✗ Failed to pull backend image"
        exit 1
    }
    Write-Success "✓ Backend image pulled"
    
    Write-Debug "Pulling windows-tools-api image"
    Write-Info "`nPulling Windows Tools API image (1.2GB)..."
    docker pull akilhassane/pantheon:windows-tools-api
    if ($LASTEXITCODE -ne 0) {
        Write-Error "✗ Failed to pull Windows Tools API image"
        exit 1
    }
    Write-Success "✓ Windows Tools API image pulled"
    
    Write-Debug "Pulling Windows 11 image"
    Write-Info "`nPulling Windows 11 image (38.2GB - this will take a while)..."
    Write-Warning "⚠ This is a large download. You can skip this and pull it later when needed."
    $response = Read-Host "Pull Windows 11 image now? (y/n)"
    if ($response -eq 'y') {
        docker pull akilhassane/pantheon:windows-11-25h2
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "⚠ Failed to pull Windows 11 image. You can pull it later with: docker pull akilhassane/pantheon:windows-11-25h2"
        } else {
            Write-Success "✓ Windows 11 image pulled"
        }
    } else {
        Write-Info "Skipping Windows 11 image. Pull it later with: docker pull akilhassane/pantheon:windows-11-25h2"
    }
} else {
    Write-Warning "⚠ Skipping Docker image pull (--SkipDocker flag)"
}

# Step 8: Create helper scripts
Write-Info "`nStep 8/8: Creating helper scripts..."
Write-Debug "Creating start.ps1"

$startScript = @"
# Start Pantheon AI Platform
Write-Host "Starting Pantheon AI Platform..." -ForegroundColor Cyan

# Check if .env is configured
`$envContent = Get-Content .env -Raw
if (`$envContent -match "your_.*_here") {
    Write-Host "ERROR: Please configure your .env file with actual API keys!" -ForegroundColor Red
    Write-Host "Edit .env and replace 'your_*_here' with your actual keys" -ForegroundColor Yellow
    exit 1
}

docker-compose up -d

Write-Host "`nPantheon AI Platform is starting..." -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Backend API: http://localhost:3002" -ForegroundColor Cyan
Write-Host "`nRun 'docker-compose logs -f' to view logs" -ForegroundColor Yellow
"@

$startScript | Out-File -FilePath "start.ps1" -Encoding UTF8
Write-Success "✓ Created start.ps1"

Write-Debug "Creating stop.ps1"
$stopScript = @"
# Stop Pantheon AI Platform
Write-Host "Stopping Pantheon AI Platform..." -ForegroundColor Yellow
docker-compose down
Write-Host "Pantheon AI Platform stopped" -ForegroundColor Green
"@

$stopScript | Out-File -FilePath "stop.ps1" -Encoding UTF8
Write-Success "✓ Created stop.ps1"

Write-Debug "Creating logs.ps1"
$logsScript = @"
# View Pantheon AI Platform logs
param([string]`$Service = "")

if (`$Service) {
    docker-compose logs -f `$Service
} else {
    docker-compose logs -f
}
"@

$logsScript | Out-File -FilePath "logs.ps1" -Encoding UTF8
Write-Success "✓ Created logs.ps1"

Write-Debug "Creating update.ps1"
$updateScript = @"
# Update Pantheon AI Platform images
Write-Host "Updating Pantheon AI Platform images..." -ForegroundColor Cyan

docker-compose pull
docker-compose up -d

Write-Host "Update complete!" -ForegroundColor Green
"@

$updateScript | Out-File -FilePath "update.ps1" -Encoding UTF8
Write-Success "✓ Created update.ps1"

# Installation complete
Write-Host @"

╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║            INSTALLATION COMPLETED SUCCESSFULLY!               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Green

Write-Info "Next steps:"
Write-Host "1. " -NoNewline; Write-Warning "Edit .env file with your API keys (REQUIRED)"
Write-Host "2. " -NoNewline; Write-Info "Run: .\start.ps1"
Write-Host "3. " -NoNewline; Write-Info "Open browser: http://localhost:3000"

Write-Host "`nUseful commands:" -ForegroundColor Cyan
Write-Host "  .\start.ps1          - Start the platform"
Write-Host "  .\stop.ps1           - Stop the platform"
Write-Host "  .\logs.ps1           - View logs"
Write-Host "  .\logs.ps1 backend   - View backend logs only"
Write-Host "  .\update.ps1         - Update to latest version"

Write-Host "`nDocumentation: See README.md for detailed usage instructions" -ForegroundColor Yellow

if ($Debug) {
    Write-Debug "Installation completed in directory: $(Get-Location)"
    Write-Debug "Files created: docker-compose.yml, .env, start.ps1, stop.ps1, logs.ps1, update.ps1"
}
