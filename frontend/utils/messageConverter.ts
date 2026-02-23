/**
 * Message Converter Utilities
 * 
 * Converts between Vercel AI SDK Message format (with parts) and our ChatMessage format
 * for session storage and backward compatibility.
 */

import { ChatMessage } from '@/types/chat'
import type { Message } from 'ai'

/**
 * Convert Vercel AI SDK Message to our ChatMessage format
 * Preserves parts array for full fidelity
 */
export function messageToChatMessage(message: Message): ChatMessage {
  const chatMessage: ChatMessage = {
    role: message.role as 'user' | 'assistant',
    content: message.content,
    timestamp: message.createdAt ? new Date(message.createdAt) : new Date()
  }

  // If message has parts, store them in a way we can restore
  if (message.parts && message.parts.length > 0) {
    // Extract thinking content from text parts
    const textParts = message.parts.filter(p => p.type === 'text')
    if (textParts.length > 0) {
      const thinkingText = textParts.map(p => p.text).join('\n')
      if (thinkingText && thinkingText !== message.content) {
        chatMessage.thinkingProcess = thinkingText
      }
    }

    // Extract tool calls and results
    const toolCalls = message.parts.filter(p => p.type === 'tool-call')
    const toolResults = message.parts.filter(p => p.type === 'tool-result')

    if (toolCalls.length > 0) {
      const commandOutputs: any[] = []
      const mediaBlocks: any[] = []
      
      toolCalls.forEach((toolCall, index) => {
        const toolResult = toolResults[index]
        let resultData = null
        
        // Try to parse result as JSON if it's a string
        try {
          resultData = toolResult?.result ? (typeof toolResult.result === 'string' ? JSON.parse(toolResult.result) : toolResult.result) : null
        } catch {
          // If parsing fails, use as-is
          resultData = toolResult?.result ? { output: toolResult.result } : null
        }
        
        // Check if this is a screenshot tool with imageData
        if ((toolCall.toolName === 'windows_take_screenshot' || toolCall.toolName === 'take_screenshot') && 
            resultData?.imageData) {
          // For now, show the base64 data in the output
          commandOutputs.push({
            command: `${toolCall.toolName}()`,
            output: resultData.imageData,
            status: 'success' as const
          })
        }
        // For terminal commands, show them as command blocks
        else if (toolCall.toolName === 'windows_send_to_terminal' || 
            toolCall.toolName === 'write_command' ||
            toolCall.toolName === 'execute_powershell' ||
            toolCall.toolName === 'windows_execute_powershell') {
          commandOutputs.push({
            command: toolCall.args?.command || JSON.stringify(toolCall.args),
            output: resultData?.output || toolResult?.result || '',
            status: 'success' as const
          })
        }
        // For other tools, show tool name and args
        else {
          commandOutputs.push({
            command: `${toolCall.toolName}(${JSON.stringify(toolCall.args)})`,
            output: toolResult?.result || '',
            status: 'success' as const
          })
        }
      })
      
      if (commandOutputs.length > 0) {
        chatMessage.commandOutputs = commandOutputs
      }
      
      if (mediaBlocks.length > 0) {
        chatMessage.mediaBlocks = mediaBlocks
      }
    }
  }

  return chatMessage
}

/**
 * Convert our ChatMessage to Vercel AI SDK Message format
 * Simply passes through all fields from the database
 */
export function chatMessageToMessage(chatMessage: ChatMessage, id?: string): Message {
  const message: Message = {
    id: id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    role: chatMessage.role,
    content: chatMessage.content,
    createdAt: chatMessage.timestamp || new Date()
  }

  // Pass through ALL fields from the ChatMessage as-is
  // This preserves the exact structure from streaming
  Object.keys(chatMessage).forEach(key => {
    if (key !== 'role' && key !== 'content' && key !== 'timestamp') {
      (message as any)[key] = (chatMessage as any)[key];
    }
  });
  
  if (chatMessage.mediaBlocks) {
    console.log(`📦 Loaded message with ${chatMessage.mediaBlocks.length} mediaBlocks from database`);
  }

  return message
}

/**
 * Convert array of Messages to ChatMessages
 */
export function messagesToChatMessages(messages: Message[]): ChatMessage[] {
  return messages.map(messageToChatMessage)
}

/**
 * Convert array of ChatMessages to Messages
 */
export function chatMessagesToMessages(chatMessages: ChatMessage[]): Message[] {
  if (!chatMessages || !Array.isArray(chatMessages)) {
    return []
  }
  return chatMessages.map((msg, index) => chatMessageToMessage(msg, `msg_${index}`))
}

/**
 * Check if a message has parts (new format)
 */
export function hasMessageParts(message: Message): boolean {
  return !!(message.parts && message.parts.length > 0)
}

/**
 * Extract thinking content from message parts
 */
export function extractThinkingFromParts(message: Message): string {
  if (!message.parts) return ''
  
  const textParts = message.parts.filter(p => p.type === 'text')
  return textParts.map(p => p.text).join('\n')
}

/**
 * Extract tool calls from message parts
 */
export function extractToolCallsFromParts(message: Message): Array<{ name: string; args: any }> {
  if (!message.parts) return []
  
  return message.parts
    .filter(p => p.type === 'tool-call')
    .map(p => ({
      name: p.toolName || 'unknown',
      args: p.args || {}
    }))
}

/**
 * Extract tool results from message parts
 */
export function extractToolResultsFromParts(message: Message): string[] {
  if (!message.parts) return []
  
  return message.parts
    .filter(p => p.type === 'tool-result')
    .map(p => p.result || '')
}
