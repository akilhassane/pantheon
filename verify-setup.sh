#!/bin/bash
# Verify Pantheon Setup
# This script checks if everything is ready for deployment

echo "========================================"
echo "  Pantheon Setup Verification"
echo "========================================"
echo ""

all_good=true

# Check Docker
echo "Checking Docker..."
if docker info > /dev/null 2>&1; then
    echo "  ✓ Docker is running"
else
    echo "  ✗ Docker is not running"
    all_good=false
fi

# Check .env file
echo ""
echo "Checking .env file..."
if [ -f ".env" ]; then
    echo "  ✓ .env file exists"
    
    # Check required variables
    required_vars=("OPENROUTER_API_KEY" "GEMINI_API_KEY" "MCP_MASTER_SECRET")
    
    for var in "${required_vars[@]}"; do
        if grep -q "^${var}=.\\+" .env; then
            echo "  ✓ $var is set"
        else
            echo "  ✗ $var is missing or empty"
            all_good=false
        fi
    done
else
    echo "  ✗ .env file not found"
    all_good=false
fi

# Check required files
echo ""
echo "Checking required files..."
required_files=(
    "docker-compose.production.yml"
    "deploy.sh"
    "backend/Dockerfile"
    "frontend/Dockerfile"
    "docker/windows-tools-api/Dockerfile"
    "backend/docker-entrypoint.sh"
    "docker/shared-folder-startup.sh"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ✗ $file missing"
        all_good=false
    fi
done

# Check Docker images (if they exist locally)
echo ""
echo "Checking Docker images..."
images=(
    "akilhassane/pantheon-backend:latest"
    "akilhassane/pantheon-frontend:latest"
    "akilhassane/pantheon-postgres:latest"
    "akilhassane/pantheon-keycloak:latest"
    "akilhassane/pantheon-windows-tools-api:latest"
)

images_exist=0
for image in "${images[@]}"; do
    if docker images -q "$image" 2>/dev/null | grep -q .; then
        echo "  ✓ $image"
        ((images_exist++))
    else
        echo "  ⚠ $image not found locally (will be pulled)"
    fi
done

if [ $images_exist -eq 0 ]; then
    echo "  ℹ No images found locally - they will be pulled from DockerHub"
fi

# Check available disk space
echo ""
echo "Checking disk space..."
free_space=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
if [ "$free_space" -gt 50 ]; then
    echo "  ✓ ${free_space}GB free"
elif [ "$free_space" -gt 20 ]; then
    echo "  ⚠ ${free_space}GB free (recommended: 50GB+)"
else
    echo "  ✗ Only ${free_space}GB free (minimum: 20GB)"
    all_good=false
fi

# Check available memory
echo ""
echo "Checking available memory..."
if command -v free &> /dev/null; then
    total_ram=$(free -g | awk '/^Mem:/{print $2}')
    if [ "$total_ram" -ge 8 ]; then
        echo "  ✓ ${total_ram}GB RAM"
    else
        echo "  ⚠ ${total_ram}GB RAM (recommended: 8GB+)"
    fi
fi

# Check ports
echo ""
echo "Checking required ports..."
ports=(3000 3002 5432 8080 8090)
for port in "${ports[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -an 2>/dev/null | grep -q ":$port.*LISTEN"; then
        echo "  ⚠ Port $port is in use"
    else
        echo "  ✓ Port $port is available"
    fi
done

# Summary
echo ""
echo "========================================"
if [ "$all_good" = true ]; then
    echo "  ✓ All checks passed!"
    echo "========================================"
    echo ""
    echo "Ready to deploy! Run:"
    echo "  ./deploy.sh"
else
    echo "  ✗ Some checks failed"
    echo "========================================"
    echo ""
    echo "Please fix the issues above before deploying."
fi
echo ""
