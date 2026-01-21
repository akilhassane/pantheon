# Quick Start Guide

## 🚀 Getting Started

### 1. Start All Services

```bash
# Navigate to docker directory
cd docker

# Start all containers
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 2. Build Individual Containers

#### Kali Linux
```bash
cd docker/kali
build.bat
```

#### Ubuntu 24.04
```bash
cd docker/ubuntu-24
build.bat
```

### 3. Access Services

#### Kali Linux
- **VNC Desktop**: http://localhost:7681
- **Terminal**: http://localhost:8081
- **SSH**: `ssh root@localhost -p 2222`

#### Ubuntu 24.04
- **VNC Desktop**: http://localhost:7682
- **Terminal**: http://localhost:8082

#### Backend API
- **API**: http://localhost:3002

## 🧪 Running Tests

```bash
# Desktop mode test
node scripts/tests/test-desktop-mode.js

# Vision test
node scripts/tests/test-vision-simple.cjs

# API connection test
node scripts/tests/test-api-connection.js

# MCP integration test
node scripts/tests/test-mcp-direct.cjs
```

## 🛠️ Utility Scripts

### Restart Services
```bash
# Restart backend
.\scripts\utils\restart-backend.ps1

# Restart frontend
.\scripts\utils\restart-frontend.ps1

# Restart all
cd docker
docker-compose restart
```

### Database Management
```bash
# Check database connections
node scripts/utils/check-database-connections.cjs

# Check messages in database
node scripts/utils/check-messages-in-db.cjs

# Check project data
node scripts/utils/check-project-data.js
```

### Diagnostics
```bash
# Fix Kali VNC
.\scripts\utils\fix-kali-vnc.ps1

# Diagnose black screen
.\scripts\utils\diagnose-black-screen.ps1

# Check Docker and restart backend
.\scripts\utils\check-docker-and-restart-backend.ps1
```

## 📁 Project Structure

```
pantheon/
├── backend/              # Backend Node.js service
├── frontend/             # Frontend React application
├── docker/               # Docker configurations
│   ├── kali/            # Kali Linux container
│   ├── ubuntu-24/       # Ubuntu 24.04 container
│   └── docker-compose.yml
├── scripts/              # Scripts
│   ├── build/           # Build scripts
│   ├── tests/           # Test scripts (134 files)
│   └── utils/           # Utility scripts (55 files)
├── docs/                 # Documentation
│   └── archive/         # Historical docs (338 files)
└── mcp-server/          # MCP server implementation
```

## 🔧 Common Tasks

### Stop All Services
```bash
cd docker
docker-compose down
```

### View Logs
```bash
# All services
cd docker
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f kali-pentest
docker-compose logs -f ubuntu-24-systemd
```

### Rebuild Containers
```bash
cd docker
docker-compose build --no-cache
docker-compose up -d
```

### Clean Up
```bash
# Stop and remove containers
cd docker
docker-compose down -v

# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune
```

## 📚 Documentation

- **Main README**: `README.md`
- **Docker README**: `docker/README.md`
- **Scripts README**: `scripts/README.md`
- **Cleanup Summary**: `PROJECT_CLEANUP_SUMMARY.md`
- **Completion Status**: `CLEANUP_COMPLETE.md`

## 🆘 Troubleshooting

### Container Won't Start
```bash
# Check logs
cd docker
docker-compose logs [service-name]

# Rebuild
docker-compose build --no-cache [service-name]
docker-compose up -d [service-name]
```

### Port Already in Use
```bash
# Find process using port
netstat -ano | findstr :[port]

# Kill process (Windows)
taskkill /PID [pid] /F
```

### VNC Not Showing Desktop
```bash
# Fix Kali VNC
.\scripts\utils\fix-kali-vnc.ps1

# Check container logs
docker logs kali-pentest
docker logs ubuntu-24-systemd
```

## 💡 Tips

1. Always run `docker-compose` commands from the `docker/` directory
2. Test scripts are in `scripts/tests/`
3. Utility scripts are in `scripts/utils/`
4. Historical documentation is in `docs/archive/`
5. Each Docker OS has its own directory with README

## 🎯 Next Steps

1. ✅ Start services: `cd docker && docker-compose up -d`
2. ✅ Access Kali desktop: http://localhost:7681
3. ✅ Access Ubuntu desktop: http://localhost:7682
4. ✅ Test backend API: http://localhost:3002
5. ✅ Run tests: `node scripts/tests/test-desktop-mode.js`

Happy hacking! 🚀
