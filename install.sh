#!/bin/bash
# Pantheon AI Platform - Automated Installation Script
# This script installs and configures the entire Pantheon platform from Docker Hub
# Compatible with Linux and macOS

set -e

# Parse arguments
DEBUG=false
SKIP_DOCKER=false
SKIP_SUPABASE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --debug)
            DEBUG=true
            shift
            ;;
        --skip-docker)
            SKIP_DOCKER=true
            shift
            ;;
        --skip-supabase)
            SKIP_SUPABASE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Color functions
print_success() { echo -e "\033[0;32m$1\033[0m"; }
print_info() { echo -e "\033[0;36m$1\033[0m"; }
print_warning() { echo -e "\033[0;33m$1\033[0m"; }
print_error() { echo -e "\033[0;31m$1\033[0m"; }
print_debug() { if [ "$DEBUG" = true ]; then echo -e "\033[0;35m[DEBUG] $1\033[0m"; fi; }

# Banner
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║              PANTHEON AI PLATFORM INSTALLER                   ║
║                                                               ║
║  Multi-OS AI Assistant with Windows/Linux/macOS Support      ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF

print_info "\nStarting installation process...\n"

# Step 1: Check system requirements
print_info "Step 1/8: Checking system requirements..."
print_debug "Detecting operating system"

OS_TYPE=$(uname -s)
case "$OS_TYPE" in
    Linux*)
        OS_NAME="Linux"
        print_success "✓ Operating System: Linux"
        ;;
    Darwin*)
        OS_NAME="macOS"
        print_success "✓ Operating System: macOS"
        ;;
    *)
        print_error "✗ Unsupported operating system: $OS_TYPE"
        exit 1
        ;;
esac

# Check memory
if [ "$OS_NAME" = "Linux" ]; then
    MEMORY_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    MEMORY_GB=$((MEMORY_KB / 1024 / 1024))
elif [ "$OS_NAME" = "macOS" ]; then
    MEMORY_BYTES=$(sysctl -n hw.memsize)
    MEMORY_GB=$((MEMORY_BYTES / 1024 / 1024 / 1024))
fi

if [ "$MEMORY_GB" -lt 16 ]; then
    print_warning "⚠ Warning: System has ${MEMORY_GB}GB RAM. Recommended: 16GB+ for Windows projects"
else
    print_success "✓ Memory: ${MEMORY_GB}GB RAM"
fi

# Check disk space
DISK_FREE=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
if [ "$DISK_FREE" -lt 100 ]; then
    print_warning "⚠ Warning: Only ${DISK_FREE}GB free disk space. Recommended: 100GB+ for Windows images"
else
    print_success "✓ Disk Space: ${DISK_FREE}GB available"
fi

# Step 2: Check Docker installation
print_info "\nStep 2/8: Checking Docker installation..."
print_debug "Looking for Docker executable"

if [ "$SKIP_DOCKER" = false ]; then
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version)
        print_success "✓ Docker installed: $DOCKER_VERSION"
        
        # Check if Docker is running
        print_debug "Checking if Docker daemon is running"
        if ! docker info &> /dev/null; then
            print_error "✗ Docker is installed but not running. Please start Docker."
            exit 1
        fi
        print_success "✓ Docker daemon is running"
        
        # Check Docker Compose
        print_debug "Checking Docker Compose"
        if command -v docker-compose &> /dev/null; then
            COMPOSE_VERSION=$(docker-compose --version)
            print_success "✓ Docker Compose installed: $COMPOSE_VERSION"
        elif docker compose version &> /dev/null; then
            COMPOSE_VERSION=$(docker compose version)
            print_success "✓ Docker Compose (plugin) installed: $COMPOSE_VERSION"
        else
            print_error "✗ Docker Compose is not installed"
            exit 1
        fi
    else
        print_error "✗ Docker is not installed"
        print_info "Please install Docker from: https://docs.docker.com/get-docker/"
        exit 1
    fi
