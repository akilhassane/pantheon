# ✅ Verify Kali Terminal is Visible & Working

## 🚀 Quick Start (Do This First)

```bash
# Terminal 1: Start Docker containers
docker-compose up -d

# Wait 10 seconds for containers to start
sleep 10

# Terminal 2: Start frontend
cd frontend
npm run dev

# Then open browser:
http://localhost:3000
```

---

## 🔍 Step-by-Step Verification

### Step 1: Check Containers are Running

```bash
docker ps
```

**Should show 2 containers:**
```
CONTAINER ID   IMAGE                              PORTS                    NAMES
...            kalilinux/kali-rolling             0.0.0.0:7681->7681/tcp  kali-pentest
...            mcp-pentest-forge:latest           0.0.0.0:3001->3001/tcp  mcp-pentest-forge
```

If not showing, start them:
```bash
docker-compose up -d
```

---

### Step 2: Verify ttyd is Running Inside Container

```bash
# Check if ttyd process exists
docker exec kali-pentest ps aux | grep ttyd
```

**Should show:**
```
root   123  0.0  0.0  ttyd -p 7681 bash
```

If not showing, ttyd didn't start. Check logs:
```bash
docker logs kali-pentest
```

---

### Step 3: Test Direct Connection to ttyd

```bash
# Try accessing terminal directly
curl -I http://localhost:7681

# Or in browser:
# http://localhost:7681
```

**Expected response:**
```
HTTP/1.1 200 OK
```

If "Connection refused" → ttyd is not running. Restart container:
```bash
docker-compose restart kali-pentest
docker logs kali-pentest
```

---

### Step 4: Frontend Should Be Running

```bash
# Check frontend is accessible
curl http://localhost:3000

# In browser:
http://localhost:3000
```

Should load the chat interface.

---

### Step 5: Test the Full Flow

**In Browser at `http://localhost:3000`:**

1. ✅ See animations with "create ORDER" and globe
2. ✅ Type a message in the input (bottom center)
3. ✅ Press Enter or click send
4. ✅ Right sidebar appears with your message
5. ✅ **Center area shows Kali terminal!**

**Terminal header should show:**
- 🟢 Green pulsing dot (connection alive)
- "Kali Linux Terminal" text
- "ttyd @ localhost:7681"

---

## 🎯 If Terminal Doesn't Appear

### Issue 1: Sidebar Doesn't Appear

```bash
# Check backend is running
curl http://localhost:3001/health
# or
netstat -an | grep 3001
```

If backend not responding, restart:
```bash
docker-compose restart mcp-pentest-forge
```

---

### Issue 2: Sidebar Appears, But Terminal is Black

**This means ttyd isn't accessible.**

```bash
# 1. Check if port 7681 is listening
netstat -an | grep 7681

# 2. Test direct connection
curl -v http://localhost:7681

# 3. Check container logs
docker logs kali-pentest

# 4. Restart container with fresh ttyd
docker-compose down
docker-compose up -d --build
```

**Wait 20 seconds** for container to boot and ttyd to start.

---

### Issue 3: Terminal Shows, But No Content

```bash
# Check browser console for errors
# F12 → Console tab → Look for errors

# Common error: "Connection refused"
# Solution: ttyd is not running

# Restart with verbose logging
docker-compose down
docker-compose up -d
docker logs -f kali-pentest
```

Should see:
```
ttyd is running at http://127.0.0.1:7681
```

---

## 🛠️ Complete Restart (Nuclear Option)

If nothing works:

```bash
# 1. Stop everything
docker-compose down -v

# 2. Clean up
docker system prune -f

# 3. Rebuild fresh
docker-compose up -d --build

# 4. Wait 30 seconds
sleep 30

# 5. Check it
docker ps
curl http://localhost:7681

# 6. Start frontend
cd frontend
npm run dev
```

---

## 📋 Verification Checklist

Run this to verify everything:

```bash
#!/bin/bash

echo "🔍 Kali Terminal Verification"
echo "============================"
echo ""

# 1. Check Docker
echo "1. Docker Containers:"
docker ps --filter "name=kali-pentest" --filter "name=mcp-pentest-forge"
echo ""

# 2. Check ttyd process
echo "2. ttyd Process:"
docker exec kali-pentest ps aux | grep ttyd | grep -v grep
echo ""

# 3. Check port 7681
echo "3. Port 7681 Status:"
netstat -an | grep 7681 || echo "Not listening (ttyd not running)"
echo ""

# 4. Test curl
echo "4. Direct Connection to ttyd:"
curl -I http://localhost:7681 2>/dev/null | head -1
echo ""

# 5. Check container logs
echo "5. Container Logs (last 10 lines):"
docker logs kali-pentest 2>/dev/null | tail -10
```

Save as `verify.sh` and run:
```bash
chmod +x verify.sh
./verify.sh
```

---

## 🎯 Expected Final State

When everything works:

### Before First Message:
- Full screen with globe animation
- "create ORDER" text
- Chat input at bottom center

### After Sending First Message:
- Right sidebar appears with chat (resizable!)
- Center area shows Kali terminal with:
  - Dark header bar
  - Green pulsing indicator
  - "Kali Linux Terminal" title
  - "ttyd @ localhost:7681" info
  - Black terminal area inside iframe
- Terminal is interactive and responsive

---

## 💡 Pro Tips

### Resize Terminal
Drag the left edge of the right sidebar left/right to resize terminal:
- **Drag left** = Make terminal bigger
- **Drag right** = Make terminal smaller

### Terminal Commands
Once visible, try:
```bash
whoami           # Shows: pentester
pwd              # Shows current directory
ls -la           # List files
neofetch         # System info
nmap localhost   # Network scan
```

### Direct Terminal Access (Without Chat)
```bash
# You can also access terminal directly:
# http://localhost:7681
```

---

## 📞 Still Not Working?

Send me output of:

```bash
docker ps
docker logs kali-pentest
curl -v http://localhost:7681
```

And I'll help debug! 🔧

---

**Terminal should be visible immediately after sending first message!** ✨



