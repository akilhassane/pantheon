#!/bin/bash
# Complete Pantheon Deployment Pipeline
# This script automates: verify → build → push → deploy → git push

set -e

SKIP_VERIFY=false
SKIP_BUILD=false
SKIP_DOCKER_PUSH=false
SKIP_DEPLOY=false
SKIP_GIT_PUSH=false
COMMIT_MESSAGE="Update: Pantheon deployment with network configurations"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-verify)
            SKIP_VERIFY=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-docker-push)
            SKIP_DOCKER_PUSH=true
            shift
            ;;
        --skip-deploy)
            SKIP_DEPLOY=true
            shift
            ;;
        --skip-git-push)
            SKIP_GIT_PUSH=true
            shift
            ;;
        --message)
            COMMIT_MESSAGE="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--skip-verify] [--skip-build] [--skip-docker-push] [--skip-deploy] [--skip-git-push] [--message \"commit message\"]"
            exit 1
            ;;
    esac
done

echo "========================================"
echo "  Pantheon Complete Deployment"
echo "========================================"
echo ""

# Step 1: Verify Setup
if [ "$SKIP_VERIFY" = false ]; then
    echo "Step 1: Verifying setup..."
    echo ""
    ./verify-setup.sh
    echo ""
    read -p "Press Enter to continue with build"
fi

# Step 2: Build and Push to DockerHub
if [ "$SKIP_BUILD" = false ] && [ "$SKIP_DOCKER_PUSH" = false ]; then
    echo ""
    echo "Step 2: Building and pushing images to DockerHub..."
    echo ""
    ./build-and-push.sh
elif [ "$SKIP_BUILD" = false ]; then
    echo ""
    echo "Step 2: Building images (skipping push)..."
    echo ""
    ./build-and-push.sh --skip-push
fi

# Step 3: Deploy locally (optional)
if [ "$SKIP_DEPLOY" = false ]; then
    echo ""
    echo "Step 3: Deploying locally..."
    echo ""
    read -p "Deploy locally to test? (yes/no): " deploy
    if [ "$deploy" = "yes" ]; then
        ./deploy.sh
        echo ""
        echo "✓ Local deployment successful"
        echo ""
        read -p "Press Enter to continue with Git push"
    fi
fi

# Step 4: Push to GitHub
if [ "$SKIP_GIT_PUSH" = false ]; then
    echo ""
    echo "Step 4: Pushing to GitHub..."
    echo ""
    ./git-push.sh "$COMMIT_MESSAGE"
fi

# Summary
echo ""
echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo ""
echo "Resources:"
echo "  DockerHub: https://hub.docker.com/u/akilhassane"
echo "  GitHub: https://github.com/akilhassane/pantheon"
echo ""
echo "Next steps:"
echo "  1. Verify images on DockerHub"
echo "  2. Test deployment on a fresh machine"
echo "  3. Update documentation if needed"
echo ""
