import { 
  ChatMessage, 
  MediaBlock, 
  CodeBlockData, 
  CommandOutput,
  MermaidBlockData,
  FileBlockData,
  CRUDBlockData,
  ErrorBlockData
} from '@/types/chat'

/**
 * Detect code blocks in markdown format (```language\ncode\n``` or ```language:filename\ncode\n```)
 */
export function detectCodeBlocks(content: string): MediaBlock[] {
  const blocks: MediaBlock[] = []
  // Updated regex to capture optional filename after language, more flexible with whitespace
  const codeBlockRegex = /```(\w+)?(?::([^\n]+))?\s*([\s\S]*?)```/g
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const language = match[1]?.toLowerCase() || 'text'
    const filename = match[2]?.trim()
    const code = match[3].trim()
    
    // Skip if code is empty
    if (!code) continue
    
    // Skip if it's a mermaid block (handled separately)
    if (language === 'mermaid') {
      continue
    }
    
    // Skip if it's a command block (handled separately)
    if (language === 'command') {
      continue
    }
    
    // Skip if it's a JSON block (handled separately)
    if (language === 'json') {
      continue
    }
    
    // Skip if it's a chart block (handled separately)
    if (language === 'chart') {
      continue
    }

    const data: CodeBlockData = {
      code,
      language,
      ...(filename && { filename })
    }

    blocks.push({
      id: `code_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      type: 'code',
      data,
      timestamp: new Date()
    })
  }

  return blocks
}

/**
 * Detect Mermaid diagrams in markdown format (```mermaid)
 */
export function detectMermaidBlocks(content: string): MediaBlock[] {
  const blocks: MediaBlock[] = []
  // More flexible regex that handles optional whitespace and newlines
  const mermaidRegex = /```mermaid\s*([\s\S]*?)```/g
  let match: RegExpExecArray | null

  console.log('🔍 detectMermaidBlocks called, content length:', content.length);

  while ((match = mermaidRegex.exec(content)) !== null) {
    const code = match[1].trim()
    
    console.log('📦 Found Mermaid block, code length:', code.length);
    console.log('📝 Code preview:', code.substring(0, 100));
    
    // Skip if code is empty
    if (!code) {
      console.warn('⚠️ Skipping empty Mermaid block');
      continue;
    }
    
    // Detect diagram type from first line
    const firstLine = code.split('\n')[0].trim()
    let diagramType = 'flowchart'
    
    if (firstLine.startsWith('sequenceDiagram')) diagramType = 'sequence'
    else if (firstLine.startsWith('classDiagram')) diagramType = 'class'
    else if (firstLine.startsWith('stateDiagram')) diagramType = 'state'
    else if (firstLine.startsWith('erDiagram')) diagramType = 'er'
    else if (firstLine.startsWith('gantt')) diagramType = 'gantt'
    else if (firstLine.startsWith('pie')) diagramType = 'pie'
    else if (firstLine.startsWith('graph')) diagramType = 'flowchart'

    const data: MermaidBlockData = {
      code,
      diagramType
    }

    blocks.push({
      id: `mermaid_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      type: 'mermaid',
      data,
      timestamp: new Date()
    })
  }

  return blocks
}

/**
 * Convert commandOutputs to MediaBlocks
 */
export function convertCommandOutputs(outputs: CommandOutput[]): MediaBlock[] {
  return outputs.map(output => ({
    id: `command_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    type: 'command' as const,
    data: {
      command: output.command,
      output: output.output,
      status: output.status || 'success',
      exitCode: output.exitCode,
      duration: output.duration
    },
    timestamp: new Date()
  }))
}

/**
 * Detect file operations from MCP tool results
 * This is a placeholder - actual implementation depends on backend response format
 */
export function detectFileBlocks(message: ChatMessage): MediaBlock[] {
  const blocks: MediaBlock[] = []
  
  // Look for file operation patterns in content
  const fileOpRegex = /(?:read|write|create|delete)\s+file:\s*([^\n]+)/gi
  let match: RegExpExecArray | null
  
  while ((match = fileOpRegex.exec(message.content)) !== null) {
    const path = match[1].trim()
    
    // This is a simplified detection - real implementation would need backend support
    const data: FileBlockData = {
      path,
      content: '', // Would be populated from actual file content
      operation: 'read'
    }

    blocks.push({
      id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      type: 'file',
      data,
      timestamp: new Date()
    })
  }

  return blocks
}

/**
 * Detect CRUD operations from MCP tool results
 * This is a placeholder - actual implementation depends on backend response format
 */
export function detectCRUDBlocks(message: ChatMessage): MediaBlock[] {
  const blocks: MediaBlock[] = []
  
  // Look for CRUD operation patterns in content
  const crudRegex = /(CREATE|READ|UPDATE|DELETE)\s+(\w+):\s*([^\n]+)/gi
  let match: RegExpExecArray | null
  
  while ((match = crudRegex.exec(message.content)) !== null) {
    const operation = match[1].toLowerCase() as 'create' | 'read' | 'update' | 'delete'
    const resource = match[2]
    
    const data: CRUDBlockData = {
      operation,
      resource,
      status: 'success',
      timestamp: new Date()
    }

    blocks.push({
      id: `crud_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      type: 'crud',
      data,
      timestamp: new Date()
    })
  }

  return blocks
}

/**
 * Detect error patterns in content
 */
export function detectErrorBlocks(content: string): MediaBlock[] {
  const blocks: MediaBlock[] = []
  
  // Look for error patterns
  const errorPatterns = [
    /Error:\s*([^\n]+)/gi,
    /Exception:\s*([^\n]+)/gi,
    /❌\s*([^\n]+)/gi,
    /Failed:\s*([^\n]+)/gi
  ]

  for (const pattern of errorPatterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      const message = match[1].trim()
      
      const data: ErrorBlockData = {
        message
      }

      blocks.push({
        id: `error_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        type: 'error',
        data,
        timestamp: new Date()
      })
    }
  }

  return blocks
}

/**
 * Detect command execution patterns in text (e.g., "I will execute the command `pwd`")
 */
export function detectCommandExecutionPatterns(content: string): MediaBlock[] {
  const blocks: MediaBlock[] = []
  
  // Pattern 1: "I will execute the command `X`"
  // Pattern 2: "I will execute `X`"
  // Pattern 3: "Executing command: `X`"
  // Pattern 4: "I will now execute the `X` command"
  
  const patterns = [
    /I will (?:now )?execute (?:the command )?`([^`]+)`/gi,
    /I will execute `([^`]+)`/gi,
    /Executing (?:command|the command)?:?\s*`([^`]+)`/gi,
    /I will (?:now )?execute the `([^`]+)` command/gi
  ]
  
  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      const command = match[1].trim()
      
      blocks.push({
        id: `cmd-exec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        type: 'command-execution',
        data: {
          command,
          status: 'executing'
        },
        timestamp: new Date()
      })
    }
  }
  
  return blocks
}

/**
 * Detect command execution blocks in special format
 */
export function detectCommandBlocks(content: string): MediaBlock[] {
  const blocks: MediaBlock[] = []
  const commandBlockRegex = /\[COMMAND_BLOCK\]\s*```command\s*([\s\S]*?)```\s*\[\/COMMAND_BLOCK\]/g
  let match: RegExpExecArray | null

  while ((match = commandBlockRegex.exec(content)) !== null) {
    try {
      const commandData = JSON.parse(match[1].trim())
      
      blocks.push({
        id: `command_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        type: 'command',
        data: {
          command: commandData.command,
          output: commandData.output,
          status: commandData.status || 'success',
          exitCode: commandData.exitCode,
          duration: commandData.duration
        },
        timestamp: new Date()
      })
    } catch (e) {
      console.error('Failed to parse command block:', e)
    }
  }

  return blocks
}