else
    print_warning "⚠ Skipping Docker check (--skip-docker flag)"
fi

# Step 3: Check Node.js installation
print_info "\nStep 3/8: Checking Node.js installation..."
print_debug "Looking for Node.js"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "✓ Node.js installed: $NODE_VERSION"
    
    NPM_VERSION=$(npm --version)
    print_success "✓ npm installed: $NPM_VERSION"
else
    print_error "✗ Node.js is not installed"
    print_info "Please install Node.js 18+ from: https://nodejs.org/"
    exit 1
fi

# Step 4: Create project directory structure
print_info "\nStep 4/8: Creating project directory structure..."
print_debug "Current directory: $(pwd)"

PROJECT_NAME="pantheon-ai"
if [ -d "$PROJECT_NAME" ]; then
    print_warning "⚠ Directory '$PROJECT_NAME' already exists"
    read -p "Do you want to continue? This will overwrite configuration files (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Installation cancelled"
        exit 0
    fi
else
    mkdir -p "$PROJECT_NAME"
    print_success "✓ Created project directory: $PROJECT_NAME"
fi

cd "$PROJECT_NAME"
print_debug "Changed to directory: $(pwd)"

# Step 5: Create docker-compose.yml
print_info "\nStep 5/8: Creating Docker Compose configuration..."
print_debug "Writing docker-compose.yml"

cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  frontend:
    image: akilhassane/pantheon:frontend
    container_name: pantheon-frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - NEXT_PUBLIC_API_URL=http://localhost:3002
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - pantheon-network

  backend:
    image: akilhassane/pantheon:backend
    container_name: pantheon-backend
    ports:
      - "3002:3002"
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - pantheon-data:/app/data
    restart: unless-stopped
    networks:
      - pantheon-network

  windows-tools-api:
    image: akilhassane/pantheon:windows-tools-api
    container_name: pantheon-windows-tools
    ports:
      - "3003:3003"
    restart: unless-stopped
    networks:
      - pantheon-network

networks:
  pantheon-network:
    driver: bridge

volumes:
  pantheon-data:
EOF

print_success "✓ Created docker-compose.yml"

# Step 6: Create .env file
print_info "\nStep 6/8: Creating environment configuration..."
print_debug "Writing .env file"

cat > .env << 'EOF'
# Supabase Configuration
# Get these from your Supabase project settings: https://supabase.com/dashboard
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Public Supabase Configuration (for frontend)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# AI Provider API Keys (at least one required)
# OpenAI: https://platform.openai.com/api-keys
OPENAI_API_KEY=your_openai_api_key_here

# Anthropic (Claude): https://console.anthropic.com/
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# OpenRouter (optional, for additional models): https://openrouter.ai/
OPENROUTER_API_KEY=your_openrouter_api_key_here
EOF

print_success "✓ Created .env file"
print_warning "⚠ IMPORTANT: You must edit .env file with your API keys before starting!"

# Step 7: Pull Docker images
print_info "\nStep 7/9: Pulling Docker images from Docker Hub..."
print_info "This may take 10-30 minutes depending on your internet connection..."
print_info "Total download size: ~5GB (Frontend: 3.8GB, Backend: 431MB, Windows Tools: 1.2GB)"
print_info "Optional: Windows 11 (38.2GB) - can be pulled later"

