# Testing Guide

Comprehensive testing guide for Pantheon AI Platform.

## Table of Contents

- [Testing Strategy](#testing-strategy)
- [Unit Tests](#unit-tests)
- [Integration Tests](#integration-tests)
- [End-to-End Tests](#end-to-end-tests)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)

## Testing Strategy

Pantheon uses a multi-layered testing approach:

1. **Unit Tests**: Test individual functions and components
2. **Integration Tests**: Test API endpoints and services
3. **End-to-End Tests**: Test complete user workflows
4. **Manual Tests**: Test UI/UX and edge cases

### Test Coverage Goals

- **Backend**: 80%+ coverage
- **Frontend**: 70%+ coverage
- **Critical Paths**: 100% coverage

## Unit Tests

### Frontend Unit Tests

We use **Jest** and **React Testing Library** for frontend testing.

#### Component Tests

```typescript
// components/__tests__/ChatMessage.test.tsx
import { render, screen } from '@testing-library/react';
import ChatMessage from '../ChatMessage';

describe('ChatMessage', () => {
  it('renders user message correctly', () => {
    render(
      <ChatMessage 
        role="user" 
        content="Hello, AI!" 
      />
    );
    
    expect(screen.getByText('Hello, AI!')).toBeInTheDocument();
    expect(screen.getByTestId('user-message')).toHaveClass('user-message');
  });
  
  it('renders assistant message correctly', () => {
    render(
      <ChatMessage 
        role="assistant" 
        content="Hello! How can I help?" 
      />
    );
    
    expect(screen.getByText('Hello! How can I help?')).toBeInTheDocument();
    expect(screen.getByTestId('assistant-message')).toHaveClass('assistant-message');
  });
});
```

#### Hook Tests

```typescript
// hooks/__tests__/useWebSocket.test.ts
import { renderHook, act } from '@testing-library/react-hooks';
import useWebSocket from '../useWebSocket';

describe('useWebSocket', () => {
  it('connects to WebSocket', () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:3002'));
    
    expect(result.current.connected).toBe(false);
    
    act(() => {
      result.current.connect();
    });
    
    expect(result.current.connected).toBe(true);
  });
});
```

### Backend Unit Tests

We use **Jest** for backend testing.

#### Service Tests

```javascript
// __tests__/project-manager.test.js
const ProjectManager = require('../project-manager');
const { supabase } = require('../database/client');

jest.mock('../database/client');

describe('ProjectManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('createProject', () => {
    it('should create a project successfully', async () => {
      const mockProject = {
        id: 'proj_123',
        name: 'Test Project',
        os_type: 'windows'
      };
      
      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: [mockProject],
            error: null
          })
        })
      });
      
      const result = await ProjectManager.createProject({
        name: 'Test Project',
        os_type: 'windows'
      });
      
      expect(result).toEqual(mockProject);
    });
    
    it('should throw error on invalid input', async () => {
      await expect(
        ProjectManager.createProject({ name: '' })
      ).rejects.toThrow('Project name is required');
    });
  });
});
```

#### Utility Tests

```javascript
// utils/__tests__/validation.test.js
const { validateProjectName, validateApiKey } = require('../validation');

describe('Validation Utils', () => {
  describe('validateProjectName', () => {
    it('should accept valid names', () => {
      expect(validateProjectName('My Project')).toBe(true);
      expect(validateProjectName('Project-123')).toBe(true);
    });
    
    it('should reject invalid names', () => {
      expect(validateProjectName('')).toBe(false);
      expect(validateProjectName('a'.repeat(101))).toBe(false);
      expect(validateProjectName('Project<>')).toBe(false);
    });
  });
  
  describe('validateApiKey', () => {
    it('should validate OpenAI keys', () => {
      expect(validateApiKey('sk-1234567890', 'openai')).toBe(true);
      expect(validateApiKey('invalid', 'openai')).toBe(false);
    });
    
    it('should validate Anthropic keys', () => {
      expect(validateApiKey('sk-ant-1234567890', 'anthropic')).toBe(true);
      expect(validateApiKey('sk-1234567890', 'anthropic')).toBe(false);
    });
  });
});
```

## Integration Tests

### API Integration Tests

```javascript
// __tests__/integration/projects.test.js
const request = require('supertest');
const app = require('../../server');

describe('Projects API', () => {
  let projectId;
  
  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({
          name: 'Integration Test Project',
          os_type: 'windows'
        })
        .expect(201);
      
      expect(response.body).toHaveProperty('project');
      expect(response.body.project).toHaveProperty('id');
      expect(response.body.project.name).toBe('Integration Test Project');
      
      projectId = response.body.project.id;
    });
    
    it('should reject invalid project data', async () => {
      await request(app)
        .post('/api/projects')
        .send({ name: '' })
        .expect(400);
    });
  });
  
  describe('GET /api/projects/:id', () => {
    it('should get project by id', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}`)
        .expect(200);
      
      expect(response.body.project.id).toBe(projectId);
    });
    
    it('should return 404 for non-existent project', async () => {
      await request(app)
        .get('/api/projects/non-existent-id')
        .expect(404);
    });
  });
  
  describe('DELETE /api/projects/:id', () => {
    it('should delete project', async () => {
      await request(app)
        .delete(`/api/projects/${projectId}`)
        .expect(200);
      
      // Verify deletion
      await request(app)
        .get(`/api/projects/${projectId}`)
        .expect(404);
    });
  });
});
```

### WebSocket Integration Tests

```javascript
// __tests__/integration/websocket.test.js
const WebSocket = require('ws');

