# API Reference 📚

Complete HTTP API documentation for **MCP-Pentest-Forge**.

## Table of Contents

- [Overview](#overview)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
- [Request/Response Format](#requestresponse-format)
- [Error Handling](#error-handling)
- [Code Examples](#code-examples)
- [Rate Limiting](#rate-limiting)

## Overview

MCP-Pentest-Forge provides an HTTP API for programmatic access to the Kali Linux pentesting environment. This enables integration with:

- n8n workflows
- Custom applications
- CI/CD pipelines
- Automation scripts
- Web interfaces

## Base URL

### Local Development
```
http://localhost:3000
```

### Docker Compose
```
http://localhost:3000
```

### Remote Server
```
http://your-server-ip:3000
```

### ngrok (Public Internet)
```
https://your-subdomain.ngrok-free.app
```

## Authentication

Currently, the API does not require authentication. **⚠️ WARNING**: Do not expose this API to the public internet without adding authentication!

### Recommended Security

When deploying in production:

1. **Add reverse proxy with authentication** (nginx, Traefik)
2. **Use API keys** (modify server.js to add auth middleware)
3. **Restrict by IP** (firewall rules)
4. **Use VPN** (WireGuard, OpenVPN)

## Endpoints

### GET /

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "message": "MCP Pentest Forge API",
  "version": "1.0.0",
  "timestamp": "2025-10-17T21:00:00.000Z"
}
```

### GET /api/tools

List all available tools.

**Response:**
```json
{
  "tools": [
    {
      "name": "kali_execute",
      "description": "Execute any command in the Kali Linux environment",
      "inputSchema": {
        "type": "object",
        "properties": {
          "command": {
            "type": "string",
            "description": "The command to execute"
          }
        },
        "required": ["command"]
      }
    }
  ]
}
```

### POST /api/tools/kali_execute

Execute a command in Kali Linux.

**Request Body:**
```json
{
  "arguments": {
    "command": "whoami"
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "result": "root\n",
  "command": "whoami",
  "timestamp": "2025-10-17T21:00:00.000Z"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Command execution failed",
  "details": "bash: badcommand: command not found\n",
  "command": "badcommand",
  "timestamp": "2025-10-17T21:00:00.000Z"
}
```

## Request/Response Format

### Request Headers

```http
Content-Type: application/json
```

If using ngrok:
```http
ngrok-skip-browser-warning: true
```

### Request Body Schema

```typescript
interface ExecuteRequest {
  arguments: {
    command: string;  // The shell command to execute
  };
}
```

### Response Schema

```typescript
interface ExecuteResponse {
  success: boolean;       // Whether command executed without errors
  result?: string;        // Command output (if success)
  error?: string;         // Error message (if failure)
  details?: string;       // Detailed error info (if failure)
  command: string;        // The command that was executed
  timestamp: string;      // ISO 8601 timestamp
}
```

## Error Handling

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Command executed successfully |
| 400 | Bad Request | Invalid request format |
| 500 | Internal Server Error | Server or execution error |
| 503 | Service Unavailable | Kali container not reachable |

### Error Response Format

```json
{
  "success": false,
  "error": "Error type",
  "details": "Detailed error message",
  "command": "attempted command",
  "timestamp": "2025-10-17T21:00:00.000Z"
}
```

### Common Errors

#### Invalid JSON
```json
{
  "success": false,
  "error": "Invalid JSON in request body"
}
```

#### Missing Command
```json
{
  "success": false,
  "error": "Command is required"
}
```

#### Kali Container Not Found
```json
{
  "success": false,
  "error": "Kali container not found or not running"
}
```

## Code Examples

### cURL

```bash
# Basic command
curl -X POST http://localhost:3000/api/tools/kali_execute \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"command": "whoami"}}'

# With ngrok
curl -X POST https://your-subdomain.ngrok-free.app/api/tools/kali_execute \
  -H "Content-Type: application/json" \
  -H "ngrok-skip-browser-warning: true" \
  -d '{"arguments": {"command": "hostname -I"}}'

# Network scan
curl -X POST http://localhost:3000/api/tools/kali_execute \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"command": "nmap -sn 192.168.1.0/24"}}'
```

### Python

```python
import requests
import json

def execute_kali_command(command):
    """Execute a command in Kali Linux via API"""
    url = "http://localhost:3000/api/tools/kali_execute"
    
    payload = {
        "arguments": {
            "command": command
        }
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    response = requests.post(url, json=payload, headers=headers)
    
    if response.status_code == 200:
        result = response.json()
        if result["success"]:
            print(f"✅ Success:\n{result['result']}")
        else:
            print(f"❌ Error: {result['error']}")
            print(f"Details: {result.get('details', 'N/A')}")
    else:
        print(f"HTTP Error: {response.status_code}")
    
    return response.json()

# Examples
execute_kali_command("whoami")
execute_kali_command("hostname -I")
execute_kali_command("nmap --version")
```

### JavaScript (Node.js)

```javascript
const axios = require('axios');

async function executeKaliCommand(command) {
    const url = 'http://localhost:3000/api/tools/kali_execute';
    
    try {
        const response = await axios.post(url, {
            arguments: {
                command: command
            }
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.data.success) {
            console.log(`✅ Success:\n${response.data.result}`);
        } else {
            console.error(`❌ Error: ${response.data.error}`);
            console.error(`Details: ${response.data.details || 'N/A'}`);
        }
        
        return response.data;
    } catch (error) {
        console.error('HTTP Error:', error.message);
        throw error;
    }
}

// Examples
(async () => {
    await executeKaliCommand('whoami');
    await executeKaliCommand('hostname -I');
    await executeKaliCommand('nmap --version');
})();
```

### JavaScript (Browser/Fetch)

```javascript
async function executeKaliCommand(command) {
    const url = 'http://localhost:3000/api/tools/kali_execute';
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            arguments: {
                command: command
            }
        })
    });
    
    const result = await response.json();
    
    if (result.success) {
        console.log('✅ Success:', result.result);
    } else {
        console.error('❌ Error:', result.error);
    }
    
    return result;
}

// Example usage
executeKaliCommand('whoami');
```

### PowerShell

```powershell
function Invoke-KaliCommand {
    param(
        [string]$Command,
        [string]$ApiUrl = "http://localhost:3000/api/tools/kali_execute"
    )
    
    $body = @{
        arguments = @{
            command = $Command
        }
    } | ConvertTo-Json
    
    $headers = @{
        "Content-Type" = "application/json"
    }
    
    try {
        $response = Invoke-RestMethod -Uri $ApiUrl -Method Post -Body $body -Headers $headers
        
        if ($response.success) {
            Write-Host "✅ Success:" -ForegroundColor Green
            Write-Host $response.result
        } else {
            Write-Host "❌ Error:" -ForegroundColor Red
            Write-Host $response.error
        }
        
        return $response
    } catch {
        Write-Host "HTTP Error: $_" -ForegroundColor Red
    }
}

# Examples
Invoke-KaliCommand -Command "whoami"
Invoke-KaliCommand -Command "hostname -I"
Invoke-KaliCommand -Command "nmap --version"
```

### Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io/ioutil"
    "net/http"
)

type ExecuteRequest struct {
    Arguments struct {
        Command string `json:"command"`
    } `json:"arguments"`
}

type ExecuteResponse struct {
    Success   bool   `json:"success"`
    Result    string `json:"result,omitempty"`
    Error     string `json:"error,omitempty"`
    Details   string `json:"details,omitempty"`
    Command   string `json:"command"`
    Timestamp string `json:"timestamp"`
}

func executeKaliCommand(command string) (*ExecuteResponse, error) {
    url := "http://localhost:3000/api/tools/kali_execute"
    
    req := ExecuteRequest{}
    req.Arguments.Command = command
    
    jsonData, err := json.Marshal(req)
    if err != nil {
        return nil, err
    }
    
    resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    body, err := ioutil.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }
    
    var result ExecuteResponse
    err = json.Unmarshal(body, &result)
    if err != nil {
        return nil, err
    }
    
    return &result, nil
}

func main() {
    result, err := executeKaliCommand("whoami")
    if err != nil {
        fmt.Printf("Error: %v\n", err)
        return
    }
    
    if result.Success {
        fmt.Printf("✅ Success:\n%s\n", result.Result)
    } else {
        fmt.Printf("❌ Error: %s\n", result.Error)
    }
}
```

## Rate Limiting

Currently, there is no built-in rate limiting. Consider implementing:

1. **Reverse proxy rate limiting** (nginx, Traefik)
2. **API gateway** (Kong, Tyk)
3. **Custom middleware** in server.js

### Example nginx Rate Limiting

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

server {
    location /api/ {
        limit_req zone=api burst=20;
        proxy_pass http://localhost:3000;
    }
}
```

## Best Practices

### Security

1. **Never expose without authentication**
   ```javascript
   // Add to server.js
   app.use('/api', (req, res, next) => {
       const apiKey = req.headers['x-api-key'];
       if (apiKey !== process.env.API_KEY) {
           return res.status(401).json({ error: 'Unauthorized' });
       }
       next();
   });
   ```

2. **Sanitize commands**
   - Validate input format
   - Block dangerous commands (rm -rf, etc.)
   - Log all executions

3. **Use HTTPS in production**
   - Set up reverse proxy with SSL
   - Use Let's Encrypt for free certificates

### Performance

1. **Implement caching** for repeated commands
2. **Add timeouts** for long-running commands
3. **Queue system** for multiple concurrent requests

### Monitoring

1. **Log all API calls**
   ```javascript
   app.use((req, res, next) => {
       console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
       next();
   });
   ```

2. **Track metrics**
   - Request count
   - Error rate
   - Response time

3. **Set up alerts**
   - High error rate
   - Unusual activity
   - Container failures

## Advanced Usage

### Batch Commands

Execute multiple commands in sequence:

```bash
curl -X POST http://localhost:3000/api/tools/kali_execute \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"command": "whoami && hostname -I && nmap --version"}}'
```

### Background Processes

For long-running scans:

```bash
curl -X POST http://localhost:3000/api/tools/kali_execute \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"command": "nmap -sV 192.168.1.0/24 > /tmp/scan.txt 2>&1 &"}}'

# Check results later
curl -X POST http://localhost:3000/api/tools/kali_execute \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"command": "cat /tmp/scan.txt"}}'
```

### Output to Files

Save scan results:

```bash
curl -X POST http://localhost:3000/api/tools/kali_execute \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"command": "nmap -sV 192.168.1.1 -oN /tmp/scan-result.txt"}}'

# Retrieve file
curl -X POST http://localhost:3000/api/tools/kali_execute \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"command": "cat /tmp/scan-result.txt"}}'
```

## Troubleshooting

### Connection Refused

**Cause**: API server not running or wrong port

**Solution**:
```bash
# Check containers
docker ps

# Check logs
docker logs mcp-pentest-forge

# Verify port
curl http://localhost:3000/
```

### Command Timeout

**Cause**: Long-running command

**Solution**: Run in background or increase timeout

### Invalid JSON Error

**Cause**: Malformed request body

**Solution**: Validate JSON before sending
```bash
# Use jq to validate
echo '{"arguments": {"command": "whoami"}}' | jq .
```

## Next Steps

- **n8n Integration**: [N8N Integration Guide](N8N_INTEGRATION.md)
- **Remote Access**: [Remote Access Guide](REMOTE_ACCESS.md)
- **ngrok Setup**: [ngrok Setup Guide](NGROK_SETUP.md)

---

**Happy coding! 🚀**

