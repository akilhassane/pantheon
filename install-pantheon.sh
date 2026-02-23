#!/bin/bash

# Pantheon AI Platform - One-Click Installation Script
# This script sets up the entire Pantheon platform with zero configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
echo -e "${BLUE}"
cat << "EOF"
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║   ██████╗  █████╗ ███╗   ██╗████████╗██╗  ██╗███████╗ ██████╗ ███╗   ██╗   ║
║   ██╔══██╗██╔══██╗████╗  ██║╚══██╔══╝██║  ██║██╔════╝██╔═══██╗████╗  ██║   ║
║   ██████╔╝███████║██╔██╗ ██║   ██║   ███████║█████╗  ██║   ██║██╔██╗ ██║   ║
║   ██╔═══╝ ██╔══██║██║╚██╗██║   ██║   ██╔══██║██╔══╝  ██║   ██║██║╚██╗██║   ║
║   ██║     ██║  ██║██║ ╚████║   ██║   ██║  ██║███████╗╚██████╔╝██║ ╚████║   ║
║   ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═══╝   ║
║                                                                            ║
║                Multi-Agentic AI Platform for OS Interaction                ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${GREEN}Starting Pantheon installation...${NC}\n"

# Check if running as root (not recommended)
if [ "$EUID" -eq 0 ]; then 
    echo -e "${YELLOW}Warning: Running as root is not recommended.${NC}"
    echo -e "${YELLOW}Consider running as a regular user with Docker permissions.${NC}\n"
fi

# Step 1: Check prerequisites
echo -e "${BLUE}[1/7] Checking prerequisites...${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed.${NC}"
    echo -e "${YELLOW}Please install Docker from: https://docs.docker.com/get-docker/${NC}"
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed.${NC}"
    echo -e "${YELLOW}Please install Docker Compose from: https://docs.docker.com/compose/install/${NC}"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${RED}Error: Docker daemon is not running.${NC}"
    echo -e "${YELLOW}Please start Docker and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker installed: $(docker --version)${NC}"
echo -e "${GREEN}✓ Docker Compose installed${NC}"
echo -e "${GREEN}✓ Docker daemon is running${NC}\n"

# Step 2: Check if environment already exists
echo -e "${BLUE}[2/7] Checking existing installation...${NC}"

EXISTING_CONTAINERS=$(docker ps -a --filter "name=pantheon-" --format "{{.Names}}" | wc -l)

if [ "$EXISTING_CONTAINERS" -gt 0 ]; then
    echo -e "${YELLOW}Found existing Pantheon containers.${NC}"
    echo -e "${GREEN}Environment is already set up!${NC}"
    
    # Check if containers are running
    RUNNING_CONTAINERS=$(docker ps --filter "name=pantheon-" --format "{{.Names}}" | wc -l)
    
    if [ "$RUNNING_CONTAINERS" -eq "$EXISTING_CONTAINERS" ]; then
        echo -e "${GREEN}✓ All containers are running${NC}"
        echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║                                                                            ║${NC}"
        echo -e "${GREEN}║  🎉 Pantheon is ready to use!                                             ║${NC}"
        echo -e "${GREEN}║                                                                            ║${NC}"
        echo -e "${GREEN}║  Access the platform at: http://localhost:3000                            ║${NC}"
        echo -e "${GREEN}║                                                                            ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════════════╝${NC}\n"
        exit 0
    else
        echo -e "${YELLOW}Some containers are not running. Starting them...${NC}"
        docker compose -f docker-compose.production.yml up -d
        echo -e "${GREEN}✓ Containers started${NC}\n"
        echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║                                                                            ║${NC}"
        echo -e "${GREEN}║  🎉 Pantheon is ready to use!                                             ║${NC}"
        echo -e "${GREEN}║                                                                            ║${NC}"
        echo -e "${GREEN}║  Access the platform at: http://localhost:3000                            ║${NC}"
        echo -e "${GREEN}║                                                                            ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════════════╝${NC}\n"
        exit 0
    fi
fi

echo -e "${GREEN}✓ No existing installation found. Proceeding with fresh install...${NC}\n"

# Step 3: Download configuration file
echo -e "${BLUE}[3/7] Downloading configuration...${NC}"

if [ ! -f "docker-compose.production.yml" ]; then
    echo -e "${YELLOW}Downloading docker-compose.production.yml from GitHub...${NC}"
    curl -fsSL https://raw.githubusercontent.com/akilhassane/pantheon/main/docker-compose.production.yml -o docker-compose.production.yml
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Failed to download configuration file.${NC}"
        echo -e "${YELLOW}Please check your internet connection and try again.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Configuration downloaded${NC}\n"
else
    echo -e "${GREEN}✓ Configuration file already exists${NC}\n"
fi

# Step 4: Create .env file with defaults
echo -e "${BLUE}[4/7] Creating environment configuration...${NC}"

if [ ! -f ".env" ]; then
    cat > .env << 'ENVEOF'
# Pantheon AI Platform - Environment Configuration
# Generated automatically by install script

