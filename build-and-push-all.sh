#!/bin/bash
# Pantheon AI Platform - Build and Push All Images to Docker Hub
# This script builds all Docker images and pushes them to Docker Hub

set -e

# Color functions
print_success() { echo -e "\033[0;32m✓ $1\033[0m"; }
print_info() { echo -e "\033[0;36mℹ $1\033[0m"; }
print_warning() { echo -e "\033[0;33m⚠ $1\033[0m"; }
print_error() { echo -e "\033[0;31m✗ $1\033[0m"; }
print_step() { echo -e "\033[0;35m▶ $1\033[0m"; }

# Configuration
DOCKER_USERNAME="akilhassane"
DOCKER_REPO="pantheon"

# Banner
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     PANTHEON AI PLATFORM - BUILD & PUSH ALL IMAGES           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF

echo ""
print_info "This script will build and push all Pantheon images to Docker Hub"
print_warning "This process will take 1-3 hours depending on your system"
print_warning "Ensure you have 100GB+ free disk space"
echo ""

read -p "Continue? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Cancelled"
    exit 0
fi

# Check if logged in to Docker Hub
print_step "Checking Docker Hub login..."
if ! docker info | grep -q "Username"; then
    print_warning "Not logged in to Docker Hub"
    print_info "Logging in..."
    docker login
fi
print_success "Logged in to Docker Hub"

# Function to build and push image
build_and_push() {
    local NAME=$1
    local TAG=$2
    local DOCKERFILE=$3
    local CONTEXT=$4
    local SIZE=$5
    
    echo ""
    print_step "Building $NAME ($SIZE)..."
    print_info "Dockerfile: $DOCKERFILE"
    print_info "Context: $CONTEXT"
    
    # Build image
    if [ -z "$DOCKERFILE" ]; then
        docker build -t ${DOCKER_USERNAME}/${DOCKER_REPO}:${TAG} ${CONTEXT}
    else
        docker build -f ${DOCKERFILE} -t ${DOCKER_USERNAME}/${DOCKER_REPO}:${TAG} ${CONTEXT}
    fi
    
    if [ $? -eq 0 ]; then
        print_success "Built ${DOCKER_USERNAME}/${DOCKER_REPO}:${TAG}"
        
        # Push image
        print_info "Pushing to Docker Hub..."
        docker push ${DOCKER_USERNAME}/${DOCKER_REPO}:${TAG}
        
        if [ $? -eq 0 ]; then
            print_success "Pushed ${DOCKER_USERNAME}/${DOCKER_REPO}:${TAG}"
            return 0
        else
            print_error "Failed to push ${DOCKER_USERNAME}/${DOCKER_REPO}:${TAG}"
            return 1
        fi
    else
        print_error "Failed to build ${DOCKER_USERNAME}/${DOCKER_REPO}:${TAG}"
        return 1
    fi
}

# Track success/failure
TOTAL=0
SUCCESS=0
FAILED=0

# Build and push core services
print_info "\n=== Building Core Services ===\n"

# Frontend
((TOTAL++))
if build_and_push "Frontend" "frontend" "docker/Dockerfile.frontend" "." "~3.8GB"; then
    ((SUCCESS++))
else
    ((FAILED++))
fi

# Backend
((TOTAL++))
if build_and_push "Backend" "backend" "docker/Dockerfile.backend" "." "~431MB"; then
    ((SUCCESS++))
else
    ((FAILED++))
fi

# Windows Tools API
((TOTAL++))
if build_and_push "Windows Tools API" "windows-tools-api" "" "docker/windows-tools-api" "~1.2GB"; then
    ((SUCCESS++))
else
    ((FAILED++))
fi

# Build and push OS images
print_info "\n=== Building OS Images ===\n"

# Ubuntu 24
print_warning "Ubuntu 24 build will take 10-15 minutes"
read -p "Build Ubuntu 24 image? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ((TOTAL++))
    if build_and_push "Ubuntu 24" "ubuntu-24" "" "docker/ubuntu-24" "~2GB"; then
        ((SUCCESS++))
    else
        ((FAILED++))
    fi
fi

# Kali Linux
print_warning "Kali Linux build will take 15-20 minutes"
read -p "Build Kali Linux image? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ((TOTAL++))
    if build_and_push "Kali Linux" "kali-desktop" "" "docker/kali" "~3GB"; then
        ((SUCCESS++))
    else
        ((FAILED++))
    fi
fi

# Windows 11
print_warning "Windows 11 build will take 30-60 minutes and requires 38GB+ disk space"
print_warning "You must have the Windows 11 snapshot already created"
read -p "Build Windows 11 image? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ((TOTAL++))
    if build_and_push "Windows 11" "windows-11-25h2" "docker/windows-11/Dockerfile.snapshot-embedded" "docker/windows-11" "~38GB"; then
        ((SUCCESS++))
    else
        ((FAILED++))
    fi
fi

# Summary
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                      BUILD SUMMARY                            ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

print_info "Total images: $TOTAL"
print_success "Successfully built and pushed: $SUCCESS"
if [ $FAILED -gt 0 ]; then
    print_error "Failed: $FAILED"
fi

echo ""

if [ $FAILED -eq 0 ]; then
    print_success "All images built and pushed successfully!"
    echo ""
    print_info "Images available at:"
    echo "  https://hub.docker.com/r/${DOCKER_USERNAME}/${DOCKER_REPO}"
    echo ""
    print_info "Users can now install with:"
    echo "  curl -fsSL https://raw.githubusercontent.com/akilhassane/pantheon/main/install.sh | bash"
else
    print_warning "Some images failed to build/push"
    print_info "Review the errors above and try building failed images individually"
fi

echo ""
print_info "Next steps:"
echo "  1. Test installation: ./test-installation.sh"
echo "  2. Create GitHub repository"
echo "  3. Add screenshots and videos"
echo "  4. Announce release"
echo ""

