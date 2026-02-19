/**
 * Windows MCP Tool Definitions for Gemini
 * Converts Windows MCP tools to Gemini function declarations
 */

const WINDOWS_MCP_TOOLS = {
  'windows_take_screenshot': {
    name: 'windows_take_screenshot',
    description: 'Capture a screenshot of the Windows desktop. Returns base64 PNG image data that you can analyze.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  
  'windows_execute_powershell': {
    name: 'windows_execute_powershell',
    description: 'Execute a PowerShell command in Windows. Returns the command output. Use for system commands, file operations, and automation.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'PowerShell command to execute (e.g., "Get-Process", "Get-ChildItem C:\\")'
        }
      },
      required: ['command']
    }
  },
  
  'windows_get_system_info': {
    name: 'windows_get_system_info',
    description: 'Get Windows system information including version, running processes, and disk usage.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  
  'windows_move_mouse': {
    name: 'windows_move_mouse',
    description: 'Move the mouse cursor to specific coordinates on the Windows desktop. Use before clicking.',
    parameters: {
      type: 'object',
      properties: {
        x: {
          type: 'number',
          description: 'X coordinate (0-1280 for typical Windows desktop)'
        },
        y: {
          type: 'number',
          description: 'Y coordinate (0-720 for typical Windows desktop)'
        }
      },
      required: ['x', 'y']
    }
  },
  
  'windows_click_mouse': {
    name: 'windows_click_mouse',
    description: 'Click the mouse at specific coordinates on the Windows desktop. Use double=true for desktop icons.',
    parameters: {
      type: 'object',
      properties: {
        x: {
          type: 'number',
          description: 'X coordinate to click'
        },
        y: {
          type: 'number',
          description: 'Y coordinate to click'
        },
        button: {
          type: 'string',
          enum: ['left', 'right', 'middle'],
          description: 'Mouse button to click (default: left)'
        },
        double: {
          type: 'boolean',
          description: 'Perform double-click (required for desktop icons to open them)'
        }
      },
      required: ['x', 'y']
    }
  },
  
  'windows_get_mouse_position': {
    name: 'windows_get_mouse_position',
    description: 'Get the current mouse cursor position on Windows desktop.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  
  'windows_type_text': {
    name: 'windows_type_text',
    description: 'Type text on the Windows desktop at the current cursor position. Use for entering text in applications.',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to type'
        }
      },
      required: ['text']
    }
  },
  
  'windows_press_key': {
    name: 'windows_press_key',
    description: 'Press a keyboard key or key combination on Windows. Supports special keys and shortcuts.',
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Key to press. Examples: "enter", "tab", "escape", "win", "ctrl+c", "alt+f4", "win+r"'
        }
      },
      required: ['key']
    }
  },
  
  'windows_list_files': {
    name: 'windows_list_files',
    description: 'List files and directories in a Windows path.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path (use backslashes: C:\\Users\\Public or forward slashes: C:/Users/Public)'
        }
      },
      required: ['path']
    }
  },
  
  'windows_read_file': {
    name: 'windows_read_file',
    description: 'Read the contents of a file in Windows.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path to read'
        },
        encoding: {
          type: 'string',
          enum: ['utf8', 'base64'],
          description: 'File encoding (default: utf8)'
        }
      },
      required: ['path']
    }
  },
  
  'windows_write_file': {
    name: 'windows_write_file',
    description: 'Write content to a file in Windows. Creates the file if it doesn\'t exist.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path to write'
        },
        content: {
          type: 'string',
          description: 'Content to write to the file'
        }
      },
      required: ['path', 'content']
    }
  },
  
  'windows_send_to_terminal': {
    name: 'windows_send_to_terminal',
    description: 'Send a command directly to the PowerShell terminal running on port 10013. The command will be VISIBLE and executed in the terminal window. Use this when you want the user to SEE the command being typed and executed.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'PowerShell command to send to the terminal (will be visible and executed)'
        }
      },
      required: ['command']
    }
  },
  
  'windows_scroll_mouse': {
    name: 'windows_scroll_mouse',
    description: 'Scroll the mouse wheel up or down. Optionally move to specific coordinates before scrolling. Use for scrolling web pages, documents, or lists.',
    parameters: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          enum: ['up', 'down'],
          description: 'Scroll direction: "up" or "down"'
        },
        clicks: {
          type: 'number',
          description: 'Number of scroll clicks (default: 750)'
        },
        x: {
          type: 'number',
          description: 'Optional X coordinate to move mouse to before scrolling'
        },
        y: {
          type: 'number',
          description: 'Optional Y coordinate to move mouse to before scrolling'
        }
      },
      required: ['direction']
    }
  }
};

/**
 * Get Windows MCP tools formatted for Gemini
 * @param {string} mode - Optional mode filter: 'terminal' or 'desktop'
 */
function getWindowsMCPToolsForGemini(mode = null) {
  const allTools = Object.values(WINDOWS_MCP_TOOLS);
  
  // If no mode specified, return all tools
  if (!mode) {
    return allTools;
  }
  
  // Terminal mode: ONLY send_to_terminal tool
  if (mode === 'terminal') {
    return allTools.filter(tool => tool.name === 'windows_send_to_terminal');
  }
  
  // Desktop mode: ALL tools EXCEPT send_to_terminal
  if (mode === 'desktop' || mode === 'windows') {
    return allTools.filter(tool => tool.name !== 'windows_send_to_terminal');
  }
  
  // Default: return all tools
  return allTools;
}

/**
 * Get tool names
 */
function getWindowsMCPToolNames() {
  return Object.keys(WINDOWS_MCP_TOOLS);
}

module.exports = {
  WINDOWS_MCP_TOOLS,
  getWindowsMCPToolsForGemini,
  getWindowsMCPToolNames
};
