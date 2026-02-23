#!/usr/bin/env pwsh
# Rebuild and restart the AI Backend container

Write-Host "🔨 Rebuilding AI Backend Docker image..." -ForegroundColor Cyan

# Stop and remove existing container
Write-Host "⏹️  Stopping existing container..." -ForegroundColor Yellow
docker-compose -f docker-compose.production.yml down backend 2>$null

# Rebuild the image
Write-Host "🏗️  Building new image..." -ForegroundColor Yellow
docker-compose -f docker-compose.production.yml build backend

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

# Start the container
Write-Host "▶️  Starting container..." -ForegroundColor Yellow
docker-compose -f docker-compose.production.yml up -d backend

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start container!" -ForegroundColor Red
    exit 1
}

# Wait for container to be healthy
Write-Host "⏳ Waiting for container to be healthy..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check status
$status = docker ps --filter "name=ai-backend" --format "{{.Status}}"
Write-Host "✅ Container status: $status" -ForegroundColor Green

# Show logs
Write-Host "`n📋 Recent logs:" -ForegroundColor Cyan
docker logs --tail 20 ai-backend

Write-Host "`n✅ AI Backend rebuilt and restarted successfully!" -ForegroundColor Green
Write-Host "   Access at: http://localhost:3002" -ForegroundColor Cyan
Write-Host "   Health check: http://localhost:3002/health" -ForegroundColor Cyan
