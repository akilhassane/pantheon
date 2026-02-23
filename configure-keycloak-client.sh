#!/bin/bash

# Configure Keycloak Client and Identity Providers
# This script creates the pantheon-backend client and configures OAuth providers

KEYCLOAK_URL="http://localhost:8080"
REALM="master"
ADMIN_USER="admin"
ADMIN_PASSWORD="admin"
CLIENT_ID="pantheon-backend"

echo "=========================================="
echo "Keycloak Configuration Script"
echo "=========================================="
echo ""

# Step 1: Get admin access token
echo "Step 1: Getting admin access token..."
TOKEN_RESPONSE=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=${ADMIN_USER}" \
  -d "password=${ADMIN_PASSWORD}" \
  -d "grant_type=password" \
  -d "client_id=admin-cli")

ACCESS_TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Failed to get access token"
  echo "Response: $TOKEN_RESPONSE"
  exit 1
fi

echo "✅ Access token obtained"
echo ""

# Step 2: Check if client already exists
echo "Step 2: Checking if client exists..."
CLIENT_CHECK=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=${CLIENT_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

if echo "$CLIENT_CHECK" | grep -q "\"clientId\":\"${CLIENT_ID}\""; then
  echo "⚠️  Client ${CLIENT_ID} already exists"
  CLIENT_UUID=$(echo $CLIENT_CHECK | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
  echo "   Client UUID: ${CLIENT_UUID}"
  
  # Update existing client
  echo "   Updating client configuration..."
  curl -s -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${CLIENT_UUID}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
      "clientId": "'${CLIENT_ID}'",
      "enabled": true,
      "publicClient": true,
      "redirectUris": [
        "http://localhost:3000/*",
        "http://localhost:3002/*"
      ],
      "webOrigins": [
        "http://localhost:3000",
        "http://localhost:3002"
      ],
      "standardFlowEnabled": true,
      "directAccessGrantsEnabled": true,
      "protocol": "openid-connect"
    }'
  echo "✅ Client updated"
else
  # Create new client
  echo "Creating new client..."
  CREATE_RESPONSE=$(curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM}/clients" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
      "clientId": "'${CLIENT_ID}'",
      "enabled": true,
      "publicClient": true,
      "redirectUris": [
        "http://localhost:3000/*",
        "http://localhost:3002/*"
      ],
      "webOrigins": [
        "http://localhost:3000",
        "http://localhost:3002"
      ],
      "standardFlowEnabled": true,
      "directAccessGrantsEnabled": true,
      "protocol": "openid-connect"
    }')
  
  if [ $? -eq 0 ]; then
    echo "✅ Client created successfully"
  else
    echo "❌ Failed to create client"
    echo "Response: $CREATE_RESPONSE"
    exit 1
  fi
fi

echo ""

# Step 3: List existing identity providers
echo "Step 3: Checking existing identity providers..."
IDP_LIST=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM}/identity-provider/instances" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

echo "Existing identity providers:"
echo "$IDP_LIST" | grep -o '"alias":"[^"]*' | cut -d'"' -f4 | while read alias; do
  echo "  - $alias"
done

echo ""
echo "=========================================="
echo "Configuration Complete!"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Configure Google OAuth in Keycloak:"
echo "   - Go to: ${KEYCLOAK_URL}/admin/master/console/#/master/identity-providers"
echo "   - Add provider: Google"
echo "   - Alias: google"
echo "   - Client ID: [Your Google OAuth Client ID]"
echo "   - Client Secret: [Your Google OAuth Client Secret]"
echo ""
echo "2. Configure Microsoft OAuth in Keycloak:"
echo "   - Add provider: Microsoft"
echo "   - Alias: microsoft"
echo "   - Client ID: [Your Microsoft OAuth Client ID]"
echo "   - Client Secret: [Your Microsoft OAuth Client Secret]"
echo ""
echo "3. Test the OAuth flow:"
echo "   curl -L http://localhost:3002/api/auth/oauth/google?redirect_uri=http://localhost:3000/auth/callback"
echo ""
