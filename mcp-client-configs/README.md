# MCP Client Configuration Guide

This directory contains configuration files to connect various MCP clients (Claude Desktop, Cursor) to the MCP Pentest Forge server.

## Available Configurations

### 1. Claude Desktop with Docker (`claude-desktop-docker.json`)
Runs the MCP server in a Docker container. Best for isolated environments.

**Location to place this file:**
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### 2. Claude Desktop with Node.js (`claude-desktop-node.json`)
Runs the MCP server directly using Node.js. More reliable for stdio communication.

**Location to place this file:**
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### 3. Cursor Configuration (`cursor-config.json`)
Configuration for Cursor IDE to use the MCP server.

**Location to place this file:**
- **Windows**: `%APPDATA%\Cursor\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`
- Check Cursor settings for the exact MCP configuration location

## Installation Steps

### For Claude Desktop (Recommended: Node.js version)

1. **Stop Claude Desktop** if it's running

2. **Create the config directory** (if it doesn't exist):
   ```powershell
   # Windows PowerShell
   New-Item -Path "$env:APPDATA\Claude" -ItemType Directory -Force
   ```

3. **Copy the configuration file**:
   ```powershell
   # Windows PowerShell (Node.js version - recommended)
   Copy-Item "mcp-client-configs\claude-desktop-node.json" "$env:APPDATA\Claude\claude_desktop_config.json"
   
   # OR Docker version
   Copy-Item "mcp-client-configs\claude-desktop-docker.json" "$env:APPDATA\Claude\claude_desktop_config.json"
   ```

4. **Start Claude Desktop**

5. **Verify the connection**:
   - Open Claude Desktop
   - Look for the 🔌 icon or MCP status indicator
   - Check for "mcp-pentest-forge" in the available servers
   - Try using one of the tools (e.g., "Use port_scan tool to scan localhost")

### For Cursor

1. **Check your Cursor MCP settings location**
   - Go to Cursor Settings → Extensions → MCP
   - Note the configuration file path

2. **Copy the configuration**:
   ```powershell
   # Adjust path based on your Cursor configuration location
   Copy-Item "mcp-client-configs\cursor-config.json" "YOUR_CURSOR_MCP_CONFIG_PATH"
   ```

3. **Restart Cursor**

## Available Tools

Once connected, the following tools will be available:

| Tool | Description | Usage |
|------|-------------|-------|
| `port_scan` | Scan ports on a target host | `port_scan target=localhost ports=1-1000` |
| `dns_lookup` | Perform DNS lookup | `dns_lookup domain=example.com type=A` |
| `web_headers` | Get HTTP headers | `web_headers url=https://example.com` |
| `ssl_info` | Get SSL certificate info | `ssl_info host=example.com port=443` |

## Available Resources

The server also provides pentesting resources:

- **pentest://tools/nmap-cheatsheet** - Nmap command reference
- **pentest://tools/metasploit-modules** - Metasploit modules catalog
- **pentest://vulnerabilities/cve-database** - CVE database reference
- **pentest://methodologies/osint-guide** - OSINT methodology guide
- **pentest://reports/templates** - Pentest report templates

## Available Prompts

Pre-configured pentesting workflows:

- **web-app-pentest** - Web application penetration testing methodology
- **network-pentest** - Network infrastructure testing approach
- **vulnerability-assessment** - Systematic vulnerability assessment
- **social-engineering** - Social engineering assessment methodology

## Troubleshooting

### Tools not appearing in Claude Desktop

1. **Check the config file exists**:
   ```powershell
   Test-Path "$env:APPDATA\Claude\claude_desktop_config.json"
   ```

2. **Validate JSON syntax**:
   ```powershell
   Get-Content "$env:APPDATA\Claude\claude_desktop_config.json" | ConvertFrom-Json
   ```

3. **Check Node.js is installed**:
   ```powershell
   node --version
   ```

4. **Test the server manually**:
   ```powershell
   node server.js
   ```
   Press Ctrl+C to exit

5. **Check Docker is running** (if using Docker version):
   ```powershell
   docker ps
   ```

6. **View Claude Desktop logs**:
   - Windows: `%APPDATA%\Claude\logs`
   - macOS: `~/Library/Logs/Claude`
   - Linux: `~/.config/Claude/logs`

### Permission Issues

If you get permission errors, ensure:
- The config file has read permissions
- Node.js has execution permissions
- Docker daemon is running (for Docker version)

### Path Issues

If the server path is incorrect, update the `args` array in the config file:
```json
"args": [
  "C:\\MCP\\mcp-server\\server.js"  // Update this path
]
```

## Testing the Configuration

### Test with Claude Desktop

1. Open Claude Desktop
2. Start a new conversation
3. Type: "List all available MCP tools"
4. You should see the 4 pentesting tools listed
5. Try a tool: "Use port_scan to scan localhost ports 1-100"

### Manual Test

Test the server directly via command line:
```powershell
# Navigate to the server directory
cd C:\MCP\mcp-server

# Run the server
node server.js

# The server should output:
# MCP Pentest Forge Server started
```

## Configuration Format

The configuration files follow this structure:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "executable",
      "args": ["argument1", "argument2"],
      "env": {
        "VARIABLE": "value"
      }
    }
  }
}
```

## Additional Notes

- **Node.js version is recommended** over Docker for better stdio communication
- The server uses **stdio transport** for communication with clients
- All tools are **simulated** for demonstration purposes
- For production use, implement actual tool integrations
- Always obtain **proper authorization** before conducting security assessments

## Support

For issues or questions:
1. Check the main README.md in the project root
2. Review server logs
3. Verify all dependencies are installed
4. Ensure proper permissions are set




