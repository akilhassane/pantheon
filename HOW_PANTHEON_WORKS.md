# How Pantheon Works - Complete Technical Overview

## Executive Summary

Pantheon is a multi-agentic AI platform that enables AI models (like GPT-4, Claude, Gemini) to interact with operating systems through a web interface. Currently supporting Windows with plans for Linux and macOS.

**In Simple Terms**: You tell an AI what you want done on a Windows computer, and it actually does it - opening programs, managing files, running commands, etc.

---

## Architecture Overview

### The Three-Layer Stack

```
┌─────────────────────────────────────────┐
│         Layer 1: User Interface         │
│              (Frontend)                 │
│  • Web browser interface                │
│  • Chat with AI                         │
│  • View Windows desktop                 │
│  • See terminal output                  │
└─────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────┐
│      Layer 2: Orchestration Layer       │
│              (Backend)                  │
│  • Manages AI conversations             │
│  • Controls Docker containers           │
│  • Handles user authentication          │
│  • Tracks usage and costs               │
└─────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────┐
│     Layer 3: Execution Layer            │
│    (Windows Tools + Windows VMs)        │
│  • Executes commands on Windows         │
│  • Takes screenshots                    │
│  • Controls mouse/keyboard              │
│  • Manages Windows applications         │
└─────────────────────────────────────────┘
```

---

## How It Works: Step by Step

### 1. User Interaction

**User**: "Open Notepad and type 'Hello World'"

The user types this in the web interface (frontend).

### 2. Frontend Processing

```javascript
// Frontend sends request to backend
POST /api/chat
{
  "message": "Open Notepad and type 'Hello World'",
  "projectId": "abc-123",
  "sessionId": "xyz-789"
}
```

### 3. Backend Receives Request

The backend (`backend/server.js`):
1. Authenticates the user
2. Loads the project context
3. Retrieves chat history
4. Prepares to call AI provider

### 4. AI Provider Call

Backend calls the AI provider (e.g., OpenAI):

```javascript
// Simplified example
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    {
      role: "system",
      content: "You are an AI assistant that can control Windows..."
    },
    {
      role: "user",
      content: "Open Notepad and type 'Hello World'"
    }
  ],
  tools: [
    {
      name: "execute_command",
      description: "Execute a PowerShell command",
      parameters: { ... }
    },
    {
      name: "type_text",
      description: "Type text into active window",
      parameters: { ... }
    }
  ]
});
```

### 5. AI Decides to Use Tools

The AI responds with tool calls:

```json
{
  "tool_calls": [
    {
      "name": "execute_command",
      "arguments": {
        "command": "notepad.exe"
      }
    },
    {
      "name": "type_text",
      "arguments": {
        "text": "Hello World"
      }
    }
  ]
}
```

### 6. Backend Executes Tools

For each tool call, backend calls Windows Tools API:

```javascript
// Execute command
POST http://localhost:3003/api/tools/execute_command
{
  "projectId": "abc-123",
  "command": "notepad.exe"
}

// Type text
POST http://localhost:3003/api/tools/type_text
{
  "projectId": "abc-123",
  "text": "Hello World"
}
```

### 7. Windows Tools API Executes

The Windows Tools API (`docker/windows-tools-api/server.js`):

1. Identifies the Windows container for this project
2. Connects to the Windows VM
3. Executes the command via PowerShell
4. Returns the result

```javascript
// Inside Windows container
> notepad.exe
// Notepad opens

> [Type text via automation]
// "Hello World" appears in Notepad
```

### 8. Results Return to AI

Backend sends tool results back to AI:

```json
{
  "tool_results": [
    {
      "tool_call_id": "call_1",
      "output": "Notepad opened successfully"
    },
    {
      "tool_call_id": "call_2",
      "output": "Text typed successfully"
    }
  ]
}
```

### 9. AI Generates Final Response

AI processes the results and responds:

```
"I've opened Notepad and typed 'Hello World' for you. 
You should see Notepad open with the text displayed."
```

