/**
 * Windows MCP Hook
 * Provides integration with Windows MCP server for screenshot, mouse, keyboard, and system control
 */

import { useState, useCallback, useRef } from 'react'

export interface MCPTool {
  name: string
  description: string
}

export interface MCPExecuteResult {
  success: boolean
  output?: string
  error?: string
  imageData?: string
  imagePath?: string
}

export interface WindowsMCPConfig {
  apiKey: string
  baseUrl: string
}

export function useWindowsMCP(config: WindowsMCPConfig) {
  const [isConnected, setIsConnected] = useState(false)
  const [availableTools, setAvailableTools] = useState<MCPTool[]>([])
  const [isExecuting, setIsExecuting] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  /**
   * Test connection to MCP server
   */
  const testConnection = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`${config.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      
      if (response.ok) {
        setIsConnected(true)
        return true
      }
      
      setIsConnected(false)
      return false
    } catch (error) {
      console.error('MCP connection test failed:', error)
      setIsConnected(false)
      return false
    }
  }, [config.baseUrl])

  /**
   * Load available tools from MCP server
   */
  const loadTools = useCallback(async (): Promise<MCPTool[]> => {
    try {
      const response = await fetch(`${config.baseUrl}/tools`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
      })

      if (!response.ok) {
        throw new Error(`Failed to load tools: ${response.statusText}`)
      }

      const data = await response.json()
      const tools = data.tools || []
      setAvailableTools(tools)
      return tools
    } catch (error) {
      console.error('Failed to load MCP tools:', error)
      return []
    }
  }, [config.apiKey, config.baseUrl])

  /**
   * Execute an MCP tool
   */
  const executeTool = useCallback(async (
    toolName: string,
    args: Record<string, any> = {}
  ): Promise<MCPExecuteResult> => {
    setIsExecuting(true)
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch(`${config.baseUrl}/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tool: toolName,
          arguments: args
        }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`Tool execution failed: ${response.statusText}`)
      }

      const result = await response.json()
      return result
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Execution cancelled'
        }
      }
      
      console.error('Tool execution error:', error)
      return {
        success: false,
        error: error.message || 'Unknown error'
      }
    } finally {
      setIsExecuting(false)
      abortControllerRef.current = null
    }
  }, [config.apiKey, config.baseUrl])

  /**
   * Cancel ongoing execution
   */
  const cancelExecution = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  /**
   * Take a screenshot
   */
  const takeScreenshot = useCallback(async (): Promise<MCPExecuteResult> => {
    return executeTool('take_screenshot', {})
  }, [executeTool])

  /**
   * Execute PowerShell command
   */
  const executePowerShell = useCallback(async (command: string): Promise<MCPExecuteResult> => {
    return executeTool('execute_powershell', { command })
  }, [executeTool])

  /**
   * Get system information
   */
  const getSystemInfo = useCallback(async (): Promise<MCPExecuteResult> => {
    return executeTool('get_system_info', {})
  }, [executeTool])

  /**
   * Move mouse to coordinates
   */
  const moveMouse = useCallback(async (x: number, y: number): Promise<MCPExecuteResult> => {
    return executeTool('move_mouse', { x, y })
  }, [executeTool])

  /**
   * Click mouse at coordinates
   */
  const clickMouse = useCallback(async (
    x: number,
    y: number,
    button: 'left' | 'right' | 'middle' = 'left'
  ): Promise<MCPExecuteResult> => {
    return executeTool('click_mouse', { x, y, button })
  }, [executeTool])

  /**
   * Type text
   */
  const typeText = useCallback(async (text: string): Promise<MCPExecuteResult> => {
    return executeTool('type_text', { text })
  }, [executeTool])

  /**
   * Press keyboard key
   */
  const pressKey = useCallback(async (key: string): Promise<MCPExecuteResult> => {
    return executeTool('press_key', { key })
  }, [executeTool])

  /**
   * List files in directory
   */
  const listFiles = useCallback(async (path: string): Promise<MCPExecuteResult> => {
    return executeTool('list_files', { path })
  }, [executeTool])

  /**
   * Read file contents
   */
  const readFile = useCallback(async (path: string, encoding: string = 'utf8'): Promise<MCPExecuteResult> => {
    return executeTool('read_file', { path, encoding })
  }, [executeTool])

  /**
   * Write file contents
   */
  const writeFile = useCallback(async (path: string, content: string): Promise<MCPExecuteResult> => {
    return executeTool('write_file', { path, content })
  }, [executeTool])

  /**
   * Find text on screen using OCR
   */
  const findTextOnScreen = useCallback(async (text: string): Promise<MCPExecuteResult> => {
    return executeTool('find_text_on_screen', { text })
  }, [executeTool])

  return {
    // State
    isConnected,
    availableTools,
    isExecuting,
    
    // Methods
    testConnection,
    loadTools,
    executeTool,
    cancelExecution,
    
    // Convenience methods
    takeScreenshot,
    executePowerShell,
    getSystemInfo,
    moveMouse,
    clickMouse,
    typeText,
    pressKey,
    listFiles,
    readFile,
    writeFile,
    findTextOnScreen
  }
}
