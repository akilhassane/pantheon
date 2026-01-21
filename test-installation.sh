#!/bin/bash
# Pantheon AI Platform - Installation Test Script
# This script tests the installation and verifies all components are working

set -e

# Color functions
print_success() { echo -e "\033[0;32m✓ $1\033[0m"; }
print_info() { echo -e "\033[0;36mℹ $1\033[0m"; }
print_warning() { echo -e "\033[0;33m⚠ $1\033[0m"; }
print_error() { echo -e "\033[0;31m✗ $1\033[0m"; }
print_test() { echo -e "\033[0;35m▶ $1\033[0m"; }

# Banner
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║         PANTHEON AI PLATFORM - INSTALLATION TEST              ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF

echo ""
print_info "Starting installation tests..."
echo ""

# Test 1: Check Docker
print_test "Test 1: Checking Docker installation..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    print_success "Docker installed: $DOCKER_VERSION"
    
    if docker info &> /dev/null; then
        print_success "Docker daemon is running"
    else
        print_error "Docker daemon is not running"
        exit 1
    fi
else
    print_error "Docker is not installed"
    exit 1
fi

# Test 2: Check Docker Compose
print_test "Test 2: Checking Docker Compose..."
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    print_success "Docker Compose installed: $COMPOSE_VERSION"
elif docker compose version &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version)
    print_success "Docker Compose (plugin) installed: $COMPOSE_VERSION"
else
    print_error "Docker Compose is not installed"
    exit 1
fi

# Test 3: Check .env file
print_test "Test 3: Checking environment configuration..."
if [ -f .env ]; then
    print_success ".env file exists"
    
    if grep -q "your_.*_here" .env; then
        print_warning ".env file contains placeholder values - needs configuration"
    else
        print_success ".env file is configured"
    fi
    
    # Check required variables
    source .env
    
    if [ -z "$SUPABASE_URL" ]; then
        print_error "SUPABASE_URL is not set"
    else
        print_success "SUPABASE_URL is set"
    fi
    
    if [ -z "$SUPABASE_ANON_KEY" ]; then
        print_error "SUPABASE_ANON_KEY is not set"
    else
        print_success "SUPABASE_ANON_KEY is set"
    fi
    
    if [ -z "$OPENAI_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$OPENROUTER_API_KEY" ]; then
        print_warning "No AI provider API key is set"
    else
        print_success "At least one AI provider API key is set"
    fi
else
    print_error ".env file not found"
    exit 1
fi

# Test 4: Check docker-compose.yml
print_test "Test 4: Checking Docker Compose configuration..."
if [ -f docker-compose.yml ]; then
    print_success "docker-compose.yml exists"
    
    # Validate docker-compose.yml
    if docker-compose config &> /dev/null; then
        print_success "docker-compose.yml is valid"
    else
        print_error "docker-compose.yml has errors"
        exit 1
    fi
else
    print_error "docker-compose.yml not found"
    exit 1
fi

# Test 5: Check Docker images
print_test "Test 5: Checking Docker images..."
IMAGES_FOUND=0

if docker images | grep -q "akilhassane/pantheon.*frontend"; then
    print_success "Frontend image found"
    ((IMAGES_FOUND++))
else
    print_warning "Frontend image not found - will be pulled on first start"
fi

if docker images | grep -q "akilhassane/pantheon.*backend"; then
    print_success "Backend image found"
    ((IMAGES_FOUND++))
else
    print_warning "Backend image not found - will be pulled on first start"
fi

if docker images | grep -q "akilhassane/pantheon.*windows-tools"; then
    print_success "Windows Tools API image found"
    ((IMAGES_FOUND++))
else
    print_warning "Windows Tools API image not found - optional"
fi

if [ $IMAGES_FOUND -eq 0 ]; then
    print_warning "No images found - run './start.sh' to pull images"
fi

# Test 6: Check helper scripts
print_test "Test 6: Checking helper scripts..."
SCRIPTS=("start.sh" "stop.sh" "logs.sh" "update.sh" "init-database.sh")
for script in "${SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        if [ -x "$script" ]; then
            print_success "$script exists and is executable"
        else
            print_warning "$script exists but is not executable"
            chmod +x "$script"
            print_success "Made $script executable"
        fi
    else
        print_error "$script not found"
    fi
done

# Test 7: Check system resources
print_test "Test 7: Checking system resources..."

# Check memory
if [ "$(uname)" == "Linux" ]; then
    MEMORY_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    MEMORY_GB=$((MEMORY_KB / 1024 / 1024))
elif [ "$(uname)" == "Darwin" ]; then
    MEMORY_BYTES=$(sysctl -n hw.memsize)
    MEMORY_GB=$((MEMORY_BYTES / 1024 / 1024 / 1024))
fi

if [ "$MEMORY_GB" -lt 8 ]; then
    print_error "System has ${MEMORY_GB}GB RAM - minimum 8GB required"
elif [ "$MEMORY_GB" -lt 16 ]; then
    print_warning "System has ${MEMORY_GB}GB RAM - 16GB+ recommended"
else
    print_success "System has ${MEMORY_GB}GB RAM"
fi

# Check disk space
DISK_FREE=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
if [ "$DISK_FREE" -lt 50 ]; then
    print_error "Only ${DISK_FREE}GB free disk space - minimum 50GB required"
elif [ "$DISK_FREE" -lt 100 ]; then
    print_warning "Only ${DISK_FREE}GB free disk space - 100GB+ recommended"
else
    print_success "${DISK_FREE}GB free disk space available"
fi

# Test 8: Test network connectivity
print_test "Test 8: Testing network connectivity..."

if ping -c 1 google.com &> /dev/null; then
    print_success "Internet connection available"
else
    print_warning "Cannot reach internet - may affect image downloads"
fi

if curl -s https://hub.docker.com &> /dev/null; then
    print_success "Docker Hub is accessible"
else
    print_warning "Cannot reach Docker Hub - may affect image downloads"
fi

# Test 9: Check if services are running
print_test "Test 9: Checking if services are running..."

if docker-compose ps | grep -q "Up"; then
    print_success "Some services are running"
    docker-compose ps
else
    print_info "No services are currently running"
    print_info "Run './start.sh' to start services"
fi

# Test 10: Test Supabase connection (if configured)
print_test "Test 10: Testing Supabase connection..."

if [ ! -z "$SUPABASE_URL" ] && [ "$SUPABASE_URL" != "your_supabase_url_here" ]; then
    if curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL" | grep -q "200\|301\|302"; then
        print_success "Supabase URL is accessible"
    else
        print_warning "Cannot reach Supabase URL - check your configuration"
    fi
else
    print_info "Supabase URL not configured - skipping connection test"
fi

# Summary
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                      TEST SUMMARY                             ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

if [ $IMAGES_FOUND -ge 2 ]; then
    print_success "Installation appears to be complete!"
    echo ""
    print_info "Next steps:"
    echo "  1. Ensure .env is configured with your API keys"
    echo "  2. Run: ./init-database.sh"
    echo "  3. Run: ./start.sh"
    echo "  4. Open browser: http://localhost:3000"
else
    print_warning "Installation is incomplete"
    echo ""
    print_info "Next steps:"
    echo "  1. Configure .env with your API keys"
    echo "  2. Run: ./start.sh (will pull missing images)"
    echo "  3. Run: ./init-database.sh"
    echo "  4. Open browser: http://localhost:3000"
fi

echo ""
print_info "For detailed documentation, see:"
echo "  - INSTALL.md - Installation guide"
echo "  - USER_GUIDE.md - User manual"
echo "  - QUICK_START_GUIDE.md - Quick start"
echo ""

