#!/bin/bash
# Pantheon AI Backend - Automated Deployment Script for Linux/Mac
# This script pulls images from DockerHub and sets up the complete stack

set -e

SKIP_PULL=false
CLEAN_INSTALL=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-pull)
            SKIP_PULL=true
            shift
            ;;
        --clean)
            CLEAN_INSTALL=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--skip-pull] [--clean]"
            exit 1
            ;;
    esac
done

echo "========================================"
echo "  Pantheon AI Backend Deployment"
echo "========================================"
echo ""

# Check if Docker is running
echo "Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo "✗ Docker is not running. Please start Docker."
    exit 1
fi
echo "✓ Docker is running"

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠ .env file not found. Creating from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✓ Created .env file. Please edit it with your API keys."
        echo "  Required: OPENROUTER_API_KEY, GEMINI_API_KEY, MCP_MASTER_SECRET"
        echo ""
        read -p "Press Enter after editing .env file to continue"
    else
        echo "✗ .env.example not found. Please create .env manually."
        exit 1
    fi
fi

# Clean install - remove existing containers and volumes
if [ "$CLEAN_INSTALL" = true ]; then
    echo ""
    echo "Performing clean install..."
    echo "⚠ This will remove all existing Pantheon containers and data!"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
        echo "Stopping and removing containers..."
        docker-compose -f docker-compose.production.yml down -v
        echo "✓ Clean install complete"
    else
        echo "Clean install cancelled"
    fi
fi

# Pull images from DockerHub
if [ "$SKIP_PULL" = false ]; then
    echo ""
    echo "Pulling images from DockerHub..."
    
    images=(
        "akilhassane/pantheon-backend:latest"
        "akilhassane/pantheon-frontend:latest"
        "akilhassane/pantheon-postgres:latest"
        "akilhassane/pantheon-keycloak:latest"
        "akilhassane/pantheon-windows-tools-api:latest"
    )
    
    for image in "${images[@]}"; do
        echo "  Pulling $image..."
        docker pull "$image"
    done
    
    echo "✓ All images pulled successfully"
fi

# Create windows-vm-files directory if it doesn't exist
if [ ! -d "windows-vm-files" ]; then
    echo ""
    echo "Creating windows-vm-files directory..."
    mkdir -p windows-vm-files
    echo "✓ Directory created"
fi

# Start services
echo ""
echo "Starting Pantheon services..."
docker-compose -f docker-compose.production.yml up -d

# Wait for services to be healthy
echo ""
echo "Waiting for services to be healthy..."
echo "This may take up to 2 minutes..."

max_wait=120
waited=0
interval=5

while [ $waited -lt $max_wait ]; do
    sleep $interval
    waited=$((waited + interval))
    
    healthy=true
    services=("pantheon-postgres" "pantheon-backend" "pantheon-frontend")
    
    for service in "${services[@]}"; do
        health=$(docker inspect --format='{{.State.Health.Status}}' "$service" 2>/dev/null || echo "unknown")
        if [ "$health" != "healthy" ]; then
            healthy=false
            break
        fi
    done
    
    if [ "$healthy" = true ]; then
        echo "✓ All services are healthy"
        break
    fi
    
    echo "  Still waiting... ($waited/$max_wait seconds)"
done

if [ $waited -ge $max_wait ]; then
    echo "⚠ Services took longer than expected to start"
    echo "  Check logs with: docker-compose -f docker-compose.production.yml logs"
fi

# Display service URLs
echo ""
echo "========================================"
echo "  Pantheon is ready!"
echo "========================================"
echo ""
echo "Service URLs:"
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:3002"
echo "  Keycloak:  http://localhost:8080"
echo "  PostgreSQL: localhost:5432"
echo ""
echo "Default Keycloak Admin:"
echo "  Username: admin"
echo "  Password: admin"
echo ""
echo "Useful commands:"
echo "  View logs:    docker-compose -f docker-compose.production.yml logs -f"
echo "  Stop:         docker-compose -f docker-compose.production.yml stop"
echo "  Restart:      docker-compose -f docker-compose.production.yml restart"
echo "  Remove:       docker-compose -f docker-compose.production.yml down"
echo ""
