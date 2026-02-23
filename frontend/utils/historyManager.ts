/**
 * History Manager Utility
 * 
 * Manages chat history truncation to prevent "413 Payload Too Large" errors.
 * Implements intelligent truncation strategies while preserving conversation context.
 */

import { ChatMessage } from '@/types/chat'

/**
 * Configuration for history truncation
 */
export interface TruncationConfig {
  /** Maximum number of messages to keep in history (default: 20) */
  maxHistoryMessages: number
  /** Maximum size for individual command outputs in bytes (default: 10KB) */
  maxOutputSize: number
  /** Warning threshold for payload size in bytes (default: 40MB) */
  maxPayloadSize: number
  /** Aggressive truncation threshold in bytes (default: 45MB) */
  aggressiveTruncationSize: number
}

/**
 * Result of output truncation
 */
export interface TruncatedOutput {
  /** Original output string */
  original: string
  /** Truncated output string */
  truncated: string
  /** Whether truncation was applied */
  wasTruncated: boolean
  /** Original size in bytes */
  originalSize: number
}

/**
 * Result of history preparation
 */
export interface PreparedHistory {
  /** Truncated chat history */
  truncatedHistory: ChatMessage[]
  /** Whether any modifications were made */
  wasModified: boolean
  /** Original payload size in bytes */
  originalSize: number
  /** Final payload size in bytes */
  finalSize: number
  /** Number of messages removed */
  messagesRemoved: number
  /** Number of outputs truncated */
  outputsTruncated: number
}

/**
 * Default truncation configuration
 */
export const DEFAULT_TRUNCATION_CONFIG: TruncationConfig = {
  maxHistoryMessages: 20,           // 10 user + 10 assistant pairs
  maxOutputSize: 10 * 1024,         // 10KB per output
  maxPayloadSize: 40 * 1024 * 1024, // 40MB warning threshold
  aggressiveTruncationSize: 45 * 1024 * 1024, // 45MB aggressive threshold
}

/**
 * History Manager Class
 * 
 * Provides methods for managing and truncating chat history to stay within payload limits.
 */
export class HistoryManager {
  private config: TruncationConfig

  constructor(config: Partial<TruncationConfig> = {}) {
    this.config = { ...DEFAULT_TRUNCATION_CONFIG, ...config }
  }

  /**
   * Truncate a single command output
   * Keeps first 5KB and last 2KB with a truncation indicator
   */
  truncateOutput(output: string, maxSize: number = this.config.maxOutputSize): TruncatedOutput {
    const originalSize = new Blob([output]).size

    if (originalSize <= maxSize) {
      return {
        original: output,
        truncated: output,
        wasTruncated: false,
        originalSize
      }
    }

    // Keep first 5KB and last 2KB
    const firstChunkSize = 5 * 1024
    const lastChunkSize = 2 * 1024

    const firstChunk = output.substring(0, firstChunkSize)
    const lastChunk = output.substring(output.length - lastChunkSize)

    const truncationIndicator = `\n\n... [Output truncated: ${this.formatBytes(originalSize)} → ${this.formatBytes(firstChunkSize + lastChunkSize)}] ...\n\n`

    const truncated = firstChunk + truncationIndicator + lastChunk

    return {
      original: output,
      truncated,
      wasTruncated: true,
      originalSize
    }
  }

  /**
   * Truncate all command outputs in a message
   */
  truncateMessageOutputs(message: ChatMessage): ChatMessage {
    if (!message.commandOutputs || message.commandOutputs.length === 0) {
      return message
    }

    const truncatedOutputs = message.commandOutputs.map(cmdOutput => {
      const result = this.truncateOutput(cmdOutput.output)
      return {
        ...cmdOutput,
        output: result.truncated
      }
    })

    return {
      ...message,
      commandOutputs: truncatedOutputs
    }
  }

  /**
   * Limit history to most recent N messages
   * Ensures we keep complete user-assistant pairs
   */
  limitHistory(history: ChatMessage[], maxMessages: number = this.config.maxHistoryMessages): ChatMessage[] {
    if (history.length <= maxMessages) {
      return history
    }

    // Keep the most recent messages
    return history.slice(-maxMessages)
  }

