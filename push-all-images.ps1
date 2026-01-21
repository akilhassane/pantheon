# Pantheon AI Platform - Push All Images to Docker Hub
# Run this after logging in to Docker Hub

Write-Host @"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     PANTHEON AI - PUSH ALL IMAGES TO DOCKER HUB             ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

Write-Host ""
Write-Host "This script will push all Pantheon images to Docker Hub" -ForegroundColor Yellow
Write-Host "Make sure you're logged in to Docker Hub first!" -ForegroundColor Yellow
Write-Host ""

# Check if logged in
$dockerInfo = docker info 2>&1
if ($dockerInfo -notmatch "Username") {
    Write-Host "ERROR: Not logged in to Docker Hub!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please login first:" -ForegroundColor Yellow
    Write-Host "  docker login" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Username: akilhassane7@gmail.com" -ForegroundColor Cyan
    Write-Host "Password: Your Docker Hub password or access token" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To create an access token:" -ForegroundColor Yellow
    Write-Host "  1. Go to https://hub.docker.com/settings/security" -ForegroundColor Cyan
    Write-Host "  2. Click 'New Access Token'" -ForegroundColor Cyan
    Write-Host "  3. Use token as password" -ForegroundColor Cyan
    exit 1
}

Write-Host "✓ Logged in to Docker Hub" -ForegroundColor Green
Write-Host ""

# List of images to push
$images = @(
    @{Name="Frontend"; Tag="frontend"; Size="3.78GB"; Time="10-20 min"},
    @{Name="Backend"; Tag="backend"; Size="431MB"; Time="2-5 min"},
    @{Name="Windows Tools API"; Tag="windows-tools-api"; Size="1.22GB"; Time="5-10 min"},
    @{Name="Windows 11"; Tag="windows-11-25h2"; Size="38.2GB"; Time="1-3 hours"; Optional=$true}
)

$totalPushed = 0
$totalFailed = 0

foreach ($image in $images) {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "Pushing: $($image.Name)" -ForegroundColor Cyan
    Write-Host "Tag: akilhassane/pantheon:$($image.Tag)" -ForegroundColor Cyan
    Write-Host "Size: $($image.Size)" -ForegroundColor Yellow
    Write-Host "Estimated time: $($image.Time)" -ForegroundColor Yellow
    
    if ($image.Optional) {
        Write-Host ""
        Write-Host "This is a large image and will take a long time to push." -ForegroundColor Yellow
        $response = Read-Host "Push this image? (y/n)"
        if ($response -ne 'y') {
            Write-Host "Skipping $($image.Name)" -ForegroundColor Yellow
            continue
        }
    }
    
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    
    # Check if image exists locally
    $imageExists = docker images akilhassane/pantheon:$($image.Tag) --format "{{.Repository}}:{{.Tag}}"
    if (-not $imageExists) {
        Write-Host "✗ Image not found locally: akilhassane/pantheon:$($image.Tag)" -ForegroundColor Red
        Write-Host "  Please build this image first" -ForegroundColor Yellow
        $totalFailed++
        continue
    }
    
    # Push image
    Write-Host "Pushing akilhassane/pantheon:$($image.Tag)..." -ForegroundColor Cyan
    docker push akilhassane/pantheon:$($image.Tag)
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Successfully pushed $($image.Name)" -ForegroundColor Green
        $totalPushed++
    } else {
        Write-Host "✗ Failed to push $($image.Name)" -ForegroundColor Red
        $totalFailed++
    }
}

# Summary
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "                    PUSH SUMMARY                           " -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Successfully pushed: $totalPushed" -ForegroundColor Green
if ($totalFailed -gt 0) {
    Write-Host "Failed: $totalFailed" -ForegroundColor Red
}
Write-Host ""

if ($totalFailed -eq 0 -and $totalPushed -gt 0) {
    Write-Host "✓ All images pushed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Build and push OS images (Ubuntu, Kali)" -ForegroundColor Yellow
    Write-Host "  2. Create GitHub repository" -ForegroundColor Yellow
    Write-Host "  3. Test installation" -ForegroundColor Yellow
    Write-Host "  4. Add screenshots and videos" -ForegroundColor Yellow
    Write-Host "  5. Create release" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "See FINAL_DEPLOYMENT_GUIDE.md for detailed instructions" -ForegroundColor Cyan
} else {
    Write-Host "Some images failed to push. Please check the errors above." -ForegroundColor Yellow
}

Write-Host ""
