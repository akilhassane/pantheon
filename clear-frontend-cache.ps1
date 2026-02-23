# Clear Next.js cache and rebuild frontend

Write-Host "Clearing Next.js cache..." -ForegroundColor Cyan

# Stop frontend container
Write-Host "Stopping frontend container..." -ForegroundColor Yellow
docker-compose -f docker-compose.yml stop ai-frontend

# Remove .next directory
Write-Host "Removing .next build cache..." -ForegroundColor Yellow
if (Test-Path "frontend/.next") {
    Remove-Item -Recurse -Force "frontend/.next"
    Write-Host "Done: .next directory removed" -ForegroundColor Green
} else {
    Write-Host "Info: .next directory not found" -ForegroundColor Gray
}

# Remove node_modules/.cache if it exists
Write-Host "Removing node_modules cache..." -ForegroundColor Yellow
if (Test-Path "frontend/node_modules/.cache") {
    Remove-Item -Recurse -Force "frontend/node_modules/.cache"
    Write-Host "Done: node_modules/.cache removed" -ForegroundColor Green
} else {
    Write-Host "Info: node_modules/.cache not found" -ForegroundColor Gray
}

# Rebuild and restart frontend
Write-Host "Rebuilding frontend container..." -ForegroundColor Cyan
docker-compose -f docker-compose.yml build --no-cache ai-frontend

Write-Host "Starting frontend container..." -ForegroundColor Cyan
docker-compose -f docker-compose.yml up -d ai-frontend

Write-Host "Done: Frontend cache cleared and rebuilt!" -ForegroundColor Green
Write-Host "Check logs with: docker-compose logs -f ai-frontend" -ForegroundColor Gray
