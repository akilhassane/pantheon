# Fix Keycloak Client Audience
# Add audience mapper to include client ID in JWT tokens

$KEYCLOAK_URL = "http://localhost:8080"
$REALM = "master"
$ADMIN_USER = "admin"
$ADMIN_PASSWORD = "admin"
$CLIENT_ID = "pantheon-backend"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Fix Keycloak Token Audience" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Get admin access token
Write-Host "Step 1: Getting admin access token..." -ForegroundColor Yellow

$tokenBody = @{
    username = $ADMIN_USER
    password = $ADMIN_PASSWORD
    grant_type = "password"
    client_id = "admin-cli"
}

try {
    $tokenResponse = Invoke-RestMethod -Uri "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" `
        -Method Post `
        -ContentType "application/x-www-form-urlencoded" `
        -Body $tokenBody
    
    $accessToken = $tokenResponse.access_token
    Write-Host "✅ Access token obtained" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to get access token: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

$headers = @{
    Authorization = "Bearer $accessToken"
}

# Step 2: Get client UUID
Write-Host "Step 2: Getting client UUID..." -ForegroundColor Yellow

try {
    $clients = Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM/clients?clientId=$CLIENT_ID" `
        -Method Get `
        -Headers $headers
    
    if ($clients.Count -eq 0) {
        Write-Host "❌ Client $CLIENT_ID not found" -ForegroundColor Red
        exit 1
    }
    
    $clientUuid = $clients[0].id
    Write-Host "✅ Client UUID: $clientUuid" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to get client: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 3: Add audience mapper
Write-Host "Step 3: Adding audience mapper..." -ForegroundColor Yellow

$audienceMapper = @{
    name = "audience-mapper"
    protocol = "openid-connect"
    protocolMapper = "oidc-audience-mapper"
    consentRequired = $false
    config = @{
        "included.client.audience" = $CLIENT_ID
        "id.token.claim" = "true"
        "access.token.claim" = "true"
    }
}

try {
    Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM/clients/$clientUuid/protocol-mappers/models" `
        -Method Post `
        -Headers $headers `
        -ContentType "application/json" `
        -Body ($audienceMapper | ConvertTo-Json -Depth 10)
    
    Write-Host "✅ Audience mapper added" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "⚠️  Audience mapper already exists" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Failed to add audience mapper: $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Configuration Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "JWT tokens will now include audience: $CLIENT_ID" -ForegroundColor Green
Write-Host ""
Write-Host "Please sign out and sign in again to get a new token with the audience claim." -ForegroundColor Yellow
Write-Host ""
