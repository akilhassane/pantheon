# Pantheon Client Agent

This agent runs on client machines to execute Windows containers locally while connecting to the cloud-hosted Pantheon backend.

## Installation

### Prerequisites
- Docker Desktop installed and running
- Node.js 18+ installed

### Setup

1. Install dependencies:
```bash
npm install
```

2. Configure the agent:
```bash
cp .env.example .env
# Edit .env with your cloud backend URL and API key
```

3. Start the agent:
```bash
npm start
```

### Running as a Service

#### Windows (using NSSM)
```powershell
# Download NSSM from https://nssm.cc/download
nssm install PantheonAgent "C:\Program Files\nodejs\node.exe" "C:\path\to\agent.js"
nssm start PantheonAgent
```

#### Linux (systemd)
```bash
sudo cp pantheon-agent.service /etc/systemd/system/
sudo systemctl enable pantheon-agent
sudo systemctl start pantheon-agent
```

## How It Works

1. Agent connects to cloud backend via WebSocket
2. Cloud backend sends container commands to agent
3. Agent executes commands on local Docker
4. Results stream back to cloud
5. Users interact with cloud frontend, containers run locally

## Security

- All communication is encrypted (WSS)
- API key authentication required
- Only authorized commands executed
- Containers run in isolated environments