/**
 * Main detection function - analyzes message and returns all media blocks
 */
export function detectMediaBlocks(message: ChatMessage): MediaBlock[] {
  const blocks: MediaBlock[] = []

  // Convert existing commandOutputs
  if (message.commandOutputs && message.commandOutputs.length > 0) {
    blocks.push(...convertCommandOutputs(message.commandOutputs))
  }

  // Detect command execution patterns (NEW - for loading state)
  blocks.push(...detectCommandExecutionPatterns(message.content))

  // Detect command execution blocks (NEW - for MCP tool calls)
  blocks.push(...detectCommandBlocks(message.content))

  // Detect JSON blocks
  blocks.push(...detectJSONBlocks(message.content))

  // Detect chart blocks
  blocks.push(...detectChartBlocks(message.content))

  // Detect code blocks (excluding mermaid, command, and json)
  blocks.push(...detectCodeBlocks(message.content))

  // Detect Mermaid diagrams
  blocks.push(...detectMermaidBlocks(message.content))

  // Detect file operations
  blocks.push(...detectFileBlocks(message))

  // Detect CRUD operations
  blocks.push(...detectCRUDBlocks(message))

  // Detect errors
  blocks.push(...detectErrorBlocks(message.content))

  // Add any existing mediaBlocks from the message (convert from media types if needed)
  if (message.mediaBlocks) {
    // Filter and convert compatible media blocks
    const compatibleBlocks = message.mediaBlocks.filter(block => {
      const validTypes: string[] = ['command', 'code', 'file', 'image', 'error', 'thinking', 'crud', 'mermaid', 'json', 'chart', 'table', 'session-suggestion']
      return validTypes.includes(block.type)
    })
    blocks.push(...compatibleBlocks as MediaBlock[])
  }

  return blocks
}

