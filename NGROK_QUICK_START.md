# ngrok Quick Start ⚡

**Get MCP-Pentest-Forge accessible from anywhere in 3 minutes!**

## Prerequisites

- MCP-Pentest-Forge containers running
- 3 minutes of your time

## Step 1: Install ngrok (1 minute)

### Windows
1. Download: [ngrok.com/download](https://ngrok.com/download)
2. Extract `ngrok.exe` to any folder

### macOS
```bash
brew install ngrok
```

### Linux
```bash
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok
```

## Step 2: Get Auth Token (30 seconds)

1. Sign up: [ngrok.com](https://ngrok.com)
2. Copy token: [dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Configure:

**Windows:**
```powershell
.\ngrok.exe config add-authtoken YOUR_TOKEN_HERE
```

**macOS/Linux:**
```bash
ngrok config add-authtoken YOUR_TOKEN_HERE
```

## Step 3: Enable HTTP Mode (30 seconds)

```bash
cd mcp-pentest-forge
echo "HTTP_PORT=3000" > .env
docker-compose restart
```

## Step 4: Start Tunnel (30 seconds)

**Windows:**
```powershell
.\ngrok.exe http 3000
```

**macOS/Linux:**
```bash
ngrok http 3000
```

## Step 5: Get Your URL (10 seconds)

Look for this line in the output:
```
Forwarding    https://abc123.ngrok-free.app -> http://localhost:3000
```

**Your public URL**: `https://abc123.ngrok-free.app`

## Step 6: Test It! (20 seconds)

From any device with internet:

```bash
curl https://YOUR-URL.ngrok-free.app/ \
  -H "ngrok-skip-browser-warning: true"
```

**✅ Done!** Your pentesting environment is now accessible globally!

## Use with n8n

Update your workflow's HTTP Request node URL to:
```
https://YOUR-URL.ngrok-free.app/api/tools/kali_execute
```

Add header:
```json
{
  "ngrok-skip-browser-warning": "true"
}
```

## Next Steps

- **Detailed setup**: [ngrok Setup Guide](docs/NGROK_SETUP.md)
- **n8n integration**: [n8n Integration Guide](docs/N8N_INTEGRATION.md)
- **Security tips**: [Remote Access Guide](docs/REMOTE_ACCESS.md)

---

**That's it! You're live! 🚀**