if [ "$SKIP_DOCKER" = false ]; then
    print_debug "Pulling frontend image"
    print_info "\nPulling frontend image (3.8GB)..."
    if ! docker pull akilhassane/pantheon:frontend; then
        print_error "✗ Failed to pull frontend image"
        print_info "Trying alternative registry..."
        if ! docker pull akilhassane/pantheon:frontend-latest; then
            print_error "✗ Failed to pull from alternative registry"
            exit 1
        fi
    fi
    print_success "✓ Frontend image pulled"
    
    print_debug "Pulling backend image"
    print_info "\nPulling backend image (431MB)..."
    if ! docker pull akilhassane/pantheon:backend; then
        print_error "✗ Failed to pull backend image"
        print_info "Trying alternative registry..."
        if ! docker pull akilhassane/pantheon:backend-latest; then
            print_error "✗ Failed to pull from alternative registry"
            exit 1
        fi
    fi
    print_success "✓ Backend image pulled"
    
    print_debug "Pulling windows-tools-api image"
    print_info "\nPulling Windows Tools API image (1.2GB)..."
    if ! docker pull akilhassane/pantheon:windows-tools-api; then
        print_warning "⚠ Failed to pull Windows Tools API image. This is optional for basic usage."
    else
        print_success "✓ Windows Tools API image pulled"
    fi
    
    print_debug "Pulling OS images"
    print_info "\nPulling Ubuntu 24 image (2GB)..."
    if ! docker pull akilhassane/pantheon:ubuntu-24; then
        print_warning "⚠ Failed to pull Ubuntu image. You can pull it later when creating Ubuntu projects."
    else
        print_success "✓ Ubuntu 24 image pulled"
    fi
    
    print_info "\nPulling Kali Linux image (3GB)..."
    if ! docker pull akilhassane/pantheon:kali-desktop; then
        print_warning "⚠ Failed to pull Kali image. You can pull it later when creating Kali projects."
    else
        print_success "✓ Kali Linux image pulled"
    fi
    
    print_debug "Asking about Windows 11 image"
    print_info "\nWindows 11 image (38.2GB) - Optional"
    print_warning "⚠ This is a very large download and will take 20-60 minutes."
    print_info "You can skip this now and pull it later when you need Windows projects."
    read -p "Pull Windows 11 image now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Pulling Windows 11 image... This will take a while."
        if ! docker pull akilhassane/pantheon:windows-11-25h2; then
            print_warning "⚠ Failed to pull Windows 11 image. You can pull it later with:"
            print_info "    docker pull akilhassane/pantheon:windows-11-25h2"
        else
            print_success "✓ Windows 11 image pulled"
        fi
    else
        print_info "Skipping Windows 11 image. Pull it later with:"
        print_info "    docker pull akilhassane/pantheon:windows-11-25h2"
    fi
else
    print_warning "⚠ Skipping Docker image pull (--skip-docker flag)"
fi

# Step 8: Create database initialization script
print_info "\nStep 8/9: Creating database initialization script..."
print_debug "Creating init-database.sh"

cat > init-database.sh << 'DBEOF'
#!/bin/bash
# Initialize Supabase database for Pantheon

set -e

echo -e "\033[0;36mInitializing Supabase database...\033[0m"

# Check if .env exists and is configured
if [ ! -f .env ]; then
    echo -e "\033[0;31mERROR: .env file not found!\033[0m"
    exit 1
fi

if grep -q "your_.*_here" .env; then
    echo -e "\033[0;31mERROR: Please configure your .env file first!\033[0m"
    exit 1
fi

# Load environment variables
source .env

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "\033[0;31mERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env\033[0m"
    exit 1
fi

echo "Creating database tables..."

# Run database initialization via backend container
docker-compose run --rm backend node /app/backend/database/init-database.js

echo -e "\033[0;32m✓ Database initialized successfully!\033[0m"
echo -e "\033[0;36mYou can now start the platform with: ./start.sh\033[0m"
DBEOF

chmod +x init-database.sh
print_success "✓ Created init-database.sh"

# Step 9: Create helper scripts
print_info "\nStep 9/9: Creating helper scripts..."
print_debug "Creating start.sh"

cat > start.sh << 'EOF'
#!/bin/bash
# Start Pantheon AI Platform
echo -e "\033[0;36mStarting Pantheon AI Platform...\033[0m"

# Check if .env is configured
if grep -q "your_.*_here" .env; then
    echo -e "\033[0;31mERROR: Please configure your .env file with actual API keys!\033[0m"
    echo -e "\033[0;33mEdit .env and replace 'your_*_here' with your actual keys\033[0m"
    exit 1
