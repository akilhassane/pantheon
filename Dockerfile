# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory in container
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY server.js ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcpuser -u 1001

# Change ownership of app directory
RUN chown -R mcpuser:nodejs /app
USER mcpuser

# Expose port (if needed for future extensions)
# EXPOSE 3000

# Command to run the application
CMD ["node", "server.js"]

# Labels for metadata
LABEL maintainer="akilhassane"
LABEL description="MCP Pentest Forge - Docker container"
LABEL version="1.0.0"

