# API Documentation

Complete REST and WebSocket API reference for Pantheon.

## Table of Contents

- [Authentication](#authentication)
- [Base URL](#base-url)
- [REST API](#rest-api)
  - [Projects](#projects)
  - [AI Chat](#ai-chat)
  - [User Settings](#user-settings)
  - [Collaboration](#collaboration)
- [WebSocket API](#websocket-api)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

## Authentication

All API requests require authentication using Bearer tokens from Keycloak.

### Obtaining Access Token

1. Authenticate via Keycloak OAuth flow
2. Receive JWT access token
3. Include in Authorization header

```bash
Authorization: Bearer <access_token>
```

### Token Refresh

Tokens expire after 5 minutes. Use refresh token to obtain new access token:

```bash
POST http://localhost:8080/realms/master/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&
client_id=pantheon-frontend&
refresh_token=<refresh_token>
```

For authentication setup, see [Keycloak Setup Guide](KEYCLOAK_SETUP.md).

## Base URL

Development: `http://localhost:3002`
Production: `https://your-domain.com`

## REST API

### Projects

#### List Projects

Get all projects for authenticated user.

```bash
GET /api/projects
Authorization: Bearer <token>

Response:
{
  "projects": [
    {
      "id": "proj_123",
      "name": "My Project",
      "status": "running",
      "created_at": "2026-02-23T10:00:00Z",
      "vm_ip": "172.30.1.2",
      "shared_folder_url": "http://172.30.1.1:8888"
    }
  ]
}
```

#### Create Project

Create new Windows VM project.

```bash
POST /api/projects
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My New Project",
  "description": "Project description",
  "os": "windows11"
}

Response:
{
  "project_id": "proj_124",
  "status": "provisioning",
  "estimated_time": "2-3 minutes"
}
```

#### Get Project Details

```bash
GET /api/projects/:projectId
Authorization: Bearer <token>

Response:
{
  "id": "proj_123",
  "name": "My Project",
  "status": "running",
  "vm_ip": "172.30.1.2",
  "shared_folder_url": "http://172.30.1.1:8888",
  "network": "project-123-network",
  "created_at": "2026-02-23T10:00:00Z",
  "collaborators": [
    {
      "user_id": "user_456",
      "email": "user@example.com",
      "role": "editor"
    }
  ]
}
```

#### Delete Project

```bash
DELETE /api/projects/:projectId
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Project deleted successfully"
}
```

### AI Chat

#### Send Message

Send message to AI model.

```bash
POST /api/chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "project_id": "proj_123",
  "message": "Hello, can you help me?",
  "model": "openai/gpt-4",
  "parameters": {
    "temperature": 0.7,
    "max_tokens": 2000
  }
}

Response:
{
  "message_id": "msg_789",
  "response": "Hello! I'd be happy to help you...",
  "model": "openai/gpt-4",
  "tokens_used": 150,
  "cost": 0.0045
}
```

#### Get Chat History

```bash
GET /api/chat/:projectId/history
Authorization: Bearer <token>

Response:
{
  "messages": [
    {
      "id": "msg_789",
      "role": "user",
      "content": "Hello, can you help me?",
      "timestamp": "2026-02-23T10:05:00Z"
    },
    {
      "id": "msg_790",
      "role": "assistant",
      "content": "Hello! I'd be happy to help you...",
      "timestamp": "2026-02-23T10:05:02Z",
      "model": "openai/gpt-4",
      "tokens": 150
    }
  ]
}
```

### User Settings

#### Get User Settings

```bash
GET /api/user/settings
Authorization: Bearer <token>

Response:
{
  "user_id": "user_456",
  "preferred_model": "openai/gpt-4",
  "model_parameters": {
    "temperature": 0.7,
    "max_tokens": 2000
  },
  "custom_models": []
}
```

#### Update User Settings

```bash
PUT /api/user/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "preferred_model": "anthropic/claude-3-opus",
  "model_parameters": {
    "temperature": 0.5,
    "max_tokens": 4000
  }
}

Response:
{
  "success": true,
  "settings": {
    "preferred_model": "anthropic/claude-3-opus",
    "model_parameters": {
      "temperature": 0.5,
      "max_tokens": 4000
    }
  }
}
```

#### Get Usage Statistics

```bash
GET /api/user/usage
Authorization: Bearer <token>

Response:
{
  "total_tokens": 1500000,
  "total_cost": 45.50,
  "by_model": {
    "gpt-4": {
      "tokens": 500000,
      "cost": 30.00,
      "requests": 250
    },
    "gpt-3.5-turbo": {
      "tokens": 1000000,
      "cost": 15.50,
      "requests": 1000
    }
  },
  "period": "last_30_days"
}
```

### Collaboration

#### Invite Collaborator

```bash
POST /api/projects/:projectId/collaborators
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "collaborator@example.com",
  "role": "editor"
}

Response:
{
  "success": true,
  "invitation_id": "inv_999",
  "status": "sent"
}
```

#### List Collaborators

```bash
GET /api/projects/:projectId/collaborators
Authorization: Bearer <token>

Response:
{
  "collaborators": [
    {
      "user_id": "user_456",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "owner",
      "joined_at": "2026-02-23T10:00:00Z"
    },
    {
      "user_id": "user_789",
      "email": "collaborator@example.com",
      "name": "Jane Smith",
      "role": "editor",
      "joined_at": "2026-02-23T11:00:00Z"
    }
  ]
}
```

#### Remove Collaborator

```bash
DELETE /api/projects/:projectId/collaborators/:userId
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Collaborator removed"
}
```

## WebSocket API

### Connection

Connect to WebSocket for real-time updates.

```javascript
const ws = new WebSocket('ws://localhost:3002/ws');

// Authenticate
ws.send(JSON.stringify({
  type: 'auth',
  token: '<access_token>'
}));

// Join project room
ws.send(JSON.stringify({
  type: 'join',
  project_id: 'proj_123'
}));
```

### Events

#### Chat Message

Receive real-time chat messages.

```javascript
{
  "type": "chat_message",
  "project_id": "proj_123",
  "message": {
    "id": "msg_790",
    "role": "assistant",
    "content": "Response from AI...",
    "timestamp": "2026-02-23T10:05:02Z"
  }
}
```

#### Project Status

Receive project status updates.

```javascript
{
  "type": "project_status",
  "project_id": "proj_123",
  "status": "running",
  "vm_ip": "172.30.1.2"
}
```

#### Collaborator Activity

Receive collaborator activity notifications.

```javascript
{
  "type": "collaborator_activity",
  "project_id": "proj_123",
  "user": {
    "id": "user_789",
    "name": "Jane Smith"
  },
  "activity": "joined_chat"
}
```

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Project not found",
    "details": {
      "project_id": "proj_999"
    }
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Invalid or expired token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| INVALID_REQUEST | 400 | Invalid request parameters |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |
| SERVICE_UNAVAILABLE | 503 | Service temporarily unavailable |

## Rate Limiting

### Limits

- API requests: 100 per minute per user
- Chat messages: 20 per minute per project
- Project creation: 5 per hour per user

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1708689600
```

### Handling Rate Limits

When rate limited (429 response):
1. Check `X-RateLimit-Reset` header
2. Wait until reset time
3. Retry request

## Best Practices

### Authentication

- Store tokens securely
- Refresh tokens before expiry
- Handle 401 errors gracefully
- Don't share tokens

### Error Handling

- Always check response status
- Parse error messages
- Implement retry logic
- Log errors for debugging

### Performance

- Use WebSocket for real-time updates
- Cache responses when appropriate
- Batch requests when possible
- Implement request queuing

### Security

- Use HTTPS in production
- Validate all inputs
- Sanitize user data
- Implement CSRF protection

## Examples

### Complete Chat Flow

```javascript
// 1. Authenticate
const token = await authenticateWithKeycloak();

// 2. Create project
const project = await fetch('http://localhost:3002/api/projects', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'My Project',
    os: 'windows11'
  })
});

const { project_id } = await project.json();

// 3. Wait for provisioning
await waitForProjectReady(project_id);

// 4. Send chat message
const response = await fetch('http://localhost:3002/api/chat', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    project_id: project_id,
    message: 'Hello AI!',
    model: 'openai/gpt-4'
  })
});

const { response: aiResponse } = await response.json();
console.log(aiResponse);
```

## Next Steps

- [Usage Guide](USAGE.md)
- [Model Configuration](MODEL_CONFIGURATION.md)
- [Troubleshooting](TROUBLESHOOTING.md)

## Support

- [GitHub Issues](https://github.com/akilhassane/pantheon/issues)
- [API Discussions](https://github.com/akilhassane/pantheon/discussions)

[Back to README](../README.md)