describe('WebSocket Integration', () => {
  let ws;
  
  beforeEach((done) => {
    ws = new WebSocket('ws://localhost:3002');
    ws.on('open', done);
  });
  
  afterEach(() => {
    ws.close();
  });
  
  it('should connect successfully', () => {
    expect(ws.readyState).toBe(WebSocket.OPEN);
  });
  
  it('should receive messages', (done) => {
    ws.on('message', (data) => {
      const message = JSON.parse(data);
      expect(message).toHaveProperty('type');
      done();
    });
    
    ws.send(JSON.stringify({
      type: 'subscribe',
      project_id: 'test-project'
    }));
  });
});
```

## End-to-End Tests

We use **Playwright** for E2E testing.

### Setup Playwright

```bash
npm install -D @playwright/test
npx playwright install
```

### E2E Test Examples

```typescript
// e2e/project-creation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Project Creation', () => {
  test('should create a new project', async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:3000');
    
    // Click new project button
    await page.click('[data-testid="new-project-button"]');
    
    // Fill project form
    await page.fill('[data-testid="project-name-input"]', 'E2E Test Project');
    await page.selectOption('[data-testid="os-type-select"]', 'windows');
    
    // Submit form
    await page.click('[data-testid="create-project-submit"]');
    
    // Verify project appears in sidebar
    await expect(page.locator('[data-testid="project-list"]'))
      .toContainText('E2E Test Project');
  });
});
```

```typescript
// e2e/chat-interaction.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Chat Interaction', () => {
  test('should send message and receive response', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Select project
    await page.click('[data-testid="project-item"]:first-child');
    
    // Type message
    await page.fill('[data-testid="chat-input"]', 'Hello, AI!');
    
    // Send message
    await page.press('[data-testid="chat-input"]', 'Enter');
    
    // Wait for response
    await page.waitForSelector('[data-testid="assistant-message"]');
    
    // Verify message appears
    await expect(page.locator('[data-testid="user-message"]'))
      .toContainText('Hello, AI!');
    
    // Verify response appears
    await expect(page.locator('[data-testid="assistant-message"]'))
      .toBeVisible();
  });
});
```

## Running Tests

### Run All Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Run Specific Tests

```bash
# Run frontend tests only
cd frontend
npm test

# Run backend tests only
cd backend
npm test

# Run specific test file
npm test -- project-manager.test.js

# Run tests matching pattern
npm test -- --grep "ProjectManager"
```

### Run E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific E2E test
npm run test:e2e -- project-creation.spec.ts

# Run in headed mode (see browser)
npm run test:e2e -- --headed

# Run in debug mode
npm run test:e2e -- --debug
```

### Continuous Integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm test
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Writing Tests

### Best Practices

1. **Test Behavior, Not Implementation**
```javascript
// ❌ Bad - tests implementation
it('should call setState', () => {
  const component = shallow(<MyComponent />);
  component.instance().setState = jest.fn();
  component.instance().handleClick();
  expect(component.instance().setState).toHaveBeenCalled();
});

// ✅ Good - tests behavior
it('should update counter on click', () => {
  render(<MyComponent />);
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```

2. **Use Descriptive Test Names**
```javascript
// ❌ Bad
it('works', () => { ... });

// ✅ Good
it('should create project with valid name and os_type', () => { ... });
```

3. **Arrange-Act-Assert Pattern**
```javascript
it('should calculate total price', () => {
  // Arrange
  const items = [
    { price: 10, quantity: 2 },
    { price: 5, quantity: 3 }
  ];
  
  // Act
  const total = calculateTotal(items);
  
  // Assert
  expect(total).toBe(35);
});
```

4. **Mock External Dependencies**
```javascript
jest.mock('../api-client');

it('should fetch projects', async () => {
  const mockProjects = [{ id: '1', name: 'Test' }];
  apiClient.getProjects.mockResolvedValue(mockProjects);
  
  const result = await fetchProjects();
  
  expect(result).toEqual(mockProjects);
});
```

5. **Test Edge Cases**
```javascript
describe('validateEmail', () => {
  it('should accept valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });
  
  it('should reject invalid emails', () => {
    expect(validateEmail('')).toBe(false);
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail('@example.com')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
  });
});
```

### Test Coverage

```bash
# Generate coverage report
npm run test:coverage

# View coverage report
open coverage/lcov-report/index.html
```

### Debugging Tests

```bash
# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Use VS Code debugger
# Add breakpoint in test file
# Press F5 to start debugging
```

## Performance Testing

### Load Testing

```javascript
// load-test.js
const autocannon = require('autocannon');

autocannon({
  url: 'http://localhost:3002/api/projects',
  connections: 100,
  duration: 30,
  method: 'GET'
}, (err, result) => {
  console.log('Requests/sec:', result.requests.average);
  console.log('Latency:', result.latency);
});
```

## Next Steps

- [Development Guide](./DEVELOPMENT.md) - Set up development environment
- [Contributing](../README.md#-contributing) - Contribution guidelines
- [API Reference](./API_REFERENCE.md) - API documentation

---

[← Back to README](../README.md)
