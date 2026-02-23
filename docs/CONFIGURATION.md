# Configuration Guide

Environment and service configuration for Pantheon.

[Back to README](../README.md)

## Environment Setup

### Required Variables

Edit `.env` file with these required variables:

```env
# AI Provider API Keys (Required)
OPENROUTER_API_KEY=your_openrouter_key_here
GEMINI_API_KEY=your_gemini_key_here

# Security (Required)
MCP_MASTER_SECRET=generate_random_64_character_string

# Database (Required)
POSTGRES_PASSWORD=secure_database_password
```

### Optional Variables

```env
# Additional AI Providers
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here

# Keycloak Admin
KEYCLOAK_ADMIN_PASSWORD=admin
```

## Service Configuration

### Keycloak

For OAuth provider configuration, see [Keycloak Setup Guide](KEYCLOAK_SETUP.md).

### AI Models

For model selection and configuration, see [Model Configuration Guide](MODEL_CONFIGURATION.md).

### Database

PostgreSQL is automatically configured. For advanced configuration:

1. Edit `docker-compose.production.yml`
2. Modify PostgreSQL environment variables
3. Restart services

### Network

Network configuration is automatic. For details, see [Network Architecture](NETWORK.md).

## Next Steps

- [Install Pantheon](INSTALLATION.md)
- [Configure Keycloak](KEYCLOAK_SETUP.md)
- [Set up AI Models](MODEL_CONFIGURATION.md)
- [Usage Guide](USAGE.md)

## Support

- [GitHub Issues](https://github.com/akilhassane/pantheon/issues)
- [Discussions](https://github.com/akilhassane/pantheon/discussions)
