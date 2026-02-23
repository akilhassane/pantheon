# Fetch .env file from shared folder on startup
# This script runs automatically when Windows starts

$sharedFolderUrl = "http://172.30.0.1:8888/.env"
$localEnvPath = "C:\MCP\.env"

Write-Host "Fetching .env from shared folder..."
Write-Host "URL: $sharedFolderUrl"

try {
    # Create MCP directory if it doesn't exist
    if (-not (Test-Path "C:\MCP")) {
        New-Item -ItemType Directory -Path "C:\MCP" -Force | Out-Null
    }
    
    # Download .env file
    Invoke-WebRequest -Uri $sharedFolderUrl -OutFile $localEnvPath -UseBasicParsing
    Write-Host "Successfully fetched .env file"
    
    # Verify file exists and has content
    if (Test-Path $localEnvPath) {
        $content = Get-Content $localEnvPath -Raw
        Write-Host "File size: $($content.Length) bytes"
    }
} catch {
    Write-Host "Error fetching .env: $_"
    exit 1
}
