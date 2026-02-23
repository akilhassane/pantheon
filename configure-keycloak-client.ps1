# Configure Keycloak Client and Identity Providers
# This script creates the pantheon-backend client and configures OAuth providers

$KEYCLOAK_URL = "http://localhost:8080"
$REALM = "master"
$ADMIN_USER = "admin"
$ADMIN_PASSWORD = "admin"
$CLIENT_ID = "pantheon-backend"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Keycloak Configuration Script" -ForegroundColor Cyan
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

# Step 2: Check if client already exists
Write-Host "Step 2: Checking if client exists..." -ForegroundColor Yellow

$headers = @{
    Authorization = "Bearer $accessToken"
}

try {
    $existingClients = Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM/clients?clientId=$CLIENT_ID" `
        -Method Get `
        -Headers $headers
    
    if ($existingClients.Count -gt 0) {
        Write-Host "⚠️  Client $CLIENT_ID already exists" -ForegroundColor Yellow
        $clientUuid = $existingClients[0].id
        Write-Host "   Client UUID: $clientUuid" -ForegroundColor Gray
        
        # Update existing client
        Write-Host "   Updating client configuration..." -ForegroundColor Yellow
        
        $clientConfig = @{
            clientId = $CLIENT_ID
            enabled = $true
            publicClient = $true
            redirectUris = @(
                "http://localhost:3000/*",
                "http://localhost:3002/*"
            )
            webOrigins = @(
                "http://localhost:3000",
                "http://localhost:3002"
            )
            standardFlowEnabled = $true
            directAccessGrantsEnabled = $true
            protocol = "openid-connect"
        }
        
        Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM/clients/$clientUuid" `
            -Method Put `
            -Headers $headers `
            -ContentType "application/json" `
            -Body ($clientConfig | ConvertTo-Json -Depth 10)
        
        Write-Host "✅ Client updated" -ForegroundColor Green
    } else {
        # Create new client
        Write-Host "Creating new client..." -ForegroundColor Yellow
        
        $clientConfig = @{
            clientId = $CLIENT_ID
            enabled = $true
            publicClient = $true
            redirectUris = @(
                "http://localhost:3000/*",
                "http://localhost:3002/*"
            )
            webOrigins = @(
                "http://localhost:3000",
                "http://localhost:3002"
            )
            standardFlowEnabled = $true
            directAccessGrantsEnabled = $true
            protocol = "openid-connect"
        }
        
        Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM/clients" `
            -Method Post `
            -Headers $headers `
            -ContentType "application/json" `
            -Body ($clientConfig | ConvertTo-Json -Depth 10)
        
        Write-Host "✅ Client created successfully" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Failed to configure client: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 3: List existing identity providers
Write-Host "Step 3: Checking existing identity providers..." -ForegroundColor Yellow

try {
    $idpList = Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM/identity-provider/instances" `
        -Method Get `
        -Headers $headers
    
    Write-Host "Existing identity providers:" -ForegroundColor Gray
    foreach ($idp in $idpList) {
        Write-Host "  - $($idp.alias)" -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠️  Could not list identity providers: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Configuration Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Configure Google OAuth in Keycloak:" -ForegroundColor White
Write-Host "   - Go to: $KEYCLOAK_URL/admin/master/console/#/master/identity-providers" -ForegroundColor Gray
Write-Host "   - Add provider: Google" -ForegroundColor Gray
Write-Host "   - Alias: google" -ForegroundColor Gray
Write-Host "   - Client ID: [Your Google OAuth Client ID]" -ForegroundColor Gray
Write-Host "   - Client Secret: [Your Google OAuth Client Secret]" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Configure Microsoft OAuth in Keycloak:" -ForegroundColor White
Write-Host "   - Add provider: Microsoft" -ForegroundColor Gray
Write-Host "   - Alias: microsoft" -ForegroundColor Gray
Write-Host "   - Client ID: [Your Microsoft OAuth Client ID]" -ForegroundColor Gray
Write-Host "   - Client Secret: [Your Microsoft OAuth Client Secret]" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Test the OAuth flow:" -ForegroundColor White
Write-Host "   curl http://localhost:3002/api/auth/oauth/google?redirect_uri=http://localhost:3000/auth/callback" -ForegroundColor Gray
Write-Host ""
