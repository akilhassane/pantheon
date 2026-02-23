# Docker Desktop VHDX Compaction Script
# This script compacts the Docker Desktop VHDX file to reclaim disk space

Write-Host "Docker Desktop VHDX Compaction Script" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Stop Docker Desktop
Write-Host "Stopping Docker Desktop..." -ForegroundColor Yellow
Stop-Process -Name "Docker Desktop" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "com.docker.backend" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "com.docker.proxy" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 5

# Shutdown WSL
Write-Host "Shutting down WSL..." -ForegroundColor Yellow
wsl --shutdown
Start-Sleep -Seconds 5

# Find the VHDX file
$vhdxPath = "$env:LOCALAPPDATA\Docker\wsl\disk\docker_data.vhdx"

if (-not (Test-Path $vhdxPath)) {
    # Try alternative location
    $vhdxPath = "$env:LOCALAPPDATA\Docker\wsl\data\ext4.vhdx"
    if (-not (Test-Path $vhdxPath)) {
        Write-Host "VHDX file not found" -ForegroundColor Red
        Write-Host "Please check your Docker Desktop installation." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Found VHDX file at: $vhdxPath" -ForegroundColor Green

# Get current size
$currentSize = (Get-Item $vhdxPath).Length / 1GB
Write-Host "Current VHDX size: $([math]::Round($currentSize, 2)) GB" -ForegroundColor Yellow

# Compact the VHDX
Write-Host ""
Write-Host "Compacting VHDX file (this may take several minutes)..." -ForegroundColor Yellow

$diskpartScript = @"
select vdisk file="$vhdxPath"
attach vdisk readonly
compact vdisk
detach vdisk
exit
"@

$diskpartScript | diskpart

# Get new size
$newSize = (Get-Item $vhdxPath).Length / 1GB
$saved = $currentSize - $newSize

Write-Host ""
Write-Host "Compaction complete!" -ForegroundColor Green
Write-Host "New VHDX size: $([math]::Round($newSize, 2)) GB" -ForegroundColor Green
Write-Host "Space reclaimed: $([math]::Round($saved, 2)) GB" -ForegroundColor Green

# Restart Docker Desktop
Write-Host ""
Write-Host "Starting Docker Desktop..." -ForegroundColor Yellow
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"

Write-Host ""
Write-Host "Done! Docker Desktop is starting..." -ForegroundColor Green
Write-Host "Please wait for Docker Desktop to fully start before using it." -ForegroundColor Yellow
