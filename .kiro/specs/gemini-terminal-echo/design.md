# Design Document: Gemini Terminal Command Echo

## Overview

This design addresses the terminal command visibility issue where Gemini AI successfully executes commands through Desktop Commander MCP, but users cannot see what commands are being executed in the browser terminal. The solution involves intercepting MCP tool calls in the backend and echoing the command text to the terminal WebSocket before execution.

The key insight is that the backend already has a WebSocket connection to broadcast terminal updates to the frontend. We'll leverage this to send command text directly to the terminal display, making AI actions transparent to the user.

## Architecture

### Current Flow (Commands Not Visible)

```
User Message → Backend → Gemini AI → MCP Tool Call → Desktop Commander MCP → Execute Command
                                                                                    ↓
                                                                            Output appears in terminal
                                                                            (but command text doesn't)
```

### Desired Flow (Commands Visible)

```
User Message → Backend → Gemini AI → MCP Tool Call → Backend Intercepts
                                                            ↓
                                                    Echo to Terminal WebSocket
                                                            ↓
                                                    Command appears in terminal
                                                            ↓
                                                    Desktop Commander MCP → Execute Command
                                                            ↓
                                                    Output appears in terminal
```

### Why This Works

1. **Desktop Commander MCP** executes commands in a bash session but doesn't write to the terminal display
2. **The terminal (ttyd/GoTTY)** displays whatever is written to its WebSocket
3. **The backend** can write to the terminal WebSocket to make commands visible
4. **By echoing before execution**, we simulate the appearance of typing the command

## Components and Interfaces

### 1. Backend Server (backend/server.js)

**Current State:**
- Has WebSocket server for frontend communication
- Has `broadcastToFrontend()` function
- Has `handleMCPToolCall()` function that calls MCP tools
- Already configured to use gotty-direct-writer.js

**Required Changes:**
- Add `echoCommandToTerminal()` function
- Modify `handleMCPToolCall()` to echo commands before execution
- Add command extraction logic for different tool types

### 2. Command Echo Function

**New Function: `echoCommandToTerminal(command)`**

```javascript
/**
 * Echo a command to the terminal to make it visible
 * @param {string} command - The command to display
 * @returns {Promise<boolean>} - True if echo succeeded
 */
async function echoCommandToTerminal(command) {
  if (!command || typeof command !== 'string') {
    console.warn('⚠️  Invalid command for echo:', command);
    return false;
  }

  try {
    console.log('🖥️  Echoing command to terminal:', command);

    // Broadcast to frontend clients (which includes terminal display)
    broadcastToFrontend({
      type: 'command_echo',
      command: command,
      timestamp: Date.now()
    });

    console.log('✅ Command echoed successfully');
    return true;

  } catch (error) {
    console.error('❌ Failed to echo command:', error.message);
    return false;
  }
}
```

**Design Decisions:**
- **Async function**: Allows for future enhancements like waiting for confirmation
- **Returns boolean**: Indicates success/failure for logging
- **Uses existing broadcast**: Leverages established WebSocket infrastructure
- **Includes timestamp**: Helps with debugging and ordering
- **Graceful failure**: Logs error but doesn't throw

### 3. Command Extraction Logic

**New Function: `extractCommandFromToolCall(toolName, args)`**

```javascript
/**
 * Extract the command text from an MCP tool call
 * @param {string} toolName - Name of the MCP tool
 * @param {object} args - Tool arguments
 * @returns {string|null} - The command to echo, or null if not applicable
 */
function extractCommandFromToolCall(toolName, args) {
  // Tools that execute commands
  const commandTools = {
    'start_process': 'command',
    'interact_with_process': 'input',
    'execute_command': 'command',
    'mcp_desktop_commander_start_process': 'command',
    'mcp_desktop_commander_interact_with_process': 'input'
  };

  const argName = commandTools[toolName];
  if (!argName) {
    // Not a command execution tool
    return null;
  }

  const command = args[argName];
  if (!command || typeof command !== 'string') {
    console.warn(`⚠️  Tool ${toolName} called without valid ${argName}`);
    return null;
  }

  return command;
}
```

