# Implementation Plan

- [x] 1. Add command extraction function to backend



  - Create `extractCommandFromToolCall(toolName, args)` function in backend/server.js
  - Map tool names to their command parameter names (start_process → command, interact_with_process → input)
  - Return null for non-command tools (read_file, list_directory, etc.)
  - Validate that extracted command is a non-empty string
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 2. Add terminal echo function to backend


  - Create `echoCommandToTerminal(command)` async function in backend/server.js
  - Use existing `broadcastToFrontend()` to send command_echo message
  - Include command text and timestamp in message
  - Return boolean indicating success/failure
  - Add error handling with graceful degradation
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 4.1, 4.2_

- [x] 3. Integrate echo into MCP tool call handler


  - Modify `handleMCPToolCall()` function in backend/server.js
  - Call `extractCommandFromToolCall()` to get command from tool arguments
  - Call `echoCommandToTerminal()` before executing MCP tool if command exists
  - Wrap echo in try-catch to prevent blocking tool execution
  - Add logging for echo success/failure
  - _Requirements: 1.1, 1.3, 2.1, 2.3, 4.1, 4.3_

- [x] 4. Update frontend to display command echoes


  - Modify frontend terminal WebSocket message handler
  - Add case for 'command_echo' message type
  - Display command with prompt prefix (e.g., "# whoami")
  - Style command text differently from output (use CSS class)
  - Ensure commands appear before their output
  - _Requirements: 1.2, 1.4, 1.5_

- [x] 5. Add CSS styling for command display


  - Create CSS class for terminal commands (.terminal-command)
  - Style with distinct color (e.g., bright green or cyan)
  - Add prompt symbol (# or $) before command
  - Ensure readability against terminal background
  - _Requirements: 1.2_

- [x] 6. Test command visibility with simple commands


  - Start all services (docker-compose up)
  - Open frontend and terminal in browser
  - Send AI message: "run the command: whoami"
  - Verify command "whoami" appears in terminal before output
  - Verify output "root" appears after command
  - _Requirements: 1.1, 1.2, 1.3, 2.1_

- [x] 7. Test with multiple sequential commands

  - Send AI message: "run these commands: whoami, pwd, ls -la"
  - Verify all three commands appear in terminal
  - Verify each command appears before its output
  - Verify commands are displayed in correct order
  - _Requirements: 1.5, 2.1_


- [ ] 8. Test with interact_with_process tool
  - Send AI message: "start a bash session and run echo hello"
  - Verify both the start_process and interact_with_process commands are visible
  - Verify the input "echo hello" appears in terminal
  - Verify output appears after input
  - _Requirements: 3.2, 3.5_


- [ ] 9. Test graceful degradation when WebSocket disconnected
  - Disconnect frontend WebSocket
  - Send AI command via API
  - Verify command still executes (even though not visible)
  - Verify backend logs warning about no connected clients
  - Reconnect WebSocket and verify echo resumes
  - _Requirements: 4.1, 4.2, 4.3, 4.4_


- [ ] 10. Add performance monitoring for echo operations
  - Add timing measurement in `echoCommandToTerminal()`
  - Log warning if echo takes longer than 100ms
  - Add metrics for echo success/failure rate
  - Monitor WebSocket message queue size
  - _Requirements: 5.1, 5.2, 5.5_


- [ ] 11. Add unit tests for command extraction
  - Test extractCommandFromToolCall with start_process
  - Test extractCommandFromToolCall with interact_with_process
  - Test extractCommandFromToolCall with execute_command
  - Test extractCommandFromToolCall with non-command tools
  - Test extractCommandFromToolCall with invalid arguments
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_


- [ ] 12. Add integration tests for end-to-end visibility
  - Create test script that connects to backend WebSocket
  - Send AI message that triggers command execution
  - Verify command_echo message is received
  - Verify command text matches expected value
  - Verify timing (echo before execution)
  - _Requirements: 1.1, 2.1, 2.2_


- [x] 13. Document the command echo architecture


  - Add comments explaining echo flow in backend/server.js
  - Document message format for command_echo
  - Add troubleshooting section for echo failures
  - Update README with command visibility feature
  - _Requirements: 4.5_
