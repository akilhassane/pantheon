# n8n Workflows 🔄

This directory contains pre-built n8n workflows for **MCP-Pentest-Forge**.

## Available Workflows

### workflow-iterative.json

**Autonomous AI Pentesting Workflow**

An intelligent, iterative workflow that:
- Accepts natural language pentesting requests
- Generates appropriate commands using AI
- Executes them in Kali Linux
- Analyzes results and decides next steps
- Continues until task is complete
- Returns comprehensive findings

#### Features

✅ **Iterative execution** - Commands run one at a time  
✅ **AI reflection** - Analyzes results after each command  
✅ **Auto-chaining** - Automatically chains commands  
✅ **Smart stopping** - Knows when task is complete  
✅ **Command history** - Tracks all executed commands  
✅ **Error handling** - Gracefully handles failures  

#### How It Works

```
User Query → Initialize State → Generate Command → Execute in Kali
                    ↑                                      ↓
                Loop Back ← Decision ← Reflect ← Extract Results
                    ↓
                Final Answer
```

#### Prerequisites

1. **n8n installed** - [See n8n setup guide](../docs/N8N_INTEGRATION.md)
2. **MCP-Pentest-Forge running** with HTTP mode enabled
3. **OpenAI API key** - Or compatible LLM provider

#### Quick Setup

1. **Import workflow**
   - Open n8n
   - Click "+" → "Import from File"
   - Select `workflow-iterative.json`

2. **Configure OpenAI credentials**
   - Settings → Credentials → Add Credential
   - Select "OpenAI"
   - Enter your API key
   - Save as "OpenAi account"

3. **Update MCP Server URL**
   - Open "Execute Command" node
   - Update URL to your MCP server:
     - Local: `http://localhost:3000/api/tools/kali_execute`
     - ngrok: `https://your-subdomain.ngrok-free.app/api/tools/kali_execute`
     - Remote: `http://your-server-ip:3000/api/tools/kali_execute`

4. **Activate workflow**
   - Click "Active" toggle in top-right
   - Workflow is now listening

5. **Test it**
   - Click "Test Workflow"
   - Select "When chat message received"
   - Send a message: "What is my username and IP?"
   - Watch the magic happen!

#### Configuration Options

**Max Iterations** (in "Initialize State" node):
```javascript
maxIterations: 5  // Adjust for task complexity
```

**AI Models** (in OpenAI Chat Model nodes):
- **Budget**: gpt-3.5-turbo
- **Balanced**: gpt-4-turbo-mini
- **Best**: gpt-4

**Timeout Settings**:
- Default: Each command times out after workflow timeout
- Long scans: Run in background with `&` or redirect to file

#### Example Use Cases

**Network Discovery**
```
"Discover all devices on my local network"

→ Executes: nmap -sn 192.168.1.0/24
→ Finds: 5 hosts
→ Executes: nmap -sV on each host
→ Returns: Comprehensive network map
```

**Vulnerability Assessment**
```
"Check if example.com has any vulnerabilities"

→ Executes: nmap -sV example.com
→ Executes: nmap --script vuln example.com
→ Executes: nikto -h http://example.com
→ Returns: Detailed vulnerability report
```

**Multi-Step Enumeration**
```
"Find all SMB shares on my network"

→ Executes: nmap -p 445 192.168.1.0/24
→ Finds: 3 hosts with SMB
→ Executes: enum4linux on each host
→ Returns: All accessible shares
```

#### Troubleshooting

**Workflow errors**
- Check MCP containers are running: `docker ps`
- Verify HTTP mode enabled: `curl http://localhost:3000/`
- Check OpenAI API key is valid

**Commands fail**
- Test command directly: `docker exec kali-pentest <command>`
- Check command syntax in prompts
- Review error in workflow execution log

**Infinite loops**
- Verify maxIterations is set
- Check Reflection Agent prompts
- Review Decision Logic node

**Slow execution**
- Use faster AI models (gpt-3.5-turbo)
- Reduce context in prompts
- Check network latency

#### Customization

**Add custom tools**
- Edit "Command Generator Agent" prompts
- Add tool-specific instructions
- Include usage examples

**Change iteration limit**
- Edit "Initialize State" node
- Increase `maxIterations` for complex tasks
- Add explicit stop conditions

**Add notifications**
- Add "Send Email" or "Slack" nodes
- Connect to "Return Final Answer"
- Get notified when scans complete

**Add logging**
- Insert "Set" nodes for debugging
- Log state at each step
- Track performance metrics

#### Advanced Features

**Background scans**
```
Command: nmap -sV 192.168.1.0/24 > /tmp/scan.txt 2>&1 &
Check later: cat /tmp/scan.txt
```

**Output to files**
```
Command: nmap -sV target -oN /tmp/scan.txt
Retrieve: cat /tmp/scan.txt
```

**Multiple targets**
Modify "Initialize State" to accept target lists

**Webhook triggers**
Replace chat trigger with webhook for API access

#### Security Considerations

⚠️ **Important Security Notes**

1. **Never expose without authentication**
   - Enable n8n basic auth
   - Use API keys
   - Restrict network access

2. **Authorized testing only**
   - Only scan authorized targets
   - Add target whitelist validation
   - Log all executions

3. **API cost monitoring**
   - OpenAI API calls cost money
   - Monitor usage in OpenAI dashboard
   - Set spending limits

4. **Rate limiting**
   - Add rate limits to prevent abuse
   - Implement request queuing
   - Monitor execution frequency

## Creating Your Own Workflows

### Basic Workflow Structure

```
Trigger → Execute Command → Process Results → Response
```

### Example: Simple Command Executor

```json
{
  "nodes": [
    {
      "type": "webhook",
      "parameters": {
        "path": "execute"
      }
    },
    {
      "type": "httpRequest",
      "parameters": {
        "url": "http://localhost:3000/api/tools/kali_execute",
        "method": "POST",
        "body": {
          "arguments": {
            "command": "={{ $json.command }}"
          }
        }
      }
    },
    {
      "type": "respondToWebhook",
      "parameters": {
        "response": "={{ $json.result }}"
      }
    }
  ]
}
```

### Example: Scheduled Network Scan

```
Cron Trigger (daily) → Execute nmap scan → Save results → Email report
```

### Example: Multi-Target Scanner

```
Webhook with target list → Loop through targets → Execute scan on each → Aggregate results
```

## Contributing Workflows

Have a useful workflow? Share it!

1. Export your workflow from n8n
2. Add it to this directory
3. Document it in this README
4. Submit a pull request

**Workflow naming convention:**
- `workflow-description.json`
- Include version if applicable: `workflow-description-v2.json`

## Documentation

- **Full integration guide**: [n8n Integration Guide](../docs/N8N_INTEGRATION.md)
- **API documentation**: [API Reference](../docs/API_REFERENCE.md)
- **Remote access**: [Remote Access Guide](../docs/REMOTE_ACCESS.md)

## Support

- **Issues**: [GitHub Issues](https://github.com/akilhassane/mcp-pentest-forge/issues)
- **Discussions**: [GitHub Discussions](https://github.com/akilhassane/mcp-pentest-forge/discussions)

---

**Happy automating! 🤖**

