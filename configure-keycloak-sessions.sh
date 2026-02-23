#!/bin/bash

# Script to configure Keycloak session timeouts for longer sessions
# This sets the session timeouts to very long durations (30 days)

echo "Configuring Keycloak session timeouts..."

# Wait for Keycloak to be ready
echo "Waiting for Keycloak to be ready..."
until docker exec pantheon-keycloak /opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 --realm master --user admin --password admin 2>/dev/null; do
  echo "Keycloak not ready yet, waiting..."
  sleep 5
done

echo "Keycloak is ready, updating realm settings..."

# Update master realm with longer session timeouts
docker exec pantheon-keycloak /opt/keycloak/bin/kcadm.sh update realms/master \
  -s 'ssoSessionIdleTimeout=2592000' \
  -s 'ssoSessionMaxLifespan=2592000' \
  -s 'ssoSessionIdleTimeoutRememberMe=2592000' \
  -s 'ssoSessionMaxLifespanRememberMe=2592000' \
  -s 'offlineSessionIdleTimeout=2592000' \
  -s 'offlineSessionMaxLifespan=2592000' \
  -s 'accessTokenLifespan=2592000' \
  -s 'accessTokenLifespanForImplicitFlow=2592000' \
  -s 'accessCodeLifespan=2592000' \
  -s 'accessCodeLifespanUserAction=2592000' \
  -s 'accessCodeLifespanLogin=2592000'

echo "✅ Keycloak session timeouts configured successfully!"
echo ""
echo "Session settings:"
echo "  - SSO Session Idle Timeout: 30 days"
echo "  - SSO Session Max Lifespan: 30 days"
echo "  - Access Token Lifespan: 30 days"
echo "  - Offline Session Idle Timeout: 30 days"
echo ""
echo "Users will now stay logged in for up to 30 days."
