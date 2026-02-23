# Windows MCP Client - Agent Architecture

## Files

- **windows-agent.py** - Windows agent (tested ✓)
- **windows-mcp-client.js** - MCP client
- **test-agent.ps1** - Test all agent tools
- **setup-agent.ps1** - Setup script
- **.env** - Configuration

## Quick Start

### Start Agent
```powershell
$env:AGENT_PORT = "8888"
$env:AGENT_API_KEY = "your-secure-key"
python windows-agent.py
```

### Test Agent
```powershell
powershell -ExecutionPolicy Bypass -File test-agent.ps1
```

### Start MCP Client
```bash
npm start
```

## Architecture

```
API Service → Windows Agent → Windows System
```

Agent contains only primitive commands. All business logic stays on API service.
