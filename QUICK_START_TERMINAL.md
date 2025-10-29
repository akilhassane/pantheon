# ⚡ Quick Start - Interactive Kali Terminal

## TL;DR - Get Running in 3 Steps

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Start Everything
```bash
docker-compose up --build
```

### Step 3: Open Browser
- Frontend: http://localhost:3000
- Backend: http://localhost:8811

## Using the Terminal

1. **Find the Terminal Button**
   - Look in the left sidebar
   - It's a green icon with horizontal lines
   - Located below "Imagine" section

2. **Click to Open**
   - Click the terminal icon
   - A modal will open with a terminal interface

3. **Wait for Connection**
   - You'll see "Connecting to Kali container..." loading
   - Once connected, you'll see a `$` prompt

4. **Type Commands**
   ```bash
   $ nmap -sV 192.168.1.100
   $ whoami
   $ ls -la /workspace/
   ```

5. **Execute**
   - Press Enter or click "Execute" button
   - Output appears in real-time

## Test Commands

Try these to verify everything works:

```bash
# Check system
$ cat /etc/os-release

# List available tools
$ which nmap sqlmap nikto

# Run a quick scan
$ nmap -V

# Check current user
$ id

# Show help
$ help
```

## Troubleshooting

### ❌ "Connecting..." stays loading
- Backend not running
- Run: `docker-compose up --build`

### ❌ "Failed to connect"
- Kali container not running
- Run: `docker ps | grep kali-pentest`

### ❌ No terminal icon visible
- Refresh page (Ctrl+R or Cmd+R)
- Check browser console (F12)

## File Changed

✅ `server.js` - Added WebSocket server
✅ `package.json` - Added `ws` dependency  
✅ `frontend/components/ui/terminal.tsx` - New terminal component
✅ `frontend/app/page.tsx` - Added terminal button & modal

## What's New

🎯 **WebSocket Connection** - Real-time bi-directional communication
🎯 **Interactive Shell** - Full SSH terminal to Kali container
🎯 **Beautiful UI** - macOS-style terminal with proper styling
🎯 **Status Indicator** - See if you're connected at a glance

---

**That's it! You're ready to rock! 🚀**
