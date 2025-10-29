#!/bin/bash

# Build and Push Kali Docker Image to Docker Hub
# Usage: ./build_and_push.sh [version]

set -e

# Configuration
DOCKER_USERNAME="akilhassane"
DOCKER_REPO="mcp-pentest-forge"
VERSION=${1:-"latest"}
IMAGE_TAG="${DOCKER_USERNAME}/${DOCKER_REPO}:kali-${VERSION}"

echo "🚀 Building and Pushing Kali Docker Image"
echo "=========================================="
echo "Repository: ${DOCKER_USERNAME}/${DOCKER_REPO}"
echo "Tag: kali-${VERSION}"
echo ""

# Step 1: Build image
echo "Step 1️⃣  Building Docker image from Dockerfile.kali..."
docker build -f Dockerfile.kali -t ${IMAGE_TAG} --progress=plain .
echo "✅ Image built successfully: ${IMAGE_TAG}"
echo ""

# Step 2: Tag as latest if not already
if [ "$VERSION" != "latest" ]; then
    echo "Step 2️⃣  Tagging as latest..."
    docker tag ${IMAGE_TAG} ${DOCKER_USERNAME}/${DOCKER_REPO}:kali-latest
    echo "✅ Tagged: ${DOCKER_USERNAME}/${DOCKER_REPO}:kali-latest"
    echo ""
fi

# Step 3: Verify Docker login
echo "Step 3️⃣  Verifying Docker Hub login..."
if ! docker login; then
    echo "❌ Docker login failed. Please try again."
    exit 1
fi
echo ""

# Step 4: Push to Docker Hub
echo "Step 4️⃣  Pushing to Docker Hub..."
docker push ${IMAGE_TAG}
echo "✅ Pushed: ${IMAGE_TAG}"

if [ "$VERSION" != "latest" ]; then
    docker push ${DOCKER_USERNAME}/${DOCKER_REPO}:kali-latest
    echo "✅ Pushed: ${DOCKER_USERNAME}/${DOCKER_REPO}:kali-latest"
fi

echo ""
echo "🎉 Done! Your image is now on Docker Hub"
echo ""
echo "To use this image:"
echo "  docker pull ${IMAGE_TAG}"
echo "  docker run -it -p 7681:7681 -p 2222:2222 ${IMAGE_TAG}"
echo ""
echo "Then visit: http://localhost:7681 for web terminal"
echo "Or SSH: ssh -p 2222 pentester@localhost (password: pentester)"

