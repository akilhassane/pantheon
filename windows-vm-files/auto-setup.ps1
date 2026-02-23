# Automatic setup script for Windows MCP environment
# This script runs once to configure the Windows VM

Write-Host "=== Windows MCP Auto-Setup ==="

# Fetch .env file
Write-Host "Step 1: Fetching .env file..."
& "C:\MCP\fetch-env-on-startup.ps1"

# Setup auto-fetch on startup
Write-Host "Step 2: Setting up automatic .env fetch..."
& "C:\MCP\setup-auto-fetch.ps1"

Write-Host "=== Setup Complete ==="
Write-Host "The .env file will be automatically fetched on every startup."
