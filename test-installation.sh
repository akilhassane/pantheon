#!/bin/bash

###############################################################################
# Pantheon AI Platform - Installation Test Script
# 
# This script tests your Pantheon installation and diagnoses common issues
#
# Usage:
#   bash test-installation.sh
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_WARNING=0

print_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((TESTS_WARNING++))
}

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Test 1: Docker Installation
test_docker() {
    print_test "Checking Docker installation..."
    
    if command -v docker >/dev/null 2>&1; then
        DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+' | head -1)
        print_pass "Docker $DOCKER_VERSION is installed"
    else
        print_fail "Docker is not installed"
        return 1
    fi
}

# Test 2: Docker Compose
test_docker_compose() {
    print_test "Checking Docker Compose..."
    
    if docker compose version >/dev/null 2>&1; then
        COMPOSE_VERSION=$(docker compose version | grep -oP '\d+\.\d+' | head -1)
        print_pass "Docker Compose $COMPOSE_VERSION is available"
    else
        print_fail "Docker Compose is not available"
        return 1
    fi
}

# Test 3: Docker Daemon
test_docker_daemon() {
    print_test "Checking Docker daemon..."
    
    if docker ps >/dev/null 2>&1; then
        print_pass "Docker daemon is running"
    else
        print_fail "Docker daemon is not running"
        return 1
    fi
}

# Test 4: Environment File
test_env_file() {
    print_test "Checking environment file..."
    
    if [ -f .env ]; then
        print_pass ".env file exists"
        
        # Check for required variables
        if grep -q "SUPABASE_URL=" .env && ! grep -q "SUPABASE_URL=https://your-project" .env; then
            print_pass "Supabase URL is configured"
        else
            print_warn "Supabase URL needs to be configured in .env"
        fi
        
        if grep -q "SUPABASE_ANON_KEY=" .env && ! grep -q "SUPABASE_ANON_KEY=your-anon-key" .env; then
            print_pass "Supabase anon key is configured"
        else
            print_warn "Supabase anon key needs to be configured in .env"
        fi
        
        # Check for at least one AI provider
        if grep -q "OPENAI_API_KEY=sk-" .env || \
           grep -q "ANTHROPIC_API_KEY=sk-ant-" .env || \
           grep -q "GEMINI_API_KEY=AIza" .env || \
           grep -q "OPENROUTER_API_KEY=sk-or-" .env; then
            print_pass "At least one AI provider API key is configured"
        else
            print_warn "No AI provider API keys configured in .env"
        fi
    else
        print_fail ".env file does not exist"
        return 1
    fi
}

# Test 5: Docker Images
test_docker_images() {
    print_test "Checking Docker images..."
    
    local images=(
        "akilhassane/pantheon:frontend"
        "akilhassane/pantheon:backend"
        "akilhassane/pantheon:windows-tools-api"
    )
    
    for image in "${images[@]}"; do
        if docker images | grep -q "${image}"; then
            print_pass "Image ${image} is available"
        else
            print_fail "Image ${image} is not available"
        fi
    done
}

# Test 6: Running Containers
test_containers() {
    print_test "Checking running containers..."
    
    if docker ps | grep -q "pantheon-frontend"; then
        print_pass "Frontend container is running"
    else
        print_fail "Frontend container is not running"
    fi
    
    if docker ps | grep -q "pantheon-backend"; then
        print_pass "Backend container is running"
    else
        print_fail "Backend container is not running"
    fi
    
    if docker ps | grep -q "pantheon-windows-tools"; then
        print_pass "Windows Tools container is running"
    else
        print_fail "Windows Tools container is not running"
    fi
}

# Test 7: Container Health
test_container_health() {
    print_test "Checking container health..."
    
    # Frontend
    if docker ps --filter "name=pantheon-frontend" --format "{{.Status}}" | grep -q "healthy"; then
        print_pass "Frontend container is healthy"
    else
        print_warn "Frontend container health check failed or still starting"
    fi
    
    # Backend
    if docker ps --filter "name=pantheon-backend" --format "{{.Status}}" | grep -q "healthy"; then
        print_pass "Backend container is healthy"
    else
        print_warn "Backend container health check failed or still starting"
    fi
    
    # Windows Tools
    if docker ps --filter "name=pantheon-windows-tools" --format "{{.Status}}" | grep -q "healthy"; then
        print_pass "Windows Tools container is healthy"
    else
        print_warn "Windows Tools container health check failed or still starting"
    fi
}