fi

# Use docker compose or docker-compose
if command -v docker-compose &> /dev/null; then
    docker-compose up -d
else
    docker compose up -d
fi

echo -e "\n\033[0;32mPantheon AI Platform is starting...\033[0m"
echo -e "\033[0;36mFrontend: http://localhost:3000\033[0m"
echo -e "\033[0;36mBackend API: http://localhost:3002\033[0m"
echo -e "\n\033[0;33mRun 'docker-compose logs -f' or 'docker compose logs -f' to view logs\033[0m"
EOF

chmod +x start.sh
print_success "✓ Created start.sh"

print_debug "Creating stop.sh"
cat > stop.sh << 'EOF'
#!/bin/bash
# Stop Pantheon AI Platform
echo -e "\033[0;33mStopping Pantheon AI Platform...\033[0m"

if command -v docker-compose &> /dev/null; then
    docker-compose down
else
    docker compose down
fi

echo -e "\033[0;32mPantheon AI Platform stopped\033[0m"
EOF

chmod +x stop.sh
print_success "✓ Created stop.sh"

print_debug "Creating logs.sh"
cat > logs.sh << 'EOF'
#!/bin/bash
# View Pantheon AI Platform logs
SERVICE=${1:-""}

if command -v docker-compose &> /dev/null; then
    if [ -z "$SERVICE" ]; then
        docker-compose logs -f
    else
        docker-compose logs -f "$SERVICE"
    fi
else
    if [ -z "$SERVICE" ]; then
        docker compose logs -f
    else
        docker compose logs -f "$SERVICE"
    fi
fi
EOF

chmod +x logs.sh
print_success "✓ Created logs.sh"

print_debug "Creating update.sh"
cat > update.sh << 'EOF'
#!/bin/bash
# Update Pantheon AI Platform images
echo -e "\033[0;36mUpdating Pantheon AI Platform images...\033[0m"

if command -v docker-compose &> /dev/null; then
    docker-compose pull
    docker-compose up -d
else
    docker compose pull
    docker compose up -d
fi

echo -e "\033[0;32mUpdate complete!\033[0m"
EOF

chmod +x update.sh
print_success "✓ Created update.sh"

# Installation complete
cat << "EOF"

╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║            INSTALLATION COMPLETED SUCCESSFULLY!               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

EOF

print_info "Next steps:"
echo "1. $(print_warning 'Edit .env file with your API keys (REQUIRED)')"
echo "   - Add your Supabase credentials"
echo "   - Add at least one AI provider API key (OpenAI, Anthropic, or OpenRouter)"
echo ""
echo "2. $(print_info 'Initialize the database:')"
echo "   ./init-database.sh"
echo ""
echo "3. $(print_info 'Start the platform:')"
echo "   ./start.sh"
echo ""
echo "4. $(print_info 'Open browser:')"
echo "   http://localhost:3000"

echo -e "\n\033[0;36mUseful commands:\033[0m"
echo "  ./start.sh           - Start the platform"
echo "  ./stop.sh            - Stop the platform"
echo "  ./logs.sh            - View logs"
echo "  ./logs.sh backend    - View backend logs only"
echo "  ./update.sh          - Update to latest version"
echo "  ./init-database.sh   - Reinitialize database"

echo -e "\n\033[0;33mDocumentation:\033[0m"
echo "  INSTALL.md  - Detailed installation guide"
echo "  USER_GUIDE.md - Complete user guide"
echo "  README.md - Project overview"

echo -e "\n\033[0;36mNeed help?\033[0m"
echo "  GitHub: https://github.com/akilhassane/pantheon"
echo "  Issues: https://github.com/akilhassane/pantheon/issues"

if [ "$DEBUG" = true ]; then
    print_debug "Installation completed in directory: $(pwd)"
    print_debug "Files created: docker-compose.yml, .env, start.sh, stop.sh, logs.sh, update.sh"
fi