**Design Decisions:**
- **Whitelist approach**: Only echo for known command execution tools
- **Flexible mapping**: Different tools use different parameter names
- **Null for non-commands**: Tools like read_file don't need echo
- **Validation**: Ensures command is a valid string

### 4. Modified Tool Call Handler

**Updated Function: `handleMCPToolCall(toolCall)`**

```javascript
async function handleMCPToolCall(toolCall) {
  const { name, args } = toolCall;
  const startTime = Date.now();

  console.log(`\n🔧 ========== MCP TOOL CALL START ==========`);
  console.log(`   Tool: ${name}`);
  console.log(`   Arguments:`, JSON.stringify(args, null, 2));

  try {
    // Extract command if this is a command execution tool
    const command = extractCommandFromToolCall(name, args);

    // Echo command to terminal before execution
    if (command) {
      console.log(`📢 Command detected, echoing to terminal...`);
      await echoCommandToTerminal(command);
    } else {
      console.log(`ℹ️  Tool ${name} does not execute commands, skipping echo`);
    }

    // Check if MCP client is connected
    if (!mcpClient.isClientConnected()) {
      const error = new Error('MCP client not connected');
      console.error(`❌ Connection check failed: ${error.message}`);
      throw error;
    }

    console.log(`✅ MCP client is connected, calling tool...`);

    // Call the tool through MCP client
    const result = await mcpClient.callTool(name, args);

    // ... rest of existing code ...
  } catch (error) {
    // ... existing error handling ...
  }
}
```

**Design Decisions:**
- **Echo before execution**: Command appears before output
- **Conditional echo**: Only for command execution tools
- **Non-blocking**: Uses await but doesn't fail on echo errors
- **Detailed logging**: Helps with debugging

### 5. Frontend Terminal Display

**Current State:**
- Frontend receives WebSocket messages
- Terminal component displays output

**Required Changes:**
- Handle `command_echo` message type
- Display command with appropriate formatting
- Distinguish command from output visually

**Frontend Component Update:**

```javascript
// In terminal component WebSocket message handler
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'command_echo') {
    // Display command with prompt styling
    displayCommandInTerminal(data.command);
  } else if (data.type === 'output') {
    // Display output normally
    displayOutputInTerminal(data.text);
  }
};

function displayCommandInTerminal(command) {
  // Add command to terminal with prompt
  const promptElement = document.createElement('div');
  promptElement.className = 'terminal-command';
  promptElement.textContent = `# ${command}`;
  terminalElement.appendChild(promptElement);
}
```

**Design Decisions:**
- **Separate message type**: Distinguishes commands from output
- **Prompt prefix**: Makes commands visually distinct
- **CSS styling**: Can style commands differently from output

## Data Models

### WebSocket Message Format

**Command Echo Message:**
```json
{
  "type": "command_echo",
  "command": "whoami",
  "timestamp": 1234567890
}
```

**Output Message (existing):**
```json
{
  "type": "output",
  "text": "root\n",
  "timestamp": 1234567890
}
```

### Tool Call Mapping

```javascript
{
  "start_process": {
    "commandParam": "command",
    "example": { "command": "ls -la", "timeout_ms": 30000 }
  },
  "interact_with_process": {
    "commandParam": "input",
    "example": { "pid": 123, "input": "echo hello" }
  },
  "execute_command": {
    "commandParam": "command",
    "example": { "command": "pwd" }
  }
}
```

## Error Handling

### Echo Failures

**Scenario 1: WebSocket Disconnected**
```javascript
// In echoCommandToTerminal()
if (frontendClients.size === 0) {
  console.warn('⚠️  No frontend clients connected, command will not be visible');
  return false; // Don't fail, just log
}
```

**Scenario 2: Invalid Command**
```javascript
// In extractCommandFromToolCall()
if (!command || typeof command !== 'string') {
  console.warn(`⚠️  Invalid command for tool ${toolName}`);
  return null; // Return null, don't throw
}
```

**Scenario 3: Broadcast Error**
```javascript
// In echoCommandToTerminal()
try {
  broadcastToFrontend({ type: 'command_echo', command });
} catch (error) {
  console.error('❌ Broadcast failed:', error.message);
  return false; // Log but don't throw
}
```

### Graceful Degradation

**Principle:** Command execution should never fail because of echo failures.

```javascript
// In handleMCPToolCall()
try {
  if (command) {
    await echoCommandToTerminal(command);
  }
} catch (echoError) {
  // Log but continue
  console.error('Echo failed, continuing with execution:', echoError);
}

