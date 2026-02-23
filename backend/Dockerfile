FROM node:20-alpine

WORKDIR /app

# Install wget for healthcheck
RUN apk add --no-cache wget

# Copy package files
COPY backend/package*.json ./

# Install dependencies
RUN npm install --production

# Copy backend application files
COPY backend/ .

# Copy docker utilities and shared folder scripts
COPY docker/ ./docker/
COPY windows-vm-files/nginx-shared-folder.conf ./windows-vm-files/nginx-shared-folder.conf

# Set permissions for entrypoint
RUN chmod +x /app/docker-entrypoint.sh

# Expose port
EXPOSE 3002

# Use custom entrypoint
ENTRYPOINT ["/app/docker-entrypoint.sh"]