### 10. Frontend Displays Response

The frontend receives the response via WebSocket and displays:
- The AI's message
- The tool calls that were made
- The results
- Updated Windows desktop view (via VNC)

---

## Key Components Explained

### Frontend (Next.js + React)

**Location**: `frontend/`

**What it does**:
- Renders the web interface
- Handles user input
- Displays chat messages
- Shows Windows desktop via VNC
- Displays terminal output
- Manages real-time updates via WebSocket

**Key Files**:
- `app/page.tsx` - Main page
- `components/chat/` - Chat interface
- `components/terminal/` - Terminal display
- `components/vnc/` - Windows desktop viewer

### Backend (Node.js + Express)

**Location**: `backend/`

**What it does**:
- Manages API requests
- Integrates with AI providers (OpenAI, Anthropic, Gemini, etc.)
- Controls Docker containers
- Manages projects and sessions
- Handles authentication
- Tracks usage and costs
- Broadcasts updates via WebSocket

**Key Files**:
- `server.js` - Main server
- `project-manager.js` - Project lifecycle management
- `provider-apis.js` - AI provider integrations
- `windows-mcp-client.js` - Windows Tools API client
- `collaboration-manager.js` - Real-time collaboration

### Windows Tools API (Node.js + Python)

**Location**: `docker/windows-tools-api/`

**What it does**:
- Provides Windows automation tools
- Executes commands on Windows VMs
- Takes screenshots
- Performs OCR (text recognition)
- Controls mouse and keyboard
- Manages windows and processes

**Available Tools**:
- `execute_command` - Run PowerShell commands
- `take_screenshot` - Capture screen
- `click_mouse` - Click at coordinates
- `type_text` - Type text
- `press_key` - Press keyboard keys
- `move_mouse` - Move cursor
- `get_window_list` - List open windows

### Windows Projects (QEMU/KVM + Windows 11)

**Location**: Docker containers (dynamically created)

**What it does**:
- Provides isolated Windows 11 environments
- Runs Windows applications
- Exposes VNC for visual access
- Executes automation commands
- Stores project-specific data

**Features**:
- Full Windows 11 installation
- VNC server (port 5900+)
- RDP server (port 3389+)
- PowerShell terminal (port 9090+)
- Isolated storage per project

---

## Data Flow Diagrams

### Creating a Project

```
User clicks "New Project"
    ↓
Frontend → Backend: POST /api/projects
    ↓
Backend Project Manager:
    1. Generate unique project ID
    2. Allocate ports (VNC, RDP, Terminal)
    3. Create Docker volume for storage
    4. Pull Windows container image
    5. Start Windows container with allocated ports
    6. Wait for Windows to boot (2-5 minutes)
    7. Verify VNC is accessible
    8. Store project in database
    ↓
Backend → Frontend: Project details
    ↓
Frontend displays: "Project ready!"
```

### Sending a Message

```
User types message
    ↓
Frontend → Backend: POST /api/chat
    ↓
Backend:
    1. Load project context
    2. Load chat history
    3. Call AI provider API
    ↓
AI Provider:
    1. Analyze message
    2. Decide on actions
    3. Return tool calls
    ↓
Backend:
    1. Execute each tool call
    2. Call Windows Tools API
    ↓
Windows Tools API:
    1. Connect to Windows container
    2. Execute command
    3. Return result
    ↓
Backend:
    1. Send results back to AI
    2. Get final response
    3. Stream to frontend via WebSocket
    ↓
Frontend:
    1. Display AI response
    2. Show tool calls
    3. Update Windows desktop view
```

### Real-time Collaboration

```
User A joins project
    ↓
Frontend establishes WebSocket connection
    ↓
Backend registers user in Collaboration Manager
    ↓
User A types message
    ↓
Frontend → Backend: WebSocket message
    ↓
Backend Collaboration Manager:
    1. Identify all users in project
    2. Broadcast message to all
    ↓
User B receives via WebSocket
    ↓
Frontend updates UI for User B
```

