# 🖥️ Real-Time Kali Linux Terminal - Setup Guide

## Overview

You now have a fully interactive, real-time terminal interface for your Kali Linux container, accessible directly from the frontend!

### Features

✅ **Real-Time Command Execution** - See output instantly as commands execute
✅ **Interactive Shell** - Type commands and execute them in the Kali container
✅ **Beautiful UI** - macOS-style terminal with green terminal text
✅ **WebSocket Connection** - Low-latency, persistent connection to Kali
✅ **Connection Status** - Visual indicator shows if you're connected
✅ **Auto-Scroll** - Output automatically scrolls to show latest commands

## Setup Instructions

### 1. Install Backend Dependencies

```bash
cd c:\MCP\mcp-server
npm install
```

This will install the new `ws` (WebSocket) package needed for real-time terminal communication.

### 2. Update Environment Variables

Make sure your `.env` or `docker-compose.yml` has these values:

```
KALI_SSH_HOST=localhost    # or your Kali container hostname
KALI_SSH_PORT=2222        # SSH port exposed by Kali container
HTTP_PORT=8811            # Backend HTTP server port
SERVER_URL=http://localhost:8811  # Frontend can reach backend at this URL
```

### 3. Build and Run

#### Using Docker Compose:

```bash
docker-compose up --build
```

#### Using npm (local development):

**Terminal 1 - Backend:**
```bash
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### 4. Access the Terminal

1. Open your browser to `http://localhost:3000` (frontend)
2. Look for the **Terminal icon** in the left sidebar (green icon with lines)
3. Click it to open the interactive terminal modal
4. Type commands and hit Enter (or click Execute)

## Terminal Icon Location

The terminal button is now in the left sidebar:
- 🟢 **Green terminal icon** with lines
- Appears below "Imagine" section
- Has a green indicator dot showing it's available

## Usage Examples

Once connected to the terminal:

```bash
# List files
$ ls -la

# Run network scans
$ nmap -sn 192.168.1.0/24

# Check Kali tools
$ which nmap sqlmap nikto

# Run a command and capture output
$ ifconfig

# Chain commands
$ cat /etc/os-release && whoami

# Execute pentesting tools
$ nmap -sV 192.168.1.100
```

## Architecture

### Frontend (React/Next.js)
- **Component**: `frontend/components/ui/terminal.tsx`
- **State Management**: WebSocket connection, output buffer, input state
- **Styling**: Tailwind CSS with monospace terminal theme

### Backend (Node.js/Express)
- **Server**: `server.js` with WebSocket support
- **Connection Type**: SSH to Kali container
- **Message Format**: JSON over WebSocket

### Communication Flow

```
Frontend (Terminal Component)
    ↓ WebSocket Connection
    ↓ (ws://localhost:8811/ws/terminal)
Backend Express Server
    ↓ SSH Connection
    ↓ (to kali-pentest:2222)
Kali Container
    ↓ Interactive Shell
    ↓ Command Execution
Output Streamed Back
```

## WebSocket Message Protocol

### Client → Server (Input)

```json
{
  "type": "input",
  "data": "command\n"
}
```

### Server → Client (Output)

```json
{
  "type": "output",
  "data": "command output text"
}
```

### Error Messages

```json
{
  "type": "error",
  "message": "Error description"
}
```

### Connection Close

```json
{
  "type": "close"
}
```

## Troubleshooting

### "Connecting to Kali container..." (hangs)

**Cause**: Backend can't reach Kali SSH server
**Solution**:
1. Check Kali container is running: `docker ps | grep kali-pentest`
2. Verify SSH is running: `docker logs kali-pentest | grep sshd`
3. Check port 2222 is exposed in docker-compose.yml

### "Failed to connect to Kali container"

**Cause**: SSH credentials or connection issue
**Solution**:
1. Verify credentials in server.js (pentester/pentester)
2. Test SSH manually: `ssh -p 2222 pentester@localhost`
3. Check firewall allows port 2222

### No output appears when typing commands

**Cause**: WebSocket disconnected
**Solution**:
1. Check browser console for errors (F12)
2. Check server logs: `docker logs mcp-pentest-forge`
3. Verify connection status indicator (red/green dot)
4. Try refreshing the page

### Terminal freezes

**Cause**: Long-running command
**Solution**:
1. Commands are executed normally in the shell
2. Long-running scans will continue
3. You can type Ctrl+C to interrupt if the shell is responsive
4. Close and reopen terminal to start fresh session

## Advanced Usage

### Running Long-Scan in Background

```bash
$ nmap -sV 192.168.1.0/24 > /workspace/scan.txt 2>&1 &
$ echo "Scan started in background"
```

### Multiple Commands

```bash
$ command1 && command2 || command3
```

### Output to File

```bash
$ nmap -sV 192.168.1.1 -oN /workspace/scan_result.txt
```

### Check Workspace Files

```bash
$ ls -la /workspace/
$ cat /workspace/scan_result.txt
```

## Performance Tips

1. **Clear terminal** - If output gets too large, open a new terminal session
2. **Background execution** - Use `&` for long-running tasks
3. **Output redirection** - Save scan results to files in `/workspace`
4. **Monitor resources** - SSH connection has 10-minute timeout for very long commands

## Security Notes

⚠️ **Important**:
- Terminal has access to **full Kali Linux** system
- Default credentials are **pentester/pentester**
- In production, change SSH credentials in `Dockerfile.kali`
- Use strong passwords for production deployments
- Restrict network access to backend in production

## Next Steps

1. ✅ Run `npm install` in backend
2. ✅ Run `docker-compose up --build`
3. ✅ Open frontend at `http://localhost:3000`
4. ✅ Click terminal icon in sidebar
5. ✅ Start executing commands!

## File Locations

- **Backend Server**: `server.js` (WebSocket + HTTP server)
- **Terminal Component**: `frontend/components/ui/terminal.tsx`
- **Frontend Page**: `frontend/app/page.tsx`
- **Docker Compose**: `docker-compose.yml`
- **Kali Dockerfile**: `Dockerfile.kali`

## API Endpoints

- **WebSocket Terminal**: `ws://localhost:8811/ws/terminal`
- **HTTP API**: `http://localhost:8811/api/tools/kali_execute`
- **Health Check**: `http://localhost:8811/health`

## Browser Support

- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ⚠️ Requires WebSocket support (all modern browsers)

---

**Enjoy your interactive Kali terminal! 🎉**
