#!/bin/bash

###############################################################################
# Update GitHub Repository with New Documentation
# 
# This script:
# 1. Removes old documentation from main branch
# 2. Adds new comprehensive documentation
# 3. Creates assets folder structure
# 4. Commits and pushes to GitHub
#
# Usage:
#   bash update-github-docs.sh
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}ℹ ${1}${NC}"
}

print_success() {
    echo -e "${GREEN}✓ ${1}${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ ${1}${NC}"
}

print_error() {
    echo -e "${RED}✗ ${1}${NC}"
}

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Check if git is installed
if ! command -v git &> /dev/null; then
    print_error "Git is not installed"
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not in a git repository"
    exit 1
fi

print_header "Updating GitHub Repository Documentation"

# Create assets folder structure
print_info "Creating assets folder structure..."
mkdir -p assets
touch assets/.gitkeep

# Create placeholder files for images
cat > assets/README.md << 'EOF'
# Pantheon Assets

This folder contains images and media for documentation.

## Required Images

Please add the following images to complete the documentation:

### Logos and Branding
- [ ] `pantheon-logo.png` - Main Pantheon logo (recommended: 512x512px)
- [ ] `pantheon-icon.png` - Icon version (recommended: 128x128px)

### Screenshots
- [ ] `login-screen.png` - Login page screenshot
- [ ] `account-creation.png` - Account creation form
- [ ] `main-interface.png` - Main Pantheon interface
- [ ] `create-project.png` - Project creation modal
- [ ] `ai-settings.png` - AI settings page
- [ ] `service-status.png` - Service status check
- [ ] `supabase-config.png` - Supabase dashboard showing API credentials

### Demo Media
- [ ] `demo.gif` - Animated demo of Pantheon in action (recommended: 800x600px)
- [ ] `install-demo-linux.gif` - Linux installation process
- [ ] `install-demo-windows.gif` - Windows installation process

### Video Thumbnails
- [ ] `video-thumbnail.png` - Thumbnail for demo video (recommended: 1280x720px)

## Image Guidelines

- Use PNG format for screenshots and logos
- Use GIF format for animations
- Optimize images for web (compress without losing quality)
- Use descriptive filenames
- Keep file sizes reasonable (<5MB per image)

## Tools for Creating Screenshots

- **Windows**: Snipping Tool, ShareX
- **macOS**: Command+Shift+4
- **Linux**: GNOME Screenshot, Flameshot

## Tools for Creating GIFs

- **All Platforms**: ScreenToGif, LICEcap, Kap
- **Online**: ezgif.com, gifski

## Video Recording

- **All Platforms**: OBS Studio
- **Windows**: Xbox Game Bar
- **macOS**: QuickTime Player
- **Linux**: SimpleScreenRecorder

---

Once you've added these images, remove this README or update it with credits.
EOF

print_success "Assets folder created"

# Create docs folder if it doesn't exist
mkdir -p docs

# Backup old README if it exists
if [ -f README.md ]; then
    print_info "Backing up old README.md..."
    cp README.md README.old.md
    print_success "Old README backed up to README.old.md"
fi

# Replace README with new version
print_info "Updating README.md..."
if [ -f README_NEW.md ]; then
    mv README_NEW.md README.md
    print_success "README.md updated"
else
    print_warning "README_NEW.md not found, skipping"
fi

# Create .gitignore for assets if needed
if [ ! -f assets/.gitignore ]; then
    cat > assets/.gitignore << 'EOF'
# Ignore temporary files
*.tmp
*.bak
*~

# But keep the structure
!.gitkeep
!README.md
EOF
    print_success "Created assets/.gitignore"
fi

# Git operations
print_header "Committing Changes to Git"

# Check if there are changes
if git diff --quiet && git diff --cached --quiet; then
    print_warning "No changes to commit"
else
    print_info "Staging changes..."
    
    # Stage new files
    git add README.md
    git add docs/
    git add assets/
    git add install-pantheon.sh
    git add install-pantheon.ps1
    git add test-installation.sh
    git add update-github-docs.sh
    git add docker-compose.production.yml
    
    # Stage any other documentation files
    git add *.md 2>/dev/null || true
    
    print_success "Changes staged"
    
    # Show what will be committed
    print_info "Files to be committed:"
    git status --short
    echo ""
    
    # Confirm commit
    read -p "Do you want to commit these changes? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Committing changes..."
        
        git commit -m "docs: Complete documentation overhaul for Pantheon

- Add comprehensive installation guide with automated installers
- Add detailed troubleshooting guide
- Add architecture documentation
- Add installation test script
- Update README with better structure and information
- Create assets folder structure for images
- Add Docker Compose production configuration

This commit provides complete documentation for users to:
- Install Pantheon on any platform
- Understand the architecture
- Troubleshoot common issues
- Test their installation
"
        
        print_success "Changes committed"
        
        # Ask about pushing
        read -p "Do you want to push to GitHub? (y/N): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Pushing to GitHub..."
            
            # Get current branch
            BRANCH=$(git rev-parse --abbrev-ref HEAD)
            
            # Push
            if git push origin "$BRANCH"; then
                print_success "Pushed to GitHub successfully"
            else
                print_error "Failed to push to GitHub"
                print_info "You may need to set up authentication or check your remote"
                exit 1
            fi
        else
            print_info "Skipping push. You can push later with: git push origin $(git rev-parse --abbrev-ref HEAD)"
        fi
    else
        print_info "Commit cancelled"
        exit 0
    fi
fi

print_header "Next Steps"

echo "Documentation has been updated! Here's what to do next:"
echo ""
echo "1. Add images to the assets/ folder:"
echo "   - See assets/README.md for required images"
echo "   - Take screenshots of Pantheon interface"
echo "   - Create demo GIFs"
echo "   - Record installation video"
echo ""
echo "2. Update placeholder links in documentation:"
echo "   - Discord server link"
echo "   - Twitter/social media links"
echo "   - Support email"
echo "   - Video URLs"
echo ""
echo "3. Test the installation scripts:"
echo "   - bash install-pantheon.sh (Linux/macOS)"
echo "   - powershell install-pantheon.ps1 (Windows)"
echo "   - bash test-installation.sh"
echo ""
echo "4. Review and customize:"
echo "   - README.md"
echo "   - docs/INSTALLATION_GUIDE.md"
echo "   - docs/TROUBLESHOOTING.md"
echo "   - docs/ARCHITECTURE.md"
echo ""
echo "5. Push images to GitHub:"
echo "   git add assets/"
echo "   git commit -m 'docs: Add documentation images'"
echo "   git push"
echo ""

print_success "Documentation update complete!"
