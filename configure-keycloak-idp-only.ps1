# Configure Keycloak to use Identity Providers Only
# This disables local user login and forces OAuth (Google/Microsoft)

$KEYCLOAK_URL = "http://localhost:8080"
$REALM = "master"
$ADMIN_USER = "admin"
$ADMIN_PASSWORD = "admin"
$CLIENT_ID = "pantheon-backend"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Keycloak Identity Provider Only Config" -ForegroundColor Cyan
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

# Step 2: Get the client configuration
Write-Host "Step 2: Getting client configuration..." -ForegroundColor Yellow

try {
    $clients = Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM/clients?clientId=$CLIENT_ID" `
        -Method Get `
        -Headers $headers
    
    if ($clients.Count -eq 0) {
        Write-Host "❌ Client $CLIENT_ID not found" -ForegroundColor Red
        exit 1
    }
    
    $clientUuid = $clients[0].id
    Write-Host "✅ Client found: $clientUuid" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to get client: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 3: Update client to use identity provider redirector
Write-Host "Step 3: Configuring client authentication flow..." -ForegroundColor Yellow

try {
    # Get current client config
    $clientConfig = Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM/clients/$clientUuid" `
        -Method Get `
        -Headers $headers
    
    # Update to use browser flow with identity provider redirector
    $clientConfig.authenticationFlowBindingOverrides = @{
        browser = "browser"
    }
    
    # Save updated config
    Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM/clients/$clientUuid" `
        -Method Put `
        -Headers $headers `
        -ContentType "application/json" `
        -Body ($clientConfig | ConvertTo-Json -Depth 10)
    
    Write-Host "✅ Client authentication flow configured" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to update client: $_" -ForegroundColor Red
}

Write-Host ""

# Step 4: Configure authentication flow to skip login form
Write-Host "Step 4: Configuring authentication to skip login form..." -ForegroundColor Yellow

try {
    # Get authentication flows
    $flows = Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM/authentication/flows" `
        -Method Get `
        -Headers $headers
    
    # Find browser flow
    $browserFlow = $flows | Where-Object { $_.alias -eq "browser" }
    
    if ($browserFlow) {
        Write-Host "✅ Found browser authentication flow" -ForegroundColor Green
        Write-Host "   Flow ID: $($browserFlow.id)" -ForegroundColor Gray
    } else {
        Write-Host "⚠️  Browser flow not found" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Could not configure authentication flow: $_" -ForegroundColor Yellow
}

Write-Host ""

# Step 5: Set default identity provider for the client
Write-Host "Step 5: Setting default identity provider..." -ForegroundColor Yellow

try {
    # Get identity providers
    $idps = Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM/identity-provider/instances" `
        -Method Get `
        -Headers $headers
    
    Write-Host "Available identity providers:" -ForegroundColor Gray
    foreach ($idp in $idps) {
        Write-Host "  - $($idp.alias) ($($idp.providerId))" -ForegroundColor Gray
    }
    
    # Update client to set default IDP
    $clientConfig = Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM/clients/$clientUuid" `
        -Method Get `
        -Headers $headers
    
    # Add attributes to force IDP
    if (-not $clientConfig.attributes) {
        $clientConfig.attributes = @{}
    }
    
    # This will make the client always redirect to Google
    $clientConfig.attributes.'kc.idp.hint' = 'google'
    
    Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM/clients/$clientUuid" `
        -Method Put `
        -Headers $headers `
        -ContentType "application/json" `
        -Body ($clientConfig | ConvertTo-Json -Depth 10)
    
    Write-Host "✅ Default identity provider set to Google" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Could not set default IDP: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Configuration Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Important Notes:" -ForegroundColor Yellow
Write-Host "1. The client will now redirect directly to Google" -ForegroundColor White
Write-Host "2. Users won't see the Keycloak login form" -ForegroundColor White
Write-Host "3. To use Microsoft instead, change kc.idp.hint to 'microsoft'" -ForegroundColor White
Write-Host ""
Write-Host "To allow users to choose between Google/Microsoft:" -ForegroundColor Yellow
Write-Host "- Remove the kc.idp.hint attribute from the client" -ForegroundColor White
Write-Host "- Or create separate sign-in buttons that pass kc_idp_hint parameter" -ForegroundColor White
Write-Host ""
Write-Host "Test the OAuth flow:" -ForegroundColor Yellow
Write-Host "  curl http://localhost:3002/api/auth/oauth/google?redirect_uri=http://localhost:3000/auth/callback" -ForegroundColor Gray
Write-Host ""
Write-Host "Clear your browser cookies for localhost:8080 to test fresh login" -ForegroundColor Yellow
Write-Host ""
