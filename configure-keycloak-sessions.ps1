# Script to configure Keycloak session timeouts for longer sessions
# This sets the session timeouts to very long durations (30 days)

Write-Host "Configuring Keycloak session timeouts..." -ForegroundColor Cyan

# Wait for Keycloak to be ready
Write-Host "Waiting for Keycloak to be ready..." -ForegroundColor Yellow
$ready = $false
$maxAttempts = 30
$attempt = 0

while (-not $ready -and $attempt -lt $maxAttempts) {
    $attempt++
    try {
        $result = docker exec pantheon-keycloak /opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 --realm master --user admin --password admin 2>&1
        if ($LASTEXITCODE -eq 0) {
            $ready = $true
        } else {
            Write-Host "Keycloak not ready yet, waiting... (Attempt $attempt/$maxAttempts)" -ForegroundColor Yellow
            Start-Sleep -Seconds 5
        }
    } catch {
        Write-Host "Keycloak not ready yet, waiting... (Attempt $attempt/$maxAttempts)" -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
}

if (-not $ready) {
    Write-Host "❌ Failed to connect to Keycloak after $maxAttempts attempts" -ForegroundColor Red
    exit 1
}

Write-Host "Keycloak is ready, updating realm settings..." -ForegroundColor Green

# Update master realm with longer session timeouts (30 days = 2592000 seconds)
docker exec pantheon-keycloak /opt/keycloak/bin/kcadm.sh update realms/master `
  -s 'ssoSessionIdleTimeout=2592000' `
  -s 'ssoSessionMaxLifespan=2592000' `
  -s 'ssoSessionIdleTimeoutRememberMe=2592000' `
  -s 'ssoSessionMaxLifespanRememberMe=2592000' `
  -s 'offlineSessionIdleTimeout=2592000' `
  -s 'offlineSessionMaxLifespan=2592000' `
  -s 'accessTokenLifespan=2592000' `
  -s 'accessTokenLifespanForImplicitFlow=2592000' `
  -s 'accessCodeLifespan=2592000' `
  -s 'accessCodeLifespanUserAction=2592000' `
  -s 'accessCodeLifespanLogin=2592000'

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Keycloak session timeouts configured successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Session settings:" -ForegroundColor Cyan
    Write-Host "  - SSO Session Idle Timeout: 30 days"
    Write-Host "  - SSO Session Max Lifespan: 30 days"
    Write-Host "  - Access Token Lifespan: 30 days"
    Write-Host "  - Offline Session Idle Timeout: 30 days"
    Write-Host ""
    Write-Host "Users will now stay logged in for up to 30 days." -ForegroundColor Green
} else {
    Write-Host "❌ Failed to update Keycloak realm settings" -ForegroundColor Red
    exit 1
}
