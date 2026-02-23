# Pantheon Network Architecture

## Overview

Pantheon uses a multi-network architecture with one main network and dynamically created project networks for isolation.

## Main Network: `mcp-server_ai-network`

**Subnet**: 10.0.1.0/24  
**Gateway**: 10.0.1.1

### Containers on Main Network

| Container | IP | Aliases | Purpose |
|-----------|-------|---------|---------|
| pantheon-backend | 10.0.1.2 | - | Main API service |
| pantheon-keycloak | 10.0.1.3 | keycloak | Authentication |
| pantheon-postgres | 10.0.1.4 | postgres | Database |
| pantheon-frontend | 10.0.1.5 | - | Web UI |
| windows-tools-api | 10.0.1.6 | - | Windows VM management |

### Purpose
- Core services communication
- User authentication and database access
- Frontend to backend communication
- Initial windows-tools-api access

## Project Networks: `project-{id}-network`

**Subnet**: 172.30.x.0/24 (x varies per project)  
**Gateway**: 172.30.x.254

### Dynamic Creation

When a user creates a Windows project:

1. Backend creates isolated network: `project-{projectId}-network`
2. Backend calculates unique subnet: `172.30.x.0/24`
3. Backend dynamically connects containers to this network

### Containers in Each Project Network

| Container | IP Pattern | Purpose |
|-----------|------------|---------|
| windows-tools-api | 172.30.x.1 | VM management (multi-homed) |
| windows-project-{id} | 172.30.x.2 | Windows 11 VM |
| pantheon-backend | 172.30.x.3 | API access (multi-homed) |
| shared-folder-{id} | 172.30.x.20 | File sharing via nginx |

### IP Allocation Logic

From `backend/project-manager.js`:

```javascript
calculateProjectSubnet(projectId) {
  // Use project ID hash to generate unique subnet
  const hash = crypto.createHash('md5').update(projectId).digest('hex');
  const thirdOctet = (parseInt(hash.substring(0, 2), 16) % 240) + 16; // 16-255
  
  return {
    subnet: `172.30.${thirdOctet}.0/24`,
    gateway: `172.30.${thirdOctet}.254`,
    sharedFolderIp: `172.30.${thirdOctet}.20`,
    windowsIp: `172.30.${thirdOctet}.2`,
    toolsApiIp: `172.30.${thirdOctet}.1`,
    backendIp: `172.30.${thirdOctet}.3`
  };
}
```

### Purpose
- Complete isolation between projects
- Each project has its own network namespace
- Projects cannot access each other's resources
- Secure file sharing within project only

## Multi-Homed Containers

### windows-tools-api

**Networks**:
- Main network: 10.0.1.6 (always)
- Project networks: 172.30.x.1 (dynamically added per project)

**Why Multi-Homed**:
- Needs to access PostgreSQL on main network (10.0.1.4)
- Needs to manage Windows VMs on project networks
- Dynamically connected when project is created

**Connection Logic**:
```javascript
// From backend/project-manager.js
const network = this.docker.getNetwork(networkName);
await network.connect({ Container: 'windows-tools-api' });
```

### pantheon-backend

**Networks**:
- Main network: 10.0.1.2 (always)
- Project networks: 172.30.x.3 (dynamically added per project)

**Why Multi-Homed**:
- Needs to access PostgreSQL and Keycloak on main network
- Needs to communicate with Windows VMs via MCP protocol
- Dynamically connected when project is created

## Network Isolation

### What Can Access What

#### From Main Network (10.0.1.0/24)
- ✅ All main network services can communicate
- ✅ Backend can access project networks (multi-homed)
- ✅ windows-tools-api can access project networks (multi-homed)
- ❌ Frontend cannot access project networks directly
- ❌ Keycloak cannot access project networks
- ❌ PostgreSQL cannot access project networks

#### From Project Network (172.30.x.0/24)
- ✅ Windows VM can access shared folder (172.30.x.20)
- ✅ Windows VM can access windows-tools-api (172.30.x.1)
- ✅ Windows VM can access backend via MCP (172.30.x.3)
- ✅ Backend can access PostgreSQL on main network (multi-homed)
- ✅ windows-tools-api can access PostgreSQL on main network (multi-homed)
- ❌ Windows VM cannot access main network directly
- ❌ Windows VM cannot access other project networks
- ❌ Shared folder cannot access main network

