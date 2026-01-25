# Integration Guide

Learn how to integrate Pantheon with your applications.

## Table of Contents

- [Overview](#overview)
- [REST API Integration](#rest-api-integration)
- [WebSocket Integration](#websocket-integration)
- [Webhooks](#webhooks)
- [SDKs](#sdks)
- [Examples](#examples)

## Overview

Pantheon provides multiple integration methods:
- **REST API**: For standard CRUD operations
- **WebSocket**: For real-time updates
- **Webhooks**: For event notifications (coming soon)
- **SDKs**: Official client libraries (coming soon)

## REST API Integration

### Base URL

```
http://localhost:3002/api
```

### Authentication

Include session token in headers:
```http
Authorization: Bearer <session_token>
```

### Example: Create and Use a Project

```javascript
const axios = require('axios');

const API_BASE = 'http://localhost:3002/api';

async function automateTask() {
  // 1. Create a project
  const project = await axios.post(`${API_BASE}/projects`, {
    name: 'Automation Project',
    os_type: 'windows'
  });
  
  const projectId = project.data.project.id;
  
  // 2. Create a session
  const session = await axios.post(`${API_BASE}/sessions`, {
    project_id: projectId,
    model: 'gpt-4'
  });
  
  const sessionId = session.data.session.id;
  
  // 3. Send commands
  const response = await axios.post(`${API_BASE}/agent/message`, {
    session_id: sessionId,
    message: 'Open Notepad and write Hello World',
    stream: false
  });
  
  console.log('AI Response:', response.data.response);
  
  // 4. Get screenshot
  const screenshot = await axios.post(`${API_BASE}/agent/action`, {
    project_id: projectId,
    action: 'screenshot'
  });
  
  console.log('Screenshot URL:', screenshot.data.result.image_url);
}
```

## WebSocket Integration

### Connect to WebSocket

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3002');

ws.on('open', () => {
  console.log('Connected to Pantheon');
  
  // Subscribe to project updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    project_id: 'proj_123'
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  
  switch(message.type) {
    case 'chat_message':
      console.log('New message:', message.content);
      break;
    case 'action_update':
      console.log('Action completed:', message.action);
      break;
    case 'user_joined':
      console.log('User joined:', message.username);
      break;
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

### Send Messages via WebSocket

```javascript
// Send a chat message
ws.send(JSON.stringify({
  type: 'chat_message',
  session_id: 'sess_456',
  message: 'Open Calculator'
}));

// Request screenshot
ws.send(JSON.stringify({
  type: 'action',
  project_id: 'proj_123',
  action: 'screenshot'
}));
```

## Webhooks

*Coming soon*

Pantheon will support webhooks for event notifications:
- Project created/deleted
- Session started/ended
- Action completed
- Error occurred

## SDKs

### JavaScript/TypeScript SDK (Coming Soon)

```javascript
import { PantheonClient } from '@pantheon/sdk';

const client = new PantheonClient({
  apiUrl: 'http://localhost:3002',
  apiKey: 'your-api-key'
});

// Create project
const project = await client.projects.create({
  name: 'My Project',
  osType: 'windows'
});

// Send message
const response = await client.agent.sendMessage({
  projectId: project.id,
  message: 'Open Notepad'
});
```

### Python SDK (Coming Soon)

```python
from pantheon import PantheonClient

client = PantheonClient(
    api_url='http://localhost:3002',
    api_key='your-api-key'
)

# Create project
project = client.projects.create(
    name='My Project',
    os_type='windows'
)

# Send message
response = client.agent.send_message(
    project_id=project.id,
    message='Open Notepad'
)
```

## Examples

### Example 1: Automated Testing

```javascript
const axios = require('axios');

async function runAutomatedTest() {
  const API_BASE = 'http://localhost:3002/api';
  
  // Create test project
  const project = await axios.post(`${API_BASE}/projects`, {
    name: 'Test Project',
    os_type: 'windows'
  });
  
  const projectId = project.data.project.id;
  
  // Create session
  const session = await axios.post(`${API_BASE}/sessions`, {
    project_id: projectId,
    model: 'gpt-4'
  });
  
  const sessionId = session.data.session.id;
  
  // Test steps
  const testSteps = [
    'Open Calculator',
    'Click on 5',
    'Click on +',
    'Click on 3',
    'Click on =',
    'Take a screenshot'
  ];
  
  for (const step of testSteps) {
    const response = await axios.post(`${API_BASE}/agent/message`, {
      session_id: sessionId,
      message: step,
      stream: false
    });
    
    console.log(`Step: ${step}`);
    console.log(`Result: ${response.data.response}`);
    
    // Wait between steps
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Cleanup
  await axios.delete(`${API_BASE}/projects/${projectId}`);
}
```

### Example 2: Batch Automation

```javascript
async function batchAutomation(tasks) {
  const API_BASE = 'http://localhost:3002/api';
  
  // Create project
  const project = await axios.post(`${API_BASE}/projects`, {
    name: 'Batch Automation',
    os_type: 'windows'
  });
  
  const projectId = project.data.project.id;
  
  // Create session
  const session = await axios.post(`${API_BASE}/sessions`, {
    project_id: projectId,
    model: 'gpt-4'
  });
  
  const sessionId = session.data.session.id;
  
  // Execute tasks
  const results = [];
  
  for (const task of tasks) {
    try {
      const response = await axios.post(`${API_BASE}/agent/message`, {
        session_id: sessionId,
        message: task,
        stream: false
      });
      
      results.push({
        task,
        success: true,
        response: response.data.response
      });
    } catch (error) {
      results.push({
        task,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

// Usage
const tasks = [
  'Create a folder called Reports',
  'Open Notepad and write a report',
  'Save the file as report.txt',
  'Take a screenshot'
];

batchAutomation(tasks).then(results => {
  console.log('Batch automation results:', results);
});
```

### Example 3: Real-time Monitoring

```javascript
const WebSocket = require('ws');

function monitorProject(projectId) {
  const ws = new WebSocket('ws://localhost:3002');
  
  ws.on('open', () => {
    // Subscribe to project
    ws.send(JSON.stringify({
      type: 'subscribe',
      project_id: projectId
    }));
    
    console.log(`Monitoring project: ${projectId}`);
  });
  
  ws.on('message', (data) => {
    const message = JSON.parse(data);
    
    // Log all events
    console.log(`[${new Date().toISOString()}] ${message.type}:`, message);
    
    // Handle specific events
    if (message.type === 'action_update' && message.status === 'error') {
      console.error('Action failed:', message.error);
      // Send alert, log to monitoring system, etc.
    }
  });
  
  return ws;
}

// Usage
const monitor = monitorProject('proj_123');

// Stop monitoring after 1 hour
setTimeout(() => {
  monitor.close();
}, 3600000);
```

### Example 4: CI/CD Integration

```javascript
// GitHub Actions workflow example
async function cicdIntegration() {
  const API_BASE = 'http://localhost:3002/api';
  
  // Create temporary project
  const project = await axios.post(`${API_BASE}/projects`, {
    name: `CI-${process.env.GITHUB_RUN_ID}`,
    os_type: 'windows'
  });
  
  const projectId = project.data.project.id;
  
  try {
    // Run deployment steps
    const session = await axios.post(`${API_BASE}/sessions`, {
      project_id: projectId,
      model: 'gpt-4'
    });
    
    const sessionId = session.data.session.id;
    
    // Deploy application
    await axios.post(`${API_BASE}/agent/message`, {
      session_id: sessionId,
      message: 'Deploy the application to production',
      stream: false
    });
    
    // Run smoke tests
    await axios.post(`${API_BASE}/agent/message`, {
      session_id: sessionId,
      message: 'Run smoke tests',
      stream: false
    });
    
    console.log('Deployment successful');
    process.exit(0);
    
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
    
  } finally {
    // Cleanup
    await axios.delete(`${API_BASE}/projects/${projectId}`);
  }
}
```

## Best Practices

### Error Handling

```javascript
async function robustApiCall() {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      const response = await axios.post(`${API_BASE}/agent/message`, {
        session_id: sessionId,
        message: 'Open Notepad',
        stream: false
      });
      
      return response.data;
      
    } catch (error) {
      attempt++;
      
      if (attempt >= maxRetries) {
        throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
}
```

### Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100 // 100 requests per minute
});

app.use('/api/', limiter);
```

### Logging

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'pantheon-integration.log' })
  ]
});

// Log all API calls
logger.info('API call', {
  endpoint: '/api/agent/message',
  projectId: 'proj_123',
  timestamp: new Date().toISOString()
});
```

## Next Steps

- [API Reference](./API_REFERENCE.md) - Complete API documentation
- [Architecture](./ARCHITECTURE.md) - Understand the system
- [User Guide](./USER_GUIDE.md) - Learn the web interface

---

[← Back to README](../README.md)
