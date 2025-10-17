# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory in container
WORKDIR /app

# Install Docker CLI (needed to execute commands in Kali container)
RUN apk add --no-cache docker-cli

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY server.js ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcpuser -u 1001

# Add user to docker group if it exists, or create it
RUN if grep -q docker /etc/group; then \
        addgroup mcpuser docker; \
    else \
        addgroup -g 1002 docker && addgroup mcpuser docker; \
    fi

# Change ownership of app directory
RUN chown -R mcpuser:nodejs /app

# For host networking mode, we need Docker access so run as root
# USER mcpuser

# Command to run the application
CMD ["node", "server.js"]

# Labels for metadata
LABEL maintainer="akilhassane"
LABEL description="MCP Pentest Forge - Docker container with Kali Linux integration"
LABEL version="1.0.0"

