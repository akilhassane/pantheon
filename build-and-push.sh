#!/bin/bash
# Build and Push Pantheon Images to DockerHub
# This script commits current container states and pushes to akilhassane/pantheon

set -e

SKIP_BUILD=false
SKIP_PUSH=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-push)
            SKIP_PUSH=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--skip-build] [--skip-push]"
            exit 1
            ;;
    esac
done

echo "========================================"
echo "  Pantheon Image Build & Push"
echo "========================================"
echo ""

# Check if Docker is running
echo "Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo "✗ Docker is not running. Please start Docker."
    exit 1
fi
echo "✓ Docker is running"

# Check if logged in to DockerHub
echo ""
echo "Checking DockerHub login..."
if ! docker info 2>&1 | grep -q "Username"; then
    echo "⚠ Not logged in to DockerHub"
    echo "Please login with: docker login"
    read -p "Login now? (yes/no): " login
    if [ "$login" = "yes" ]; then
        docker login
    else
        echo "✗ DockerHub login required"
        exit 1
    fi
fi
echo "✓ Logged in to DockerHub"

if [ "$SKIP_BUILD" = false ]; then
    echo ""
    echo "========================================"
    echo "  Step 1: Committing Container States"
    echo "========================================"
    echo ""
    
    # Commit backend container
    echo "Committing pantheon-backend..."
    echo "  Description: Backend API service with Docker socket access"
    status=$(docker inspect --format='{{.State.Status}}' pantheon-backend 2>/dev/null || echo "not found")
    echo "  Container status: $status"
    if [ "$status" != "not found" ]; then
        docker commit pantheon-backend akilhassane/pantheon-backend:latest
        echo "  ✓ Committed successfully"
    else
        echo "  ✗ Container not found"
        exit 1
    fi
    
    # Commit frontend container
    echo ""
    echo "Committing pantheon-frontend..."
    echo "  Description: Next.js frontend application"
    status=$(docker inspect --format='{{.State.Status}}' pantheon-frontend 2>/dev/null || echo "not found")
    echo "  Container status: $status"
    if [ "$status" != "not found" ]; then
        docker commit pantheon-frontend akilhassane/pantheon-frontend:latest
        echo "  ✓ Committed successfully"
    else
        echo "  ✗ Container not found"
        exit 1
    fi
    
    # Commit windows-tools-api container
    echo ""
    echo "Committing windows-tools-api..."
    echo "  Description: Windows VM management API"
    status=$(docker inspect --format='{{.State.Status}}' windows-tools-api 2>/dev/null || echo "not found")
    echo "  Container status: $status"
    if [ "$status" != "not found" ]; then
        docker commit windows-tools-api akilhassane/pantheon-windows-tools-api:latest
        echo "  ✓ Committed successfully"
    else
        echo "  ✗ Container not found"
        exit 1
    fi
    
    echo ""
    echo "Tagging official images..."
    
    # Tag postgres
    echo "  Tagging postgres:16-alpine..."
    docker tag postgres:16-alpine akilhassane/pantheon-postgres:latest
    echo "  ✓ Tagged successfully"
    
    # Tag keycloak
    echo "  Tagging quay.io/keycloak/keycloak:23.0..."
    docker tag quay.io/keycloak/keycloak:23.0 akilhassane/pantheon-keycloak:latest
    echo "  ✓ Tagged successfully"
    
    echo ""
    echo "✓ All images built successfully"
fi

if [ "$SKIP_PUSH" = false ]; then
    echo ""
    echo "========================================"
    echo "  Step 2: Pushing Images to DockerHub"
    echo "========================================"
    echo ""
    
    images=(
        "akilhassane/pantheon-backend:latest"
        "akilhassane/pantheon-frontend:latest"
        "akilhassane/pantheon-postgres:latest"
        "akilhassane/pantheon-keycloak:latest"
        "akilhassane/pantheon-windows-tools-api:latest"
    )
    
    for image in "${images[@]}"; do
        echo "Pushing $image..."
        docker push "$image"
        echo "  ✓ Pushed successfully"
        echo ""
    done
    
    echo "✓ All images pushed successfully"
fi

echo ""
echo "========================================"
echo "  Build & Push Complete!"
echo "========================================"
echo ""
echo "Images available at:"
echo "  https://hub.docker.com/u/akilhassane"
echo ""
echo "Next steps:"
echo "  1. Test deployment: ./deploy.sh"
echo "  2. Push to GitHub: git push origin main"
echo ""
