# Network Architecture

Detailed network configuration and isolation model for Pantheon.

## Table of Contents

- [Overview](#overview)
- [Main Network](#main-network)
- [Project Networks](#project-networks)
- [Multi-Homed Containers](#multi-homed-containers)
- [Network Isolation](#network-isolation)
- [IP Address Allocation](#ip-address-allocation)
- [DNS Configuration](#dns-configuration)
- [Security](#security)

## Overview

Pantheon uses a dual-network architecture:

1. **Main Network**: Core services (Frontend, Backend, Keycloak, PostgreSQL)
2. **Project Networks**: Isolated per-project environments (Windows VM, Shared Folder)

This design ensures:
- Complete isolation between projects
- Secure communication between services
- Predictable IP addressing
- Scalable architecture

## Main Network

### Configuration

- **Network Name**: `mcp-server_ai-network`
- **Subnet**: `10.0.1.0/24`
- **Gateway**: `10.0.1.1`
- **Driver**: bridge

### Services and IPs

| Service | Container Name | IP Address | Ports |
|---------|---------------|------------|-------|
| Backend | pantheon-backend | 10.0.1.2 | 3002 |
| Keycloak | pantheon-keycloak | 10.0.1.3 | 8080 |
| PostgreSQL | pantheon-postgres | 10.0.1.4 | 5432 |
| Frontend | pantheon-frontend | 10.0.1.5 | 3000 |
| Windows Tools API | windows-tools-api | 10.0.1.6 | 8090 |

### DNS Aliases

- `postgres` → 10.0.1.4
- `keycloak` → 10.0.1.3

### Network Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              Main Network (10.0.1.0/24)                     │
│                  mcp-server_ai-network                      │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Frontend   │  │   Backend    │  │   Keycloak   │    │
│  │  10.0.1.5    │  │  10.0.1.2    │  │  10.0.1.3    │    │
│  │  :3000       │  │  :3002       │  │  :8080       │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐                       │
│  │  PostgreSQL  │  │ Windows Tools│                       │
│  │  10.0.1.4    │  │     API      │                       │
│  │  :5432       │  │  10.0.1.6    │                       │
│  └──────────────┘  │  :8090       │                       │
│                    └──────────────┘                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Project Networks

### Configuration

Each project gets its own isolated network:

- **Network Name**: `project-{id}-network`
- **Subnet**: `172.30.x.0/24` (x = project number)
- **Gateway**: `172.30.x.1`
- **Driver**: bridge

### Services and IPs

| Service | IP Address | Purpose |
|---------|------------|---------|
| Windows Tools API | 172.30.x.1 | Multi-homed bridge |
| Windows VM | 172.30.x.2 | Windows 11 environment |
| Shared Folder | 172.30.x.3 | File sharing service |
| Backend | 172.30.x.4 | Multi-homed bridge |

### Network Diagram

```
┌─────────────────────────────────────────────────────────────┐
│         Project Network (172.30.1.0/24)                     │
│            project-123-network                              │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Windows VM   │  │Shared Folder │  │Windows Tools │    │
│  │ 172.30.1.2   │  │ 172.30.1.3   │  │     API      │    │
│  │              │  │ nginx:8888   │  │ 172.30.1.1   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                            │               │
│                                            │ Multi-homed   │
│  ┌──────────────┐                          │               │
│  │   Backend    │◄─────────────────────────┘               │
│  │ 172.30.1.4   │                                          │
│  └──────────────┘                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Example: Multiple Projects

```
Project 1: 172.30.1.0/24
  - Windows VM: 172.30.1.2
  - Shared Folder: 172.30.1.3
  - Tools API: 172.30.1.1
  - Backend: 172.30.1.4

Project 2: 172.30.2.0/24
  - Windows VM: 172.30.2.2
  - Shared Folder: 172.30.2.3
  - Tools API: 172.30.2.1
  - Backend: 172.30.2.4

Project 3: 172.30.3.0/24
  - Windows VM: 172.30.3.2
  - Shared Folder: 172.30.3.3
  - Tools API: 172.30.3.1
  - Backend: 172.30.3.4
```

## Multi-Homed Containers

### Windows Tools API

The Windows Tools API container is multi-homed, connected to:
1. Main network (10.0.1.6)
2. All project networks (172.30.x.1)

**Purpose:**
- Provides Windows automation tools to all projects
- Maintains single instance for efficiency
- Isolated per-project access

**Connection Process:**
1. Container starts on main network
2. Backend dynamically connects it to project network on project creation
3. Container accessible at 172.30.x.1 within project

### Backend

The Backend container is also multi-homed:
1. Main network (10.0.1.2)
2. All project networks (172.30.x.4)

**Purpose:**
- Manages project resources
- Orchestrates Windows VMs
- Provides API access to projects

## Network Isolation

### Project Isolation

Each project network is completely isolated:
- No direct communication between projects
- Separate IP ranges
- Independent routing tables
- Isolated broadcast domains

### Security Benefits

1. **Data Isolation**: Projects cannot access each other's data
2. **Resource Isolation**: Network traffic is separated
3. **Failure Isolation**: Network issues in one project don't affect others
4. **Security Isolation**: Compromised project cannot access others

### Communication Paths

**Allowed:**
- Frontend ↔ Backend (main network)
- Backend ↔ PostgreSQL (main network)
- Backend ↔ Keycloak (main network)
- Backend ↔ Windows VM (project network)
- Windows VM ↔ Shared Folder (project network)
- Windows VM ↔ Tools API (project network)

**Blocked:**
- Project 1 ↔ Project 2 (isolated networks)
- Windows VM ↔ Main Network (no bridge)
- Shared Folder ↔ Main Network (no bridge)

## IP Address Allocation

### Static IP Assignment

All IPs are statically assigned using Docker's IPAMConfig:

```yaml
networks:
  mcp-server_ai-network:
    ipv4_address: 10.0.1.2
```

### Benefits

1. **Predictable Addressing**: Services always have same IP
2. **Reliable DNS**: No need for dynamic DNS updates
3. **Simplified Configuration**: Hardcoded IPs in config
4. **Debugging**: Easy to identify services by IP

### IP Ranges

- **Main Network**: 10.0.1.0/24 (254 usable IPs)
  - Reserved: 10.0.1.1 (gateway)
  - Used: 10.0.1.2-6 (services)
  - Available: 10.0.1.7-254

- **Project Networks**: 172.30.0.0/16 (65,534 usable IPs)
  - Each project: /24 subnet (254 IPs)
  - Maximum projects: 256 (172.30.0.0 - 172.30.255.0)

## DNS Configuration

### Internal DNS

Docker provides automatic DNS resolution:
- Container names resolve to IPs
- Network aliases provide additional names
- DNS queries handled by Docker daemon

### DNS Aliases

Main network aliases:
- `postgres` → pantheon-postgres (10.0.1.4)
- `keycloak` → pantheon-keycloak (10.0.1.3)

### External DNS

Backend container configured with external DNS:
- 1.1.1.1 (Cloudflare)
- 1.0.0.1 (Cloudflare)
- 8.8.8.8 (Google)
- 8.8.4.4 (Google)

## Security

### Network Security

1. **Firewall Rules**: Only necessary ports exposed
2. **Network Isolation**: Projects cannot communicate
3. **Encrypted Traffic**: TLS for external communication
4. **Access Control**: Authentication required for all services

### Port Exposure

Only these ports exposed to host:
- 3000 (Frontend)
- 3002 (Backend)
- 8080 (Keycloak)
- 5432 (PostgreSQL)
- 8090 (Windows Tools API)

Project networks not exposed to host.

### Best Practices

1. **Use Reverse Proxy**: nginx/traefik for HTTPS
2. **Enable Firewall**: Host firewall for additional protection
3. **Regular Updates**: Keep Docker and images updated
4. **Monitor Traffic**: Log and analyze network traffic
5. **Limit Exposure**: Only expose necessary ports

## Troubleshooting

### Cannot Connect to Service

**Check network connectivity:**
```bash
# From backend container
docker exec pantheon-backend ping postgres
docker exec pantheon-backend ping keycloak

# Check IP assignment
docker inspect pantheon-backend | grep IPAddress
```

### Project Network Issues

**Verify project network:**
```bash
# List networks
docker network ls | grep project

# Inspect project network
docker network inspect project-123-network

# Check container connections
docker inspect windows-vm-123 | grep Networks -A 20
```

### Multi-Homed Container Issues

**Verify multi-homed connections:**
```bash
# Check windows-tools-api networks
docker inspect windows-tools-api | grep Networks -A 50

# Should show both main and project networks
```

### DNS Resolution Issues

**Test DNS:**
```bash
# From backend container
docker exec pantheon-backend nslookup postgres
docker exec pantheon-backend nslookup keycloak

# Check /etc/hosts
docker exec pantheon-backend cat /etc/hosts
```

## Next Steps

- [Installation Guide](INSTALLATION.md)
- [Usage Guide](USAGE.md)
- [Troubleshooting](TROUBLESHOOTING.md)

## Support

- [GitHub Issues](https://github.com/akilhassane/pantheon/issues)
- [Discussions](https://github.com/akilhassane/pantheon/discussions)

[Back to README](../README.md)
