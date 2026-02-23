# Build and Push Pantheon Images to DockerHub
# This script commits current container states and pushes to akilhassane/pantheon

param(
    [switch]$SkipBuild = $false,
    [switch]$SkipPush = $false
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Pantheon Image Build & Push" -ForegroundColor Cyan
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

# Check if logged in to DockerHub
Write-Host ""
Write-Host "Checking DockerHub login..." -ForegroundColor Yellow
$dockerInfo = docker info 2>&1 | Select-String "Username"
if (-not $dockerInfo) {
    Write-Host "⚠ Not logged in to DockerHub" -ForegroundColor Yellow
    Write-Host "Please login with: docker login" -ForegroundColor Cyan
    $login = Read-Host "Login now? (yes/no)"
    if ($login -eq "yes") {
        docker login
        if ($LASTEXITCODE -ne 0) {
            Write-Host "✗ Login failed" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "✗ DockerHub login required" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✓ Logged in to DockerHub" -ForegroundColor Green

if (-not $SkipBuild) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Step 1: Committing Container States" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Define containers to commit
    $containers = @(
        @{
            Name = "pantheon-backend"
            Image = "akilhassane/pantheon-backend:latest"
            Description = "Backend API service with Docker socket access"
        },
        @{
            Name = "pantheon-frontend"
            Image = "akilhassane/pantheon-frontend:latest"
            Description = "Next.js frontend application"
        },
        @{
            Name = "windows-tools-api"
            Image = "akilhassane/pantheon-windows-tools-api:latest"
            Description = "Windows VM management API"
        }
    )
    
    foreach ($container in $containers) {
        Write-Host "Committing $($container.Name)..." -ForegroundColor Yellow
        Write-Host "  Description: $($container.Description)" -ForegroundColor Cyan
        
        # Check if container exists and is running
        $containerStatus = docker inspect --format='{{.State.Status}}' $container.Name 2>$null
        if (-not $containerStatus) {
            Write-Host "  ✗ Container not found: $($container.Name)" -ForegroundColor Red
            continue
        }
        
        Write-Host "  Container status: $containerStatus" -ForegroundColor Cyan
        
        # Commit container to image
        docker commit $container.Name $container.Image
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Committed successfully" -ForegroundColor Green
        } else {
            Write-Host "  ✗ Failed to commit" -ForegroundColor Red
            exit 1
        }
    }
    
    Write-Host ""
    Write-Host "Tagging official images..." -ForegroundColor Yellow
    
    # Tag official images with pantheon prefix
    $officialImages = @(
        @{
            Source = "postgres:16-alpine"
            Target = "akilhassane/pantheon-postgres:latest"
        },
        @{
            Source = "quay.io/keycloak/keycloak:23.0"
            Target = "akilhassane/pantheon-keycloak:latest"
        }
    )
    
    foreach ($image in $officialImages) {
        Write-Host "  Tagging $($image.Source)..." -ForegroundColor Cyan
        docker tag $image.Source $image.Target
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Tagged successfully" -ForegroundColor Green
        } else {
            Write-Host "  ✗ Failed to tag" -ForegroundColor Red
            exit 1
        }
    }
    
    Write-Host ""
    Write-Host "✓ All images built successfully" -ForegroundColor Green
}

if (-not $SkipPush) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Step 2: Pushing Images to DockerHub" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    $images = @(
        "akilhassane/pantheon-backend:latest",
        "akilhassane/pantheon-frontend:latest",
        "akilhassane/pantheon-postgres:latest",
        "akilhassane/pantheon-keycloak:latest",
        "akilhassane/pantheon-windows-tools-api:latest"
    )
    
    foreach ($image in $images) {
        Write-Host "Pushing $image..." -ForegroundColor Yellow
        docker push $image
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Pushed successfully" -ForegroundColor Green
        } else {
            Write-Host "  ✗ Failed to push" -ForegroundColor Red
            exit 1
        }
        Write-Host ""
    }
    
    Write-Host "✓ All images pushed successfully" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Build & Push Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Images available at:" -ForegroundColor Cyan
Write-Host "  https://hub.docker.com/u/akilhassane" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Test deployment: .\deploy.ps1" -ForegroundColor White
Write-Host "  2. Push to GitHub: git push origin main" -ForegroundColor White
Write-Host ""
