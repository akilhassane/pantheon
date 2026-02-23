/**
 * MCP to Gemini Tools Converter
 * Converts MCP tool schemas to Gemini function declarations
 */

/**
 * Convert MCP tool schema to Gemini function declaration
 * @param {Object} mcpTool - MCP tool definition
 * @returns {Object} Gemini function declaration
 */
function convertMCPToolToGemini(mcpTool) {
  const { name, description, inputSchema } = mcpTool;

  // Convert MCP inputSchema to Gemini parameters format
  const parameters = {
    type: inputSchema.type || 'object',
    properties: {},
    required: inputSchema.required || []
  };

  // Convert properties
  if (inputSchema.properties) {
    for (const [propName, propSchema] of Object.entries(inputSchema.properties)) {
      parameters.properties[propName] = {
        type: propSchema.type,
        description: propSchema.description || ''
      };

      // Handle enums
      if (propSchema.enum) {
        parameters.properties[propName].enum = propSchema.enum;
      }

      // Handle default values
      if (propSchema.default !== undefined) {
        parameters.properties[propName].default = propSchema.default;
      }

      // Handle nested objects
      if (propSchema.type === 'object' && propSchema.properties) {
        parameters.properties[propName].properties = propSchema.properties;
      }

      // Handle arrays
      if (propSchema.type === 'array' && propSchema.items) {
        parameters.properties[propName].items = propSchema.items;
      }
    }
  }

  return {
    name,
    description,
    parameters
  };
}

/**
 * Convert array of MCP tools to Gemini function declarations
 * @param {Array} mcpTools - Array of MCP tool definitions
 * @returns {Array} Array of Gemini function declarations
 */
function convertMCPToolsToGemini(mcpTools) {
  return mcpTools.map(tool => convertMCPToolToGemini(tool));
}

/**
 * Filter MCP tools to only include those relevant for AI command execution
 * @param {Array} mcpTools - Array of MCP tool definitions
 * @returns {Array} Filtered array of MCP tools
 */
function filterRelevantTools(mcpTools) {
  // Tools that are most useful for AI command execution
  const relevantToolNames = [
    'write_command',           // Primary tool for executing commands (types in terminal)
    'get_session_output',      // Get the output from the terminal
    'write_text',              // Write text without Enter
    'send_key'                 // Send special keys (Ctrl+C, Enter, etc.)
  ];

  return mcpTools.filter(tool => {
    // Extract original tool name (remove server prefix if present)
    const originalName = tool._originalName || tool.name.split('_').slice(1).join('_') || tool.name;
    
    // Check if it's a terminal tool
    if (relevantToolNames.includes(originalName)) {
      return true;
    }
    
    // Include all desktop-vision tools (they have _server metadata)
    if (tool._server === 'desktop-vision') {
      return true;
    }
    
    return false;
  });
}

/**
 * Enhance tool descriptions for better AI understanding
 * @param {Array} geminiTools - Array of Gemini function declarations
 * @returns {Array} Enhanced Gemini function declarations
 */
