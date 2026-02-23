# The Doofenshmirtz - Pantheon Uninstaller
# Removes all Pantheon containers, networks, volumes, and images

param(
    [switch]$KeepImages = $false,
    [switch]$KeepVolumes = $false,
    [switch]$Force = $false
)

Write-Host "`n========================================" -ForegroundColor Red
Write-Host "  THE DOOFENSHMIRTZ" -ForegroundColor Red
Write-Host "  Pantheon Uninstaller" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""

if (-not $Force) {
    Write-Host "This will remove:" -ForegroundColor Yellow
    Write-Host "  - All Pantheon containers" -ForegroundColor White
    Write-Host "  - All project networks" -ForegroundColor White
    if (-not $KeepVolumes) {
        Write-Host "  - All data volumes (DATABASE WILL BE DELETED)" -ForegroundColor Red
    }
    if (-not $KeepImages) {
        Write-Host "  - All Pantheon images" -ForegroundColor White
    }
    Write-Host ""
    $confirm = Read-Host "Are you sure? Type 'UNINSTALL' to confirm"
    if ($confirm -ne "UNINSTALL") {
        Write-Host "Cancelled" -ForegroundColor Yellow
        exit 0
    }
}

Write-Host "`nStep 1: Stopping containers..." -ForegroundColor Yellow
$containers = @(
    "pantheon-frontend",
    "pantheon-backend",
    "pantheon-postgres",
    "pantheon-keycloak",
    "windows-tools-api"
)

foreach ($container in $containers) {
    $exists = docker ps -a --format "{{.Names}}" | Select-String -Pattern "^$container$"
    if ($exists) {
        Write-Host "  Stopping $container..." -ForegroundColor Cyan
        docker stop $container 2>$null
        docker rm $container 2>$null
        Write-Host "  Removed $container" -ForegroundColor Green
    }
}

# Remove project containers
Write-Host "`nStep 2: Removing project containers..." -ForegroundColor Yellow
$projectContainers = docker ps -a --format "{{.Names}}" | Select-String -Pattern "windows-project-|shared-folder-"
foreach ($container in $projectContainers) {
    Write-Host "  Removing $container..." -ForegroundColor Cyan
    docker stop $container 2>$null
    docker rm $container 2>$null
}

Write-Host "`nStep 3: Removing networks..." -ForegroundColor Yellow
$networks = @("mcp-server_ai-network")
$projectNetworks = docker network ls --format "{{.Name}}" | Select-String -Pattern "project-.*-network"
$networks += $projectNetworks

foreach ($network in $networks) {
    if ($network) {
        Write-Host "  Removing $network..." -ForegroundColor Cyan
        docker network rm $network 2>$null
    }
}

if (-not $KeepVolumes) {
    Write-Host "`nStep 4: Removing volumes..." -ForegroundColor Yellow
    $volumes = @(
        "pantheon-postgres-data",
        "pantheon-windows-files"
    )
    
    foreach ($volume in $volumes) {
        $exists = docker volume ls --format "{{.Name}}" | Select-String -Pattern "^$volume$"
        if ($exists) {
            Write-Host "  Removing $volume..." -ForegroundColor Cyan
            docker volume rm $volume 2>$null
            Write-Host "  Removed $volume" -ForegroundColor Green
        }
    }
} else {
    Write-Host "`nStep 4: Keeping volumes (--KeepVolumes specified)" -ForegroundColor Yellow
}

if (-not $KeepImages) {
    Write-Host "`nStep 5: Removing images..." -ForegroundColor Yellow
    $images = @(
        "akilhassane/pantheon-backend:latest",
        "akilhassane/pantheon-frontend:latest",
        "akilhassane/pantheon-postgres:latest",
        "akilhassane/pantheon-keycloak:latest",
        "akilhassane/pantheon-windows-tools-api:latest"
    )
    
    foreach ($image in $images) {
        $exists = docker images --format "{{.Repository}}:{{.Tag}}" | Select-String -Pattern "^$image$"
        if ($exists) {
            Write-Host "  Removing $image..." -ForegroundColor Cyan
            docker rmi $image 2>$null
            Write-Host "  Removed $image" -ForegroundColor Green
        }
    }
} else {
    Write-Host "`nStep 5: Keeping images (--KeepImages specified)" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  Uninstall Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Pantheon has been removed from your system." -ForegroundColor White
Write-Host ""

if ($KeepVolumes) {
    Write-Host "Note: Data volumes were preserved." -ForegroundColor Yellow
    Write-Host "To remove them manually:" -ForegroundColor Cyan
    Write-Host "  docker volume rm pantheon-postgres-data pantheon-windows-files" -ForegroundColor White
    Write-Host ""
}

if ($KeepImages) {
    Write-Host "Note: Docker images were preserved." -ForegroundColor Yellow
    Write-Host "To remove them manually:" -ForegroundColor Cyan
    Write-Host "  docker rmi akilhassane/pantheon-backend:latest" -ForegroundColor White
    Write-Host "  docker rmi akilhassane/pantheon-frontend:latest" -ForegroundColor White
    Write-Host "  docker rmi akilhassane/pantheon-postgres:latest" -ForegroundColor White
    Write-Host "  docker rmi akilhassane/pantheon-keycloak:latest" -ForegroundColor White
    Write-Host "  docker rmi akilhassane/pantheon-windows-tools-api:latest" -ForegroundColor White
    Write-Host ""
}
