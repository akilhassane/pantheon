# Setup automatic .env fetching on Windows startup
# This script configures Windows to automatically fetch the .env file on boot

$scriptPath = "C:\MCP\fetch-env-on-startup.ps1"
$taskName = "FetchMCPEnv"

Write-Host "Setting up automatic .env fetch on startup..."

# Create MCP directory
if (-not (Test-Path "C:\MCP")) {
    New-Item -ItemType Directory -Path "C:\MCP" -Force | Out-Null
}

# Copy the fetch script to C:\MCP
$fetchScript = @'
# Fetch .env file from shared folder
$sharedFolderUrl = "http://172.30.0.1:8888/.env"
$localEnvPath = "C:\MCP\.env"

try {
    Invoke-WebRequest -Uri $sharedFolderUrl -OutFile $localEnvPath -UseBasicParsing
} catch {
    Write-Host "Error fetching .env: $_"
}
'@

Set-Content -Path $scriptPath -Value $fetchScript

# Create scheduled task to run on startup
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force

Write-Host "Setup complete! .env will be fetched automatically on startup."
