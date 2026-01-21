# Pantheon Architecture Documentation

## Overview

Pantheon is a multi-agentic AI platform built on a microservices architecture using Docker containers. This document explains how all components work together.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User's Browser                          │
│                     (http://localhost:3000)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP/WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend Container                         │
│                    (Next.js 14 + React 18)                      │
│                                                                 │
│  • User Interface (React Components)                            │
│  • Real-time Updates (WebSocket Client)                         │
│  • State Management (React Context)                             │
│  • Terminal Emulator (xterm.js)                                 │
│                                                                 │
│  Port: 3000                                                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ REST API + WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend Container                          │
│                    (Node.js 18 + Express)                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Core Services                              │   │
│  │                                                         │   │
│  │  • Project Manager      • Session Manager             │   │
│  │  • AI Provider APIs     • Collaboration Manager       │   │
│  │  • MCP Client Manager   • Usage Tracking              │   │
│  │  • WebSocket Server     • Authentication              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Port: 3002                                                     │
└──────────┬──────────────────────────────┬───────────────────────┘
           │                              │
           │                              │ Docker API
           │                              ▼
           │                    ┌──────────────────────┐
           │                    │   Docker Engine      │
           │                    │                      │
           │                    │  • Container Mgmt    │
           │                    │  • Volume Mgmt       │
           │                    │  • Network Mgmt      │
           │                    └──────────────────────┘
           │
           │ HTTP API
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Windows Tools API Container                    │
│                    (Node.js + Python)                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Windows Automation Tools                   │   │
│  │                                                         │   │
│  │  • Screenshot & OCR     • Mouse Control               │   │
│  │  • Keyboard Input       • Window Management           │   │
│  │  • Process Control      • File Operations             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Port: 3003                                                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Windows API Calls
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Windows Project Containers                   │
│                      (QEMU/KVM + Windows 11)                    │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │   Project 1      │  │   Project 2      │  │   Project N  │  │
│  │                  │  │                  │  │              │  │
│  │  • Windows 11    │  │  • Windows 11    │  │  • Windows   │  │
│  │  • VNC Server    │  │  • VNC Server    │  │  • VNC       │  │
│  │  • Isolated      │  │  • Isolated      │  │  • Isolated  │  │
│  │  • Per-project   │  │  • Per-project   │  │  • Storage   │  │
│  │    storage       │  │    storage       │  │              │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│                                                                 │
│  Ports: 5900+, 3389+, 9090+ (dynamic allocation)               │
└─────────────────────────────────────────────────────────────────┘

External Services:
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   Supabase       │  │  AI Providers    │  │   Docker Hub     │
│   (PostgreSQL)   │  │  • OpenAI        │  │   (Images)       │
│                  │  │  • Anthropic     │  │                  │
│  • User Data     │  │  • Gemini        │  │  • Frontend      │
│  • Projects      │  │  • OpenRouter    │  │  • Backend       │
│  • Sessions      │  │  • Mistral       │  │  • Windows Tools │
│  • Messages      │  │  • Cohere        │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

## Component Details

### 1. Frontend Container

**Technology**: Next.js 14, React 18, TypeScript

**Responsibilities**:
- Render user interface
- Handle user interactions
- Manage client-side state
- Communicate with backend via REST and WebSocket
- Display terminal output
- Show Windows desktop via VNC

**Key Files**:
- `frontend/app/` - Next.js app router pages
- `frontend/components/` - React components
- `frontend/contexts/` - React context providers
- `frontend/hooks/` - Custom React hooks
- `frontend/lib/` - Utility libraries

**Environment Variables**:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=http://localhost:3002
```

---

### 2. Backend Container

**Technology**: Node.js 18, Express.js

**Responsibilities**:
- Handle API requests
- Manage AI provider integrations
- Control Docker containers
- Manage projects and sessions
- Handle WebSocket connections
- Track usage and costs
- Authenticate users

**Key Modules**:

#### Project Manager (`project-manager.js`)
- Create/delete Windows projects
- Allocate ports dynamically
- Manage project lifecycle
- Handle project isolation

#### Session Manager (`enhanced-session-manager.js`)
- Create/delete chat sessions
- Store message history
- Manage session state
- Handle session switching

#### AI Provider APIs (`provider-apis.js`)
- OpenAI integration
- Anthropic integration
- Google Gemini integration
- OpenRouter integration
- Unified API interface

#### MCP Client Manager (`mcp-client-manager.js`)
- Manage MCP connections
- Execute tools
- Handle tool responses
- Error handling

#### Collaboration Manager (`collaboration-manager.js`)
- Real-time collaboration
- User presence tracking
- Cursor synchronization
- Shared editing

**Environment Variables**:
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
MCP_MASTER_SECRET=xxx
PORT=3002
```

---

### 3. Windows Tools API Container

**Technology**: Node.js 18, Python 3

**Responsibilities**:
- Provide Windows automation tools
- Execute commands on Windows containers
- Capture screenshots
- Perform OCR
- Control mouse and keyboard
- Manage windows and processes

**Available Tools**:
- `take_screenshot` - Capture screen
- `click_mouse` - Click at coordinates
- `type_text` - Type text
- `press_key` - Press keyboard keys
- `move_mouse` - Move mouse cursor
- `get_window_list` - List open windows
- `execute_command` - Run PowerShell commands

**Environment Variables**:
```env
PORT=3003
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

### 4. Windows Project Containers

**Technology**: QEMU/KVM, Windows 11

**Responsibilities**:
- Provide isolated Windows environments
- Run Windows applications
- Expose VNC for visual access
- Execute automation commands
- Store project-specific data

**Features**:
- Full Windows 11 installation
- VNC server on port 5900+
- RDP server on port 3389+
- PowerShell terminal on port 9090+
- Isolated storage per project
- Dynamic port allocation

---

## Data Flow

### 1. User Sends Message

```
User types message in browser
    ↓
Frontend sends POST /api/chat
    ↓
Backend receives request
    ↓
Backend calls AI provider API
    ↓
AI decides to use tool
    ↓
Backend calls Windows Tools API
    ↓
Windows Tools API executes on Windows container
    ↓
Result returned to Backend
    ↓
Backend sends to AI provider
    ↓
AI generates response
    ↓
Backend streams response to Frontend via WebSocket
    ↓
Frontend displays response to User
```

### 2. Project Creation

```
User clicks "Create Project"
    ↓
Frontend sends POST /api/projects
    ↓
Backend Project Manager:
  1. Allocates unique ports
  2. Creates Docker volume
  3. Starts Windows container
  4. Waits for container to be ready
  5. Stores project in database
    ↓
Backend returns project details
    ↓
Frontend displays project
```

### 3. Real-time Collaboration

```
User A joins project
    ↓
Frontend establishes WebSocket connection
    ↓
Backend registers user in Collaboration Manager
    ↓
User A types message
    ↓
Frontend sends via WebSocket
    ↓
Backend broadcasts to all users in project
    ↓
User B receives message via WebSocket
    ↓
Frontend updates UI for User B
```

---

## Database Schema

### Tables

#### users
```sql
- id (uuid, primary key)
- email (text, unique)
- created_at (timestamp)
- updated_at (timestamp)
```

#### projects
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key)
- name (text)
- os_type (text) -- 'windows', 'linux', 'macos'
- container_id (text)
- vnc_port (integer)
- rdp_port (integer)
- terminal_port (integer)
- status (text) -- 'creating', 'running', 'stopped', 'error'
- created_at (timestamp)
- updated_at (timestamp)
```

#### sessions
```sql
- id (uuid, primary key)
- project_id (uuid, foreign key)
- user_id (uuid, foreign key)
- name (text)
- created_at (timestamp)
- updated_at (timestamp)
- deleted_at (timestamp, nullable)
```

#### messages
```sql
- id (uuid, primary key)
- session_id (uuid, foreign key)
- role (text) -- 'user', 'assistant', 'system'
- content (text)
- blocks (jsonb) -- tool calls, results, etc.
- created_at (timestamp)
```

#### collaborators
```sql
- id (uuid, primary key)
- project_id (uuid, foreign key)
- user_id (uuid, foreign key)
- role (text) -- 'owner', 'editor', 'viewer'
- created_at (timestamp)
```

#### usage_records
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key)
- project_id (uuid, foreign key)
- provider (text) -- 'openai', 'anthropic', etc.
- model (text)
- input_tokens (integer)
- output_tokens (integer)
- cost (numeric)
- created_at (timestamp)
```

---

## Security

### Authentication

- Supabase Auth for user authentication
- JWT tokens for API requests
- Session-based authentication for WebSocket

### Authorization

- Row-level security (RLS) in Supabase
- Project ownership verification
- Collaborator role-based access

### API Keys

- Per-project API keys for Windows Tools
- Encrypted storage using MCP_MASTER_SECRET
- Keys never exposed to frontend

### Container Isolation

- Each project runs in isolated Docker container
- Separate network namespaces
- Isolated storage volumes
- No cross-project access

---

## Networking

### Docker Networks

```
pantheon-network (bridge)
  ├── frontend (172.25.0.2)
  ├── backend (172.25.0.3)
  ├── windows-tools-api (172.25.0.4)
  └── windows-project-* (172.25.0.5+)
