#!/bin/sh
set -e

echo "🚀 Starting AI Backend..."

# Ensure windows-vm-files directory exists
mkdir -p /app/windows-vm-files

# Set default HOST_WINDOWS_VM_FILES_PATH if not provided
if [ -z "$HOST_WINDOWS_VM_FILES_PATH" ]; then
    echo "⚠️  HOST_WINDOWS_VM_FILES_PATH not set, using default: /host/windows-vm-files"
    export HOST_WINDOWS_VM_FILES_PATH="/host/windows-vm-files"
fi

echo "✅ Environment configured:"
echo "   - HOST_WINDOWS_VM_FILES_PATH: $HOST_WINDOWS_VM_FILES_PATH"
echo "   - BACKEND_CONTAINER_NAME: ${BACKEND_CONTAINER_NAME:-ai-backend}"
echo "   - PORT: ${PORT:-3002}"

# Start the Node.js application
exec npm start
