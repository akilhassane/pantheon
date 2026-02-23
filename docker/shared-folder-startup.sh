#!/bin/sh
# Startup script for shared folder nginx container
# This script runs before nginx starts to set up the environment

echo "Starting shared folder container..."

# Get project ID from environment or working directory
PROJECT_ID="${PROJECT_ID:-$(basename $(pwd))}"
SHARED_FOLDER_PATH="${SHARED_FOLDER_PATH:-/app/windows-vm-files/$PROJECT_ID}"
NGINX_CONFIG_PATH="${NGINX_CONFIG_PATH:-$SHARED_FOLDER_PATH/.nginx-config.conf}"
NGINX_HTML_ROOT="${NGINX_HTML_ROOT:-$SHARED_FOLDER_PATH}"

echo "Project ID: $PROJECT_ID"
echo "Shared folder: $SHARED_FOLDER_PATH"
echo "Nginx config: $NGINX_CONFIG_PATH"
echo "Nginx HTML root: $NGINX_HTML_ROOT"

# Copy nginx config to the correct location
if [ -f "$NGINX_CONFIG_PATH" ]; then
    echo "Copying nginx config..."
    cp "$NGINX_CONFIG_PATH" /etc/nginx/conf.d/default.conf
    
    # Update the root path in the nginx config
    sed -i "s|root /usr/share/nginx/html;|root $NGINX_HTML_ROOT;|g" /etc/nginx/conf.d/default.conf
    
    echo "Nginx config copied and updated successfully"
else
    echo "WARNING: Nginx config not found at $NGINX_CONFIG_PATH"
    echo "Creating default nginx configuration..."
    cat > /etc/nginx/conf.d/default.conf << EOF
server {
    listen 8888;
    server_name _;
    
    # Shared folder root
    root $NGINX_HTML_ROOT;
    
    # Enable directory listing
    autoindex on;
    autoindex_exact_size off;
    autoindex_localtime on;
    
    # Allow large file uploads
    client_max_body_size 1G;
    
    # CORS headers for cross-origin access
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
    add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;
    
    # Serve all files
    location / {
        try_files \$uri \$uri/ =404;
    }
}
EOF
fi

# Check if .env file exists in the shared folder
if [ ! -f "$SHARED_FOLDER_PATH/.env" ]; then
    echo "Creating default .env file..."
    cat > "$SHARED_FOLDER_PATH/.env" << 'EOF'
# Windows Project Environment Variables
# This file is automatically created and can be modified by the Windows VM
# Access this file at: http://172.30.0.1:8888/.env

# Example variables:
# PROJECT_NAME=MyProject
# API_KEY=your-api-key-here
EOF
fi

# Set proper permissions
chmod 644 "$SHARED_FOLDER_PATH/.env" 2>/dev/null || true
chmod 755 "$SHARED_FOLDER_PATH" 2>/dev/null || true

echo "Shared folder initialized"
echo "Starting nginx..."

# Start nginx in foreground
exec nginx -g 'daemon off;'
