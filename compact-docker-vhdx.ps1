# Docker VHDX Compaction Script
# This script compacts Docker Desktop's virtual disk to reclaim unused space

Write-Host "Docker VHDX Compaction Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    Write-Host "Please right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Common Docker VHDX locations
$vhdxPaths = @(
    "$env:LOCALAPPDATA\Docker\wsl\data\ext4.vhdx",
    "$env:LOCALAPPDATA\Docker\wsl\distro\ext4.vhdx",
    "$env:USERPROFILE\AppData\Local\Docker\wsl\data\ext4.vhdx",
    "$env:USERPROFILE\AppData\Local\Docker\wsl\distro\ext4.vhdx"
)

# Find the VHDX file
$vhdxPath = $null
foreach ($path in $vhdxPaths) {
    if (Test-Path $path) {
        $vhdxPath = $path
        break
    }
}

if (-not $vhdxPath) {
    Write-Host "ERROR: Could not find Docker VHDX file" -ForegroundColor Red
    Write-Host "Searched locations:" -ForegroundColor Yellow
    foreach ($path in $vhdxPaths) {
        Write-Host "  - $path" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "You can manually specify the path:" -ForegroundColor Yellow
    Write-Host "  .\compact-docker-vhdx.ps1 -VhdxPath 'C:\path\to\ext4.vhdx'" -ForegroundColor Gray
    exit 1
}

Write-Host "Found Docker VHDX: $vhdxPath" -ForegroundColor Green

# Get current size
$currentSize = (Get-Item $vhdxPath).Length
$currentSizeGB = [math]::Round($currentSize / 1GB, 2)
Write-Host "Current size: $currentSizeGB GB" -ForegroundColor Yellow
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker status..." -ForegroundColor Cyan
$dockerProcess = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
if ($dockerProcess) {
    Write-Host "Docker Desktop is running. Stopping Docker..." -ForegroundColor Yellow
    
    # Stop Docker Desktop
    Stop-Process -Name "Docker Desktop" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
    
    # Stop WSL
    Write-Host "Shutting down WSL..." -ForegroundColor Yellow
    wsl --shutdown
    Start-Sleep -Seconds 5
} else {
    Write-Host "Docker Desktop is not running. Shutting down WSL..." -ForegroundColor Yellow
    wsl --shutdown
    Start-Sleep -Seconds 5
}

# Verify WSL is stopped
$wslProcess = Get-Process "wslservice" -ErrorAction SilentlyContinue
if ($wslProcess) {
    Write-Host "Waiting for WSL to fully stop..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
}

Write-Host ""
Write-Host "Starting VHDX compaction..." -ForegroundColor Cyan
Write-Host "This may take several minutes depending on the disk size." -ForegroundColor Gray
Write-Host ""

# Compact the VHDX
try {
    Optimize-VHD -Path $vhdxPath -Mode Full
    Write-Host "Compaction completed successfully!" -ForegroundColor Green
    Write-Host ""
    
    # Get new size
    $newSize = (Get-Item $vhdxPath).Length
    $newSizeGB = [math]::Round($newSize / 1GB, 2)
    $savedGB = [math]::Round(($currentSize - $newSize) / 1GB, 2)
    
    Write-Host "Results:" -ForegroundColor Cyan
    Write-Host "  Original size: $currentSizeGB GB" -ForegroundColor White
    Write-Host "  New size:      $newSizeGB GB" -ForegroundColor White
    Write-Host "  Space saved:   $savedGB GB" -ForegroundColor Green
    Write-Host ""
    
} catch {
    Write-Host "ERROR: Failed to compact VHDX" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host "You can now restart Docker Desktop." -ForegroundColor Yellow
Write-Host ""
Write-Host "Done!" -ForegroundColor Green
