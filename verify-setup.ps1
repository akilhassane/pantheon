# Verify Pantheon Setup
# This script checks if everything is ready for deployment

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Pantheon Setup Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Check Docker
Write-Host "Checking Docker..." -ForegroundColor Yellow
try {
    docker info | Out-Null
    Write-Host "  ✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Docker is not running" -ForegroundColor Red
    $allGood = $false
}

# Check .env file
Write-Host ""
Write-Host "Checking .env file..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "  ✓ .env file exists" -ForegroundColor Green
    
    # Check required variables
    $envContent = Get-Content ".env" -Raw
    $requiredVars = @("OPENROUTER_API_KEY", "GEMINI_API_KEY", "MCP_MASTER_SECRET")
    
    foreach ($var in $requiredVars) {
        if ($envContent -match "$var=.+") {
            Write-Host "  ✓ $var is set" -ForegroundColor Green
        } else {
            Write-Host "  ✗ $var is missing or empty" -ForegroundColor Red
            $allGood = $false
        }
    }
} else {
    Write-Host "  ✗ .env file not found" -ForegroundColor Red
    $allGood = $false
}

# Check required files
Write-Host ""
Write-Host "Checking required files..." -ForegroundColor Yellow
$requiredFiles = @(
    "docker-compose.production.yml",
    "deploy.ps1",
    "backend/Dockerfile",
    "frontend/Dockerfile",
    "docker/windows-tools-api/Dockerfile",
    "backend/docker-entrypoint.sh",
    "docker/shared-folder-startup.sh"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "  ✓ $file" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $file missing" -ForegroundColor Red
        $allGood = $false
    }
}

# Check Docker images (if they exist locally)
Write-Host ""
Write-Host "Checking Docker images..." -ForegroundColor Yellow
$images = @(
    "akilhassane/pantheon-backend:latest",
    "akilhassane/pantheon-frontend:latest",
    "akilhassane/pantheon-postgres:latest",
    "akilhassane/pantheon-keycloak:latest",
    "akilhassane/pantheon-windows-tools-api:latest"
)

$imagesExist = 0
foreach ($image in $images) {
    $exists = docker images -q $image 2>$null
    if ($exists) {
        Write-Host "  ✓ $image" -ForegroundColor Green
        $imagesExist++
    } else {
        Write-Host "  ⚠ $image not found locally (will be pulled)" -ForegroundColor Yellow
    }
}

if ($imagesExist -eq 0) {
    Write-Host "  ℹ No images found locally - they will be pulled from DockerHub" -ForegroundColor Cyan
}

# Check available disk space
Write-Host ""
Write-Host "Checking disk space..." -ForegroundColor Yellow
$drive = (Get-Location).Drive
$freeSpace = [math]::Round($drive.Free / 1GB, 2)
if ($freeSpace -gt 50) {
    Write-Host "  ✓ $freeSpace GB free" -ForegroundColor Green
} elseif ($freeSpace -gt 20) {
    Write-Host "  ⚠ $freeSpace GB free (recommended: 50GB+)" -ForegroundColor Yellow
} else {
    Write-Host "  ✗ Only $freeSpace GB free (minimum: 20GB)" -ForegroundColor Red
    $allGood = $false
}

# Check available memory
Write-Host ""
Write-Host "Checking available memory..." -ForegroundColor Yellow
$totalRAM = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 2)
if ($totalRAM -ge 8) {
    Write-Host "  ✓ $totalRAM GB RAM" -ForegroundColor Green
} else {
    Write-Host "  ⚠ $totalRAM GB RAM (recommended: 8GB+)" -ForegroundColor Yellow
}

# Check ports
Write-Host ""
Write-Host "Checking required ports..." -ForegroundColor Yellow
$ports = @(3000, 3002, 5432, 8080, 8090)
foreach ($port in $ports) {
    $connection = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue -InformationLevel Quiet
    if ($connection) {
        Write-Host "  ⚠ Port $port is in use" -ForegroundColor Yellow
    } else {
        Write-Host "  ✓ Port $port is available" -ForegroundColor Green
    }
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "  ✓ All checks passed!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Ready to deploy! Run:" -ForegroundColor Green
    Write-Host "  .\deploy.ps1" -ForegroundColor White
} else {
    Write-Host "  ✗ Some checks failed" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Please fix the issues above before deploying." -ForegroundColor Yellow
}
Write-Host ""
