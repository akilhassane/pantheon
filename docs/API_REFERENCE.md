# API Reference

Complete API documentation for Pantheon AI Platform.

## Table of Contents

- [Authentication](#authentication)
- [Projects API](#projects-api)
- [Sessions API](#sessions-api)
- [AI Agent API](#ai-agent-api)
- [WebSocket API](#websocket-api)
- [Usage Tracking API](#usage-tracking-api)

## Base URL

```
http://localhost:3002/api
```

## Authentication

Currently, Pantheon uses session-based authentication. Future versions will support API keys.

### Headers

```http
Content-Type: application/json
```

## Projects API

### List Projects

Get all projects for the current user.

```http
GET /api/projects
```

**Response:**
```json
{
  "projects": [
    {
      "id": "proj_123",
      "name": "My Project",
      "os_type": "windows",
      "created_at": "2025-01-25T10:00:00Z",
      "status": "active"
    }
  ]
}
```

### Create Project

Create a new project.

```http
POST /api/projects
```

**Request Body:**
```json
{
  "name": "New Project",
  "os_type": "windows"
}
```

**Response:**
```json
{
  "project": {
    "id": "proj_124",
    "name": "New Project",
    "os_type": "windows",
    "created_at": "2025-01-25T10:05:00Z",
    "status": "initializing"
  }
}
```

### Get Project

Get details of a specific project.

```http
GET /api/projects/:projectId
```

**Response:**
```json
{
  "project": {
    "id": "proj_123",
    "name": "My Project",
    "os_type": "windows",
    "created_at": "2025-01-25T10:00:00Z",
    "status": "active",
    "container_id": "container_abc123"
  }
}
```

### Delete Project

Delete a project and its associated resources.

```http
DELETE /api/projects/:projectId
```

**Response:**
```json
{
  "success": true,
  "message": "Project deleted successfully"
}
```

## Sessions API

### Create Session

Create a new chat session.

```http
POST /api/sessions
```

**Request Body:**
```json
{
  "project_id": "proj_123",
  "model": "gpt-4"
}
```

**Response:**
```json
{
  "session": {
    "id": "sess_456",
    "project_id": "proj_123",
    "model": "gpt-4",
    "created_at": "2025-01-25T10:10:00Z"
  }
}
```

### Get Session History

Get chat history for a session.

```http
GET /api/sessions/:sessionId/history
```

**Response:**
```json
{
  "messages": [
    {
      "id": "msg_789",
      "role": "user",
      "content": "Open Notepad",
      "timestamp": "2025-01-25T10:11:00Z"
    },
    {
      "id": "msg_790",
      "role": "assistant",
      "content": "I'll open Notepad for you.",
      "timestamp": "2025-01-25T10:11:02Z"
    }
  ]
}
```

## AI Agent API

### Send Message

Send a message to the AI agent.

```http
POST /api/agent/message
```

**Request Body:**
```json
{
  "session_id": "sess_456",
  "message": "Open Notepad and write Hello World",
  "stream": true
}
```

**Response (Streaming):**
```
data: {"type":"token","content":"I'll"}
data: {"type":"token","content":" open"}
data: {"type":"token","content":" Notepad"}
data: {"type":"action","action":"click","target":"start_menu"}
data: {"type":"complete"}
```

**Response (Non-streaming):**
```json
{
  "response": "I'll open Notepad and write Hello World for you.",
  "actions": [
    {
      "type": "click",
      "target": "start_menu"
    },
    {
      "type": "type",
      "text": "notepad"
    }
  ]
}
```

### Execute Action

Execute a specific action on the Windows environment.

```http
POST /api/agent/action
```

**Request Body:**
```json
{
  "project_id": "proj_123",
  "action": "screenshot"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "image_url": "/screenshots/screenshot_123.png",
    "timestamp": "2025-01-25T10:15:00Z"
  }
}
```

## WebSocket API

### Connect

```javascript
const ws = new WebSocket('ws://localhost:3002');

ws.onopen = () => {
  // Subscribe to project updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    project_id: 'proj_123'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

### Message Types

#### Subscribe to Project
```json
{
  "type": "subscribe",
  "project_id": "proj_123"
}
```

#### Chat Message
```json
{
  "type": "chat_message",
  "session_id": "sess_456",
  "message": "Hello"
}
```

#### Action Update
```json
{
  "type": "action_update",
  "action": "screenshot",
  "status": "completed",
  "result": {...}
}
```

#### Collaboration Update
```json
{
  "type": "user_joined",
  "user_id": "user_789",
  "username": "John Doe"
}
```

## Usage Tracking API

### Get Usage Stats

Get API usage statistics.

```http
GET /api/usage/stats
```

**Query Parameters:**
- `start_date`: ISO 8601 date (optional)
- `end_date`: ISO 8601 date (optional)
- `model`: Filter by model (optional)

**Response:**
```json
{
  "usage": {
    "total_tokens": 150000,
    "total_cost": 2.50,
    "by_model": {
      "gpt-4": {
        "tokens": 100000,
        "cost": 2.00
      },
      "gpt-3.5-turbo": {
        "tokens": 50000,
        "cost": 0.50
      }
    },
    "by_date": [
      {
        "date": "2025-01-25",
        "tokens": 50000,
        "cost": 0.85
      }
    ]
  }
}
```

## Error Responses

All endpoints may return these error responses:

### 400 Bad Request
```json
{
  "error": "Invalid request",
  "message": "Missing required field: project_id"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

### 404 Not Found
```json
{
  "error": "Not found",
  "message": "Project not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

## Rate Limits

- **API Requests**: 100 requests per minute per IP
- **WebSocket Messages**: 50 messages per minute per connection
- **AI Agent Calls**: Limited by your AI provider's rate limits

## Code Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

const API_BASE = 'http://localhost:3002/api';

// Create a project
async function createProject(name) {
  const response = await axios.post(`${API_BASE}/projects`, {
    name,
    os_type: 'windows'
  });
  return response.data.project;
}

// Send message to AI
async function sendMessage(sessionId, message) {
  const response = await axios.post(`${API_BASE}/agent/message`, {
    session_id: sessionId,
    message,
    stream: false
  });
  return response.data;
}
```

### Python

```python
import requests

API_BASE = 'http://localhost:3002/api'

# Create a project
def create_project(name):
    response = requests.post(f'{API_BASE}/projects', json={
        'name': name,
        'os_type': 'windows'
    })
    return response.json()['project']

# Send message to AI
def send_message(session_id, message):
    response = requests.post(f'{API_BASE}/agent/message', json={
        'session_id': session_id,
        'message': message,
        'stream': False
    })
    return response.json()
```

### cURL

```bash
# Create a project
curl -X POST http://localhost:3002/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"My Project","os_type":"windows"}'

# Send message to AI
curl -X POST http://localhost:3002/api/agent/message \
  -H "Content-Type: application/json" \
  -d '{"session_id":"sess_456","message":"Open Notepad","stream":false}'
```

## Next Steps

- [Integration Guide](./INTEGRATION.md) - Learn how to integrate Pantheon
- [Architecture](./ARCHITECTURE.md) - Understand the system design
- [User Guide](./USER_GUIDE.md) - Learn the web interface

---

[← Back to README](../README.md)