function enhanceToolDescriptions(geminiTools) {
  const enhancements = {
    'desktop-vision_see_screen': {
      description: `Capture and see what is currently displayed on the VNC desktop screen.

🎯 USE THIS TOOL when:
- You need to see what's on the screen
- User asks "what do you see?" or "what's on screen?"
- You need to verify visual state before taking action
- You want to check if a GUI application opened correctly

Returns a base64 encoded PNG image of the entire desktop that you can analyze.`
    },
    'desktop-vision_read_screen_text': {
      description: `Extract and read all visible text from the desktop screen using OCR.

🎯 USE THIS TOOL when:
- You need to read text from the screen
- User asks about text content visible on screen
- You need to verify text in GUI applications

Returns the extracted text content from the screen.`
    },
    'desktop-vision_click': {
      description: `Click the mouse at a specific position on the VNC desktop screen.

🎯 USE THIS TOOL when:
- You need to click a button, link, or UI element
- User asks you to click something
- You need to interact with GUI applications

Parameters:
- x: X coordinate to click
- y: Y coordinate to click
- button: 'left', 'right', or 'middle' (default: 'left')`
    },
    'desktop-vision_type_text': {
      description: `Type text at the current cursor position on the VNC desktop.

🎯 USE THIS TOOL when:
- You need to type text into a GUI application
- User asks you to enter text somewhere
- You need to fill in forms or text fields

Parameters:
- text: Text to type
- delay: Delay between keystrokes in milliseconds (default: 50)`
    },
    'desktop-vision_press_key': {
      description: `Press a keyboard key or key combination on the VNC desktop.

🎯 USE THIS TOOL when:
- You need to press special keys (Enter, Tab, Escape, etc.)
- You need to use keyboard shortcuts (ctrl+c, alt+F4, etc.)

Parameters:
- key: Key to press (e.g., 'Return', 'Tab', 'Escape', 'ctrl+l', 'alt+F4')`
    },
    'desktop-vision_get_windows': {
      description: `Get information about all visible windows on the VNC desktop.

🎯 USE THIS TOOL when:
- You need to see what windows are open
- You want to find a specific window
- You need window positions and sizes

Returns array of windows with id, name, position, and size.`
    },
    'desktop-vision_focus_window': {
      description: `Focus a specific window by its ID on the VNC desktop.

🎯 USE THIS TOOL when:
- You need to bring a window to the front
- You want to switch to a specific application

Parameters:
- windowId: Window ID from get_windows`
    },
    'desktop-vision_move_mouse': {
      description: `Move the mouse cursor to a specific position on the VNC desktop.

Parameters:
- x: X coordinate
- y: Y coordinate`
    },
    'desktop-vision_scroll': {
      description: `Scroll the page or window on the VNC desktop.

Parameters:
- direction: 'up', 'down', 'left', or 'right'
- amount: Number of scroll clicks (default: 750)`
    },
    'desktop-vision_get_mouse_position': {
      description: `Get the current mouse cursor position on the VNC desktop.

Returns the current x, y coordinates of the mouse.`
    },
    write_command: {
      description: `Execute a bash command in the Kali Linux terminal and receive the actual output.

🎯 USE THIS TOOL when the user asks to:
- Run, execute, check, show, list, find, or get anything
- Mentions any command name (whoami, ls, pwd, ifconfig, nmap, netstat, ps, etc.)
- Wants system information, files, processes, network status, security scans, etc.
- Asks questions that require checking the system state

This is your PRIMARY and MOST IMPORTANT tool. Use it immediately when appropriate.

✅ CORRECT USAGE EXAMPLES:
- User: "run whoami" → IMMEDIATELY call write_command({command: "whoami"})
- User: "what's my IP?" → IMMEDIATELY call write_command({command: "ip addr show"})
- User: "list files" → IMMEDIATELY call write_command({command: "ls -la"})
- User: "check if apache is running" → IMMEDIATELY call write_command({command: "systemctl status apache2"})
- User: "scan port 80" → IMMEDIATELY call write_command({command: "nmap -p 80 localhost"})

❌ INCORRECT - DO NOT DO THIS:
- Describing what the command does without executing it
- Saying "I will execute..." without actually calling the function
- Asking for permission before executing (just execute it)
- Telling the user to run the command themselves

🔄 WHAT HAPPENS:
1. The command is typed into the terminal (visible in the iframe)
2. Enter key is pressed automatically
3. The command executes in the real Kali Linux environment
4. You receive the actual terminal output as a string
5. You analyze and explain the output to the user

📊 RETURN VALUE:
You receive the actual text output from the terminal, including:
- Standard output (stdout)
- Standard error (stderr) if any
- Command execution results
- Any error messages

Always analyze this output and explain it to the user. Never tell them to "check the terminal" - you have the output!`
    },
    get_session_output: {
      description: `Retrieve recent output from the terminal session.

Use this to:
- Get output after executing a command
- Review recent terminal activity
- Capture long-running command output

Parameters:
- lines: Number of recent lines to retrieve (default: 100)
- includeAnsi: Include ANSI color codes (default: false)`
    },
    get_session_state: {
      description: `Check the current state of the terminal session.

Use this to:
- Verify the terminal is ready for commands
- Check if a command is still running
- Get session information

Returns session state including:
- state: 'ready', 'busy', 'initializing', or 'terminated'
- isReady: boolean indicating if ready for input
- lastPrompt: the last detected bash prompt`
    },
    send_key: {
      description: `Send a special key or control sequence to the terminal.

⚠️⚠️⚠️ CRITICAL WARNING ⚠️⚠️⚠️
DO NOT USE write_text + send_key("enter") TO EXECUTE COMMANDS!
If the user asks to execute a command, use write_command instead!
write_command automatically types the command AND presses Enter AND captures output!

🎯 USE THIS TOOL ONLY when:
- You need to interrupt a running command (Ctrl+C)
- You need to send EOF signal (Ctrl+D)
- You need to press Enter AFTER using write_text for an interactive prompt
- You need to navigate command history (up/down arrows)
- You need to send other control sequences

✅ CORRECT USAGE EXAMPLES:
- Stop a running command → send_key({key: "ctrl-c"})
- Send EOF to close input → send_key({key: "ctrl-d"})
- Press Enter after typing password → send_key({key: "enter"})
- Navigate to previous command → send_key({key: "up"})
- Clear the screen → send_key({key: "ctrl-l"})

📋 AVAILABLE KEYS:
- enter: Press Enter/Return key
- ctrl-c: Interrupt/stop current command (SIGINT)
- ctrl-d: Send EOF signal
- tab: Tab key for autocomplete
- backspace: Delete previous character
- up/down: Navigate command history
- left/right: Move cursor

❌ NEVER USE FOR:
- Executing commands (use write_command instead)
- Pressing Enter to run a command (use write_command instead)
- Combined with write_text to execute commands (use write_command instead)

🔄 CORRECT PATTERN:
- ❌ WRONG: write_text({text: "ls -la"}) then send_key({key: "enter"})
- ✅ CORRECT: write_command({command: "ls -la"})`
    },
    write_text: {
      description: `Write text to the terminal without pressing Enter (types text but doesn't execute).

⚠️⚠️⚠️ CRITICAL WARNING ⚠️⚠️⚠️
DO NOT USE THIS TOOL FOR EXECUTING COMMANDS!
If the user asks to "execute", "run", "check", or perform ANY command, use write_command instead!
This tool is ONLY for interactive prompts, NOT for command execution!

🎯 USE THIS TOOL ONLY when:
- A command is ALREADY RUNNING and waiting for input (password prompt, yes/no prompt)
- You need to respond to an interactive prompt
- You are in the middle of an interactive session (like mysql, python REPL, etc.)

⚠️ IMPORTANT: This does NOT execute the text as a command. Use write_command for executing commands.

✅ CORRECT USAGE EXAMPLES:
- Command is waiting for password → write_text({text: "mypassword"})
- Interactive prompt asks "Continue? (y/n)" → write_text({text: "y"})
- Inside Python REPL → write_text({text: "print('hello')"})

❌ NEVER USE FOR:
- Executing commands (use write_command instead)
- Running any bash command (use write_command instead)
- When user says "execute", "run", "check", "show", "list" (use write_command)
- Normal command execution (use write_command)

🔄 RELATIONSHIP TO OTHER TOOLS:
- write_command: ALWAYS use this for executing commands (types + Enter + captures output)
- write_text: ONLY for interactive prompts (types without Enter)
- send_key: ONLY for special keys, NOT for executing commands`
    }
  };

  return geminiTools.map(tool => {
    if (enhancements[tool.name]) {
      return {
        ...tool,
        description: enhancements[tool.name].description
      };
    }
    return tool;
  });
}

/**
 * Main function to convert and prepare MCP tools for Gemini
 * @param {Array} mcpTools - Array of MCP tool definitions
 * @param {Object} options - Conversion options
 * @returns {Array} Array of Gemini function declarations ready for use
 */
function prepareMCPToolsForGemini(mcpTools, options = {}) {
  const {
    filterTools = true,
    enhanceDescriptions = true
  } = options;

  let tools = mcpTools;

  // Filter to relevant tools if requested
  if (filterTools) {
    tools = filterRelevantTools(tools);
  }

  // Convert to Gemini format
  let geminiTools = convertMCPToolsToGemini(tools);

  // Enhance descriptions if requested
  if (enhanceDescriptions) {
    geminiTools = enhanceToolDescriptions(geminiTools);
  }

  return geminiTools;
}

module.exports = {
  convertMCPToolToGemini,
  convertMCPToolsToGemini,
  filterRelevantTools,
  enhanceToolDescriptions,
  prepareMCPToolsForGemini
};
