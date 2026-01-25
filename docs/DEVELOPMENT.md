# Development Guide

Set up your development environment for Pantheon.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Development Workflow](#development-workflow)
- [Code Structure](#code-structure)
- [Testing](#testing)
- [Contributing](#contributing)

## Prerequisites

### Required Software

- **Node.js** 18+ and npm
- **Docker** 20.10+ and Docker Compose 2.0+
- **Git**
- **Code Editor** (VS Code recommended)

### Recommended Tools

- **VS Code Extensions**:
  - ESLint
  - Prettier
  - TypeScript
  - Docker
  - GitLens

## Setup

### 1. Clone Repository

```bash
git clone https://github.com/akilhassane/pantheon.git
cd pantheon
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..

# Install backend dependencies
cd backend
npm install
cd ..
```

### 3. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

Required environment variables:
```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Providers (at least one)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Development
NODE_ENV=development
FRONTEND_PORT=3000
BACKEND_PORT=3002
```

### 4. Start Development Servers

#### Option A: Using Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

#### Option B: Local Development

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 5. Verify Setup

- Frontend: http://localhost:3000
- Backend API: http://localhost:3002
- Backend Health: http://localhost:3002/health

## Development Workflow

### Branch Strategy

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes
git add .
git commit -m "feat: add new feature"

# Push to GitHub
git push origin feature/your-feature-name

# Create Pull Request on GitHub
```

### Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new feature
fix: resolve bug
docs: update documentation
style: format code
refactor: restructure code
test: add tests
chore: update dependencies
```

### Code Style

We use ESLint and Prettier for code formatting:

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Hot Reload

Both frontend and backend support hot reload:
- Frontend: Changes auto-refresh in browser
- Backend: Nodemon restarts server on changes

## Code Structure

### Frontend Structure

```
frontend/
├── components/          # React components
│   ├── chat/           # Chat interface
│   ├── sidebar/        # Sidebar components
│   ├── modals/         # Modal dialogs
│   └── ui/             # Reusable UI components
├── pages/              # Next.js pages
│   ├── index.tsx       # Home page
│   └── api/            # API routes
├── lib/                # Utility functions
│   ├── api.ts          # API client
│   └── websocket.ts    # WebSocket client
├── hooks/              # Custom React hooks
├── styles/             # CSS/Tailwind styles
└── public/             # Static assets
```

### Backend Structure

```
backend/
├── server.js                    # Main entry point
├── routes/                      # API routes
│   ├── project-routes.js
│   ├── session-routes.js
│   └── agent-routes.js
├── managers/                    # Business logic
│   ├── project-manager.js
│   ├── session-manager.js
│   └── collaboration-manager.js
├── services/                    # External services
│   ├── provider-apis.js
│   └── windows-api-client.js
├── middleware/                  # Express middleware
│   ├── auth.js
│   └── error-handler.js
├── database/                    # Database schemas
│   └── schema.sql
└── utils/                       # Utility functions
```

## Testing

### Run Tests

```bash
# Run all tests
npm test

# Run frontend tests
cd frontend
npm test

# Run backend tests
cd backend
npm test

# Run with coverage
npm run test:coverage
```

### Writing Tests

#### Frontend Tests (Jest + React Testing Library)

```javascript
// components/__tests__/ChatInput.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import ChatInput from '../ChatInput';

describe('ChatInput', () => {
  it('should send message on submit', () => {
    const onSend = jest.fn();
    render(<ChatInput onSend={onSend} />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.submit(input.closest('form'));
    
    expect(onSend).toHaveBeenCalledWith('Hello');
  });
});
```

#### Backend Tests (Jest)

```javascript
// __tests__/project-manager.test.js
const ProjectManager = require('../project-manager');

describe('ProjectManager', () => {
  it('should create a project', async () => {
    const project = await ProjectManager.createProject({
      name: 'Test Project',
      os_type: 'windows'
    });
    
    expect(project).toHaveProperty('id');
    expect(project.name).toBe('Test Project');
  });
});
```

### Integration Tests

```bash
# Run integration tests
npm run test:integration

# Test specific endpoint
npm run test:integration -- --grep "POST /api/projects"
```

## Debugging

### VS Code Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "program": "${workspaceFolder}/backend/server.js",
      "env": {
        "NODE_ENV": "development"
      }
    },
    {
      "type": "chrome",
      "request": "launch",
      "name": "Debug Frontend",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/frontend"
    }
  ]
}
```

### Debug Logs

```javascript
// Enable debug logging
const debug = require('debug')('pantheon:backend');

debug('Processing request:', req.body);
```

### Docker Debugging

```bash
# View container logs
docker logs <container_id>

# Execute commands in container
docker exec -it <container_id> bash

# Inspect container
docker inspect <container_id>
```

## Database Development

### Supabase Local Development

```bash
# Install Supabase CLI
npm install -g supabase

# Initialize Supabase
supabase init

# Start local Supabase
supabase start

# Run migrations
supabase db push
```

### Database Migrations

```sql
-- migrations/001_initial_schema.sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  os_type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## API Development

### Adding New Endpoints

1. Create route file:
```javascript
// routes/new-feature-routes.js
const express = require('express');
const router = express.Router();

router.get('/new-feature', async (req, res) => {
  // Implementation
  res.json({ success: true });
});

module.exports = router;
```

2. Register route in server.js:
```javascript
const newFeatureRoutes = require('./routes/new-feature-routes');
app.use('/api/new-feature', newFeatureRoutes);
```

### Testing API Endpoints

```bash
# Using curl
curl -X POST http://localhost:3002/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","os_type":"windows"}'

# Using httpie
http POST localhost:3002/api/projects name="Test" os_type="windows"
```

## Contributing

### Pull Request Process

1. Fork the repository
2. Create feature branch
3. Make changes
4. Write tests
5. Update documentation
6. Submit pull request

### Code Review Checklist

- [ ] Code follows style guidelines
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] Error handling implemented
- [ ] Performance considered

### Contribution Guidelines

- Write clear commit messages
- Add tests for new features
- Update documentation
- Follow existing code style
- Keep PRs focused and small

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [Docker Documentation](https://docs.docker.com/)
- [Supabase Documentation](https://supabase.com/docs)

## Getting Help

- [GitHub Issues](https://github.com/akilhassane/pantheon/issues)
- [Discussions](https://github.com/akilhassane/pantheon/discussions)

---

[← Back to README](../README.md)
