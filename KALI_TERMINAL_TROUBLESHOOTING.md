# 🔧 Kali Terminal Not Showing - Troubleshooting Guide

## Quick Checklist

Before diving into troubleshooting, verify:

- [ ] Did you send a chat message? (Terminal only shows after first message)
- [ ] Is the right sidebar appearing?
- [ ] Is the center area showing anything, or is it blank?

---

## 🚨 Common Issues & Solutions

### Issue 1: Chat Sidebar Doesn't Appear

**Problem**: You send a message but nothing happens.

**Checklist**:
```bash
# 1. Is backend running?
netstat -an | grep 3001

# 2. Is frontend running?
netstat -an | grep 3000

# 3. Check browser console
F12 → Console tab → Look for errors
```

**Solution**:
```bash
# Make sure both are running:
cd frontend
npm run dev

# In another terminal:
# Check if server.js is running
ps aux | grep node
```

---

### Issue 2: Sidebar Shows, But Terminal Area is Blank/Black

**Problem**: Sidebar appears on right with messages, but center is just black.

This means the iframe at `http://localhost:7681` is not accessible.

**Step 1: Check if ttyd is Running**

```bash
# List running containers
docker ps

# Should see something like: kalilinux/kali-linux-docker

# Check if ttyd process is running inside
docker exec <container_name> ps aux | grep ttyd
```

**Step 2: Verify Port 7681 is Exposed**

```bash
# Check if port 7681 is listening
netstat -an | grep 7681

# Or using lsof
lsof -i :7681

# Should show LISTENING on 7681
```

**Step 3: Test Direct Connection**

```bash
# Try connecting directly
curl http://localhost:7681

# If it works, you should see HTML output
# If error: "Connection refused" → ttyd not running
```

**Step 4: Start ttyd**

If not running, start it:

```bash
# Option A: Enter container and start ttyd
docker exec -it <container_name> bash
# Inside container:
apt-get update
apt-get install -y ttyd
ttyd -p 7681 bash

# Option B: Docker exec directly
docker exec -it <container_name> ttyd -p 7681 bash
```

---

### Issue 3: Terminal Shows, But Commands Don't Work

**Problem**: Terminal appears but is unresponsive.

```bash
# 1. Check if bash is available
docker exec <container_name> which bash

# 2. Check container status
docker ps -a

# 3. Check container logs
docker logs <container_name>

# 4. Restart container
docker restart <container_name>

# 5. Restart ttyd
docker exec <container_name> killall ttyd
docker exec <container_name> ttyd -p 7681 bash
```

---

### Issue 4: Port Already in Use

**Problem**: Error about port 7681 already being used.

```bash
# Find what's using port 7681
lsof -i :7681

# Kill the process
kill -9 <PID>

# Or use a different port (update code if needed)
docker exec <container_name> ttyd -p 7682 bash
```

---

## 🔍 Step-by-Step Diagnostic

### Step 1: Verify Docker Container is Running

```bash
docker ps
```

You should see:
```
CONTAINER ID   IMAGE                              NAMES
abc123def456   kalilinux/kali-linux-docker       kali-terminal
```

If not running:
```bash
# Start it
docker run -it -p 7681:7681 kalilinux/kali-linux-docker bash

# Or with compose
docker-compose up kali
```

### Step 2: Check if ttyd is Installed

```bash
docker exec <container_name> which ttyd

# If "not found", install it:
docker exec <container_name> apt-get update
docker exec <container_name> apt-get install -y ttyd
```

### Step 3: Start ttyd

```bash
# Inside container
docker exec -it <container_name> bash
ttyd -p 7681 bash

# Or one-liner
docker exec <container_name> ttyd -p 7681 bash
```

### Step 4: Test from Host Machine

```bash
# Test connectivity
curl -v http://localhost:7681

# Expected output: HTML page of ttyd web interface
# If fails: Connection refused → service not listening
```

### Step 5: Open Browser

```
http://localhost:7681
```

Should see a web-based terminal interface with black background.

### Step 6: Test React App

1. Open `http://localhost:3000`
2. Send a chat message
3. Check browser DevTools (F12)
   - Network tab: Look for failed requests to `localhost:7681`
   - Console tab: Look for CORS or connection errors

---

## 🐛 Browser Console Errors & Solutions

### Error: "Refused to connect to localhost:7681"

```
Solution:
1. ttyd service not running
2. Port 7681 not exposed
3. Firewall blocking port

Fix:
docker exec <container_name> ttyd -p 7681 bash
```

### Error: "Cross-Origin Request Blocked"

