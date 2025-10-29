# Command Echo Architecture

## Overview

This document describes the command echo feature that makes AI-executed commands visible in the terminal before they execute.

## Problem Statement

When Gemini AI executes commands through Desktop Commander MCP, the commands are executed successfully but are not visible in the browser terminal (ttyd). Users can only see the output, not the commands themselves, making it difficult to understand what the AI is doing.

## Solution Architecture

### Flow Diagram

```
User Message → Backend → Gemini AI → MCP Tool Call
                                          ↓
                                    Extract Command
                                          ↓
                                    Echo to Terminal
                                          ↓
                                    Execute via MCP
                                          ↓
                                    Return Output
```

### Components

#### 1. Command Extraction (`extractCommandFromToolCall`)

**Location:** `backend/server.js`

**Purpose:** Extracts the command text from MCP tool call arguments

**Supported Tools:**
- `start_process` → extracts `command` parameter
- `interact_with_process` → extracts `input` parameter
- `execute_command` → extracts `command` parameter
- `mcp_desktop_commander_start_process` → extracts `command` parameter
- `mcp_desktop_commander_interact_with_process` → extracts `input` parameter
- `write_command` → extracts `command` parameter
- `mcp_gotty_direct_writer_write_command` → extracts `command` parameter

**Returns:** Command string or `null` if not a command execution tool

#### 2. Terminal Echo (`echoCommandToTerminal`)

**Location:** `backend/server.js`

**Purpose:** Broadcasts command text to connected frontend clients

**Process:**
1. Validates command is a non-empty string
2. Checks if frontend clients are connected
3. Broadcasts `command_echo` message via WebSocket
4. Logs success/failure and timing

**Message Format:**
```json
{
  "type": "command_echo",
  "command": "whoami",
  "timestamp": 1234567890
}
```

**Performance:** Target < 100ms per echo operation

#### 3. MCP Tool Call Handler Integration

**Location:** `backend/server.js` → `handleMCPToolCall()`

**Integration Point:** Before MCP tool execution

**Process:**
1. Extract command from tool call arguments
2. If command exists, echo to terminal
3. Wrap echo in try-catch for graceful degradation
4. Proceed with MCP tool execution regardless of echo success

**Error Handling:** Echo failures are logged but don't block command execution

#### 4. Frontend WebSocket Client

**Location:** `frontend/lib/websocket-client.ts`

**Purpose:** Receives command echo messages from backend

**Event Type:** `command_echo` added to `WebSocketEventType`

**Usage:**
```typescript
wsClient.on('command_echo', (data) => {
  console.log('Command:', data.command);
  // Display in terminal UI
});
```

#### 5. Terminal Display Styling

**Location:** `frontend/styles/terminal-commands.css`

**Purpose:** Styles for displaying commands in terminal

**Key Styles:**
- `.terminal-command` - Bright green text with bold font
- `.terminal-command::before` - Adds `# ` prompt prefix
- `.terminal-command.new` - Fade-in animation for new commands

## Message Flow

### 1. User Sends Message

```
User: "run the command: whoami"
  ↓
Frontend → Backend /api/chat
```

### 2. Gemini Processes Message

```
Backend → Gemini API
  ↓
Gemini decides to call MCP tool
  ↓
Returns: functionCall { name: "start_process", args: { command: "whoami" } }
```

### 3. Backend Handles Tool Call

```
handleMCPToolCall(functionCall)
  ↓
extractCommandFromToolCall("start_process", { command: "whoami" })
  ↓
Returns: "whoami"
  ↓
echoCommandToTerminal("whoami")
  ↓
Broadcasts: { type: "command_echo", command: "whoami", timestamp: ... }
  ↓
mcpClient.callTool("start_process", { command: "whoami" })
  ↓
Returns: { output: "root\n" }
```

### 4. Frontend Receives Echo

```
WebSocket receives: { type: "command_echo", command: "whoami" }
  ↓
WebSocket client emits event
  ↓
Terminal component displays: "# whoami"
  ↓
(Output "root" appears from MCP execution)
```

## Configuration

### Environment Variables

None required - uses existing backend WebSocket server

### Backend Configuration

**WebSocket Server:** Created automatically with HTTP server on port 3002

**Frontend Clients:** Tracked in `frontendClients` Set

### Frontend Configuration

**WebSocket URL:** `ws://localhost:3002` (same as backend HTTP port)

**Auto-reconnect:** Enabled with exponential backoff

## Error Handling

### Echo Failures

**Scenario:** WebSocket disconnected, no clients connected, broadcast error

**Handling:**
- Log warning message
- Return `false` from `echoCommandToTerminal()`
- Continue with command execution
- Don't throw errors

**User Impact:** Commands execute but aren't visible (graceful degradation)

### Command Extraction Failures

**Scenario:** Invalid tool name, missing command parameter, empty command

**Handling:**
- Log warning message
- Return `null` from `extractCommandFromToolCall()`
- Skip echo step
- Continue with tool execution

**User Impact:** No echo for that specific tool call

### MCP Tool Call Failures

**Scenario:** MCP client disconnected, tool execution error

