# Requirements Document

## Introduction

This specification addresses the issue where Gemini AI executes commands through Desktop Commander MCP successfully, but the commands themselves are not visible in the browser terminal at http://localhost:8081. Users can see the command output but cannot see what command was executed, making it difficult to understand what the AI is doing.

## Glossary

- **Desktop Commander MCP**: The Model Context Protocol server that provides terminal control capabilities, running at /opt/DesktopCommanderMCP/ in the kali-pentest container
- **GoTTY/ttyd Terminal**: The web-based terminal interface accessible at http://localhost:8081 that displays the bash session
- **Terminal Echo**: The process of making executed commands visible in the terminal display before showing their output
- **Backend Server**: The Node.js Express server (backend/server.js) that bridges Gemini AI and Desktop Commander MCP
- **MCP Tool Call**: When Gemini AI invokes a Desktop Commander MCP tool like start_process or interact_with_process

## Requirements

### Requirement 1: Command Visibility in Terminal

**User Story:** As a user, I want to see the commands that Gemini AI executes in the terminal, so that I can understand what actions the AI is taking.

#### Acceptance Criteria

1. WHEN Gemini AI executes a command via Desktop Commander MCP, THE System SHALL display the command text in the terminal before execution
2. WHEN a command is displayed, THE System SHALL format it to look like a user-typed command with the appropriate prompt
3. WHILE displaying commands, THE System SHALL preserve the command output visibility
4. IF the command is multi-line, THEN THE System SHALL display all lines with proper formatting
5. WHEN multiple commands execute in sequence, THE System SHALL display each command separately and clearly

### Requirement 2: Real-Time Command Echo

**User Story:** As a user, I want commands to appear in the terminal immediately when the AI executes them, so that I can follow along with the AI's actions in real-time.

#### Acceptance Criteria

1. WHEN the backend receives an MCP tool call, THE System SHALL echo the command to the terminal before calling the MCP tool
2. WHEN echoing to the terminal, THE System SHALL use the existing terminal WebSocket connection
3. WHILE echoing commands, THE System SHALL not delay command execution
4. IF the terminal WebSocket is disconnected, THEN THE System SHALL attempt to reconnect before echoing
5. WHEN the echo succeeds, THE System SHALL log the success for debugging purposes

### Requirement 3: Support All Command Execution Methods

**User Story:** As a developer, I want command echo to work for all Desktop Commander MCP tools that execute commands, so that visibility is consistent regardless of execution method.

#### Acceptance Criteria

1. WHEN start_process is called, THE System SHALL echo the command parameter to the terminal
2. WHEN interact_with_process is called, THE System SHALL echo the input parameter to the terminal
3. WHEN execute_command is called, THE System SHALL echo the command parameter to the terminal
4. IF a tool call doesn't involve command execution, THEN THE System SHALL not echo anything to the terminal
5. WHEN determining what to echo, THE System SHALL extract the command from the tool's arguments correctly

### Requirement 4: Graceful Degradation

**User Story:** As a system administrator, I want the system to continue working even if terminal echo fails, so that command execution is not blocked by display issues.

#### Acceptance Criteria

1. WHEN terminal echo fails, THE System SHALL log the error but continue with command execution
2. WHEN the terminal WebSocket is unavailable, THE System SHALL execute commands without echo
3. WHILE echo is failing, THE System SHALL attempt to reconnect to the terminal WebSocket
4. IF echo fails repeatedly, THEN THE System SHALL not retry indefinitely for each command
5. WHEN echo is unavailable, THE System SHALL inform the user through the AI response that commands are executing but not visible

### Requirement 5: Minimal Performance Impact

**User Story:** As a user, I want command echo to not slow down command execution, so that the AI remains responsive.

#### Acceptance Criteria

1. WHEN echoing a command, THE System SHALL complete the echo operation in less than 100ms
2. WHEN the echo operation times out, THE System SHALL proceed with command execution
3. WHILE echoing, THE System SHALL not block the main execution thread
4. IF echo is slow, THEN THE System SHALL execute the command in parallel with the echo
5. WHEN measuring performance, THE System SHALL log echo timing for monitoring