```

### Port Allocation

**Static Ports**:
- Frontend: 3000
- Backend: 3002
- Windows Tools API: 3003

**Dynamic Ports** (per project):
- VNC: 5900 + project_index
- RDP: 3389 + project_index
- Terminal: 9090 + project_index

### Port Discovery

Backend maintains port allocation table:
```javascript
{
  projectId: {
    vncPort: 5900,
    rdpPort: 3389,
    terminalPort: 9090
  }
}
```

---

## Scalability

### Horizontal Scaling

- Frontend: Multiple instances behind load balancer
- Backend: Multiple instances with shared database
- Windows Tools API: Multiple instances

### Vertical Scaling

- Increase Docker resource limits
- Allocate more CPU/memory per container

### Resource Limits

**Per Container**:
- Frontend: 1 CPU, 2GB RAM
- Backend: 2 CPU, 4GB RAM
- Windows Tools: 1 CPU, 2GB RAM
- Windows Project: 4 CPU, 8GB RAM

---

## Monitoring

### Health Checks

All containers expose `/health` endpoint:
```json
{
  "status": "ok",
  "timestamp": "2024-01-22T10:00:00Z",
  "uptime": 3600
}
```

### Logging

- Container logs: `docker logs <container>`
- Application logs: Structured JSON logs
- Error tracking: Console errors + Supabase logs

### Metrics

- API response times
- AI provider latency
- Container resource usage
- Database query performance

---

## Deployment

### Development

```bash
docker-compose up -d
```

### Production

```bash
docker-compose -f docker-compose.production.yml up -d
```

### CI/CD

1. Build images
2. Push to Docker Hub
3. Pull on production server
4. Rolling update

---

## Future Architecture

### Planned Improvements

1. **Kubernetes Support**
   - Deploy on Kubernetes cluster
   - Auto-scaling based on load
   - Better resource management

2. **Multi-Region**
   - Deploy in multiple regions
   - Reduce latency
   - Improve availability

3. **Caching Layer**
   - Redis for session caching
   - CDN for static assets
   - API response caching

4. **Message Queue**
   - RabbitMQ/Redis for async tasks
   - Background job processing
   - Better error handling

5. **Microservices**
   - Separate AI provider service
   - Separate project management service
   - Better separation of concerns

---

## Troubleshooting Architecture Issues

### Container Communication Issues

```bash
# Test network connectivity
docker exec frontend ping backend
docker exec backend ping windows-tools-api

# Inspect network
docker network inspect pantheon-network
```

### Port Conflicts

```bash
# Find what's using a port
lsof -i :3000

# Check Docker port mappings
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

### Resource Exhaustion

```bash
# Check resource usage
docker stats

# Check disk space
df -h
docker system df
```

---

For more details, see:
- [Installation Guide](./INSTALLATION_GUIDE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [API Reference](./API_REFERENCE.md)

[⬆ Back to Top](#pantheon-architecture-documentation)
