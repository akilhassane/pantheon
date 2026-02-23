Windows MCP Shared Folder
==========================

This folder is accessible from your Windows VM at:
http://172.30.0.1:8888

Files in this folder:
- .env: Environment configuration for MCP
- fetch-env-on-startup.ps1: Script to fetch .env on startup
- setup-auto-fetch.ps1: Script to configure automatic .env fetching
- auto-setup.ps1: One-time setup script

To manually fetch the .env file:
1. Open PowerShell in Windows VM
2. Run: Invoke-WebRequest -Uri "http://172.30.0.1:8888/.env" -OutFile "C:\MCP\.env"

To setup automatic fetching:
1. Open PowerShell as Administrator in Windows VM
2. Run: Invoke-WebRequest -Uri "http://172.30.0.1:8888/setup-auto-fetch.ps1" -OutFile "C:\Temp\setup.ps1"
3. Run: powershell -ExecutionPolicy Bypass -File "C:\Temp\setup.ps1"

Security:
- This shared folder is ONLY accessible from this specific Windows project
- Other projects cannot access this folder (network isolation)
- The host machine cannot access this folder directly (no port binding)
