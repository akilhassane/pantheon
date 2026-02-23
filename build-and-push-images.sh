#!/bin/bash

# Pantheon AI Platform - Build and Push All Docker Images
# This script builds all Docker images and pushes them to Docker Hub

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DOCKER_USERNAME="akilhassane"
DOCKER_REPO="pantheon"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                                            ║${NC}"
echo -e "${BLUE}║              Pantheon Docker Image Build & Push Script                     ║${NC}"
echo -e "${BLUE}║                                                                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════════════╝${NC}\n"

# Check if logged in to Docker Hub
echo -e "${BLUE}[1/6] Checking Docker Hub authentication...${NC}"
if ! docker info | grep -q "Username: $DOCKER_USERNAME"; then
    echo -e "${YELLOW}Not logged in to Docker Hub. Please login:${NC}"
    docker login
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to login to Docker Hub${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✓ Authenticated as $DOCKER_USERNAME${NC}\n"

# Build Frontend
echo -e "${BLUE}[2/6] Building Frontend image...${NC}"
echo -e "${YELLOW}Building Next.js application...${NC}"
docker build \
    -t ${DOCKER_USERNAME}/${DOCKER_REPO}:frontend \
    -f frontend/Dockerfile \
    --build-arg NEXT_PUBLIC_SUPABASE_URL=http://localhost:5432 \
    --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=default-anon-key \
    --build-arg NEXT_PUBLIC_API_URL=http://localhost:3002 \
    ./frontend

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Frontend image built successfully${NC}"
    
    echo -e "${YELLOW}Pushing to Docker Hub...${NC}"
    docker push ${DOCKER_USERNAME}/${DOCKER_REPO}:frontend
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Frontend image pushed successfully${NC}\n"
    else
        echo -e "${RED}✗ Failed to push frontend image${NC}\n"
        exit 1
    fi
else
    echo -e "${RED}✗ Failed to build frontend image${NC}\n"
    exit 1
fi

# Build Backend
echo -e "${BLUE}[3/6] Building Backend image...${NC}"
echo -e "${YELLOW}Building Node.js API server...${NC}"
docker build \
    -t ${DOCKER_USERNAME}/${DOCKER_REPO}:backend \
    -f backend/Dockerfile \
    .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backend image built successfully${NC}"
    
    echo -e "${YELLOW}Pushing to Docker Hub...${NC}"
    docker push ${DOCKER_USERNAME}/${DOCKER_REPO}:backend
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Backend image pushed successfully${NC}\n"
    else
        echo -e "${RED}✗ Failed to push backend image${NC}\n"
        exit 1
    fi
else
    echo -e "${RED}✗ Failed to build backend image${NC}\n"
    exit 1
fi

# Build PostgreSQL
echo -e "${BLUE}[4/6] Building PostgreSQL image...${NC}"
echo -e "${YELLOW}Building database with migrations...${NC}"
docker build \
    -t ${DOCKER_USERNAME}/${DOCKER_REPO}:postgres \
    -f docker/postgres/Dockerfile \
    .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ PostgreSQL image built successfully${NC}"
    
    echo -e "${YELLOW}Pushing to Docker Hub...${NC}"
    docker push ${DOCKER_USERNAME}/${DOCKER_REPO}:postgres
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ PostgreSQL image pushed successfully${NC}\n"
    else
        echo -e "${RED}✗ Failed to push PostgreSQL image${NC}\n"
        exit 1
    fi
else
    echo -e "${RED}✗ Failed to build PostgreSQL image${NC}\n"
    exit 1
fi

# Build Keycloak
echo -e "${BLUE}[5/6] Building Keycloak image...${NC}"
echo -e "${YELLOW}Building authentication server...${NC}"
docker build \
    -t ${DOCKER_USERNAME}/${DOCKER_REPO}:keycloak \
    -f docker/keycloak/Dockerfile \
    .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Keycloak image built successfully${NC}"
    
    echo -e "${YELLOW}Pushing to Docker Hub...${NC}"
    docker push ${DOCKER_USERNAME}/${DOCKER_REPO}:keycloak
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Keycloak image pushed successfully${NC}\n"
    else
        echo -e "${RED}✗ Failed to push Keycloak image${NC}\n"
        exit 1
    fi
else
    echo -e "${RED}✗ Failed to build Keycloak image${NC}\n"
    exit 1
fi

# Build Windows Tools API (if source exists)
echo -e "${BLUE}[6/6] Building Windows Tools API image...${NC}"
if [ -f "docker/windows-tools-api/server.js" ]; then
    echo -e "${YELLOW}Building Windows automation tools...${NC}"
    docker build \
        -t ${DOCKER_USERNAME}/${DOCKER_REPO}:windows-tools-api \
        -f docker/windows-tools-api/Dockerfile \
        ./docker/windows-tools-api

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Windows Tools API image built successfully${NC}"
        
        echo -e "${YELLOW}Pushing to Docker Hub...${NC}"
        docker push ${DOCKER_USERNAME}/${DOCKER_REPO}:windows-tools-api
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Windows Tools API image pushed successfully${NC}\n"
        else
            echo -e "${RED}✗ Failed to push Windows Tools API image${NC}\n"
            exit 1
        fi
    else
        echo -e "${RED}✗ Failed to build Windows Tools API image${NC}\n"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ Windows Tools API source not found, skipping...${NC}"
    echo -e "${YELLOW}Note: Using existing image from Docker Hub${NC}\n"
fi

# Summary
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║  ✓ All images built and pushed successfully!                 ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}║  Images available at:                                        ║${NC}"
echo -e "${GREEN}║  - ${DOCKER_USERNAME}/${DOCKER_REPO}:frontend                           ║${NC}"
echo -e "${GREEN}║  - ${DOCKER_USERNAME}/${DOCKER_REPO}:backend                            ║${NC}"
echo -e "${GREEN}║  - ${DOCKER_USERNAME}/${DOCKER_REPO}:postgres                           ║${NC}"
echo -e "${GREEN}║  - ${DOCKER_USERNAME}/${DOCKER_REPO}:keycloak                           ║${NC}"
echo -e "${GREEN}║  - ${DOCKER_USERNAME}/${DOCKER_REPO}:windows-tools-api                  ║${NC}"
echo -e "${GREEN}║                                                               ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${BLUE}Next steps:${NC}"
echo -e "  1. Test the images: ${YELLOW}docker compose -f docker-compose.production.yml pull${NC}"
echo -e "  2. Run locally: ${YELLOW}docker compose -f docker-compose.production.yml up -d${NC}"
echo -e "  3. Commit and push to GitHub: ${YELLOW}git add . && git commit -m 'Update Docker images' && git push${NC}"
echo ""
