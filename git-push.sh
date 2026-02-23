#!/bin/bash
# Push Pantheon to GitHub
# This script initializes git (if needed) and pushes to akilhassane/pantheon

set -e

COMMIT_MESSAGE="${1:-Initial commit: Pantheon AI Backend with Windows VM integration}"

echo "========================================"
echo "  Push to GitHub"
echo "========================================"
echo ""

# Check if git is installed
echo "Checking Git..."
if ! command -v git &> /dev/null; then
    echo "✗ Git is not installed. Please install Git first."
    exit 1
fi
echo "✓ Git is installed"

# Check if .git directory exists
if [ ! -d ".git" ]; then
    echo ""
    echo "Initializing Git repository..."
    git init
    echo "✓ Git repository initialized"
fi

# Check if remote exists
remote_url=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$remote_url" ]; then
    echo ""
    echo "Adding GitHub remote..."
    git remote add origin https://github.com/akilhassane/pantheon.git
    echo "✓ Remote added: https://github.com/akilhassane/pantheon.git"
else
    echo ""
    echo "Remote already configured: $remote_url"
fi

# Check for changes
echo ""
echo "Checking for changes..."
status=$(git status --porcelain)
if [ -z "$status" ]; then
    echo "✓ No changes to commit"
    echo ""
    read -p "Push to GitHub anyway? (yes/no): " push
    if [ "$push" != "yes" ]; then
        echo "Cancelled"
        exit 0
    fi
else
    echo "✓ Changes detected"
    
    # Show what will be committed
    echo ""
    echo "Files to be committed:"
    git status --short
    
    echo ""
    read -p "Commit and push these changes? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Cancelled"
        exit 0
    fi
    
    # Add all files (respecting .gitignore)
    echo ""
    echo "Adding files..."
    git add .
    echo "✓ Files added"
    
    # Commit
    echo ""
    echo "Committing changes..."
    git commit -m "$COMMIT_MESSAGE"
    echo "✓ Changes committed"
fi

# Push to GitHub
echo ""
echo "Pushing to GitHub..."
echo "Repository: https://github.com/akilhassane/pantheon"

# Check if main branch exists
current_branch=$(git branch --show-current)
if [ -z "$current_branch" ]; then
    current_branch="main"
    git branch -M main
fi

echo "Branch: $current_branch"

# Push
git push -u origin $current_branch

echo ""
echo "========================================"
echo "  Successfully Pushed to GitHub!"
echo "========================================"
echo ""
echo "Repository URL:"
echo "  https://github.com/akilhassane/pantheon"
echo ""