/**
 * Detect if pasted text should be treated as a file
 * @param text - The text content
 * @param isPasted - Whether the text was pasted (vs typed)
 * @returns Whether to treat as file
 */
export function shouldTreatAsFile(text: string, isPasted: boolean): boolean {
  // Only apply to pasted text
  if (!isPasted) return false
  
  // Treat as file if > 1000 characters
  return text.length > 1000
}

/**
 * Setup paste detection for textarea
 */
export function setupPasteDetection(textarea: HTMLTextAreaElement): () => boolean {
  let isPasted = false
  
  const handlePaste = () => {
    isPasted = true
    setTimeout(() => { isPasted = false }, 100)
  }
  
  textarea.addEventListener('paste', handlePaste)
  
  // Return cleanup function and getter
  const getPasteState = () => isPasted
  
  // Store cleanup function
  ;(getPasteState as any).cleanup = () => {
    textarea.removeEventListener('paste', handlePaste)
  }
  
  return getPasteState
}


/**
 * Detect JSON blocks in special format or code blocks
 */
export function detectJSONBlocks(content: string): MediaBlock[] {
  const blocks: MediaBlock[] = []
  
  // Detect JSON in code blocks: ```json\n{...}\n```
  const jsonCodeBlockRegex = /```json\s*([\s\S]*?)```/g
  let match: RegExpExecArray | null

  while ((match = jsonCodeBlockRegex.exec(content)) !== null) {
    try {
      const jsonData = JSON.parse(match[1].trim())
      
      blocks.push({
        id: `json_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        type: 'json',
        data: {
          data: jsonData,
          collapsed: false
        },
        timestamp: new Date()
      })
    } catch (e) {
      // If JSON parsing fails, skip this block
      console.error('Failed to parse JSON block:', e)
    }
  }

  return blocks
}

/**
 * Detect chart blocks in special format
 */
export function detectChartBlocks(content: string): MediaBlock[] {
  const blocks: MediaBlock[] = []
  const chartBlockRegex = /\[CHART_BLOCK\]\s*```chart\s*([\s\S]*?)```\s*\[\/CHART_BLOCK\]/g
  let match: RegExpExecArray | null

  while ((match = chartBlockRegex.exec(content)) !== null) {
    try {
      const chartData = JSON.parse(match[1].trim())
      
      blocks.push({
        id: `chart_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        type: 'chart',
        data: chartData,
        timestamp: new Date()
      })
    } catch (e) {
      console.error('Failed to parse chart block:', e)
    }
  }

  return blocks
}
