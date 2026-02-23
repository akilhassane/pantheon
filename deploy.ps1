# Pantheon AI Backend - Automated Deployment Script for Windows
# This script pulls images from DockerHub and sets up the complete stack

param(
    [switch]$SkipPull = $false,
    [switch]$CleanInstall = $false
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Pantheon AI Backend Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker..." -ForegroundColor Yellow
try {
    docker info | Out-Null
    Write-Host "✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Check for .env file
if (-not (Test-Path ".env")) {
    Write-Host "⚠ .env file not found. Creating from .env.example..." -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "✓ Created .env file. Please edit it with your API keys." -ForegroundColor Green
        Write-Host "  Required: OPENROUTER_API_KEY, GEMINI_API_KEY, MCP_MASTER_SECRET" -ForegroundColor Yellow
        Write-Host ""
        Read-Host "Press Enter after editing .env file to continue"
    } else {
        Write-Host "✗ .env.example not found. Please create .env manually." -ForegroundColor Red
        exit 1
    }
}

# Clean install - remove existing containers and volumes
if ($CleanInstall) {
    Write-Host ""
    Write-Host "Performing clean install..." -ForegroundColor Yellow
    Write-Host "⚠ This will remove all existing Pantheon containers and data!" -ForegroundColor Red
    $confirm = Read-Host "Are you sure? (yes/no)"
    if ($confirm -eq "yes") {
        Write-Host "Stopping and removing containers..." -ForegroundColor Yellow
        docker-compose -f docker-compose.production.yml down -v
        Write-Host "✓ Clean install complete" -ForegroundColor Green
    } else {
        Write-Host "Clean install cancelled" -ForegroundColor Yellow
    }
}

# Pull images from DockerHub
if (-not $SkipPull) {
    Write-Host ""
    Write-Host "Pulling images from DockerHub..." -ForegroundColor Yellow
    
    $images = @(
        "akilhassane/pantheon-backend:latest",
        "akilhassane/pantheon-frontend:latest",
        "akilhassane/pantheon-postgres:latest",
        "akilhassane/pantheon-keycloak:latest",
        "akilhassane/pantheon-windows-tools-api:latest"
    )
    
    foreach ($image in $images) {
        Write-Host "  Pulling $image..." -ForegroundColor Cyan
        docker pull $image
        if ($LASTEXITCODE -ne 0) {
            Write-Host "✗ Failed to pull $image" -ForegroundColor Red
            exit 1
        }
    }
    
    Write-Host "✓ All images pulled successfully" -ForegroundColor Green
}

# Create windows-vm-files directory if it doesn't exist
if (-not (Test-Path "windows-vm-files")) {
    Write-Host ""
    Write-Host "Creating windows-vm-files directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path "windows-vm-files" | Out-Null
    Write-Host "✓ Directory created" -ForegroundColor Green
}

# Start services
Write-Host ""
Write-Host "Starting Pantheon services..." -ForegroundColor Yellow
docker-compose -f docker-compose.production.yml up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to start services" -ForegroundColor Red
    exit 1
}

# Wait for services to be healthy
Write-Host ""
Write-Host "Waiting for services to be healthy..." -ForegroundColor Yellow
Write-Host "This may take up to 2 minutes..." -ForegroundColor Cyan

$maxWait = 120
$waited = 0
$interval = 5

while ($waited -lt $maxWait) {
    Start-Sleep -Seconds $interval
    $waited += $interval
    
    $healthy = $true
    $services = @("pantheon-postgres", "pantheon-backend", "pantheon-frontend")
    
    foreach ($service in $services) {
        $health = docker inspect --format='{{.State.Health.Status}}' $service 2>$null
        if ($health -ne "healthy") {
            $healthy = $false
            break
        }
    }
    
    if ($healthy) {
        Write-Host "✓ All services are healthy" -ForegroundColor Green
        break
    }
    
    Write-Host "  Still waiting... ($waited/$maxWait seconds)" -ForegroundColor Cyan
}

if ($waited -ge $maxWait) {
    Write-Host "⚠ Services took longer than expected to start" -ForegroundColor Yellow
    Write-Host "  Check logs with: docker-compose -f docker-compose.production.yml logs" -ForegroundColor Cyan
}

# Display service URLs
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Pantheon is ready!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Service URLs:" -ForegroundColor Cyan
Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor White
Write-Host "  Backend:   http://localhost:3002" -ForegroundColor White
Write-Host "  Keycloak:  http://localhost:8080" -ForegroundColor White
Write-Host "  PostgreSQL: localhost:5432" -ForegroundColor White
Write-Host ""
Write-Host "Default Keycloak Admin:" -ForegroundColor Cyan
Write-Host "  Username: admin" -ForegroundColor White
Write-Host "  Password: admin" -ForegroundColor White
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Cyan
Write-Host "  View logs:    docker-compose -f docker-compose.production.yml logs -f" -ForegroundColor White
Write-Host "  Stop:         docker-compose -f docker-compose.production.yml stop" -ForegroundColor White
Write-Host "  Restart:      docker-compose -f docker-compose.production.yml restart" -ForegroundColor White
Write-Host "  Remove:       docker-compose -f docker-compose.production.yml down" -ForegroundColor White
Write-Host ""
