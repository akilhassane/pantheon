# Pantheon Platform - Automated Setup Script
# This script pulls Docker images and sets up the entire platform automatically
# Author: Kiro AI Assistant
# Date: 2026-02-22

param(
    [string]$PostgresPassword = "postgres",
    [string]$SupabaseUrl = "",
    [string]$SupabaseServiceKey = "",
    [switch]$SkipDatabase = $false
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Pantheon Platform Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$DOCKER_HUB_USER = "akilhassane"
$DOCKER_HUB_REPO = "pantheon"

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

# Check Docker
docker --version | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Docker is not installed or not running" -ForegroundColor Red
    Write-Host "  Please install Docker Desktop from https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ Docker is installed" -ForegroundColor Green

# Check Docker Compose
docker compose version | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Docker Compose is not available" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Docker Compose is available" -ForegroundColor Green
Write-Host ""

# Create necessary directories
Write-Host "Creating directories..." -ForegroundColor Yellow
$directories = @(
    "postgres-data",
    "windows-vm-files"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "✓ Created $dir" -ForegroundColor Green
    } else {
        Write-Host "✓ $dir already exists" -ForegroundColor Gray
    }
}
Write-Host ""

# Create docker-compose.yml
Write-Host "Creating docker-compose.yml..." -ForegroundColor Yellow

$dockerCompose = @"
version: '3.8'

services:
  postgres:
    image: $DOCKER_HUB_USER/${DOCKER_HUB_REPO}:postgres-latest
    container_name: pantheon-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: $PostgresPassword
      POSTGRES_DB: ai_backend
    volumes:
      - ./postgres-data:/var/lib/postgresql/data
    networks:
      - pantheon-network
      - mcp-server_ai-network
    ports:
      - "5432:5432"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    image: $DOCKER_HUB_USER/${DOCKER_HUB_REPO}:backend-latest
    container_name: pantheon-backend
    environment:
      NODE_ENV: production
      PORT: 5000
      DATABASE_URL: postgresql://postgres:$PostgresPassword@postgres:5432/ai_backend
      SUPABASE_URL: $SupabaseUrl
      SUPABASE_SERVICE_ROLE_KEY: $SupabaseServiceKey
      FRONTEND_URL: http://localhost:3000
    volumes:
      - ./windows-vm-files:/app/windows-vm-files
    networks:
      - pantheon-network
      - mcp-server_ai-network
    ports:
      - "5000:5000"
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    extra_hosts:
      - "host.docker.internal:host-gateway"

  frontend:
    image: $DOCKER_HUB_USER/${DOCKER_HUB_REPO}:frontend-latest
    container_name: pantheon-frontend
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: http://localhost:5000
    networks:
      - pantheon-network
    ports:
      - "3000:3000"
    depends_on:
      - backend
    restart: unless-stopped

  windows-tools-api:
    image: $DOCKER_HUB_USER/${DOCKER_HUB_REPO}:windows-tools-api-latest
    container_name: windows-tools-api
    environment:
      PORT: 8090
      SUPABASE_URL: $SupabaseUrl
      SUPABASE_SERVICE_ROLE_KEY: $SupabaseServiceKey
    networks:
      - pantheon-network
      - mcp-server_ai-network
    ports:
      - "8090:8090"
    restart: unless-stopped

networks:
  pantheon-network:
    name: pantheon-network
    driver: bridge
  mcp-server_ai-network:
    name: mcp-server_ai-network
    external: true
"@

$dockerCompose | Out-File -FilePath "docker-compose.yml" -Encoding UTF8
Write-Host "✓ docker-compose.yml created" -ForegroundColor Green
Write-Host ""