// Always proceed to tool execution
const result = await mcpClient.callTool(name, args);
```

## Testing Strategy

### Unit Tests

**Test 1: Command Extraction**
```javascript
describe('extractCommandFromToolCall', () => {
  it('should extract command from start_process', () => {
    const command = extractCommandFromToolCall('start_process', {
      command: 'ls -la',
      timeout_ms: 30000
    });
    expect(command).toBe('ls -la');
  });

  it('should extract input from interact_with_process', () => {
    const command = extractCommandFromToolCall('interact_with_process', {
      pid: 123,
      input: 'echo hello'
    });
    expect(command).toBe('echo hello');
  });

  it('should return null for non-command tools', () => {
    const command = extractCommandFromToolCall('read_file', {
      path: '/etc/passwd'
    });
    expect(command).toBeNull();
  });
});
```

**Test 2: Echo Function**
```javascript
describe('echoCommandToTerminal', () => {
  it('should broadcast command to frontend', async () => {
    const broadcastSpy = jest.spyOn(global, 'broadcastToFrontend');
    await echoCommandToTerminal('whoami');
    expect(broadcastSpy).toHaveBeenCalledWith({
      type: 'command_echo',
      command: 'whoami',
      timestamp: expect.any(Number)
    });
  });

  it('should handle invalid commands gracefully', async () => {
    const result = await echoCommandToTerminal(null);
    expect(result).toBe(false);
  });
});
```

### Integration Tests

**Test 1: End-to-End Command Visibility**
```javascript
// test-command-visibility.cjs
const WebSocket = require('ws');