  /**
   * Calculate approximate payload size in bytes
   */
  calculatePayloadSize(payload: any): number {
    try {
      const jsonString = JSON.stringify(payload)
      return new Blob([jsonString]).size
    } catch (error) {
      console.error('Failed to calculate payload size:', error)
      // Return a conservative estimate
      return 50 * 1024 * 1024 // 50MB
    }
  }

  /**
   * Apply full truncation strategy to prepare history for sending
   * This is the main orchestration method
   */
  prepareHistoryForSend(
    history: ChatMessage[],
    config: Partial<TruncationConfig> = {}
  ): PreparedHistory {
    // Merge config
    const effectiveConfig = { ...this.config, ...config }

    // Track modifications
    let wasModified = false
    let outputsTruncated = 0
    let messagesRemoved = 0

    // Step 1: Truncate command outputs in all messages
    let processedHistory = history.map(message => {
      if (message.commandOutputs && message.commandOutputs.length > 0) {
        const truncatedMessage = this.truncateMessageOutputs(message)
        if (truncatedMessage.commandOutputs !== message.commandOutputs) {
          wasModified = true
          outputsTruncated += message.commandOutputs.length
        }
        return truncatedMessage
      }
      return message
    })

    // Step 2: Calculate payload size
    const originalSize = this.calculatePayloadSize({ history: processedHistory })

    // Step 3: Limit history if needed
    if (processedHistory.length > effectiveConfig.maxHistoryMessages) {
      const originalLength = processedHistory.length
      processedHistory = this.limitHistory(processedHistory, effectiveConfig.maxHistoryMessages)
      messagesRemoved = originalLength - processedHistory.length
      wasModified = true
    }

    // Step 4: Check if we need aggressive truncation
    let finalSize = this.calculatePayloadSize({ history: processedHistory })

    if (finalSize > effectiveConfig.aggressiveTruncationSize) {
      console.warn(`📦 Payload size ${this.formatBytes(finalSize)} exceeds aggressive threshold, applying aggressive truncation`)

      // Apply more aggressive truncation
      // 1. Reduce max output size to 5KB
      processedHistory = processedHistory.map(message => {
        if (message.commandOutputs && message.commandOutputs.length > 0) {
          const aggressiveOutputs = message.commandOutputs.map(cmdOutput => {
            const result = this.truncateOutput(cmdOutput.output, 5 * 1024)
            return {
              ...cmdOutput,
              output: result.truncated
            }
          })
          return {
            ...message,
            commandOutputs: aggressiveOutputs
          }
        }
        return message
      })

      // 2. Further limit history to last 10 messages
      if (processedHistory.length > 10) {
        const beforeLength = processedHistory.length
        processedHistory = this.limitHistory(processedHistory, 10)
        messagesRemoved += beforeLength - processedHistory.length
      }

      finalSize = this.calculatePayloadSize({ history: processedHistory })
      wasModified = true
    }

    // Log warning if still over threshold
    if (finalSize > effectiveConfig.maxPayloadSize) {
      console.warn(`⚠️ Payload size ${this.formatBytes(finalSize)} still exceeds warning threshold after truncation`)
    }

    return {
      truncatedHistory: processedHistory,
      wasModified,
      originalSize,
      finalSize,
      messagesRemoved,
      outputsTruncated
    }
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  /**
   * Check if history needs truncation
   */
  shouldTruncate(history: ChatMessage[]): boolean {
    const size = this.calculatePayloadSize({ history })
    return size > this.config.maxPayloadSize || history.length > this.config.maxHistoryMessages
  }

  /**
   * Get truncation statistics for debugging
   */
  getStats(history: ChatMessage[]): {
    messageCount: number
    payloadSize: number
    formattedSize: string
    needsTruncation: boolean
    outputCount: number
  } {
    const payloadSize = this.calculatePayloadSize({ history })
    const outputCount = history.reduce((count, msg) => {
      return count + (msg.commandOutputs?.length || 0)
    }, 0)

    return {
      messageCount: history.length,
      payloadSize,
      formattedSize: this.formatBytes(payloadSize),
      needsTruncation: this.shouldTruncate(history),
      outputCount
    }
  }
}

// Export singleton instance with default config
export const historyManager = new HistoryManager()

// Export for creating custom instances
export default HistoryManager
