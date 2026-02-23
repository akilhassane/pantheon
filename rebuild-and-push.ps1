# Rebuild Docker images from Dockerfiles and push to Docker Hub
# This ensures reproducible builds from source code
# Author: Kiro AI Assistant
# Date: 2026-02-22

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Pantheon - Rebuild and Push Images" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$DOCKER_HUB_USER = "akilhassane"
$DOCKER_HUB_REPO = "pantheon"

# Check Docker Hub login
Write-Host "Checking Docker Hub authentication..." -ForegroundColor Yellow
$loginCheck = docker info 2>&1 | Select-String "Username"
if (-not $loginCheck) {
    Write-Host "Not logged in. Please login:" -ForegroundColor Red
    docker login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Login failed. Exiting." -ForegroundColor Red
        exit 1
    }
}
Write-Host "Authenticated" -ForegroundColor Green
Write-Host ""

# Build Backend
Write-Host "Building Backend..." -ForegroundColor Yellow
docker build -t "$DOCKER_HUB_USER/${DOCKER_HUB_REPO}:backend-latest" -f backend/Dockerfile .
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Backend built successfully" -ForegroundColor Green
    Write-Host "  Pushing to Docker Hub..." -ForegroundColor Gray
    docker push "$DOCKER_HUB_USER/${DOCKER_HUB_REPO}:backend-latest"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Backend pushed successfully" -ForegroundColor Green
    }
} else {
    Write-Host "  Backend build failed" -ForegroundColor Red
}
Write-Host ""

# Build Frontend
Write-Host "Building Frontend..." -ForegroundColor Yellow
docker build -t "$DOCKER_HUB_USER/${DOCKER_HUB_REPO}:frontend-latest" -f frontend/Dockerfile ./frontend
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Frontend built successfully" -ForegroundColor Green
    Write-Host "  Pushing to Docker Hub..." -ForegroundColor Gray
    docker push "$DOCKER_HUB_USER/${DOCKER_HUB_REPO}:frontend-latest"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Frontend pushed successfully" -ForegroundColor Green
    }
} else {
    Write-Host "  Frontend build failed" -ForegroundColor Red
}
Write-Host ""

# Build Windows Tools API
Write-Host "Building Windows Tools API..." -ForegroundColor Yellow
docker build -t "$DOCKER_HUB_USER/${DOCKER_HUB_REPO}:windows-tools-api-latest" -f docker/windows-tools-api/Dockerfile ./docker/windows-tools-api
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Windows Tools API built successfully" -ForegroundColor Green
    Write-Host "  Pushing to Docker Hub..." -ForegroundColor Gray
    docker push "$DOCKER_HUB_USER/${DOCKER_HUB_REPO}:windows-tools-api-latest"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Windows Tools API pushed successfully" -ForegroundColor Green
    }
} else {
    Write-Host "  Windows Tools API build failed" -ForegroundColor Red
}
Write-Host ""

# Build PostgreSQL
Write-Host "Building PostgreSQL..." -ForegroundColor Yellow
docker build -t "$DOCKER_HUB_USER/${DOCKER_HUB_REPO}:postgres-latest" -f docker/postgres/Dockerfile .
if ($LASTEXITCODE -eq 0) {
    Write-Host "  PostgreSQL built successfully" -ForegroundColor Green
    Write-Host "  Pushing to Docker Hub..." -ForegroundColor Gray
    docker push "$DOCKER_HUB_USER/${DOCKER_HUB_REPO}:postgres-latest"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  PostgreSQL pushed successfully" -ForegroundColor Green
    }
} else {
    Write-Host "  PostgreSQL build failed" -ForegroundColor Red
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Images available on Docker Hub:" -ForegroundColor Green
Write-Host "  docker pull $DOCKER_HUB_USER/${DOCKER_HUB_REPO}:backend-latest" -ForegroundColor White
Write-Host "  docker pull $DOCKER_HUB_USER/${DOCKER_HUB_REPO}:frontend-latest" -ForegroundColor White
Write-Host "  docker pull $DOCKER_HUB_USER/${DOCKER_HUB_REPO}:windows-tools-api-latest" -ForegroundColor White
Write-Host "  docker pull $DOCKER_HUB_USER/${DOCKER_HUB_REPO}:postgres-latest" -ForegroundColor White
Write-Host ""

Write-Host "Done!" -ForegroundColor Green
