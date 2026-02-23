FROM quay.io/keycloak/keycloak:23.0

# Set environment variables for development mode
ENV KEYCLOAK_ADMIN=admin
ENV KEYCLOAK_ADMIN_PASSWORD=admin
ENV KC_HTTP_ENABLED=true
ENV KC_HEALTH_ENABLED=true

# Expose Keycloak port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=5 --start-period=60s \
  CMD exec 3<>/dev/tcp/localhost/8080 && echo -e 'GET /health/ready HTTP/1.1\r\nHost: localhost\r\n\r\n' >&3 && cat <&3 | grep -q '200 OK'

# Note: Command is specified in docker-compose.yml
