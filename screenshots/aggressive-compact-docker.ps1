# Aggressive Docker VHDX Compaction Script
# Uses diskpart to shrink and compact the VHDX more aggressively

param(
    [string]$VhdxPath = "C:\Users\akilh\AppData\Local\Docker\wsl\disk\docker_data.vhdx"
)

Write-Host "Aggressive Docker VHDX Compaction Script" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
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

# Step 1: Stop Docker and WSL
Write-Host "Step 1: Stopping Docker and WSL..." -ForegroundColor Cyan
Write-Host "Stopping all Docker processes..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -like "*docker*"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 5

Write-Host "Shutting down WSL..." -ForegroundColor Yellow
wsl --shutdown
Start-Sleep -Seconds 10

# Verify everything is stopped
$wslProcess = Get-Process "wsl*" -ErrorAction SilentlyContinue
if ($wslProcess) {
    Write-Host "Force stopping remaining WSL processes..." -ForegroundColor Yellow
    Stop-Process -Name "wsl*" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 5
}

Write-Host "All processes stopped." -ForegroundColor Green
Write-Host ""

# Step 2: Optimize using diskpart (more aggressive)
Write-Host "Step 2: Running aggressive VHDX optimization..." -ForegroundColor Cyan
Write-Host "This will use diskpart for maximum compaction..." -ForegroundColor Gray
Write-Host ""

# Create diskpart script
$diskpartScript = @"
select vdisk file="$VhdxPath"
attach vdisk readonly
compact vdisk
detach vdisk
"@

$scriptPath = "$env:TEMP\compact-vhdx.txt"
$diskpartScript | Out-File -FilePath $scriptPath -Encoding ASCII

Write-Host "Running diskpart compact..." -ForegroundColor Yellow
diskpart /s $scriptPath

Remove-Item $scriptPath -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Diskpart compaction completed!" -ForegroundColor Green
Write-Host ""

# Step 3: Additional PowerShell optimization
Write-Host "Step 3: Running PowerShell optimization..." -ForegroundColor Cyan
try {
    Optimize-VHD -Path $VhdxPath -Mode Full
    Write-Host "PowerShell optimization completed!" -ForegroundColor Green
} catch {
    Write-Host "Warning: PowerShell optimization had issues (this is normal after diskpart)" -ForegroundColor Yellow
}

Write-Host ""

# Step 4: Check results
$newSize = (Get-Item $VhdxPath).Length
$newSizeGB = [math]::Round($newSize / 1GB, 2)
$savedGB = [math]::Round(($currentSize - $newSize) / 1GB, 2)

Write-Host "Compaction Results:" -ForegroundColor Cyan
Write-Host "  Original size: $currentSizeGB GB" -ForegroundColor White
Write-Host "  New size:      $newSizeGB GB" -ForegroundColor White
Write-Host "  Space saved:   $savedGB GB" -ForegroundColor Green
Write-Host ""

# Step 5: Restart Docker
Write-Host "Step 4: Restarting Docker Desktop..." -ForegroundColor Cyan
try {
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    Write-Host "Docker Desktop is starting..." -ForegroundColor Yellow
    Write-Host "Waiting for Docker to initialize (30 seconds)..." -ForegroundColor Gray
    Start-Sleep -Seconds 30
    
    $dockerProcess = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
    if ($dockerProcess) {
        Write-Host "Docker Desktop started successfully!" -ForegroundColor Green
    } else {
        Write-Host "Warning: Docker Desktop process not detected. Please check manually." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Warning: Could not automatically start Docker Desktop" -ForegroundColor Yellow
    Write-Host "Please start Docker Desktop manually" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Aggressive compaction completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
