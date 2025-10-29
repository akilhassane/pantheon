#!/bin/bash

# Kali Terminal Quick Start Script
# This script installs and starts ttyd on the Kali container

echo "🚀 Starting Kali Terminal Setup..."
echo ""

# Step 1: Check if container is running
echo "Step 1: Checking if kali-pentest container is running..."
if docker ps --filter "name=kali-pentest" --quiet | grep -q .; then
    echo "✅ Container is running"
else
    echo "❌ Container not running. Starting docker-compose..."
    docker-compose up -d
    sleep 10
fi

echo ""

# Step 2: Check if ttyd is installed
echo "Step 2: Checking if ttyd is installed..."
if docker exec kali-pentest which ttyd &>/dev/null; then
    echo "✅ ttyd is already installed"
else
    echo "Installing ttyd (this may take 1-2 minutes)..."
    docker exec -it kali-pentest bash -c "apt-get update && apt-get install -y ttyd"
    echo "✅ ttyd installed"
fi

echo ""

# Step 3: Start ttyd
echo "Step 3: Starting ttyd on port 7681..."
docker exec -d kali-pentest bash -c "pkill -f 'ttyd -p 7681' || true; sleep 1; ttyd -p 7681 bash"
echo "✅ ttyd started"

echo ""

# Step 4: Wait and verify
echo "Step 4: Waiting for service to be ready (10 seconds)..."
sleep 10

# Step 5: Test connection
echo "Step 5: Testing connection to ttyd..."
if curl -I http://localhost:7681 &>/dev/null; then
    echo "✅ ttyd is accessible at http://localhost:7681"
else
    echo "⚠️  Could not reach ttyd yet. It may still be starting..."
fi

echo ""
echo "🎉 Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Open browser: http://localhost:3000"
echo "2. Send a chat message"
echo "3. Terminal will appear in the center!"
echo ""
echo "Or access terminal directly: http://localhost:7681"



