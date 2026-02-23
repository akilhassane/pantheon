FROM node:20-alpine

WORKDIR /app

# Install Python and required packages
RUN apk add --no-cache python3 py3-pip wget

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm install

# Copy application files
COPY server.js ./
COPY .env.example ./
COPY tools/ ./tools/
COPY tools-standalone/ ./tools-standalone/
COPY public/ ./public/

# Create logs directory
RUN mkdir -p /app/logs

# Expose port
EXPOSE 8090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:8090/health || exit 1

# Start the server
CMD ["node", "server.js"]
