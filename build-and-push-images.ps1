# Pantheon AI Platform - Build and Push All Docker Images (Windows PowerShell)
# This script builds all Docker images and pushes them to Docker Hub

$ErrorActionPreference = "Stop"

# Configuration
$DOCKER_USERNAME = "akilhassane"
$DOCKER_REPO = "pantheon"

function Write-ColorOutput($ForegroundColor, $Message) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    Write-Output $Message
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-ColorOutput Cyan @"

╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║              Pantheon Docker Image Build & Push Script                     ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝

"@

# Check if logged in to Docker Hub
Write-ColorOutput Cyan "[1/6] Checking Docker Hub authentication..."
$dockerInfo = docker info 2>&1 | Out-String
if (-not ($dockerInfo -match "Username: $DOCKER_USERNAME")) {
    Write-ColorOutput Yellow "Not logged in to Docker Hub. Please login:"
    docker login
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput Red "Failed to login to Docker Hub"
        exit 1
    }
}
Write-ColorOutput Green "✓ Authenticated as $DOCKER_USERNAME`n"

# Build Frontend
Write-ColorOutput Cyan "[2/6] Building Frontend image..."
Write-ColorOutput Yellow "Building Next.js application..."
docker build `
    -t "${DOCKER_USERNAME}/${DOCKER_REPO}:frontend" `
    -f frontend/Dockerfile `
    --build-arg NEXT_PUBLIC_SUPABASE_URL=http://localhost:5432 `
    --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=default-anon-key `
    --build-arg NEXT_PUBLIC_API_URL=http://localhost:3002 `
    ./frontend

if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput Green "✓ Frontend image built successfully"
    
    Write-ColorOutput Yellow "Pushing to Docker Hub..."
    docker push "${DOCKER_USERNAME}/${DOCKER_REPO}:frontend"
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput Green "✓ Frontend image pushed successfully`n"
    } else {
        Write-ColorOutput Red "✗ Failed to push frontend image`n"
        exit 1
    }
} else {
    Write-ColorOutput Red "✗ Failed to build frontend image`n"
    exit 1
}

# Build Backend
Write-ColorOutput Cyan "[3/6] Building Backend image..."
Write-ColorOutput Yellow "Building Node.js API server..."
docker build `
    -t "${DOCKER_USERNAME}/${DOCKER_REPO}:backend" `
    -f backend/Dockerfile `
    .

if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput Green "✓ Backend image built successfully"
    
    Write-ColorOutput Yellow "Pushing to Docker Hub..."
    docker push "${DOCKER_USERNAME}/${DOCKER_REPO}:backend"
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput Green "✓ Backend image pushed successfully`n"
    } else {
        Write-ColorOutput Red "✗ Failed to push backend image`n"
        exit 1
    }
} else {
    Write-ColorOutput Red "✗ Failed to build backend image`n"
    exit 1
}

# Build PostgreSQL
Write-ColorOutput Cyan "[4/6] Building PostgreSQL image..."
Write-ColorOutput Yellow "Building database with migrations..."
docker build `
    -t "${DOCKER_USERNAME}/${DOCKER_REPO}:postgres" `
    -f docker/postgres/Dockerfile `
    .

if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput Green "✓ PostgreSQL image built successfully"
    
    Write-ColorOutput Yellow "Pushing to Docker Hub..."
    docker push "${DOCKER_USERNAME}/${DOCKER_REPO}:postgres"
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput Green "✓ PostgreSQL image pushed successfully`n"
    } else {
        Write-ColorOutput Red "✗ Failed to push PostgreSQL image`n"
        exit 1
    }
} else {
    Write-ColorOutput Red "✗ Failed to build PostgreSQL image`n"
    exit 1
}

# Build Keycloak
Write-ColorOutput Cyan "[5/6] Building Keycloak image..."
Write-ColorOutput Yellow "Building authentication server..."
docker build `
    -t "${DOCKER_USERNAME}/${DOCKER_REPO}:keycloak" `
    -f docker/keycloak/Dockerfile `
    .

if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput Green "✓ Keycloak image built successfully"
    
    Write-ColorOutput Yellow "Pushing to Docker Hub..."
    docker push "${DOCKER_USERNAME}/${DOCKER_REPO}:keycloak"
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput Green "✓ Keycloak image pushed successfully`n"
    } else {
        Write-ColorOutput Red "✗ Failed to push Keycloak image`n"
        exit 1
    }
} else {
    Write-ColorOutput Red "✗ Failed to build Keycloak image`n"
    exit 1
}

# Build Windows Tools API (if source exists)
Write-ColorOutput Cyan "[6/6] Building Windows Tools API image..."
if (Test-Path "docker/windows-tools-api/server.js") {
    Write-ColorOutput Yellow "Building Windows automation tools..."
    docker build `
        -t "${DOCKER_USERNAME}/${DOCKER_REPO}:windows-tools-api" `
        -f docker/windows-tools-api/Dockerfile `
        ./docker/windows-tools-api

    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput Green "✓ Windows Tools API image built successfully"
        
        Write-ColorOutput Yellow "Pushing to Docker Hub..."
        docker push "${DOCKER_USERNAME}/${DOCKER_REPO}:windows-tools-api"
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput Green "✓ Windows Tools API image pushed successfully`n"
        } else {
            Write-ColorOutput Red "✗ Failed to push Windows Tools API image`n"
            exit 1
        }
    } else {
        Write-ColorOutput Red "✗ Failed to build Windows Tools API image`n"
        exit 1
    }
} else {
    Write-ColorOutput Yellow "⚠ Windows Tools API source not found, skipping..."
    Write-ColorOutput Yellow "Note: Using existing image from Docker Hub`n"
}

# Summary
Write-ColorOutput Green @"

╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║  ✓ All images built and pushed successfully!                 ║
║                                                               ║
║  Images available at:                                        ║
║  - ${DOCKER_USERNAME}/${DOCKER_REPO}:frontend                           ║
║  - ${DOCKER_USERNAME}/${DOCKER_REPO}:backend                            ║
║  - ${DOCKER_USERNAME}/${DOCKER_REPO}:postgres                           ║
║  - ${DOCKER_USERNAME}/${DOCKER_REPO}:keycloak                           ║
║  - ${DOCKER_USERNAME}/${DOCKER_REPO}:windows-tools-api                  ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

"@

Write-ColorOutput Cyan "Next steps:"
Write-Output "  1. Test the images: docker compose -f docker-compose.production.yml pull"
Write-Output "  2. Run locally: docker compose -f docker-compose.production.yml up -d"
Write-Output "  3. Commit and push to GitHub: git add . && git commit -m 'Update Docker images' && git push"
Write-Output ""