async function testCommandVisibility() {
  // Connect to backend WebSocket
  const ws = new WebSocket('ws://localhost:3002');

  // Listen for command echo
  ws.on('message', (data) => {
    const message = JSON.parse(data);
    if (message.type === 'command_echo') {
      console.log('✅ Command echo received:', message.command);
    }
  });

  // Send AI message that triggers command
  const response = await fetch('http://localhost:3002/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'run the command: whoami'
    })
  });

  // Wait for echo
  await new Promise(resolve => setTimeout(resolve, 2000));
}
```

**Test 2: Multiple Commands**
```javascript
async function testMultipleCommands() {
  const commands = ['whoami', 'pwd', 'ls -la'];

  for (const cmd of commands) {
    await sendAIMessage(`run: ${cmd}`);
    await waitForEcho(cmd);
  }

  console.log('✅ All commands echoed successfully');
}
```

### Manual Testing

**Test Procedure:**
1. Start all services: `docker-compose up`
2. Open browser to http://localhost:3000 (frontend)
3. Open browser to http://localhost:8081 (terminal)
4. Send message to AI: "run the command: whoami"
5. **Verify:** Command "whoami" appears in terminal
6. **Verify:** Output "root" appears after command
7. Send message: "run: ls -la"
8. **Verify:** Command "ls -la" appears in terminal
9. **Verify:** Directory listing appears after command

**Expected Visual Result:**
```
# whoami
root
# ls -la
total 48
drwxr-xr-x 1 root root 4096 Oct 29 12:00 .
drwxr-xr-x 1 root root 4096 Oct 29 12:00 ..
...
```

## Performance Considerations

### Echo Latency

**Target:** < 100ms per echo operation

**Optimization:**
- Use existing WebSocket connection (no new connections)
- Broadcast is synchronous (no network delay)
- No database or file I/O involved

**Measurement:**
```javascript
async function echoCommandToTerminal(command) {
  const startTime = Date.now();

  // ... echo logic ...

  const duration = Date.now() - startTime;
  if (duration > 100) {
    console.warn(`⚠️  Echo took ${duration}ms (target: <100ms)`);
  }
}
```

### Memory Impact

**Minimal:** No additional data structures or caching required

**WebSocket Message Size:**
- Command echo: ~50-200 bytes per message
- Negligible compared to output data

### CPU Impact

**Minimal:** Simple string operations and JSON serialization

## Security Considerations

### Command Injection

**Risk:** Malicious commands could be echoed to terminal

**Mitigation:**
- Echo is display-only, doesn't execute anything
- Actual execution is handled by Desktop Commander MCP with its own security
- No additional risk introduced by echo feature

### Information Disclosure

**Risk:** Commands might contain sensitive information

**Mitigation:**
- Commands are already visible in AI responses
- Terminal is only accessible to authenticated users
- No additional disclosure beyond existing system

### WebSocket Security

**Risk:** Unauthorized clients could receive command echoes

**Mitigation:**
- WebSocket server is on localhost only
- Frontend must be on same network
- Existing security model unchanged

## Deployment Considerations

### Prerequisites

1. Backend server running (backend/server.js)
2. Frontend connected to backend WebSocket
3. Desktop Commander MCP running in kali-pentest container
4. Terminal accessible at http://localhost:8081

### Deployment Steps

1. **Update backend/server.js**
   - Add `extractCommandFromToolCall()` function
   - Add `echoCommandToTerminal()` function
   - Modify `handleMCPToolCall()` to call echo

2. **Update frontend terminal component**
   - Add handler for `command_echo` message type
   - Add styling for command display

3. **Restart services**
   ```bash
   docker-compose restart ai-backend
   docker-compose restart frontend
   ```

4. **Test command visibility**
   - Send test command via AI
   - Verify command appears in terminal

### Rollback Plan

If echo causes issues:

1. **Remove echo call from handleMCPToolCall()**
   ```javascript
   // Comment out echo
   // if (command) {
   //   await echoCommandToTerminal(command);
   // }
   ```

2. **Restart backend**
   ```bash
   docker-compose restart ai-backend
   ```

3. **System returns to previous behavior**
   - Commands execute but aren't visible
   - No functional impact

## Alternative Approaches Considered

### Alternative 1: Modify Desktop Commander MCP

**Approach:** Add echo capability directly to Desktop Commander MCP

**Pros:**
- Centralized solution
- Works for all MCP clients

**Cons:**
- Requires modifying external dependency
- More complex to maintain
- Harder to customize per use case
- **Rejected:** We want to avoid modifying Desktop Commander MCP

### Alternative 2: Use gotty-direct-writer.js

**Approach:** Switch to gotty-direct-writer MCP server that writes directly to terminal

**Pros:**
- Purpose-built for terminal visibility
- No backend changes needed

**Cons:**
- Backend is already configured for this but it's not working
- May have other issues preventing visibility
- **Status:** Already attempted, not working reliably

### Alternative 3: Terminal Session Sharing

**Approach:** Have Desktop Commander MCP and terminal share the same PTY

**Pros:**
- True terminal integration
- Commands naturally visible

**Cons:**
- Complex PTY management
- Risk of terminal state corruption
- Difficult to implement
- **Rejected:** Too complex for the benefit

## Chosen Approach: Backend Echo Interception

**Rationale:**
- **Simple:** Minimal code changes in one file
- **Reliable:** Uses existing WebSocket infrastructure
- **Maintainable:** Easy to understand and debug
- **Flexible:** Can customize echo format and behavior
- **Safe:** Doesn't modify external dependencies
- **Testable:** Easy to unit test and integration test
- **Performant:** No additional latency or overhead

This approach gives us full control over command visibility while maintaining the existing architecture and not requiring changes to Desktop Commander MCP or the terminal infrastructure.