# Supabase Configuration (Optional - uses local PostgreSQL by default)
SUPABASE_URL=http://localhost:5432
SUPABASE_SERVICE_ROLE_KEY=default-service-key
SUPABASE_ANON_KEY=default-anon-key
NEXT_PUBLIC_SUPABASE_URL=http://localhost:5432
NEXT_PUBLIC_SUPABASE_ANON_KEY=default-anon-key

# AI Provider API Keys (Add your keys here to enable AI features)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
OPENROUTER_API_KEY=
GEMINI_API_KEY=
MISTRAL_API_KEY=
COHERE_API_KEY=

# MCP Configuration
MCP_MASTER_SECRET=default-master-secret

# Server Configuration
DEBUG=false
ANALYTICS_ID=

# Windows VM Configuration
HOST_WINDOWS_VM_FILES_PATH=/app/windows-vm-files
ENVEOF
    echo -e "${GREEN}✓ Environment file created (.env)${NC}"
    echo -e "${YELLOW}Note: You can add your AI provider API keys to .env later${NC}\n"
else
    echo -e "${GREEN}✓ Environment file already exists${NC}\n"
fi

# Step 5: Pull Docker images
echo -e "${BLUE}[5/7] Pulling Docker images from Docker Hub...${NC}"
echo -e "${YELLOW}This may take a few minutes depending on your internet speed...${NC}\n"

docker compose -f docker-compose.production.yml pull

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to pull Docker images.${NC}"
    echo -e "${YELLOW}Please check your internet connection and try again.${NC}"
    exit 1
fi

echo -e "\n${GREEN}✓ All images pulled successfully${NC}\n"

# Step 6: Start containers
echo -e "${BLUE}[6/7] Starting Pantheon containers...${NC}"
echo -e "${YELLOW}This will create and start all services...${NC}\n"

docker compose -f docker-compose.production.yml up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to start containers.${NC}"
    echo -e "${YELLOW}Check the logs with: docker compose -f docker-compose.production.yml logs${NC}"
    exit 1
fi

echo -e "\n${GREEN}✓ All containers started${NC}\n"

# Step 7: Wait for services to be healthy
echo -e "${BLUE}[7/7] Waiting for services to be ready...${NC}"
echo -e "${YELLOW}This may take up to 2 minutes...${NC}\n"

# Wait for backend to be healthy
echo -n "Waiting for backend... "
for i in {1..60}; do
    if docker exec pantheon-backend wget -q --spider http://localhost:3002/health 2>/dev/null; then
        echo -e "${GREEN}✓${NC}"
        break
    fi
    sleep 2
    echo -n "."
done

# Wait for frontend to be ready
echo -n "Waiting for frontend... "
for i in {1..60}; do
    if docker exec pantheon-frontend wget -q --spider http://localhost:3000 2>/dev/null; then
        echo -e "${GREEN}✓${NC}"
        break
    fi
    sleep 2
    echo -n "."
done

echo ""

# Final status check
echo -e "\n${BLUE}Checking container status...${NC}\n"
docker compose -f docker-compose.production.yml ps

# Success message
echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                                            ║${NC}"
echo -e "${GREEN}║  🎉 Installation Complete!                                                 ║${NC}"
echo -e "${GREEN}║                                                                            ║${NC}"
echo -e "${GREEN}║  Pantheon AI Platform is now running!                                     ║${NC}"
echo -e "${GREEN}║                                                                            ║${NC}"
echo -e "${GREEN}║  📱 Frontend:        http://localhost:3000                                 ║${NC}"
echo -e "${GREEN}║  🔧 Backend API:     http://localhost:3002                                 ║${NC}"
echo -e "${GREEN}║  🔐 Keycloak:        http://localhost:8080                                 ║${NC}"
echo -e "${GREEN}║  🗄️  PostgreSQL:      localhost:5432                                       ║${NC}"
echo -e "${GREEN}║  🪟 Windows Tools:   http://localhost:8090                                 ║${NC}"
echo -e "${GREEN}║                                                                            ║${NC}"
echo -e "${GREEN}║  📝 Next Steps:                                                            ║${NC}"
echo -e "${GREEN}║  1. Open http://localhost:3000 in your browser                            ║${NC}"
echo -e "${GREEN}║  2. Add your AI provider API keys to .env file                            ║${NC}"
echo -e "${GREEN}║  3. Restart: docker compose -f docker-compose.production.yml restart      ║${NC}"
echo -e "${GREEN}║                                                                            ║${NC}"
echo -e "${GREEN}║  📚 Documentation: https://github.com/akilhassane/pantheon                ║${NC}"
echo -e "${GREEN}║                                                                            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════════════╝${NC}\n"

# Useful commands
echo -e "${BLUE}Useful Commands:${NC}"
echo -e "  ${YELLOW}View logs:${NC}      docker compose -f docker-compose.production.yml logs -f"
echo -e "  ${YELLOW}Stop:${NC}           docker compose -f docker-compose.production.yml stop"
echo -e "  ${YELLOW}Start:${NC}          docker compose -f docker-compose.production.yml start"
echo -e "  ${YELLOW}Restart:${NC}        docker compose -f docker-compose.production.yml restart"
echo -e "  ${YELLOW}Remove:${NC}         docker compose -f docker-compose.production.yml down"
echo -e "  ${YELLOW}Remove + data:${NC}  docker compose -f docker-compose.production.yml down -v"
echo ""