---

## Database Schema

### Core Tables

#### users
Stores user accounts
```sql
- id: Unique user identifier
- email: User's email
- created_at: Account creation time
```

#### projects
Stores Windows projects
```sql
- id: Unique project identifier
- user_id: Owner of the project
- name: Project name
- os_type: 'windows' (future: 'linux', 'macos')
- container_id: Docker container ID
- vnc_port: Port for VNC access
- rdp_port: Port for RDP access
- terminal_port: Port for terminal access
- status: 'creating', 'running', 'stopped', 'error'
- created_at: Project creation time
```

#### sessions
Stores chat sessions within projects
```sql
- id: Unique session identifier
- project_id: Which project this belongs to
- user_id: Session creator
- name: Session name
- created_at: Session creation time
- deleted_at: Soft delete timestamp
```

#### messages
Stores chat messages
```sql
- id: Unique message identifier
- session_id: Which session this belongs to
- role: 'user', 'assistant', 'system'
- content: Message text
- blocks: JSON array of tool calls and results
- created_at: Message timestamp
```

#### collaborators
Stores project collaborators
```sql
- id: Unique identifier
- project_id: Which project
- user_id: Which user
- role: 'owner', 'editor', 'viewer'
- created_at: When added
```

#### usage_records
Tracks AI API usage
```sql
- id: Unique identifier
- user_id: Who used it
- project_id: Which project
- provider: 'openai', 'anthropic', etc.
- model: 'gpt-4o', 'claude-3-5-sonnet', etc.
- input_tokens: Tokens sent to AI
- output_tokens: Tokens received from AI
- cost: Calculated cost in USD
- created_at: When used
```

---

## Security Architecture

### Authentication Flow

```
User enters email/password
    ↓
Frontend → Supabase Auth
    ↓
Supabase validates credentials
    ↓
Returns JWT token
    ↓
Frontend stores token
    ↓
All API requests include token in header:
Authorization: Bearer <jwt-token>
    ↓
Backend validates token with Supabase
    ↓
If valid, process request
If invalid, return 401 Unauthorized
```

### Project Isolation

Each project runs in an isolated Docker container:

```
Project A Container
├── Windows 11 OS
├── Isolated filesystem
├── Separate network namespace
├── Unique ports (5900, 3389, 9090)
└── Cannot access Project B

Project B Container
├── Windows 11 OS
├── Isolated filesystem
├── Separate network namespace
├── Unique ports (5901, 3390, 9091)
└── Cannot access Project A
```

### API Key Security

Per-project API keys for Windows Tools:

```
1. User creates project
2. Backend generates unique API key
3. Key = HMAC(project_id, MCP_MASTER_SECRET)
4. Key stored encrypted in database
5. Windows Tools API validates key
6. Key never exposed to frontend
```

---

## Networking

### Docker Network

All containers are on the same Docker bridge network:

```
pantheon-network (172.25.0.0/16)
├── frontend (172.25.0.2:3000)
├── backend (172.25.0.3:3002)
├── windows-tools-api (172.25.0.4:3003)
├── windows-project-1 (172.25.0.5:5900,3389,9090)
├── windows-project-2 (172.25.0.6:5901,3390,9091)
└── windows-project-N (172.25.0.N:...)
```

### Port Allocation

**Static Ports** (always the same):
- Frontend: 3000
- Backend: 3002
- Windows Tools API: 3003

**Dynamic Ports** (per project):
- VNC: 5900 + project_index
- RDP: 3389 + project_index  
- Terminal: 9090 + project_index

Example:
- Project 1: VNC=5900, RDP=3389, Terminal=9090
- Project 2: VNC=5901, RDP=3390, Terminal=9091
- Project 3: VNC=5902, RDP=3391, Terminal=9092

---

## AI Provider Integration

### Supported Providers

1. **OpenAI**
   - Models: GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo, o1
   - Tool calling: Native support
   - Streaming: Yes

