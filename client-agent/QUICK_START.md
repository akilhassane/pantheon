# Pantheon Client Agent - Quick Start

## Setup

### 1. Install Dependencies

```bash
cd client-agent
npm install
```

### 2. Configure Environment

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# For local testing (backend running locally)
BACKEND_URL=ws://localhost:3002

# Your Supabase user ID (optional)
USER_ID=your-user-id-here
```

### 3. Start Docker Desktop

Make sure Docker Desktop is running:
- Windows: Switch to **Windows containers** mode (right-click Docker tray icon)
- Or keep in Linux containers mode (works with dockurr/windows image)

### 4. Start the Agent

```bash
node agent.js
```

You should see:

```
========================================
🤖 Pantheon Client Agent
========================================
Agent ID: YOUR-HOSTNAME-1234567890
Backend: ws://localhost:3003
Hostname: YOUR-HOSTNAME
Platform: win32
========================================
🔌 Connecting to Pantheon backend...
   URL: ws://localhost:3003
   Agent ID: YOUR-HOSTNAME-1234567890
   Hostname: YOUR-HOSTNAME
✅ Connected to Pantheon backend
👋 Received welcome from backend
```

## Testing

### Test 1: Check Agent Connection

In another terminal, test the backend API:

```bash
# List connected agents
curl http://localhost:3003/api/agents

# Should return:
# {
#   "success": true,
#   "agents": [
#     {
#       "agentId": "YOUR-HOSTNAME-1234567890",
#       "metadata": {...},
#       "connected": true
#     }
#   ],
#   "count": 1
# }
```

### Test 2: Create Container via Agent

```bash
# Create a test container
curl -X POST http://localhost:3003/api/agents/YOUR-AGENT-ID/containers \
  -H "Content-Type: application/json" \
  -d '{
    "Image": "nginx:alpine",
    "name": "test-container",
    "HostConfig": {
      "PortBindings": {
        "80/tcp": [{"HostPort": "8080"}]
      }
    }
  }'

# Should return:
# {
#   "success": true,
#   "result": {
#     "containerId": "abc123..."
#   }
# }
```

### Test 3: List Containers

```bash
curl http://localhost:3003/api/agents/YOUR-AGENT-ID/containers

# Should return list of containers
```

### Test 4: Start Container

```bash
curl -X POST http://localhost:3003/api/agents/YOUR-AGENT-ID/containers/CONTAINER-ID/start

# Should return:
# {
#   "success": true,
#   "result": {
#     "status": "started"
#   }
# }
```

### Test 5: Access Container

Open browser: http://localhost:8080

You should see the nginx welcome page!

## Production Deployment

Update `.env` with your production backend URL:

```env
BACKEND_URL=wss://your-backend-url.com
USER_ID=your-supabase-user-id
```

Restart agent:

```bash
node agent.js
```

The agent will now connect to your backend and receive commands from the web UI!

## Troubleshooting

### Agent Can't Connect

**Error:** `WebSocket error: connect ECONNREFUSED`

**Solution:**
- Make sure backend is running (`cd backend && npm start`)
- Check BACKEND_URL in `.env`
- For production, use `wss://` not `ws://`

### Docker Commands Fail

**Error:** `Error: connect ENOENT //./pipe/docker_engine`

**Solution:**
- Start Docker Desktop
- Make sure Docker is running: `docker ps`

### Container Creation Fails

**Error:** `no matching manifest for windows/amd64`

**Solution:**
- Switch Docker Desktop to Windows containers mode
- Or use Linux-compatible images (nginx, ubuntu, etc.)

### Agent Disconnects Frequently

**Solution:**
- Check network connection
- Check firewall settings
- Increase reconnect interval in agent.js

## Next Steps

1. **Test with Windows 11 Image**
   ```bash
   # Pull the image
   docker pull dockurr/windows:latest
   
   # Create via agent API
   curl -X POST http://localhost:3003/api/agents/YOUR-AGENT-ID/containers \
     -H "Content-Type: application/json" \
     -d '{
       "Image": "dockurr/windows:latest",
       "name": "windows-11-test",
       "HostConfig": {
         "PortBindings": {
           "8006/tcp": [{"HostPort": "8006"}]
         }
       }
     }'
   ```

2. **Integrate with Frontend**
   - Frontend calls backend API
   - Backend sends commands to agent
   - Agent creates containers locally
   - User accesses via noVNC

3. **Package as Installer**
   - See `PACKAGING.md` for details
   - Create Windows installer
   - Distribute to users

## Architecture

```
┌─────────────────────────────────────────┐
│  Frontend (Vercel)                      │
│  https://frontend-beryl-beta-62...      │
└────────────────┬────────────────────────┘
                 │ HTTPS API
                 │
┌────────────────▼────────────────────────┐
│  Backend Server                         │
│  http://localhost:3002                  │
│                                         │
│  • Receives API calls from frontend    │
│  • Sends commands via WebSocket        │
└────────────────┬────────────────────────┘
                 │ WebSocket
                 │ (wss://)
┌────────────────▼────────────────────────┐
│  Client Agent (Your Machine)            │
│  node agent.js                          │
│                                         │
│  • Connects to backend server          │
│  • Receives container commands         │
│  • Executes via Docker API             │
└────────────────┬────────────────────────┘
                 │ Docker API
                 │
┌────────────────▼────────────────────────┐
│  Docker Desktop                         │
│                                         │
│  • Windows 11 containers               │
│  • Running locally                     │
│  • Accessible via localhost            │
└─────────────────────────────────────────┘
```

---

**Status:** ✅ Ready to test!
**Next:** Run `node agent.js` and test the API endpoints