#### Between Project Networks
- ❌ Project A cannot access Project B
- ❌ Complete isolation enforced by Docker bridge networks

## Windows VM Access

### From Inside Windows VM

The Windows VM (172.30.x.2) can access:

1. **Shared Folder**: `http://172.30.0.1:8888`
   - Via socat proxy in Windows container
   - Actual target: `172.30.x.20:8888` (shared-folder container)
   - DNAT rules configured in Windows container

2. **Windows Tools API**: `http://172.30.x.1:8090`
   - Direct access on project network
   - Used for MCP protocol communication

3. **Backend (via MCP)**: `http://172.30.x.3:3002`
   - For AI agent communication
   - MCP protocol over HTTP

### Socat Proxy Configuration

The Windows container runs socat to proxy traffic:

```bash
# Shared folder proxy
socat TCP-LISTEN:8888,bind=172.30.0.1,fork,reuseaddr TCP:172.30.x.20:8888

# Tools API proxy (if needed)
socat TCP-LISTEN:8090,fork,reuseaddr TCP:windows-tools-api:8090
```

This allows the Windows VM to use consistent addresses regardless of the actual project network subnet.

## Security Features

### Network Isolation
- Each project runs in its own Docker bridge network
- Projects cannot see or access each other
- No shared resources between projects

### No Host Port Binding
- Shared folders do NOT bind to host ports
- Only accessible within project network
- Host machine cannot access project resources directly

### Multi-Homed Access Control
- Only backend and windows-tools-api can bridge networks
- Controlled by Docker network connections
- Cannot be bypassed from within containers

### Database Access
- Only main network containers can access PostgreSQL
- Project networks have no direct database access
- All database operations go through backend or windows-tools-api

## Deployment Considerations

### Initial Deployment

When deploying with `docker-compose.production.yml`:

1. Main network is created: `mcp-server_ai-network`
2. All 5 core containers start on main network
3. windows-tools-api is on main network ONLY initially
4. No project networks exist yet

### Project Creation

When a user creates a Windows project:

1. Backend creates project network: `project-{id}-network`
2. Backend connects windows-tools-api to project network
3. Backend creates Windows VM container on project network
4. Backend creates shared folder container on project network
5. Backend connects itself to project network (if needed)

### Project Deletion

When a project is deleted:

1. Backend stops and removes Windows VM container
2. Backend stops and removes shared folder container
3. Backend disconnects windows-tools-api from project network
4. Backend disconnects itself from project network
5. Backend removes project network

### Network Persistence

- Main network persists across restarts
- Project networks persist until project deletion
- Multi-homed connections persist across container restarts
- Static IPs are maintained via IPAMConfig

## Troubleshooting

### windows-tools-api Not Accessible from Project

**Symptom**: Windows VM cannot reach windows-tools-api

**Check**:
```bash
# Verify windows-tools-api is on project network
docker network inspect project-{id}-network

# Should show windows-tools-api with IP 172.30.x.1
```

**Fix**:
```bash
# Reconnect windows-tools-api to project network
docker network connect project-{id}-network windows-tools-api
```

### Shared Folder Not Accessible

**Symptom**: Windows VM gets 404 or connection refused at 172.30.0.1:8888

**Check**:
```bash
# Verify socat is running in Windows container
docker exec windows-project-{id} ps aux | grep socat

# Verify shared folder container is running
docker ps | grep shared-folder-{id}
```

**Fix**:
```bash
# Restart socat proxy
docker exec windows-project-{id} /usr/local/bin/start-socat-proxy.sh
```

### Backend Cannot Access Project

**Symptom**: Backend cannot communicate with Windows VM

**Check**:
```bash
# Verify backend is on project network
docker network inspect project-{id}-network

# Should show pantheon-backend with IP 172.30.x.3
```

**Fix**:
```bash
# Reconnect backend to project network
docker network connect project-{id}-network pantheon-backend
```

## Summary

- **Main Network**: Core services, always present
- **Project Networks**: Isolated per project, dynamically created
- **Multi-Homed**: windows-tools-api and backend bridge networks
- **Security**: Complete isolation between projects
- **Scalability**: Each project gets its own network namespace
- **Persistence**: Networks and connections survive restarts

This architecture ensures security, isolation, and scalability while allowing necessary communication between components.
