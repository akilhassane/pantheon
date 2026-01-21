# Pantheon AI Platform - Build and Push All Images to Docker Hub (PowerShell)
# This script builds all Docker images and pushes them to Docker Hub

param(
    [switch]$SkipOS
)

$ErrorActionPreference = "Stop"

# Color functions
function Write-Success { Write-Host "✓ $args" -ForegroundColor Green }
function Write-Info { Write-Host "ℹ $args" -ForegroundColor Cyan }
function Write-Warning { Write-Host "⚠ $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "✗ $args" -ForegroundColor Red }
function Write-Step { Write-Host "▶ $args" -ForegroundColor Magenta }

# Configuration
$DOCKER_USERNAME = "akilhassane"
$DOCKER_REPO = "pantheon"

# Banner
Write-Host @"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     PANTHEON AI PLATFORM - BUILD & PUSH ALL IMAGES           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

Write-Host ""
Write-Info "This script will build and push all Pantheon images to Docker Hub"
Write-Warning "This process will take 1-3 hours depending on your system"
Write-Warning "Ensure you have 100GB+ free disk space"
Write-Host ""

$response = Read-Host "Continue? (y/n)"
if ($response -ne 'y') {
    Write-Info "Cancelled"
    exit 0
}

# Check if logged in to Docker Hub
Write-Step "Checking Docker Hub login..."
$dockerInfo = docker info 2>&1
if ($dockerInfo -notmatch "Username") {
    Write-Warning "Not logged in to Docker Hub"
    Write-Info "Logging in..."
    docker login
}
Write-Success "Logged in to Docker Hub"

# Function to build and push image
function Build-And-Push {
    param(
        [string]$Name,
        [string]$Tag,
        [string]$Dockerfile,
        [string]$Context,
        [string]$Size
    )
    
    Write-Host ""
    Write-Step "Building $Name ($Size)..."
    Write-Info "Dockerfile: $Dockerfile"
    Write-Info "Context: $Context"
    
    # Build image
    try {
        if ([string]::IsNullOrEmpty($Dockerfile)) {
            docker build -t "${DOCKER_USERNAME}/${DOCKER_REPO}:${Tag}" $Context
        } else {
            docker build -f $Dockerfile -t "${DOCKER_USERNAME}/${DOCKER_REPO}:${Tag}" $Context
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Built ${DOCKER_USERNAME}/${DOCKER_REPO}:${Tag}"
            
            # Push image
            Write-Info "Pushing to Docker Hub..."
            docker push "${DOCKER_USERNAME}/${DOCKER_REPO}:${Tag}"
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Pushed ${DOCKER_USERNAME}/${DOCKER_REPO}:${Tag}"
                return $true
            } else {
                Write-Error "Failed to push ${DOCKER_USERNAME}/${DOCKER_REPO}:${Tag}"
                return $false
            }
        } else {
            Write-Error "Failed to build ${DOCKER_USERNAME}/${DOCKER_REPO}:${Tag}"
            return $false
        }
    } catch {
        Write-Error "Error building/pushing ${DOCKER_USERNAME}/${DOCKER_REPO}:${Tag}: $_"
        return $false
    }
}

# Track success/failure
$TOTAL = 0
$SUCCESS = 0
$FAILED = 0

# Build and push core services
Write-Info "`n=== Building Core Services ===`n"

# Frontend
$TOTAL++
if (Build-And-Push -Name "Frontend" -Tag "frontend" -Dockerfile "docker/Dockerfile.frontend" -Context "." -Size "~3.8GB") {
    $SUCCESS++
} else {
    $FAILED++
}

# Backend
$TOTAL++
if (Build-And-Push -Name "Backend" -Tag "backend" -Dockerfile "docker/Dockerfile.backend" -Context "." -Size "~431MB") {
    $SUCCESS++
} else {
    $FAILED++
}

# Windows Tools API
$TOTAL++
if (Build-And-Push -Name "Windows Tools API" -Tag "windows-tools-api" -Dockerfile "" -Context "docker/windows-tools-api" -Size "~1.2GB") {
    $SUCCESS++
} else {
    $FAILED++
}

# Build and push OS images
if (-not $SkipOS) {
    Write-Info "`n=== Building OS Images ===`n"

    # Ubuntu 24
    Write-Warning "Ubuntu 24 build will take 10-15 minutes"
    $response = Read-Host "Build Ubuntu 24 image? (y/n)"
    if ($response -eq 'y') {
        $TOTAL++
        if (Build-And-Push -Name "Ubuntu 24" -Tag "ubuntu-24" -Dockerfile "" -Context "docker/ubuntu-24" -Size "~2GB") {
            $SUCCESS++
        } else {
            $FAILED++
        }
    }

    # Kali Linux
    Write-Warning "Kali Linux build will take 15-20 minutes"
    $response = Read-Host "Build Kali Linux image? (y/n)"
    if ($response -eq 'y') {
        $TOTAL++
        if (Build-And-Push -Name "Kali Linux" -Tag "kali-desktop" -Dockerfile "" -Context "docker/kali" -Size "~3GB") {
            $SUCCESS++
        } else {
            $FAILED++
        }
    }

    # Windows 11
    Write-Warning "Windows 11 build will take 30-60 minutes and requires 38GB+ disk space"
    Write-Warning "You must have the Windows 11 snapshot already created"
    $response = Read-Host "Build Windows 11 image? (y/n)"
    if ($response -eq 'y') {
        $TOTAL++
        if (Build-And-Push -Name "Windows 11" -Tag "windows-11-25h2" -Dockerfile "docker/windows-11/Dockerfile.snapshot-embedded" -Context "docker/windows-11" -Size "~38GB") {
            $SUCCESS++
        } else {
            $FAILED++
        }
    }
}

# Summary
Write-Host ""
Write-Host @"
╔═══════════════════════════════════════════════════════════════╗
║                      BUILD SUMMARY                            ║
╚═══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Green

Write-Host ""
Write-Info "Total images: $TOTAL"
Write-Success "Successfully built and pushed: $SUCCESS"
if ($FAILED -gt 0) {
    Write-Error "Failed: $FAILED"
}

Write-Host ""

if ($FAILED -eq 0) {
    Write-Success "All images built and pushed successfully!"
    Write-Host ""
    Write-Info "Images available at:"
    Write-Host "  https://hub.docker.com/r/${DOCKER_USERNAME}/${DOCKER_REPO}"
    Write-Host ""
    Write-Info "Users can now install with:"
    Write-Host "  irm https://raw.githubusercontent.com/akilhassane/pantheon/main/install.ps1 | iex"
} else {
    Write-Warning "Some images failed to build/push"
    Write-Info "Review the errors above and try building failed images individually"
}

Write-Host ""
Write-Info "Next steps:"
Write-Host "  1. Test installation: .\test-installation.ps1"
Write-Host "  2. Create GitHub repository"
Write-Host "  3. Add screenshots and videos"
Write-Host "  4. Announce release"
Write-Host ""

