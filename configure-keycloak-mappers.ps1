$KEYCLOAK_URL = "http://localhost:8080"
$REALM = "ai-backend"
$CLIENT_ID = "pantheon-backend"
$ADMIN_USER = "admin"
$ADMIN_PASSWORD = "admin"

Write-Host "Configuring Keycloak mappers..." -ForegroundColor Cyan

# Get admin token
$tokenBody = @{
    username = $ADMIN_USER
    password = $ADMIN_PASSWORD
    grant_type = "password"
    client_id = "admin-cli"
}

$tokenResponse = Invoke-RestMethod -Uri "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" -Method Post -ContentType "application/x-www-form-urlencoded" -Body $tokenBody
$ACCESS_TOKEN = $tokenResponse.access_token

Write-Host "Got access token" -ForegroundColor Green

# Get client UUID
$clients = Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM/clients" -Method Get -Headers @{ Authorization = "Bearer $ACCESS_TOKEN" }
$client = $clients | Where-Object { $_.clientId -eq $CLIENT_ID }
$CLIENT_UUID = $client.id

Write-Host "Client UUID: $CLIENT_UUID" -ForegroundColor Green

# Add Google IDP mapper for picture
$idpMapper = @{
    name = "google-picture"
    identityProviderAlias = "google"
    identityProviderMapper = "oidc-user-attribute-idp-mapper"
    config = @{
        "claim" = "picture"
        "user.attribute" = "picture"
        "syncMode" = "FORCE"
    }
} | ConvertTo-Json -Depth 10

try {
    Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM/identity-provider/instances/google/mappers" -Method Post -Headers @{ Authorization = "Bearer $ACCESS_TOKEN"; "Content-Type" = "application/json" } -Body $idpMapper | Out-Null
    Write-Host "Added Google picture mapper" -ForegroundColor Green
} catch {
    Write-Host "Picture mapper may already exist" -ForegroundColor Yellow
}

# Add Google IDP mapper for name
$idpNameMapper = @{
    name = "google-name"
    identityProviderAlias = "google"
    identityProviderMapper = "oidc-user-attribute-idp-mapper"
    config = @{
        "claim" = "name"
        "user.attribute" = "name"
        "syncMode" = "FORCE"
    }
} | ConvertTo-Json -Depth 10

try {
    Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM/identity-provider/instances/google/mappers" -Method Post -Headers @{ Authorization = "Bearer $ACCESS_TOKEN"; "Content-Type" = "application/json" } -Body $idpNameMapper | Out-Null
    Write-Host "Added Google name mapper" -ForegroundColor Green
} catch {
    Write-Host "Name mapper may already exist" -ForegroundColor Yellow
}

Write-Host "Configuration complete! Sign out and sign in again." -ForegroundColor Green
