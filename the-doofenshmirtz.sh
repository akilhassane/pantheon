#!/bin/bash
# The Doofenshmirtz - Pantheon Uninstaller
# Removes all Pantheon containers, networks, volumes, and images

KEEP_IMAGES=false
KEEP_VOLUMES=false
FORCE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --keep-images)
            KEEP_IMAGES=true
            shift
            ;;
        --keep-volumes)
            KEEP_VOLUMES=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--keep-images] [--keep-volumes] [--force]"
            exit 1
            ;;
    esac
done

echo ""
echo "========================================"
echo "  THE DOOFENSHMIRTZ"
echo "  Pantheon Uninstaller"
echo "========================================"
echo ""

if [ "$FORCE" = false ]; then
    echo "This will remove:"
    echo "  - All Pantheon containers"
    echo "  - All project networks"
    if [ "$KEEP_VOLUMES" = false ]; then
        echo "  - All data volumes (DATABASE WILL BE DELETED)"
    fi
    if [ "$KEEP_IMAGES" = false ]; then
        echo "  - All Pantheon images"
    fi
    echo ""
    read -p "Are you sure? Type 'UNINSTALL' to confirm: " confirm
    if [ "$confirm" != "UNINSTALL" ]; then
        echo "Cancelled"
        exit 0
    fi
fi

echo ""
echo "Step 1: Stopping containers..."
containers=(
    "pantheon-frontend"
    "pantheon-backend"
    "pantheon-postgres"
    "pantheon-keycloak"
    "windows-tools-api"
)

for container in "${containers[@]}"; do
    if docker ps -a --format "{{.Names}}" | grep -q "^${container}$"; then
        echo "  Stopping $container..."
        docker stop "$container" 2>/dev/null
        docker rm "$container" 2>/dev/null
        echo "  Removed $container"
    fi
done

# Remove project containers
echo ""
echo "Step 2: Removing project containers..."
for container in $(docker ps -a --format "{{.Names}}" | grep -E "windows-project-|shared-folder-"); do
    echo "  Removing $container..."
    docker stop "$container" 2>/dev/null
    docker rm "$container" 2>/dev/null
done

echo ""
echo "Step 3: Removing networks..."
networks=("mcp-server_ai-network")
for network in $(docker network ls --format "{{.Name}}" | grep -E "project-.*-network"); do
    networks+=("$network")
done

for network in "${networks[@]}"; do
    if [ -n "$network" ]; then
        echo "  Removing $network..."
        docker network rm "$network" 2>/dev/null
    fi
done

if [ "$KEEP_VOLUMES" = false ]; then
    echo ""
    echo "Step 4: Removing volumes..."
    volumes=(
        "pantheon-postgres-data"
        "pantheon-windows-files"
    )
    
    for volume in "${volumes[@]}"; do
        if docker volume ls --format "{{.Name}}" | grep -q "^${volume}$"; then
            echo "  Removing $volume..."
            docker volume rm "$volume" 2>/dev/null
            echo "  Removed $volume"
        fi
    done
else
    echo ""
    echo "Step 4: Keeping volumes (--keep-volumes specified)"
fi

if [ "$KEEP_IMAGES" = false ]; then
    echo ""
    echo "Step 5: Removing images..."
    images=(
        "akilhassane/pantheon-backend:latest"
        "akilhassane/pantheon-frontend:latest"
        "akilhassane/pantheon-postgres:latest"
        "akilhassane/pantheon-keycloak:latest"
        "akilhassane/pantheon-windows-tools-api:latest"
    )
    
    for image in "${images[@]}"; do
        if docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "^${image}$"; then
            echo "  Removing $image..."
            docker rmi "$image" 2>/dev/null
            echo "  Removed $image"
        fi
    done
else
    echo ""
    echo "Step 5: Keeping images (--keep-images specified)"
fi

echo ""
echo "========================================"
echo "  Uninstall Complete!"
echo "========================================"
echo ""
echo "Pantheon has been removed from your system."
echo ""

if [ "$KEEP_VOLUMES" = true ]; then
    echo "Note: Data volumes were preserved."
    echo "To remove them manually:"
    echo "  docker volume rm pantheon-postgres-data pantheon-windows-files"
    echo ""
fi

if [ "$KEEP_IMAGES" = true ]; then
    echo "Note: Docker images were preserved."
    echo "To remove them manually:"
    echo "  docker rmi akilhassane/pantheon-backend:latest"
    echo "  docker rmi akilhassane/pantheon-frontend:latest"
    echo "  docker rmi akilhassane/pantheon-postgres:latest"
    echo "  docker rmi akilhassane/pantheon-keycloak:latest"
    echo "  docker rmi akilhassane/pantheon-windows-tools-api:latest"
    echo ""
fi