# Create .env file if it doesn't exist
if (-not (Test-Path ".env")) {
    Write-Host "Creating .env file..." -ForegroundColor Yellow
    
    $envContent = @"
# Database Configuration
POSTGRES_PASSWORD=$PostgresPassword
DATABASE_URL=postgresql://postgres:$PostgresPassword@postgres:5432/ai_backend

# Supabase Configuration (optional - for production)
SUPABASE_URL=$SupabaseUrl
SUPABASE_SERVICE_ROLE_KEY=$SupabaseServiceKey

# API Configuration
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000

# Keycloak Configuration (optional)
KEYCLOAK_URL=
KEYCLOAK_REALM=
KEYCLOAK_CLIENT_ID=
KEYCLOAK_CLIENT_SECRET=
"@
    
    $envContent | Out-File -FilePath ".env" -Encoding UTF8
    Write-Host "✓ .env file created" -ForegroundColor Green
    Write-Host "  Please edit .env to add your Supabase credentials if needed" -ForegroundColor Yellow
} else {
    Write-Host "✓ .env file already exists" -ForegroundColor Gray
}
Write-Host ""

# Create external network if it doesn't exist
Write-Host "Creating Docker networks..." -ForegroundColor Yellow
$networkExists = docker network ls --filter "name=^mcp-server_ai-network$" --format "{{.Name}}"
if (-not $networkExists) {
    docker network create mcp-server_ai-network
    Write-Host "✓ Created mcp-server_ai-network" -ForegroundColor Green
} else {
    Write-Host "✓ mcp-server_ai-network already exists" -ForegroundColor Gray
}
Write-Host ""

# Pull images
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Pulling Docker Images" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$images = @(
    "postgres-latest",
    "backend-latest",
    "frontend-latest",
    "windows-tools-api-latest"
)

foreach ($image in $images) {
    $fullImage = "$DOCKER_HUB_USER/${DOCKER_HUB_REPO}:$image"
    Write-Host "Pulling $fullImage..." -ForegroundColor Yellow
    docker pull $fullImage
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Successfully pulled $fullImage" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to pull $fullImage" -ForegroundColor Red
    }
    Write-Host ""
}

# Start services
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Starting Services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Starting Docker Compose services..." -ForegroundColor Yellow
docker compose up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ All services started successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to start services" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Wait for services to be healthy
Write-Host "Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check service status
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Service Status" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$services = @(
    @{ Name = "pantheon-postgres"; Port = 5432; Description = "PostgreSQL Database" },
    @{ Name = "pantheon-backend"; Port = 5000; Description = "Backend API" },
    @{ Name = "pantheon-frontend"; Port = 3000; Description = "Frontend Web App" },
    @{ Name = "windows-tools-api"; Port = 8090; Description = "Windows Tools API" }
)

foreach ($service in $services) {
    $status = docker ps --filter "name=^$($service.Name)$" --format "{{.Status}}"
    if ($status) {
        Write-Host "✓ $($service.Description) ($($service.Name))" -ForegroundColor Green
        Write-Host "  Status: $status" -ForegroundColor Gray
        Write-Host "  Port: $($service.Port)" -ForegroundColor Gray
    } else {
        Write-Host "✗ $($service.Description) ($($service.Name)) - Not running" -ForegroundColor Red
    }
    Write-Host ""
}

# Display access information
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Access Information" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Frontend:  http://localhost:3000" -ForegroundColor Green
Write-Host "Backend:   http://localhost:5000" -ForegroundColor Green
Write-Host "Database:  localhost:5432" -ForegroundColor Green
Write-Host "           User: postgres" -ForegroundColor Gray
Write-Host "           Password: $PostgresPassword" -ForegroundColor Gray
Write-Host "           Database: ai_backend" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Open http://localhost:3000 in your browser" -ForegroundColor White
Write-Host "  2. Sign in or create an account" -ForegroundColor White
Write-Host "  3. Configure your API keys in Settings" -ForegroundColor White
Write-Host "  4. Create your first project" -ForegroundColor White
Write-Host ""

Write-Host "To stop all services:" -ForegroundColor Yellow
Write-Host "  docker compose down" -ForegroundColor White
Write-Host ""

Write-Host "To view logs:" -ForegroundColor Yellow
Write-Host "  docker compose logs -f [service-name]" -ForegroundColor White
Write-Host ""

Write-Host "For help and documentation:" -ForegroundColor Yellow
Write-Host "  https://github.com/$DOCKER_HUB_USER/$DOCKER_HUB_REPO" -ForegroundColor White
Write-Host ""
