# n8n Integration Guide 🔄

Complete guide to integrating **MCP-Pentest-Forge** with n8n for automated pentesting workflows.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Importing the Workflow](#importing-the-workflow)
- [Configuration](#configuration)
- [Using the Workflow](#using-the-workflow)
- [Workflow Architecture](#workflow-architecture)
- [Customization](#customization)
- [Troubleshooting](#troubleshooting)

## Overview

The n8n integration enables:
- **Automated pentesting workflows** triggered by chat messages
- **Iterative command execution** with AI reflection
- **Multi-step reconnaissance** automatically chaining commands
- **Remote access** via HTTP API
- **Web-based interface** for pentesting operations

### What You'll Build

An autonomous AI agent that:
1. Receives natural language pentesting requests
2. Generates appropriate commands
3. Executes them in Kali Linux
4. Analyzes results and decides next steps
5. Continues until task is complete
6. Returns comprehensive findings

## Prerequisites

### Required

1. **MCP-Pentest-Forge** containers running
   ```bash
   docker-compose up -d
   ```

2. **n8n** installed
   - Self-hosted: [n8n Installation Guide](https://docs.n8n.io/hosting/)
   - Cloud: [n8n Cloud](https://n8n.io/cloud/)
   - Docker: 
     ```bash
     docker run -it --rm \
       --name n8n \
       -p 5678:5678 \
       -v ~/.n8n:/home/node/.n8n \
       n8nio/n8n
     ```

3. **OpenAI API Key**
   - Get from: [OpenAI Platform](https://platform.openai.com/api-keys)
   - Or use alternative LLM providers

### Optional

- **ngrok** for remote access (see [ngrok Setup Guide](NGROK_SETUP.md))

## Setup

### Step 1: Enable HTTP Mode

MCP-Pentest-Forge needs HTTP mode for n8n communication.

1. Create `.env` file in project root:
   ```bash
   cd mcp-pentest-forge
   cat > .env << 'EOF'
   # Enable HTTP API
   HTTP_PORT=3000
   EOF
   ```

2. Restart containers:
   ```bash
   docker-compose restart
   ```

3. Verify HTTP endpoint:
   ```bash
   # Test basic connectivity
   curl http://localhost:3000/
   
   # Should return: {"status":"ok","message":"MCP Pentest Forge API"}
   
   # List available tools
   curl http://localhost:3000/api/tools
   ```

### Step 2: Set Up n8n

#### Option A: Docker (Recommended)

```bash
# Create persistent data directory
mkdir -p ~/.n8n

# Run n8n
docker run -d \
  --name n8n \
  --network host \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n

# Access n8n at http://localhost:5678
```

#### Option B: npm

```bash
# Install globally
npm install -g n8n

# Run n8n
n8n start

# Access at http://localhost:5678
```

#### Option C: n8n Cloud

Sign up at [n8n.io/cloud](https://n8n.io/cloud) (easiest option for remote access)

### Step 3: Configure OpenAI Credentials

1. Open n8n: `http://localhost:5678`
2. Click on your profile (bottom left)
3. Go to **Settings** → **Credentials**
4. Click **Add Credential**
5. Select **OpenAI**
6. Enter your API key
7. Save as "OpenAi account"

## Importing the Workflow

### Method 1: Import from File

1. In n8n, click **"+" → "Import from File"**
2. Select `workflows/workflow-iterative.json` from the repository
3. Click **Import**

### Method 2: Copy-Paste JSON

1. Open `workflows/workflow-iterative.json` in a text editor
2. Copy the entire contents
3. In n8n, click **"+" → "Import from URL or JSON"**
4. Paste the JSON
5. Click **Import**

### Method 3: Download from GitHub

```bash
# Download the workflow
curl -O https://raw.githubusercontent.com/akilhassane/mcp-pentest-forge/master/workflows/workflow-iterative.json

# Then import via n8n interface
```

## Configuration

### Update MCP Server URL

After importing, update the HTTP Request node:

1. Open the workflow
2. Find the **"Execute Command"** node
3. Update the URL:
   - **Local**: `http://localhost:3000/api/tools/kali_execute`
   - **ngrok**: `https://your-subdomain.ngrok-free.app/api/tools/kali_execute`
   - **Remote**: `http://your-server-ip:3000/api/tools/kali_execute`

### Configure Workflow Settings

1. **Max Iterations** (in "Initialize State" node):
   ```javascript
   maxIterations: 5  // Adjust based on task complexity
   ```

2. **AI Model** (in OpenAI Chat Model nodes):
   - Default: `gpt-4-turbo-mini`
   - For better results: `gpt-4` or `gpt-4-turbo`
   - For cost savings: `gpt-3.5-turbo`

3. **ngrok Headers** (if using ngrok):
   ```json
   {
     "ngrok-skip-browser-warning": "true"
   }
   ```

## Using the Workflow

### Activate the Workflow

1. Click **"Active"** toggle in top-right
2. The workflow is now listening for chat messages

### Test Execution

#### Method 1: Manual Test

1. Click **"Test Workflow"** button
2. Click on **"When chat message received"** node
3. Click **"Listen for test event"**
4. In the test chat, type: "What is my username and IP address?"
5. Watch the workflow execute step-by-step

#### Method 2: Production Chat

1. Click **"Test Workflow"** → **"Copy production URL"**
2. Open the URL in a browser
3. Chat interface appears
4. Type your pentesting request
5. AI agent executes commands and returns results

### Example Commands

Try these natural language commands:

```
Simple Commands:
- "What is my current username?"
- "Show me my IP address"
- "List all network interfaces"

Network Discovery:
- "Discover all devices on my local network"
- "Find all open ports on 192.168.1.1"
- "Scan for web servers on my network"

Security Testing:
- "Test example.com for open ports"
- "Find subdomains of example.com"
- "Check if SSH is running on 192.168.1.100"

Multi-Step Tasks:
- "Enumerate all services on 192.168.1.0/24"
- "Find all devices with port 445 open and list SMB shares"
- "Discover hosts then scan each for vulnerabilities"
```

## Workflow Architecture

### Node Overview

```
1. [When chat message received] - Webhook trigger
   ↓
2. [Initialize State] - Set up iteration tracking
   ↓
3. [Command Generator Agent] - AI generates next command
   ↓
4. [Execute Command] - HTTP call to MCP-Pentest-Forge
   ↓
5. [Extract Command Results] - Parse output
   ↓
6. [Update Command History] - Track executed commands
   ↓
7. [Reflection Agent] - Decide if task is complete
   ↓
8. [Decision Logic] - Should continue or finish?
   ↓
   ├─→ [Loop Back] - Continue (more commands needed)
   └─→ [Return Final Answer] - Done (task complete)
```

### Key Components

#### 1. Iterative Loop
- Executes commands one at a time
- AI reflects on results after each command
- Automatically chains commands until goal is achieved
- Max iterations prevent infinite loops

#### 2. Command History
- Tracks all executed commands
- Stores outputs and status
- Used by AI to make informed decisions

#### 3. Reflection Agent
- Analyzes command results
- Determines if user's goal is achieved
- Decides whether to continue or finish

#### 4. State Management
- Maintains context across iterations
- Tracks progress and results
- Enables complex multi-step workflows

## Customization

### Adjust Iteration Limit

Edit **"Initialize State"** node:

```javascript
return {
  json: {
    chatInput: chatInput,
    originalQuery: chatInput,
    iteration: 0,
    maxIterations: 10,  // Increase for complex tasks
    // ...
  }
};
```

### Change AI Model

Edit **"OpenAI Chat Model"** nodes:

- **Command Generator**: Faster model for command generation
- **Reflection Agent**: Smarter model for decision-making
- **Extract Results**: Can use cheaper model

Recommended combinations:
- **Budget**: GPT-3.5-Turbo for all
- **Balanced**: GPT-4-Turbo-Mini for all
- **Best Results**: GPT-4 for reflection, GPT-4-Turbo-Mini for others

### Add Custom System Prompts

Edit Agent nodes to customize behavior:

```javascript
options: {
  systemMessage: "You are a network security expert specializing in..."
}
```

### Add Error Handling

Add an **"Error Trigger"** node to catch failures:

1. Add node: **"Error Trigger"**
2. Connect to **"Send Email"** or **"Slack"** node
3. Configure notifications for workflow errors

### Add Logging

Insert **"Set"** or **"Code"** nodes to log state:

```javascript
console.log('Current iteration:', $json.iteration);
console.log('Command history:', $json.commandHistory);
return $input.all();
```

## Advanced Features

### Remote Access via ngrok

See [ngrok Setup Guide](NGROK_SETUP.md) for detailed instructions.

Quick setup:
```bash
# Start ngrok
ngrok http 3000

# Update workflow URL to ngrok address
# Now accessible from anywhere!
```

### Webhook Integration

Trigger pentesting workflows from:
- **Slack**: `/pentest scan 192.168.1.0/24`
- **Discord**: `!pentest whoami`
- **Telegram**: `/scan target.com`
- **Custom apps**: POST to webhook URL

### Scheduled Scans

Add **"Cron"** node to schedule regular scans:

```
Cron: 0 2 * * *  # Daily at 2 AM
↓
[Set Command] → [Execute Workflow]
```

### Multi-Target Scanning

Modify workflow to accept target lists:

```javascript
// In Initialize State
const targets = ['192.168.1.1', '192.168.1.100', '192.168.1.254'];
return {
  json: {
    targets: targets,
    currentTarget: 0,
    // ...
  }
};
```

## Troubleshooting

### Workflow Errors

**Issue**: "Could not connect to server"

**Solutions**:
1. Verify MCP containers are running: `docker ps`
2. Check HTTP mode is enabled: `curl http://localhost:3000/`
3. Update URL in "Execute Command" node
4. If using ngrok, verify tunnel is active

---

**Issue**: "OpenAI API error"

**Solutions**:
1. Verify API key is correct
2. Check API quota/billing
3. Try a different model
4. Check OpenAI status page

---

**Issue**: "Workflow times out"

**Solutions**:
1. Increase workflow timeout in n8n settings
2. Reduce maxIterations
3. Use faster AI models
4. Optimize command execution

### Command Execution Issues

**Issue**: Commands return errors

**Solutions**:
1. Test command directly in Kali: `docker exec kali-pentest <command>`
2. Check command syntax in "Command Generator" prompts
3. Add error handling in "Extract Command Results"

---

**Issue**: Infinite loops

**Solutions**:
1. Check maxIterations is set correctly
2. Review Reflection Agent prompts
3. Add explicit stop conditions in Decision Logic

### Performance Issues

**Issue**: Slow execution

**Solutions**:
1. Use faster AI models (gpt-3.5-turbo)
2. Reduce context in prompts
3. Run n8n and MCP on same machine
4. Increase n8n worker processes

## Best Practices

### Security

1. **Never expose without authentication**
   - Enable n8n basic auth or OAuth
   - Use API keys for webhooks
   - Restrict network access

2. **Sanitize inputs**
   - Validate user commands
   - Prevent command injection
   - Log all executions

3. **Authorized testing only**
   - Only scan authorized targets
   - Add target whitelist validation
   - Include disclaimers in chat interface

### Optimization

1. **Efficient prompts**
   - Be specific in system messages
   - Provide clear examples
   - Keep context concise

2. **Smart iteration**
   - Start with low maxIterations
   - Increase only if needed
   - Use early stopping logic

3. **Resource management**
   - Monitor API costs
   - Set execution limits
   - Cache common results

## Examples

### Example 1: Network Discovery Workflow

```
User: "Find all devices on my network"

Iteration 1:
Command: nmap -sn 192.168.1.0/24
Result: Found 5 hosts

Iteration 2:
Command: nmap -sV 192.168.1.1
Result: Router, ports 80, 443 open

Iteration 3-5:
Commands: nmap -sV [remaining hosts]

Final Answer: Network scan complete. Found 5 devices:
- 192.168.1.1: Router (HTTP, HTTPS)
- 192.168.1.100: Web server (HTTP, SSH)
...
```

### Example 2: Vulnerability Assessment

```
User: "Check if 192.168.1.100 has any vulnerabilities"

Iteration 1:
Command: nmap -sV 192.168.1.100
Result: SSH, HTTP, MySQL open

Iteration 2:
Command: nmap --script vuln 192.168.1.100
Result: Outdated SSH version detected

Iteration 3:
Command: nikto -h http://192.168.1.100
Result: Missing security headers

Final Answer: Found 2 vulnerabilities:
1. Outdated SSH (CVE-2023-XXXX)
2. Missing HTTP security headers
```

## Next Steps

- **Remote access**: [Remote Access Guide](REMOTE_ACCESS.md)
- **Expose to internet**: [ngrok Setup Guide](NGROK_SETUP.md)
- **API details**: [API Reference](API_REFERENCE.md)
- **Video tutorials**: [YouTube Resources](YOUTUBE_RESOURCES.md)

---

**Happy automating! 🤖⚡**

