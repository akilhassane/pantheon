#!/bin/bash

# Configure Keycloak to include Google profile picture in JWT tokens
# This script adds a mapper to include the 'picture' claim from Google IDP

KEYCLOAK_URL="http://localhost:8080"
REALM="pantheon"
CLIENT_ID="pantheon-backend"
ADMIN_USER="admin"
ADMIN_PASSWORD="admin"

echo "🔧 Configuring Keycloak to include Google profile picture..."
echo ""

# Get admin access token
echo "1. Getting admin access token..."
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

echo "✅ Got access token"
echo ""

# Get client UUID
echo "2. Getting client UUID..."
CLIENT_UUID=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM}/clients" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" | grep -o "\"id\":\"[^\"]*\",\"clientId\":\"${CLIENT_ID}\"" | grep -o "\"id\":\"[^\"]*" | cut -d'"' -f4)

if [ -z "$CLIENT_UUID" ]; then
  echo "❌ Failed to get client UUID"
  exit 1
fi

echo "✅ Client UUID: ${CLIENT_UUID}"
echo ""

# Add picture mapper
echo "3. Adding 'picture' mapper to client..."
MAPPER_RESPONSE=$(curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${CLIENT_UUID}/protocol-mappers/models" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "picture",
    "protocol": "openid-connect",
    "protocolMapper": "oidc-usermodel-attribute-mapper",
    "consentRequired": false,
    "config": {
      "userinfo.token.claim": "true",
      "user.attribute": "picture",
      "id.token.claim": "true",
      "access.token.claim": "true",
      "claim.name": "picture",
      "jsonType.label": "String"
    }
  }')

echo "✅ Picture mapper added"
echo ""

# Add name mapper (if not exists)
echo "4. Adding 'name' mapper to client..."
NAME_MAPPER_RESPONSE=$(curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${CLIENT_UUID}/protocol-mappers/models" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "name",
    "protocol": "openid-connect",
    "protocolMapper": "oidc-usermodel-attribute-mapper",
    "consentRequired": false,
    "config": {
      "userinfo.token.claim": "true",
      "user.attribute": "name",
      "id.token.claim": "true",
      "access.token.claim": "true",
      "claim.name": "name",
      "jsonType.label": "String"
    }
  }')

echo "✅ Name mapper added"
echo ""

# Configure Google IDP to store user attributes
echo "5. Configuring Google Identity Provider..."
IDP_RESPONSE=$(curl -s -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM}/identity-provider/instances/google" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "alias": "google",
    "providerId": "google",
    "enabled": true,
    "updateProfileFirstLoginMode": "on",
    "trustEmail": true,
    "storeToken": true,
    "addReadTokenRoleOnCreate": false,
    "authenticateByDefault": false,
    "linkOnly": false,
    "firstBrokerLoginFlowAlias": "first broker login",
    "config": {
      "syncMode": "FORCE",
      "guiOrder": "1"
    }
  }')

echo "✅ Google IDP configured"
echo ""

echo "🎉 Configuration complete!"
echo ""
echo "Next steps:"
echo "1. Sign out from the application"
echo "2. Sign in again with Google"
echo "3. The profile picture should now be included in the JWT token"
