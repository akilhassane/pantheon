# Pantheon Vercel Deployment Script (PowerShell)

Write-Host "🚀 Pantheon Vercel Deployment Helper" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check if Vercel CLI is installed
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelInstalled) {
    Write-Host "📦 Installing Vercel CLI..." -ForegroundColor Yellow
    npm install -g vercel
}

Write-Host "📋 Deployment Steps:" -ForegroundColor White
Write-Host ""
Write-Host "1. Deploy Frontend"
Write-Host "2. Deploy Backend"
Write-Host "3. Configure Environment Variables"
Write-Host "4. Test Deployment"
Write-Host ""

$deployFrontend = Read-Host "Deploy frontend? (y/n)"
if ($deployFrontend -eq "y") {
    Write-Host "🎨 Deploying frontend..." -ForegroundColor Green
    Set-Location frontend
    vercel --prod
    Set-Location ..
    Write-Host "✅ Frontend deployed!" -ForegroundColor Green
}

Write-Host ""
$deployBackend = Read-Host "Deploy backend? (y/n)"
if ($deployBackend -eq "y") {
    Write-Host "⚙️  Deploying backend..." -ForegroundColor Green
    Set-Location backend
    vercel --prod
    Set-Location ..
    Write-Host "✅ Backend deployed!" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Yellow
Write-Host "1. Set environment variables in Vercel dashboard"
Write-Host "2. Update NEXT_PUBLIC_API_URL in frontend"
Write-Host "3. Deploy client agents to user machines"
Write-Host "4. Test the application"
Write-Host ""
Write-Host "📖 Full guide: docs/VERCEL_DEPLOYMENT.md" -ForegroundColor Cyan