```
Solution: CORS issue with iframe

This should work by default since we use same origin.
If still issues, ttyd might not be responding.

Check:
curl -v http://localhost:7681
```

### Error: "Failed to fetch"

```
Solution: Network connectivity issue

Check:
1. Port 7681 is open
2. Service is responding
3. Firewall not blocking
4. Docker port mapping is correct
```

---

## 🔧 Docker Compose Fix

Update your `docker-compose.yml`:

```yaml
version: '3.8'

services:
  kali:
    image: kalilinux/kali-linux-docker
    container_name: kali-terminal
    ports:
      - "7681:7681"
    environment:
      - PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
    stdin_open: true
    tty: true
    command: >
      bash -c "
        apt-get update &&
        apt-get install -y ttyd &&
        ttyd -p 7681 bash
      "
```

Start it:
```bash
docker-compose up -d kali

# Check logs
docker-compose logs -f kali

# Should see something like:
# ttyd is running at http://127.0.0.1:7681
```

---

## 📋 Complete Verification Script

Copy and run this to verify everything:

```bash
#!/bin/bash

echo "🔍 Kali Terminal Setup Verification"
echo "===================================="
echo ""

# Check Docker
echo "1. Checking Docker..."
if command -v docker &> /dev/null; then
    echo "   ✅ Docker found"
else
    echo "   ❌ Docker not found"
    exit 1
fi

# Check container
echo "2. Checking Kali container..."
CONTAINER_ID=$(docker ps -q -f name=kali)
if [ -z "$CONTAINER_ID" ]; then
    echo "   ❌ Kali container not running"
    echo "   Run: docker run -it -p 7681:7681 kalilinux/kali-linux-docker bash"
    exit 1
else
    echo "   ✅ Container running: $CONTAINER_ID"
fi

# Check ttyd
echo "3. Checking ttyd..."
if docker exec $CONTAINER_ID which ttyd &> /dev/null; then
    echo "   ✅ ttyd installed"
else
    echo "   ❌ ttyd not installed"
    echo "   Run: docker exec $CONTAINER_ID apt-get install -y ttyd"
    exit 1
fi

# Check port
echo "4. Checking port 7681..."
if curl -s http://localhost:7681 &> /dev/null; then
    echo "   ✅ Port 7681 accessible"
else
    echo "   ❌ Port 7681 not accessible"
    echo "   Run: docker exec $CONTAINER_ID ttyd -p 7681 bash"
    exit 1
fi

# Check frontend
echo "5. Checking frontend..."
if curl -s http://localhost:3000 &> /dev/null; then
    echo "   ✅ Frontend running"
else
    echo "   ❌ Frontend not running"
    echo "   Run: cd frontend && npm run dev"
    exit 1
fi

echo ""
echo "✅ All checks passed!"
echo "Try sending a chat message to see the terminal"
```

Save as `verify.sh` and run:
```bash
chmod +x verify.sh
./verify.sh
```

---

## 🎯 Step-by-Step Fix (Most Common Case)

If you just want it to work quickly:

### 1. Get Container Name

```bash
docker ps
# Note the container ID or NAME for kali
```

### 2. Install & Start ttyd

```bash
# Replace <container_name> with your container's name
docker exec <container_name> apt-get update
docker exec <container_name> apt-get install -y ttyd
docker exec <container_name> ttyd -p 7681 bash
```

### 3. Verify It's Running

```bash
# Should return HTML
curl http://localhost:7681
```

### 4. Reload Browser

```
http://localhost:3000
```

### 5. Send a Chat Message

Type something and press Enter. The terminal should appear!

---

## 📞 Still Not Working?

Run these diagnostic commands and share the output:

```bash
# Check docker
docker ps

# Check port
netstat -an | grep 7681

# Check container logs
docker logs <container_name>

# Check if ttyd is running
docker exec <container_name> ps aux | grep ttyd

# Test connectivity
curl -v http://localhost:7681
```

---

## 🚀 Alternative: Use Manual Start

If automated setup isn't working:

```bash
# 1. Open terminal in Docker container
docker exec -it <container_name> bash

# 2. Inside container, run:
apt-get update
apt-get install -y ttyd
ttyd -p 7681 bash

# 3. Keep this terminal open, open another and test:
curl http://localhost:7681

# 4. Then reload your React app and send a message
```

---

**Once the terminal shows**, you should be able to:
- Type bash commands
- Run Kali tools
- See real-time output
- Resize the sidebar and terminal adjusts

Let me know what error you're seeing and I can help more specifically! 🎯



