# Pantheon Quick Reference Card

## Installation

### Linux/macOS
```bash
curl -O https://raw.githubusercontent.com/akilhassane/pantheon/main/install-pantheon.sh
chmod +x install-pantheon.sh
bash install-pantheon.sh
```

### Windows
```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/akilhassane/pantheon/main/install-pantheon.ps1" -OutFile "install-pantheon.ps1"
powershell -ExecutionPolicy Bypass -File install-pantheon.ps1
```

## Access URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3002 |
| Windows Tools | http://localhost:3003 |

## Docker Commands

### Start Services
```bash
docker-compose -f docker-compose.production.yml up -d
```

### Stop Services
```bash
docker-compose -f docker-compose.production.yml down
```

### Restart Services
```bash
docker-compose -f docker-compose.production.yml restart
```

### View Logs
```bash
# All services
docker-compose -f docker-compose.production.yml logs -f

# Specific service
docker logs -f pantheon-backend
docker logs -f pantheon-frontend
docker logs -f pantheon-windows-tools
```

### Check Status
```bash
docker-compose -f docker-compose.production.yml ps
```

### Update Images
```bash
docker-compose -f docker-compose.production.yml pull
docker-compose -f docker-compose.production.yml up -d
```

## Environment Variables

### Required
```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# At least one AI provider
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
# or
GEMINI_API_KEY=AIza...
```

### Optional
```env
# OpenRouter (multi-model support)
OPENROUTER_API_KEY=sk-or-v1-...

# Mistral
MISTRAL_API_KEY=...

# Cohere
COHERE_API_KEY=...

# MCP Master Secret
MCP_MASTER_SECRET=...

# Debug
DEBUG=false
NODE_ENV=production
```

## Troubleshooting

### Test Installation
```bash
bash test-installation.sh
```

### Check Container Health
```bash
docker ps
# Look for "healthy" status
```

### View Backend Logs
```bash
docker logs pantheon-backend --tail 100 -f
```

### Restart Specific Service
```bash
docker-compose -f docker-compose.production.yml restart backend
```

### Clean Docker System
```bash
docker system prune -a
```

### Check Disk Space
```bash
docker system df
df -h
```

## Common Issues

### Port Already in Use
```bash
# Find process using port
lsof -i :3000  # Linux/macOS
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 <PID>  # Linux/macOS
taskkill /PID <PID> /F  # Windows
```

### Container Won't Start
```bash
# Check logs
docker logs pantheon-backend

# Remove and recreate
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d
```

### Database Connection Failed
1. Verify Supabase credentials in `.env`
2. Check Supabase project status
3. Restart backend: `docker-compose -f docker-compose.production.yml restart backend`

### Frontend Can't Connect to Backend
1. Check backend is running: `docker ps | grep pantheon-backend`
2. Test backend: `curl http://localhost:3002/health`
3. Verify `NEXT_PUBLIC_API_URL` in `.env`

## API Endpoints

### Health Checks
```bash
curl http://localhost:3002/health
curl http://localhost:3003/health
```

### Projects
```bash
# List projects
curl http://localhost:3002/api/projects

# Create project
curl -X POST http://localhost:3002/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"My Project","osType":"windows"}'
```

### Sessions
```bash
# List sessions
curl http://localhost:3002/api/sessions?projectId=<project-id>

# Create session
curl -X POST http://localhost:3002/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"projectId":"<project-id>","name":"New Session"}'
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + K` | Focus chat |
| `Ctrl + Enter` | Send message |
| `Ctrl + /` | Toggle sidebar |
| `Ctrl + ,` | Settings |
| `Ctrl + N` | New project |
| `Esc` | Close modal |

## AI Model Recommendations

### For Complex Tasks
- GPT-4o (OpenAI)
- Claude 3.5 Sonnet (Anthropic)
- Gemini 1.5 Pro (Google)

### For General Use
- GPT-4 Turbo (OpenAI)
- Claude 3 Sonnet (Anthropic)
- Gemini 1.5 Flash (Google)

### For Cost Efficiency
- GPT-3.5 Turbo (OpenAI)
- Claude 3 Haiku (Anthropic)
- Gemini 1.5 Flash (Google)

## Resource Requirements

### Per Service
| Service | CPU | RAM | Disk |
|---------|-----|-----|------|
| Frontend | 1 | 2GB | 1GB |
| Backend | 2 | 4GB | 2GB |
| Windows Tools | 1 | 2GB | 1GB |
| Windows Project | 4 | 8GB | 20GB |

### Minimum System
- 8GB RAM
- 4 CPU cores
- 64GB free disk space

### Recommended System
- 16GB RAM
- 8 CPU cores
- 50GB free disk space

## Backup and Restore

### Backup Project Data
```bash
# Export Docker volume
docker run --rm -v pantheon-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/pantheon-backup.tar.gz /data
```

### Restore Project Data
```bash
# Import Docker volume
docker run --rm -v pantheon-data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/pantheon-backup.tar.gz -C /
```

### Backup Database
Use Supabase dashboard to export database.

## Security Checklist

- [ ] Change default passwords
- [ ] Rotate API keys regularly
- [ ] Use strong Supabase passwords
- [ ] Enable 2FA on Supabase
- [ ] Don't commit `.env` to git
- [ ] Use HTTPS in production
- [ ] Limit collaborator access
- [ ] Monitor usage regularly

## Performance Optimization

### Increase Docker Resources
Docker Desktop → Settings → Resources
- CPU: 8 cores
- Memory: 16GB
- Disk: 100GB

### Clean Up Regularly
```bash
# Remove unused containers
docker container prune

# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything
docker system prune -a --volumes
```

### Monitor Resources
```bash
# Real-time stats
docker stats

# Disk usage
docker system df
```

## Getting Help

### Documentation
- [Installation Guide](./docs/INSTALLATION_GUIDE.md)
- [User Guide](./docs/USER_GUIDE.md)
- [Troubleshooting](./docs/TROUBLESHOOTING.md)
- [Architecture](./docs/ARCHITECTURE.md)

### Support
- 💬 Discord: [Join server](#)
- 🐛 GitHub: [Report issue](https://github.com/akilhassane/pantheon/issues)
- 📧 Email: support@pantheon.ai

### Useful Links
- GitHub: https://github.com/akilhassane/pantheon
- Docker Hub: https://hub.docker.com/r/akilhassane/pantheon
- Documentation: https://docs.pantheon.ai

---

**Print this page for quick reference!**