# Test 8: Port Availability
test_ports() {
    print_test "Checking port availability..."
    
    # Frontend (3000)
    if curl -f http://localhost:3000 >/dev/null 2>&1; then
        print_pass "Frontend is accessible on port 3000"
    else
        print_fail "Frontend is not accessible on port 3000"
    fi
    
    # Backend (3002)
    if curl -f http://localhost:3002/health >/dev/null 2>&1; then
        print_pass "Backend is accessible on port 3002"
    else
        print_fail "Backend is not accessible on port 3002"
    fi
    
    # Windows Tools (3003)
    if curl -f http://localhost:3003/health >/dev/null 2>&1; then
        print_pass "Windows Tools API is accessible on port 3003"
    else
        print_fail "Windows Tools API is not accessible on port 3003"
    fi
}

# Test 9: Network Connectivity
test_network() {
    print_test "Checking network connectivity..."
    
    if docker network ls | grep -q "pantheon-network"; then
        print_pass "Pantheon network exists"
    else
        print_fail "Pantheon network does not exist"
    fi
}

# Test 10: Volumes
test_volumes() {
    print_test "Checking Docker volumes..."
    
    if docker volume ls | grep -q "pantheon-data"; then
        print_pass "Data volume exists"
    else
        print_warn "Data volume does not exist"
    fi
    
    if docker volume ls | grep -q "pantheon-windows-files"; then
        print_pass "Windows files volume exists"
    else
        print_warn "Windows files volume does not exist"
    fi
    
    if docker volume ls | grep -q "pantheon-workspaces"; then
        print_pass "Workspaces volume exists"
    else
        print_warn "Workspaces volume does not exist"
    fi
}

# Test 11: API Endpoints
test_api_endpoints() {
    print_test "Testing API endpoints..."
    
    # Backend health
    BACKEND_HEALTH=$(curl -s http://localhost:3002/health 2>/dev/null)
    if echo "$BACKEND_HEALTH" | grep -q "ok"; then
        print_pass "Backend health endpoint responds correctly"
    else
        print_fail "Backend health endpoint not responding correctly"
    fi
    
    # Windows Tools health
    TOOLS_HEALTH=$(curl -s http://localhost:3003/health 2>/dev/null)
    if echo "$TOOLS_HEALTH" | grep -q "healthy"; then
        print_pass "Windows Tools health endpoint responds correctly"
    else
        print_fail "Windows Tools health endpoint not responding correctly"
    fi
}

# Test 12: Disk Space
test_disk_space() {
    print_test "Checking disk space..."
    
    AVAILABLE_SPACE=$(df -BG . | awk 'NR==2 {print $4}' | sed 's/G//')
    
    if [ "$AVAILABLE_SPACE" -ge 10 ]; then
        print_pass "Sufficient disk space available (${AVAILABLE_SPACE}GB)"
    else
        print_warn "Low disk space: ${AVAILABLE_SPACE}GB available (10GB+ recommended)"
    fi
}

# Print summary
print_summary() {
    print_header "Test Summary"
    
    echo "Tests Passed:  $TESTS_PASSED"
    echo "Tests Failed:  $TESTS_FAILED"
    echo "Warnings:      $TESTS_WARNING"
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ All critical tests passed!${NC}"
        echo ""
        echo "Your Pantheon installation appears to be working correctly."
        echo "Access Pantheon at: http://localhost:3000"
        echo ""
        
        if [ $TESTS_WARNING -gt 0 ]; then
            echo -e "${YELLOW}⚠ There are $TESTS_WARNING warnings that should be addressed.${NC}"
            echo ""
        fi
    else
        echo -e "${RED}✗ $TESTS_FAILED tests failed!${NC}"
        echo ""
        echo "Your Pantheon installation has issues that need to be fixed."
        echo ""
        echo "Common fixes:"
        echo "  1. Make sure Docker is running"
        echo "  2. Configure .env file with your credentials"
        echo "  3. Restart services: docker-compose -f docker-compose.production.yml restart"
        echo "  4. Check logs: docker-compose -f docker-compose.production.yml logs"
        echo ""
        echo "For more help, see: ./docs/TROUBLESHOOTING.md"
        echo ""
    fi
}

# Main test flow
main() {
    clear
    
    print_header "Pantheon Installation Test"
    
    echo "This script will test your Pantheon installation and diagnose issues."
    echo ""
    
    # Run all tests
    test_docker
    test_docker_compose
    test_docker_daemon
    test_env_file
    test_docker_images
    test_containers
    test_container_health
    test_ports
    test_network
    test_volumes
    test_api_endpoints
    test_disk_space
    
    # Print summary
    print_summary
}

# Run main function
main
