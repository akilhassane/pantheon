# 🖥️ Kali Linux Terminal Setup Guide

## Overview

The center area now displays a **Kali Linux terminal** when you send your first message. The terminal runs inside your Docker container and is accessible through your web browser.

## ⚙️ Setup Instructions

### Option 1: Using ttyd (Recommended - Easiest)

ttyd provides a web-based terminal interface accessible via HTTP.

#### Step 1: Install ttyd in Kali Container

Add this to your `Dockerfile.kali`:

```dockerfile
FROM kalilinux/kali-linux-docker

# Install ttyd
RUN apt-get update && apt-get install -y ttyd

# Expose port 7681 for ttyd
EXPOSE 7681

# Start ttyd when container runs
CMD ["/usr/bin/ttyd", "-p", "7681", "bash"]
```

Or, if already running, install via Docker exec:

```bash
docker exec <kali_container_name> apt-get update
docker exec <kali_container_name> apt-get install -y ttyd
```

#### Step 2: Start ttyd on Port 7681

In your container:

```bash
ttyd -p 7681 bash
```

Or in docker-compose:

```yaml
kali:
  image: kalilinux/kali-linux-docker
  ports:
    - "7681:7681"
  command: ttyd -p 7681 bash
```

#### Step 3: Verify Connection

Open browser and visit: `http://localhost:7681`

You should see a web-based terminal.

### Option 2: Using docker-compose

Create/update `docker-compose.yml`:

```yaml
version: '3.8'

services:
  kali:
    image: kalilinux/kali-linux-docker
    container_name: kali-terminal
    ports:
      - "7681:7681"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: >
      bash -c "apt-get update && 
               apt-get install -y ttyd && 
               ttyd -p 7681 bash"
  
  backend:
    build: .
    ports:
      - "3001:3001"
    depends_on:
      - kali

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
```

Then start:

```bash
docker-compose up
```

### Option 3: Manual Docker Run

```bash
docker run -it -p 7681:7681 kalilinux/kali-linux-docker bash -c "apt-get update && apt-get install -y ttyd && ttyd -p 7681 bash"
```

## 🚀 How It Works

### User Flow:

```
1. User types message in chat input
   ↓
2. Clicks send or presses Enter
   ↓
3. First message triggers sidebar
   ↓
4. Center area switches from animations to Kali terminal
   ↓
5. Terminal displays via iframe at http://localhost:7681
   ↓
6. User can interact with terminal in real-time
```

### Architecture:

```
┌─────────────────────────────────────┐
│  React Frontend (port 3000)         │
│  ┌──────────────┐                   │
│  │ Chat Sidebar │   Center Area     │
│  │              │   ┌─────────────┐ │
│  │   Messages   │   │   Terminal  │ │
│  │   + Input    │   │  (Kali)     │ │
│  └──────────────┘   └─────────────┘ │
└─────────────────────────────────────┘
           ↓ (iframe to http://localhost:7681)
┌─────────────────────────────────────┐
│  ttyd Web Terminal (port 7681)      │
│  ┌─────────────────────────────────┐│
│  │  Kali Linux Terminal            ││
│  │  $ _                            ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
           ↓ (Docker exec)
┌─────────────────────────────────────┐
│  Kali Docker Container              │
│  └─────────────────────────────────┐│
│  │ Bash Shell (root access)        ││
│  │ All Kali tools available        ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

## 🎯 Features

✅ **Real-time Terminal** - Full bash access  
✅ **Web-based** - No SSH required  
✅ **Full Color Support** - Beautiful terminal output  
✅ **Copy/Paste** - Full clipboard support  
✅ **Responsive** - Adjustable via sidebar resize  
✅ **Multiple Sessions** - Open multiple terminals  

## 🧪 Testing

### Quick Test:

1. Start the application
2. Send your first chat message
3. Right sidebar appears with chat
4. Center area shows Kali terminal
5. Try commands:
   ```bash
   whoami
   pwd
   ls -la
   neofetch
   ```

### If Terminal Doesn't Load:

Check these:

```bash
# 1. Check if ttyd is running
docker ps | grep kali

# 2. Check if port 7681 is open
netstat -an | grep 7681

# 3. Test directly
curl http://localhost:7681

# 4. Check logs
docker logs <kali_container_name>

# 5. Restart ttyd
docker exec <kali_container_name> killall ttyd
docker exec <kali_container_name> ttyd -p 7681 bash
```

## 🔧 Customization

### Change Terminal Port

Edit `app/page.tsx`:

```jsx
// Change from 7681 to your desired port
src="http://localhost:7681"
// to
src="http://localhost:YOUR_PORT"
```

### Change Terminal Size

The terminal automatically fills the available space. To adjust styling:

```jsx
<iframe
  src="http://localhost:7681"
  className="w-full h-full" // Adjust width/height here
  style={{ backgroundColor: '#000000' }}
/>
```

### Use Different Terminal Software

Instead of ttyd, you can use:

- **shellinabox** - Similar web terminal
- **Wetty** - Another web terminal
- **Custom Node.js backend** - WebSocket-based terminal

## ⚡ Advanced: Using Docker Exec for Terminal

If you prefer not to use ttyd, you can create a custom WebSocket backend:

### Backend (Node.js):

```javascript
const express = require('express');
const expressWs = require('express-ws');
const { exec } = require('child_process');
const pty = require('node-pty');

const app = express();
expressWs(app);

// WebSocket endpoint for terminal
app.ws('/terminal', (ws, req) => {
  const shell = pty.spawn('bash', [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
  });

  shell.onData(data => {
    ws.send(data);
  });

  ws.on('message', (msg) => {
    shell.write(msg);
  });
});

app.listen(7681);
```

### Frontend (React with xterm.js):

```typescript
import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';

const TerminalComponent = () => {
  const terminalRef = useRef(null);

  useEffect(() => {
    const term = new Terminal();
    term.open(terminalRef.current);

    const ws = new WebSocket('ws://localhost:7681/terminal');
    
    ws.onmessage = (event) => {
      term.write(event.data);
    };

    term.onData((data) => {
      ws.send(data);
    });
  }, []);

  return <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />;
};
```

## 📚 ttyd Documentation

For more ttyd options and configurations:
- GitHub: https://github.com/tsl0922/ttyd
- Full options: `ttyd --help`

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Terminal shows blank | Check if ttyd is running: `docker ps` |
| "Connection refused" | Ensure port 7681 is exposed and ttyd is listening |
| Terminal slow | Reduce terminal size or check network |
| Commands don't execute | Check bash is available in container |
| Copy/paste not working | Check browser clipboard permissions |

## ✅ Verification Checklist

- [ ] Kali container is running
- [ ] ttyd is installed in container
- [ ] Port 7681 is exposed
- [ ] ttyd is listening on port 7681
- [ ] Frontend can reach http://localhost:7681
- [ ] Chat message triggers sidebar
- [ ] Terminal displays in center area
- [ ] Terminal is interactive

## 🎉 Success!

When working correctly, you'll see:
1. Chat sidebar on the right with your messages
2. Kali Linux terminal in the center with a header showing "Kali Linux Terminal"
3. Full bash access with all Kali tools available
4. Ability to resize the sidebar to adjust terminal view

---

**Enjoy your integrated Kali terminal!** 🖥️ 🔓

For issues or questions, check the troubleshooting section above.



