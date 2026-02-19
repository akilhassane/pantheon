# Docker VHDX Compaction Script
param(
    [string]$VhdxPath = "C:\Users\akilh\AppData\Local\Docker\wsl\disk\docker_data.vhdx"
)

Write-Host "Docker VHDX Compaction Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $VhdxPath)) {
    Write-Host "ERROR: VHDX file not found at: $VhdxPath" -ForegroundColor Red
    exit 1
}

Write-Host "Found Docker VHDX: $VhdxPath" -ForegroundColor Green

$currentSize = (Get-Item $VhdxPath).Length
$currentSizeGB = [math]::Round($currentSize / 1GB, 2)
Write-Host "Current size: $currentSizeGB GB" -ForegroundColor Yellow
Write-Host ""

Write-Host "Stopping Docker Desktop..." -ForegroundColor Yellow
Stop-Process -Name "Docker Desktop" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

Write-Host "Shutting down WSL..." -ForegroundColor Yellow
wsl --shutdown
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "Starting VHDX compaction..." -ForegroundColor Cyan
Write-Host "This may take several minutes..." -ForegroundColor Gray
Write-Host ""

Optimize-VHD -Path $VhdxPath -Mode Full

Write-Host "Compaction completed!" -ForegroundColor Green
Write-Host ""

$newSize = (Get-Item $VhdxPath).Length
$newSizeGB = [math]::Round($newSize / 1GB, 2)
$savedGB = [math]::Round(($currentSize - $newSize) / 1GB, 2)

Write-Host "Results:" -ForegroundColor Cyan
Write-Host "  Original size: $currentSizeGB GB" -ForegroundColor White
Write-Host "  New size:      $newSizeGB GB" -ForegroundColor White
Write-Host "  Space saved:   $savedGB GB" -ForegroundColor Green
Write-Host ""
Write-Host "Done! You can now restart Docker Desktop." -ForegroundColor Green
