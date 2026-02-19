# Pantheon AI Platform - Architecture

System architecture and design documentation.

---

## Table of Contents

1. [Overview](#overview)
2. [System Components](#system-components)
3. [Data Flow](#data-flow)
4. [Technology Stack](#technology-stack)
5. [Security](#security)
6. [Scalability](#scalability)
7. [Design Decisions](#design-decisions)

---

## Overview

Pantheon is a multi-agentic AI platform that enables AI models to interact with operating systems. The architecture is designed for:

- **Modularity**: Independent, replaceable components
- **Scalability**: Horizontal scaling for multiple users
- **Security**: Isolated environments and secure authentication
- **Extensibility**: Easy to add new OS types and AI providers

---

## System Components

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Users                               │
│                    (Web Browsers)                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Load Balancer                          │
│                    (nginx/Traefik)                          │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│       Frontend            │   │      Keycloak             │
│    (Next.js/React)        │   │   (Authentication)        │
│   Port: 3000              │   │   Port: 8080              │
└───────────────────────────┘   └───────────────────────────┘
                │                           │
                └─────────────┬─────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend API                            │
│                  (Node.js/Express)                          │
│                   Port: 3002                                │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Project    │  │   Session    │  │     AI       │    │
│  │  Management  │  │  Management  │  │  Integration │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  WebSocket   │  │ Collaboration│  │   Storage    │    │
│  │    Server    │  │    Manager   │  │   Manager    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
│   PostgreSQL     │  │    Docker    │  │   Supabase   │
│   (Keycloak DB)  │  │    Engine    │  │  (App Data)  │
│   Port: 5432     │  │              │  │              │
└──────────────────┘  └──────────────┘  └──────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Windows Containers                         │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Project 1   │  │  Project 2   │  │  Project N   │    │
│  │  Windows 11  │  │  Windows 11  │  │  Windows 11  │    │
│  │  VNC: 5900   │  │  VNC: 5901   │  │  VNC: 590N   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## System Components

### 1. Frontend (Next.js + React)

**Purpose**: User interface for interacting with Pantheon

**Key Features**:
- Server-side rendering for performance
- Real-time updates via WebSocket
- Responsive design for all devices
- Terminal emulation with xterm.js

**Technologies**:
- Next.js 14 (App Router)
- React 18
- Tailwind CSS
- Radix UI components
- xterm.js for terminal
- WebSocket client

**File Structure**:
```
frontend/
├── app/
│   ├── page.tsx              # Dashboard
│   ├── project/[id]/         # Project view
│   └── layout.tsx            # Root layout
├── components/
│   ├── modals/               # Modal dialogs
│   ├── ui/                   # UI components
│   └── terminal/             # Terminal component
└── hooks/
    ├── useWebSocket.ts       # WebSocket hook
    └── useGlobalWebSocket.ts # Global WS hook
```

### 2. Backend API (Node.js + Express)

**Purpose**: Core business logic and API endpoints

**Key Features**:
- RESTful API
- WebSocket server for real-time updates
- AI provider integration
- Docker container management
- Session management

**Technologies**:
- Node.js 18
- Express.js
- Dockerode (Docker API)
- WebSocket (ws library)
- AI SDKs (OpenAI, Anthropic, etc.)

**File Structure**:
```
backend/
├── server.js                 # Main server
├── routes/
│   ├── project-routes.js     # Project endpoints
│   ├── session-routes.js     # Session endpoints
│   └── collaboration-routes.js
├── services/
│   ├── ai-service.js         # AI integration
│   ├── docker-service.js     # Container management
│   └── storage-service.js    # File storage
├── websocket/
│   └── global-websocket.js   # WebSocket server
└── middleware/
    ├── auth.js               # Authentication
    └── validation.js         # Request validation
```

### 3. Keycloak (Authentication)

**Purpose**: Identity and access management

**Key Features**:
- OAuth 2.0 / OpenID Connect
- Social login (Google, Microsoft)
- User management
- Role-based access control

**Configuration**:
- Realm: `master`
- Client: `pantheon-client`
- Identity Providers: Google, Microsoft
- Token expiration: 1 hour

### 4. PostgreSQL (Database)

**Purpose**: Store Keycloak data

**Schema**:
- Users and credentials
- Realms and clients
- Identity provider configurations
- Sessions and tokens

### 5. Supabase (Application Database)

**Purpose**: Store application data

**Tables**:
- `projects`: Project metadata
- `sessions`: AI session data
- `messages`: Chat history
- `collaborations`: Project sharing
- `settings`: User preferences

### 6. Docker Engine

**Purpose**: Container orchestration

**Responsibilities**:
- Create Windows containers
- Manage container lifecycle
- Network isolation
- Volume management
- Resource allocation

### 7. Windows Containers

**Purpose**: Isolated Windows environments for each project

**Features**:
- Full Windows 11 installation
- VNC server for remote access
- Persistent storage
- Network isolation
- Resource limits (CPU, RAM)

**Base Image**: Custom Windows 11 with:
- Python 3.11
- Node.js 18
- Chrome browser
- Common utilities

---

## Data Flow

### User Authentication Flow

```
1. User clicks "Sign In"
   ↓
2. Frontend redirects to Keycloak
   ↓
3. User authenticates with Google/Microsoft
   ↓
4. Keycloak issues JWT token
   ↓
5. Frontend stores token
   ↓
6. All API requests include token in Authorization header
   ↓
7. Backend validates token with Keycloak
```

### Project Creation Flow

```
1. User submits "Create Project" form
   ↓
2. Frontend sends POST /api/projects
   ↓
3. Backend validates request
   ↓
4. Backend creates Supabase record
   ↓
5. Backend creates Docker container
   ↓
6. Backend starts Windows environment
   ↓
7. Backend returns project details
   ↓
8. Frontend redirects to project page
```

### AI Interaction Flow

```
1. User types message in chat
   ↓
2. Frontend sends via WebSocket
   ↓
3. Backend receives message
   ↓
4. Backend sends to AI provider
   ↓
5. AI responds with actions
   ↓
6. Backend executes actions in Windows container
   ↓
7. Backend streams response to frontend
   ↓
8. Frontend displays response in real-time
```

### Collaboration Flow

```
1. Owner invites collaborator
   ↓
2. Backend creates collaboration record
   ↓
3. Backend broadcasts "collaboration-added" via WebSocket
   ↓
4. All connected clients receive update
   ↓
5. Collaborator sees project in their dashboard
   ↓
6. Collaborator can access project
```

---

## Technology Stack

### Frontend

| Technology | Purpose | Version |
|------------|---------|---------|
| Next.js | React framework | 14.x |
| React | UI library | 18.x |
| TypeScript | Type safety | 5.x |
| Tailwind CSS | Styling | 3.x |
| Radix UI | Component library | Latest |
| xterm.js | Terminal emulation | 5.x |

### Backend

| Technology | Purpose | Version |
|------------|---------|---------|
| Node.js | Runtime | 18.x |
| Express | Web framework | 4.x |
| Dockerode | Docker API | 4.x |
| ws | WebSocket | 8.x |
| OpenAI SDK | AI integration | Latest |
| Anthropic SDK | AI integration | Latest |

### Infrastructure

| Technology | Purpose | Version |
|------------|---------|---------|
| Docker | Containerization | 24.x |
| Docker Compose | Orchestration | 2.x |
| Keycloak | Authentication | 23.x |
| PostgreSQL | Database | 15.x |
| Supabase | Backend-as-a-Service | Latest |

---

## Security

### Authentication & Authorization

- **OAuth 2.0**: Industry-standard authentication
- **JWT Tokens**: Stateless authentication
- **Role-Based Access**: Viewer, Editor, Admin roles
- **Token Expiration**: 1-hour access tokens
- **Refresh Tokens**: Long-lived refresh tokens

### Network Security

- **Container Isolation**: Each project in separate network
- **Firewall Rules**: Only necessary ports exposed
- **HTTPS**: TLS encryption in production
- **CORS**: Restricted cross-origin requests

### Data Security

- **Encryption at Rest**: Database encryption
- **Encryption in Transit**: TLS for all connections
- **API Key Storage**: Environment variables only
- **Secrets Management**: Docker secrets

### Container Security

- **Resource Limits**: CPU and memory constraints
- **Read-Only Filesystems**: Where possible
- **Non-Root Users**: Containers run as non-root
- **Image Scanning**: Regular vulnerability scans

---

## Scalability

### Horizontal Scaling

**Frontend**:
- Stateless design
- Can run multiple instances
- Load balancer distributes traffic

**Backend**:
- Stateless API
- WebSocket sticky sessions
- Can scale to multiple nodes

**Database**:
- Supabase handles scaling
- Read replicas for performance
- Connection pooling

### Vertical Scaling

**Windows Containers**:
- Adjustable CPU/RAM per project
- Resource limits prevent overuse
- Can run on larger hosts

### Performance Optimization

- **Caching**: Redis for session data
- **CDN**: Static assets on CDN
- **Database Indexing**: Optimized queries
- **Connection Pooling**: Reuse connections
- **Lazy Loading**: Load resources on demand

---

## Design Decisions

### Why Next.js?

- Server-side rendering for SEO
- Built-in routing and API routes
- Excellent developer experience
- Strong TypeScript support

### Why Docker?

- Consistent environments
- Easy deployment
- Resource isolation
- Portable across platforms

### Why Keycloak?

- Open-source and self-hosted
- Industry-standard protocols
- Extensive identity provider support
- Fine-grained access control

### Why Supabase?

- PostgreSQL-based (familiar)
- Real-time subscriptions
- Built-in authentication
- Generous free tier

### Why WebSocket?

- Real-time bidirectional communication
- Lower latency than polling
- Efficient for streaming responses
- Native browser support

---

## Future Enhancements

### Planned Features

1. **Linux Support**: Ubuntu/Debian containers
2. **macOS Support**: macOS virtualization
3. **Mobile Apps**: iOS and Android clients
4. **Plugin System**: Extensible tool system
5. **Marketplace**: Share automation scripts
6. **Analytics**: Usage and performance metrics
7. **Monitoring**: Health checks and alerts
8. **Backup**: Automated project backups

### Technical Improvements

1. **Kubernetes**: Container orchestration
2. **Redis**: Caching and pub/sub
3. **Elasticsearch**: Log aggregation
4. **Prometheus**: Metrics collection
5. **Grafana**: Monitoring dashboards
6. **CI/CD**: Automated testing and deployment

---

## Deployment Architecture

### Development

```
Local Machine
├── Docker Desktop
├── All services in docker-compose.yml
└── Hot reload for development
```

### Production

```
Cloud Provider (AWS/GCP/Azure)
├── Load Balancer
├── Frontend (Multiple instances)
├── Backend (Multiple instances)
├── Keycloak (HA setup)
├── PostgreSQL (Managed service)
├── Supabase (Cloud)
└── Windows Hosts (Dedicated servers)
```

---

## Monitoring & Logging

### Logging Strategy

- **Application Logs**: Winston/Pino
- **Access Logs**: nginx/Express
- **Container Logs**: Docker logs
- **Centralized**: Elasticsearch/Loki

### Metrics

- **System**: CPU, RAM, disk, network
- **Application**: Request rate, latency, errors
- **Business**: Active users, projects, sessions
- **Costs**: AI API usage, infrastructure

### Alerting

- **Critical**: Service down, high error rate
- **Warning**: High latency, resource usage
- **Info**: Deployments, configuration changes

---

## Support

- **Documentation**: https://github.com/akilhassane/pantheon
- **Issues**: https://github.com/akilhassane/pantheon/issues
- **Architecture Discussions**: https://github.com/akilhassane/pantheon/discussions

---

**Last Updated**: February 20, 2026  
**Version**: 1.0.0
