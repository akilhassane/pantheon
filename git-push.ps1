# Push Pantheon to GitHub
# This script initializes git (if needed) and pushes to akilhassane/pantheon

param(
    [string]$CommitMessage = "Initial commit: Pantheon AI Backend with Windows VM integration"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Push to GitHub" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if git is installed
Write-Host "Checking Git..." -ForegroundColor Yellow
try {
    git --version | Out-Null
    Write-Host "✓ Git is installed" -ForegroundColor Green
} catch {
    Write-Host "✗ Git is not installed. Please install Git first." -ForegroundColor Red
    exit 1
}

# Check if .git directory exists
if (-not (Test-Path ".git")) {
    Write-Host ""
    Write-Host "Initializing Git repository..." -ForegroundColor Yellow
    git init
    Write-Host "✓ Git repository initialized" -ForegroundColor Green
}

# Check if remote exists
$remoteUrl = git remote get-url origin 2>$null
if (-not $remoteUrl) {
    Write-Host ""
    Write-Host "Adding GitHub remote..." -ForegroundColor Yellow
    git remote add origin https://github.com/akilhassane/pantheon.git
    Write-Host "✓ Remote added: https://github.com/akilhassane/pantheon.git" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Remote already configured: $remoteUrl" -ForegroundColor Cyan
}

# Check for changes
Write-Host ""
Write-Host "Checking for changes..." -ForegroundColor Yellow
$status = git status --porcelain
if (-not $status) {
    Write-Host "✓ No changes to commit" -ForegroundColor Green
    Write-Host ""
    $push = Read-Host "Push to GitHub anyway? (yes/no)"
    if ($push -ne "yes") {
        Write-Host "Cancelled" -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "✓ Changes detected" -ForegroundColor Green
    
    # Show what will be committed
    Write-Host ""
    Write-Host "Files to be committed:" -ForegroundColor Cyan
    git status --short
    
    Write-Host ""
    $confirm = Read-Host "Commit and push these changes? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Host "Cancelled" -ForegroundColor Yellow
        exit 0
    }
    
    # Add all files (respecting .gitignore)
    Write-Host ""
    Write-Host "Adding files..." -ForegroundColor Yellow
    git add .
    Write-Host "✓ Files added" -ForegroundColor Green
    
    # Commit
    Write-Host ""
    Write-Host "Committing changes..." -ForegroundColor Yellow
    git commit -m $CommitMessage
    Write-Host "✓ Changes committed" -ForegroundColor Green
}

# Push to GitHub
Write-Host ""
Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
Write-Host "Repository: https://github.com/akilhassane/pantheon" -ForegroundColor Cyan

# Check if main branch exists
$currentBranch = git branch --show-current
if (-not $currentBranch) {
    $currentBranch = "main"
    git branch -M main
}

Write-Host "Branch: $currentBranch" -ForegroundColor Cyan

# Push
git push -u origin $currentBranch

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Successfully Pushed to GitHub!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Repository URL:" -ForegroundColor Cyan
    Write-Host "  https://github.com/akilhassane/pantheon" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "✗ Failed to push to GitHub" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "  1. Repository doesn't exist - create it at https://github.com/new" -ForegroundColor Cyan
    Write-Host "  2. Authentication failed - configure Git credentials" -ForegroundColor Cyan
    Write-Host "  3. Branch protection - check repository settings" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}