2. **Anthropic**
   - Models: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
   - Tool calling: Native support
   - Streaming: Yes

3. **Google Gemini**
   - Models: Gemini 1.5 Pro, Gemini 1.5 Flash
   - Tool calling: Native support
   - Streaming: Yes

4. **OpenRouter**
   - Models: All of the above + more
   - Tool calling: Depends on model
   - Streaming: Yes

### Tool Calling Format

Pantheon uses the standard tool calling format:

```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "execute_command",
        "description": "Execute a PowerShell command on Windows",
        "parameters": {
          "type": "object",
          "properties": {
            "command": {
              "type": "string",
              "description": "The PowerShell command to execute"
            }
          },
          "required": ["command"]
        }
      }
    }
  ]
}
```

---

## Performance Considerations

### Resource Usage

**Per Service**:
- Frontend: ~500MB RAM, 0.5 CPU
- Backend: ~1GB RAM, 1 CPU
- Windows Tools: ~500MB RAM, 0.5 CPU
- Windows Project: ~4GB RAM, 2 CPU

**Total for 1 project**: ~6GB RAM, 4 CPU

**Total for 3 projects**: ~14GB RAM, 8 CPU

### Optimization Strategies

1. **Stop unused projects**: Frees resources
2. **Use efficient AI models**: GPT-3.5 vs GPT-4
3. **Limit concurrent projects**: Based on available resources
4. **Cache responses**: Reduce API calls
5. **Optimize Docker**: Increase resource limits

---

## Deployment Options

### Local Development

```bash
docker-compose up -d
```

Runs on localhost, uses local Docker.

### Production (Single Server)

```bash
docker-compose -f docker-compose.production.yml up -d
```

Uses pre-built images from Docker Hub.

### Production (Kubernetes)

Future: Deploy on Kubernetes cluster for:
- Auto-scaling
- High availability
- Load balancing
- Better resource management

---

## Future Enhancements

### Planned Features

1. **Linux Support** (Q2 2025)
   - Ubuntu, Debian, Fedora containers
   - Linux-specific tools
   - Shell automation

2. **macOS Support** (Q3 2025)
   - macOS containers (if possible)
   - macOS-specific tools
   - AppleScript integration

3. **Mobile App** (Q4 2025)
   - iOS and Android apps
   - Mobile-optimized interface
   - Push notifications

4. **Plugin System** (Q4 2025)
   - Custom tools
   - Third-party integrations
   - Marketplace

5. **Advanced Features** (2026)
   - Multi-user projects
   - Project templates
   - Automation workflows
   - Scheduled tasks
   - API webhooks

---

## Troubleshooting Common Issues

### Issue: Container won't start

**Cause**: Insufficient resources or port conflict

**Solution**:
```bash
# Check resources
docker stats

# Check ports
docker ps

# Restart
docker-compose restart
```

### Issue: AI not responding

**Cause**: Invalid API key or rate limit

**Solution**:
1. Verify API key in `.env`
2. Check AI provider dashboard
3. Check backend logs: `docker logs pantheon-backend`

### Issue: Windows desktop black screen

**Cause**: Windows still booting or VNC issue

**Solution**:
1. Wait 30 seconds
2. Refresh browser
3. Check VNC port: `docker port <container>`
4. Restart project

---

## Summary

Pantheon is a sophisticated platform that bridges AI and operating systems:

1. **User** interacts via web interface
2. **Frontend** sends requests to backend
3. **Backend** orchestrates AI and containers
4. **AI** decides what actions to take
5. **Windows Tools** executes actions on Windows
6. **Windows VM** runs the actual commands
7. **Results** flow back to user

All of this happens in seconds, giving users the power to control Windows computers through natural language.

---

**For more details, see**:
- [Architecture Documentation](./docs/ARCHITECTURE.md)
- [Installation Guide](./docs/INSTALLATION_GUIDE.md)
- [User Guide](./docs/USER_GUIDE.md)

[⬆ Back to Top](#how-pantheon-works---complete-technical-overview)
