# Complete Pantheon Deployment Pipeline
# This script automates: verify → build → push → deploy → git push

param(
    [switch]$SkipVerify = $false,
    [switch]$SkipBuild = $false,
    [switch]$SkipDockerPush = $false,
    [switch]$SkipDeploy = $false,
    [switch]$SkipGitPush = $false,
    [string]$CommitMessage = "Update: Pantheon deployment with network configurations"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Pantheon Complete Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify Setup
if (-not $SkipVerify) {
    Write-Host "Step 1: Verifying setup..." -ForegroundColor Yellow
    Write-Host ""
    & .\verify-setup.ps1
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "✗ Verification failed. Please fix issues before continuing." -ForegroundColor Red
        exit 1
    }
    Write-Host ""
    Read-Host "Press Enter to continue with build"
}

# Step 2: Build and Push to DockerHub
if (-not $SkipBuild -and -not $SkipDockerPush) {
    Write-Host ""
    Write-Host "Step 2: Building and pushing images to DockerHub..." -ForegroundColor Yellow
    Write-Host ""
    & .\build-and-push.ps1
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "✗ Build/push failed." -ForegroundColor Red
        exit 1
    }
} elseif (-not $SkipBuild) {
    Write-Host ""
    Write-Host "Step 2: Building images (skipping push)..." -ForegroundColor Yellow
    Write-Host ""
    & .\build-and-push.ps1 -SkipPush
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "✗ Build failed." -ForegroundColor Red
        exit 1
    }
}

# Step 3: Deploy locally (optional)
if (-not $SkipDeploy) {
    Write-Host ""
    Write-Host "Step 3: Deploying locally..." -ForegroundColor Yellow
    Write-Host ""
    $deploy = Read-Host "Deploy locally to test? (yes/no)"
    if ($deploy -eq "yes") {
        & .\deploy.ps1
        if ($LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-Host "✗ Deployment failed." -ForegroundColor Red
            exit 1
        }
        Write-Host ""
        Write-Host "✓ Local deployment successful" -ForegroundColor Green
        Write-Host ""
        Read-Host "Press Enter to continue with Git push"
    }
}

# Step 4: Push to GitHub
if (-not $SkipGitPush) {
    Write-Host ""
    Write-Host "Step 4: Pushing to GitHub..." -ForegroundColor Yellow
    Write-Host ""
    & .\git-push.ps1 -CommitMessage $CommitMessage
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "✗ Git push failed." -ForegroundColor Red
        exit 1
    }
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Resources:" -ForegroundColor Cyan
Write-Host "  DockerHub: https://hub.docker.com/u/akilhassane" -ForegroundColor White
Write-Host "  GitHub: https://github.com/akilhassane/pantheon" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Verify images on DockerHub" -ForegroundColor White
Write-Host "  2. Test deployment on a fresh machine" -ForegroundColor White
Write-Host "  3. Update documentation if needed" -ForegroundColor White
Write-Host ""
