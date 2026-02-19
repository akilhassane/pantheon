# Pantheon AI Platform - API Reference

Complete API documentation for integrating with Pantheon.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Projects API](#projects-api)
3. [Sessions API](#sessions-api)
4. [AI Models API](#ai-models-api)
5. [Collaboration API](#collaboration-api)
6. [WebSocket API](#websocket-api)
7. [Error Handling](#error-handling)

---

## Base URL

```
http://localhost:3002/api
```

For production, replace with your deployed backend URL.

---

## Authentication

All API requests require authentication using Keycloak JWT tokens.

### Get Access Token

```http
POST /auth/token
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "password"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600
}
```

### Using the Token

Include the token in the Authorization header:

```http
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Projects API

### List Projects

Get all projects for the authenticated user.

```http
GET /projects
Authorization: Bearer {token}
```

**Response:**
```json
{
  "projects": [
    {
      "id": "proj_123",
      "name": "My Project",
      "description": "Project description",
      "os_type": "windows",
      "status": "running",
      "created_at": "2024-01-15T10:30:00Z",
      "owner_id": "user_456"
    }
  ]
}
```

### Create Project

Create a new project.

```http
POST /projects
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "New Project",
  "description": "Project description",
  "os_type": "windows",
  "settings": {
    "cpu": 2,
    "memory": 4096
  }
}
```

**Response:**
```json
{
  "project": {
    "id": "proj_789",
    "name": "New Project",
    "status": "initializing",
    "created_at": "2024-01-15T11:00:00Z"
  }
}
```

### Get Project

Get details for a specific project.

```http
GET /projects/{project_id}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "project": {
    "id": "proj_123",
    "name": "My Project",
    "description": "Project description",
    "os_type": "windows",
    "status": "running",
    "container_id": "abc123",
    "vnc_port": 5900,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T12:00:00Z"
  }
}
```

### Update Project

Update project settings.

```http
PATCH /projects/{project_id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "Updated description"
}
```

### Delete Project

Delete a project and all associated data.

```http
DELETE /projects/{project_id}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "message": "Project deleted successfully"
}
```

---

## Sessions API

### Create Session

Start a new AI session in a project.

```http
POST /projects/{project_id}/sessions
Authorization: Bearer {token}
Content-Type: application/json

{
  "model": "gpt-4",
  "mode": "default"
}
```

**Response:**
```json
{
  "session": {
    "id": "sess_456",
    "project_id": "proj_123",
    "model": "gpt-4",
    "status": "active",
    "created_at": "2024-01-15T12:00:00Z"
  }
}
```

### Send Message

Send a message to the AI.

```http
POST /sessions/{session_id}/messages
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "Open Chrome and search for Python tutorials",
  "stream": true
}
```

**Response (Streaming):**
```
data: {"type":"token","content":"I'll"}
data: {"type":"token","content":" help"}
data: {"type":"token","content":" you"}
data: {"type":"action","action":"screenshot","status":"started"}
data: {"type":"action","action":"screenshot","status":"completed"}
data: {"type":"done"}
```

### Get Session History

Get all messages in a session.

```http
GET /sessions/{session_id}/messages
Authorization: Bearer {token}
```

**Response:**
```json
{
  "messages": [
    {
      "id": "msg_789",
      "role": "user",
      "content": "Open Chrome",
      "timestamp": "2024-01-15T12:00:00Z"
    },
    {
      "id": "msg_790",
      "role": "assistant",
      "content": "I'll open Chrome for you.",
      "timestamp": "2024-01-15T12:00:05Z"
    }
  ]
}
```

---

## AI Models API

### List Available Models

Get all available AI models.

```http
GET /models
Authorization: Bearer {token}
```

**Response:**
```json
{
  "models": [
    {
      "id": "gpt-4",
      "name": "GPT-4",
      "provider": "openai",
      "context_length": 8192,
      "capabilities": ["text", "vision"]
    },
    {
      "id": "claude-3-opus",
      "name": "Claude 3 Opus",
      "provider": "anthropic",
      "context_length": 200000,
      "capabilities": ["text", "vision"]
    }
  ]
}
```

### Get Model Details

Get details for a specific model.

```http
GET /models/{model_id}
Authorization: Bearer {token}
```

---

## Collaboration API

### List Collaborators

Get all collaborators for a project.

```http
GET /projects/{project_id}/collaborators
Authorization: Bearer {token}
```

**Response:**
```json
{
  "collaborators": [
    {
      "user_id": "user_123",
      "email": "user@example.com",
      "role": "editor",
      "added_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### Add Collaborator

Invite a user to collaborate on a project.

```http
POST /projects/{project_id}/collaborators
Authorization: Bearer {token}
Content-Type: application/json

{
  "email": "collaborator@example.com",
  "role": "editor"
}
```

**Roles:**
- `viewer`: Read-only access
- `editor`: Can make changes
- `admin`: Full control

### Remove Collaborator

Remove a collaborator from a project.

```http
DELETE /projects/{project_id}/collaborators/{user_id}
Authorization: Bearer {token}
```

---

## WebSocket API

### Connect to WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3002');

ws.onopen = () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your_jwt_token'
  }));
  
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

### WebSocket Events

#### Session Updates

```json
{
  "type": "session_update",
  "session_id": "sess_456",
  "status": "active"
}
```

#### New Message

```json
{
  "type": "message",
  "session_id": "sess_456",
  "message": {
    "id": "msg_789",
    "role": "assistant",
    "content": "Task completed"
  }
}
```

#### Collaboration Events

```json
{
  "type": "collaboration_added",
  "project_id": "proj_123",
  "user": {
    "id": "user_456",
    "email": "user@example.com"
  }
}
```

#### Project Status

```json
{
  "type": "project_status",
  "project_id": "proj_123",
  "status": "running"
}
```

---

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Project not found",
    "details": {
      "project_id": "proj_invalid"
    }
  }
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_REQUEST` | Request validation failed |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `RATE_LIMIT` | Too many requests |
| `SERVER_ERROR` | Internal server error |

---

## Rate Limiting

API requests are rate-limited to prevent abuse:

- **Authenticated**: 1000 requests/hour
- **Unauthenticated**: 100 requests/hour

Rate limit headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642262400
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { PantheonClient } from '@pantheon/sdk';

const client = new PantheonClient({
  apiKey: 'your_api_key',
  baseUrl: 'http://localhost:3002'
});

// Create project
const project = await client.projects.create({
  name: 'My Project',
  os_type: 'windows'
});

// Start session
const session = await client.sessions.create(project.id, {
  model: 'gpt-4'
});

// Send message
const response = await client.sessions.sendMessage(session.id, {
  content: 'Open Chrome'
});
```

### Python

```python
from pantheon import PantheonClient

client = PantheonClient(
    api_key='your_api_key',
    base_url='http://localhost:3002'
)

# Create project
project = client.projects.create(
    name='My Project',
    os_type='windows'
)

# Start session
session = client.sessions.create(
    project_id=project.id,
    model='gpt-4'
)

# Send message
response = client.sessions.send_message(
    session_id=session.id,
    content='Open Chrome'
)
```

---

## Webhooks

Configure webhooks to receive real-time notifications.

### Setup Webhook

```http
POST /webhooks
Authorization: Bearer {token}
Content-Type: application/json

{
  "url": "https://your-app.com/webhook",
  "events": ["session.completed", "project.status_changed"],
  "secret": "your_webhook_secret"
}
```

### Webhook Payload

```json
{
  "event": "session.completed",
  "timestamp": "2024-01-15T12:00:00Z",
  "data": {
    "session_id": "sess_456",
    "project_id": "proj_123",
    "status": "completed"
  }
}
```

### Verify Webhook Signature

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return signature === digest;
}
```

---

## Best Practices

1. **Use HTTPS** in production
2. **Store tokens securely** - never in client-side code
3. **Implement retry logic** for failed requests
4. **Handle rate limits** gracefully
5. **Validate webhook signatures**
6. **Use WebSockets** for real-time updates
7. **Cache responses** when appropriate
8. **Monitor API usage** and costs

---

## Support

- **Documentation**: https://github.com/akilhassane/pantheon
- **Issues**: https://github.com/akilhassane/pantheon/issues
- **API Status**: https://status.pantheon.ai (coming soon)

---

**Last Updated**: February 20, 2026  
**API Version**: 1.0.0
