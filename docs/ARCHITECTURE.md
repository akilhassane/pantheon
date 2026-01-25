# Architecture

System architecture and design of Pantheon AI Platform.

## Table of Contents

- [Overview](#overview)
- [System Components](#system-components)
- [Data Flow](#data-flow)
- [Technology Stack](#technology-stack)
- [Security](#security)
- [Scalability](#scalability)

## Overview

Pantheon is a multi-layered system that enables AI models to interact with operating systems through a web-based interface. The architecture is designed for modularity, scalability, and security.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
│                    (Next.js + React)                        │
│                   http://localhost:3000                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         Backend                             │
│                    (Node.js + Express)                      │
│                   http://localhost:3002                     │
│                                                             │
│  • AI Provider Integration                                  │
│  • Project Management                                       │
│  • Session Management                                       │
│  • WebSocket Server                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Windows Tools API                        │
│                    (Node.js + Python)                       │
│                   http://localhost:3003                     │
│                                                             │
│  • Windows Automation                                       │
│  • Screenshot & OCR                                         │
│  • Mouse & Keyboard Control                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Windows Projects                         │
│              (Docker containers with Windows)               │
│                                                             │
│  • Isolated Windows environments                            │
│  • Per-project storage                                      │
│  • VNC access                                               │
└─────────────────────────────────────────────────────────────┘
```

## System Components

### 1. Frontend Layer

**Technology**: Next.js 14, React 18, TypeScript

**Responsibilities**:
- User interface rendering
- Real-time chat interface
- Project management UI
- Settings and configuration
- WebSocket client for real-time updates

**Key Features**:
- Server-side rendering (SSR)
- Responsive design
- Real-time collaboration
- Terminal emulation (xterm.js)

**File Structure**:
```
frontend/
├── components/       # React components
├── pages/           # Next.js pages
├── styles/          # CSS/Tailwind styles
├── lib/             # Utility functions
└── hooks/           # Custom React hooks
```

### 2. Backend Layer

**Technology**: Node.js 18, Express.js, TypeScript

**Responsibilities**:
- API endpoint management
- AI provider integration
- Session management
- Project lifecycle management
- WebSocket server
- Database operations

**Key Modules**:

#### AI Integration
- `provider-apis.js`: Unified interface for AI providers
- `context-aware-ai.js`: Context management for AI
- `ai-system-prompt.js`: System prompt generation

#### Project Management
- `project-manager.js`: Project CRUD operations
- `project-routes.js`: API endpoints for projects

#### Session Management
- `session-manager.js`: Session lifecycle
- `session-persistence.js`: Session storage
- `session-routes.js`: Session API endpoints

#### Collaboration
- `collaboration-manager.js`: Multi-user coordination
- `collaboration-websocket.js`: Real-time updates
- `websocket-broadcaster.js`: Message broadcasting

**File Structure**:
```
backend/
├── server.js                    # Main entry point
├── provider-apis.js             # AI provider integration
├── project-manager.js           # Project management
├── session-manager.js           # Session handling
├── collaboration-manager.js     # Real-time collaboration
├── database/                    # Database schemas
└── middleware/                  # Express middleware
```

### 3. Windows Tools API

**Technology**: Node.js, Python, Windows API

**Responsibilities**:
- Windows automation
- Screen capture and OCR
- Mouse and keyboard control
- File system operations
- Process management

**Key Features**:
- PyAutoGUI for automation
- Tesseract OCR for text recognition
- Win32 API integration
- VNC server management

### 4. Database Layer

**Technology**: Supabase (PostgreSQL)

**Schema**:

```sql
-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  os_type TEXT NOT NULL,
  container_id TEXT,
  status TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  model TEXT,
  created_at TIMESTAMP
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  role TEXT,
  content TEXT,
  timestamp TIMESTAMP
);

-- Usage tracking table
CREATE TABLE usage (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  model TEXT,
  tokens INTEGER,
  cost DECIMAL,
  timestamp TIMESTAMP
);
```

### 5. Container Layer

**Technology**: Docker, QEMU/KVM

**Responsibilities**:
- Isolated Windows environments
- Resource management
- Network isolation
- Storage management

**Container Configuration**:
```yaml
services:
  windows-project:
    image: windows-base:latest
    volumes:
      - project-data:/data
    networks:
      - isolated-network
    environment:
      - VNC_PASSWORD=secure
```

## Data Flow

### User Request Flow

```
1. User sends message in frontend
   ↓
2. Frontend sends to backend via WebSocket
   ↓
3. Backend processes message
   ↓
4. Backend calls AI provider API
   ↓
5. AI generates response and actions
   ↓
6. Backend sends actions to Windows Tools API
   ↓
7. Windows Tools API executes on container
   ↓
8. Results sent back to backend
   ↓
9. Backend streams response to frontend
   ↓
10. Frontend displays to user
```

### Collaboration Flow

```
1. User A sends message
   ↓
2. Backend receives message
   ↓
3. Backend broadcasts to all connected users
   ↓
4. User B receives update via WebSocket
   ↓
5. User B's UI updates in real-time
```

## Technology Stack

### Frontend
- **Framework**: Next.js 14
- **UI Library**: React 18
- **Styling**: Tailwind CSS
- **Components**: Radix UI
- **Terminal**: xterm.js
- **State**: React Context + Hooks
- **WebSocket**: native WebSocket API

### Backend
- **Runtime**: Node.js 18
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI SDKs**: 
  - OpenAI SDK
  - Anthropic SDK
  - Google Generative AI SDK
- **Container**: Dockerode

### Infrastructure
- **Containerization**: Docker
- **Orchestration**: Docker Compose
- **Virtualization**: QEMU/KVM
- **Networking**: Docker bridge networks
- **Storage**: Docker volumes

## Security

### Authentication & Authorization
- Session-based authentication
- Supabase Row Level Security (RLS)
- API key encryption
- Project-level access control

### Network Security
- Isolated container networks
- Internal-only APIs
- CORS configuration
- Rate limiting

### Data Security
- Encrypted environment variables
- Secure credential storage
- No sensitive data in logs
- Regular security audits

### Container Security
- Isolated environments
- Resource limits
- Read-only file systems where possible
- Regular image updates

## Scalability

### Horizontal Scaling

**Frontend**:
- Stateless design
- Can run multiple instances
- Load balancer ready

**Backend**:
- Stateless API design
- Session storage in database
- Can scale horizontally

**Database**:
- Supabase handles scaling
- Connection pooling
- Read replicas support

### Vertical Scaling

**Container Resources**:
```yaml
resources:
  limits:
    cpus: '2'
    memory: 4G
  reservations:
    cpus: '1'
    memory: 2G
```

### Performance Optimization

- **Caching**: Redis for session data
- **CDN**: Static assets via CDN
- **Compression**: Gzip/Brotli compression
- **Lazy Loading**: Component code splitting
- **Database**: Indexed queries, connection pooling

## Deployment Architecture

### Production Setup

```
┌─────────────────────────────────────────┐
│         Load Balancer (Nginx)           │
└─────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌──────────────┐        ┌──────────────┐
│  Frontend 1  │        │  Frontend 2  │
└──────────────┘        └──────────────┘
        │                       │
        └───────────┬───────────┘
                    ▼
        ┌─────────────────────┐
        │   Backend Cluster   │
        └─────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌──────────────┐        ┌──────────────┐
│  Supabase    │        │   Docker     │
│  (Database)  │        │   Swarm      │
└──────────────┘        └──────────────┘
```

## Monitoring & Logging

### Logging
- Structured logging (JSON)
- Log levels: ERROR, WARN, INFO, DEBUG
- Centralized log aggregation
- Log rotation

### Monitoring
- Health check endpoints
- Resource usage tracking
- Performance metrics
- Error tracking

### Metrics
- API response times
- Container resource usage
- Database query performance
- WebSocket connection count

## Future Enhancements

### Planned Features
- Linux OS support
- macOS support
- Plugin system
- Marketplace
- Mobile app

### Architecture Improvements
- Microservices architecture
- Kubernetes orchestration
- Service mesh
- Event-driven architecture

---

[← Back to README](../README.md)
