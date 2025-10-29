# 🚀 Complete Startup Guide

## One-Command Start (Everything!)

```bash
docker-compose up -d
```

That's it! This will:
- ✅ Build Kali image with ttyd pre-installed
- ✅ Start Kali container with ttyd listening on port 7681
- ✅ Start backend server on port 3001
- ✅ Everything is ready to go!

---

## Verify Everything is Running

```bash
# Check containers
docker ps

# Should show:
# - mcp-pentest-forge (backend)
# - kali-pentest (kali with ttyd)
```

---

## Start Frontend (Separate Terminal)

```bash
cd frontend
npm install  # First time only
npm run dev
```

Frontend will be at: `http://localhost:3000`

---

## Test the Setup

1. **Open browser**: `http://localhost:3000`
2. **Type a message** in the chat input
3. **Press Enter**
4. **Right sidebar appears** with your message
5. **Center area shows Kali terminal** ✨

---

## Ports Reference

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 3000 | React app (run locally with npm) |
| Backend | 3001 | Node.js API server |
| Kali Terminal (ttyd) | 7681 | Web-based terminal |
| Kali SSH | 2222 | SSH access (optional) |

---

## Direct Access (Without Chat)

Want to test terminal directly?

```bash
# Visit in browser:
http://localhost:7681
```

You'll see the ttyd web terminal with full bash access!

---

## Commands for Kali Terminal

Once the terminal loads:

```bash
whoami                  # See current user
pwd                     # See current directory
ls -la                  # List files
neofetch                # System info
nmap localhost          # Scan network
sudo apt-get update     # Update packages
apt-cache search nmap   # Search for tools
```

---

## Troubleshooting

### Terminal still not showing?

```bash
# Check if ttyd is running
docker ps

# Check logs
docker logs kali-pentest

# Should see:
# ttyd is running at http://127.0.0.1:7681
```

### Port 7681 in use?

```bash
# Kill the process
lsof -i :7681
kill -9 <PID>

# Or restart everything
docker-compose restart
```

### Need to rebuild?

```bash
# Remove old containers
docker-compose down

# Rebuild fresh
docker-compose up -d --build
```

---

## Stop Everything

```bash
# Stop containers (keeps data)
docker-compose stop

# Remove containers completely
docker-compose down

# Remove everything including volumes
docker-compose down -v
```

---

## Next Steps

✅ **Setup Complete!** Now you can:
- 💬 Chat in the right sidebar
- 🖥️ Use Kali terminal in center
- 🎚️ Resize sidebar to adjust terminal view
- 🔧 Run any Kali tool or command

---

**Everything should work out of the box now!** 🎉

Enjoy your integrated Kali terminal! 🔓