**Handling:**
- Echo still succeeds (command is visible)
- Tool execution fails with error message
- Error returned to Gemini and user

**User Impact:** Command visible but execution failed

## Performance Considerations

### Echo Latency

**Target:** < 100ms per echo operation

**Actual:** Typically 1-5ms (WebSocket broadcast is very fast)

**Monitoring:** Logged in `echoCommandToTerminal()` if > 100ms

### Memory Impact

**WebSocket Messages:** ~50-200 bytes per command echo

**Frontend Clients Set:** Minimal (typically 1-2 clients)

**No Caching:** Commands are not stored, only broadcast

### CPU Impact

**String Operations:** Minimal (trim, validation)

**JSON Serialization:** Minimal (small message size)

**WebSocket Broadcast:** O(n) where n = number of connected clients (typically 1-2)

## Security Considerations

### Command Injection

**Risk:** Malicious commands could be echoed to terminal

**Mitigation:**
- Echo is display-only, doesn't execute anything
- Actual execution handled by Desktop Commander MCP with its own security
- No additional risk introduced

### Information Disclosure

**Risk:** Commands might contain sensitive information

**Mitigation:**
- Commands already visible in AI responses
- Terminal only accessible to authenticated users
- WebSocket on localhost only

### WebSocket Security

**Risk:** Unauthorized clients could receive command echoes

**Mitigation:**
- WebSocket server on localhost only
- Frontend must be on same network
- No authentication bypass introduced

## Testing

### Unit Tests

**Command Extraction:**
- Test with `start_process` tool
- Test with `interact_with_process` tool
- Test with non-command tools
- Test with invalid arguments

**Echo Function:**
- Test successful broadcast
- Test with no connected clients
- Test with invalid commands
- Test timing/performance

### Integration Tests

**End-to-End:**
- Connect to backend WebSocket
- Send AI message that triggers command
- Verify `command_echo` message received
- Verify command text matches
- Verify timing (echo before execution)

**Multiple Commands:**
- Send message with multiple commands
- Verify all commands echoed
- Verify correct order

### Manual Testing

**Visual Verification:**
1. Start all services
2. Open frontend and terminal
3. Send AI message: "run the command: whoami"
4. Verify command appears in terminal before output
5. Verify output appears after command

## Troubleshooting

### Commands Not Visible

**Symptoms:** Commands execute but don't appear in terminal

**Possible Causes:**
1. Frontend WebSocket not connected
2. Backend not broadcasting echo messages
3. Terminal iframe not receiving messages

**Debugging:**
```bash
# Check backend logs for echo messages
grep "Echoing command" backend.log

# Check WebSocket connections
grep "Frontend client connected" backend.log

# Test WebSocket directly
node test-command-echo.cjs
```

### Echo Delays

**Symptoms:** Commands appear after execution completes

**Possible Causes:**
1. Network latency
2. WebSocket congestion
3. Frontend processing delay

**Debugging:**
```bash
# Check echo timing in logs
grep "Command echoed successfully" backend.log

# Monitor WebSocket latency
# (Check browser DevTools → Network → WS)
```

### Duplicate Commands

**Symptoms:** Same command appears multiple times

**Possible Causes:**
1. Multiple WebSocket connections
2. Echo called multiple times
3. Frontend displaying duplicates

**Debugging:**
```bash
# Check number of connected clients
grep "Frontend client connected" backend.log | wc -l

# Check for duplicate echo calls
grep "Echoing command" backend.log | sort | uniq -c
```

## Future Enhancements

### Potential Improvements

1. **Command History:** Store echoed commands for replay
2. **Command Filtering:** Allow users to hide certain commands
3. **Syntax Highlighting:** Color-code different command types
4. **Command Annotations:** Add metadata (timestamp, duration, status)
5. **Terminal Integration:** Write directly to ttyd PTY instead of WebSocket

### Known Limitations

1. **Iframe Isolation:** Terminal is in iframe, can't directly manipulate
2. **ttyd Integration:** No direct write to ttyd terminal session
3. **Command Timing:** Echo and execution are separate operations
4. **No Rollback:** Can't "un-echo" a command if execution fails

## References

### Related Files

- `backend/server.js` - Main implementation
- `frontend/lib/websocket-client.ts` - WebSocket client
- `frontend/styles/terminal-commands.css` - Terminal styling
- `.kiro/specs/gemini-terminal-echo/` - Specification documents

### Related Documentation

- Desktop Commander MCP: `/opt/DesktopCommanderMCP/`
- ttyd Documentation: https://github.com/tsl0922/ttyd
- WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket

## Changelog

### Version 1.0.0 (2025-10-29)

- Initial implementation
- Added `extractCommandFromToolCall()` function
- Added `echoCommandToTerminal()` function
- Integrated echo into `handleMCPToolCall()`
- Added `command_echo` WebSocket event type
- Added terminal command CSS styling
- Created test suite
- Documented architecture

## Support

For issues or questions about command echo:

1. Check backend logs for echo messages
2. Verify WebSocket connection in browser DevTools
3. Test with `test-command-echo.cjs` script
4. Review this documentation for troubleshooting steps

## License

Same as parent project
