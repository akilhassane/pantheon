/**
 * Search Engine for indexing and querying conversation history
 */

import { Session, ChatMessage } from '@/types/chat'
import { SearchResult } from '@/types/sidebar'

/**
 * Simple fuzzy matching score calculation
 * Returns a score between 0 and 1 based on how well the text matches the query
 */
function calculateFuzzyScore(text: string, query: string): number {
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  
  // Exact match gets highest score
  if (lowerText === lowerQuery) return 1.0
  
  // Contains exact query gets high score
  if (lowerText.includes(lowerQuery)) return 0.8
  
  // Check for word matches
  const queryWords = lowerQuery.split(/\s+/)
  const textWords = lowerText.split(/\s+/)
  
  let matchedWords = 0
  for (const queryWord of queryWords) {
    if (textWords.some(textWord => textWord.includes(queryWord))) {
      matchedWords++
    }
  }
  
  const wordMatchScore = matchedWords / queryWords.length
  
  // Check for character sequence matches
  let sequenceMatches = 0
  let queryIndex = 0
  
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      sequenceMatches++
      queryIndex++
    }
  }
  
  const sequenceScore = sequenceMatches / lowerQuery.length
  
  // Combine scores with weights
  return (wordMatchScore * 0.6) + (sequenceScore * 0.4)
}

/**
 * Extract context around a matched text
 */
function extractContext(
  content: string,
  matchStart: number,
  matchEnd: number,
  contextLength: number = 50
): { before: string; after: string } {
  const before = content.substring(
    Math.max(0, matchStart - contextLength),
    matchStart
  ).trim()
  
  const after = content.substring(
    matchEnd,
    Math.min(content.length, matchEnd + contextLength)
  ).trim()
  
  return { before, after }
}

/**
 * Find the best match position in the content
 */
function findMatchPosition(content: string, query: string): { start: number; end: number } | null {
  const lowerContent = content.toLowerCase()
  const lowerQuery = query.toLowerCase()
  
  // Try exact match first
  const exactIndex = lowerContent.indexOf(lowerQuery)
  if (exactIndex !== -1) {
    return { start: exactIndex, end: exactIndex + query.length }
  }
  
  // Try to find the first word match
  const queryWords = lowerQuery.split(/\s+/)
  for (const word of queryWords) {
    const wordIndex = lowerContent.indexOf(word)
    if (wordIndex !== -1) {
      return { start: wordIndex, end: wordIndex + word.length }
    }
  }
  
  return null
}

/**
 * Search across all sessions and return ranked results
 */
export function searchSessions(
  sessions: Session[],
  query: string,
  maxResults: number = 50
): SearchResult[] {
  if (!query.trim()) {
    return []
  }
  
  const results: SearchResult[] = []
  
  for (const session of sessions) {
    // Search in session name
    const sessionNameScore = calculateFuzzyScore(session.name, query)
    
    // Search in messages
    session.chatHistory.forEach((message, index) => {
      const contentScore = calculateFuzzyScore(message.content, query)
      
      if (contentScore > 0.3 || sessionNameScore > 0.5) {
        const matchPosition = findMatchPosition(message.content, query)
        const context = matchPosition
          ? extractContext(message.content, matchPosition.start, matchPosition.end)
          : { before: '', after: '' }
        
        const matchedText = matchPosition
          ? message.content.substring(matchPosition.start, matchPosition.end)
          : query
        
        // Calculate final relevance score
        const relevanceScore = Math.max(contentScore, sessionNameScore * 0.5)
        
        results.push({
          sessionId: session.id,
          sessionName: session.name,
          messageIndex: index,
          messageRole: message.role,
          messageContent: message.content,
          matchedText,
          contextBefore: context.before,
          contextAfter: context.after,
          timestamp: message.timestamp || session.lastActive,
          relevanceScore
        })
      }
    })
  }
  
  // Sort by relevance score (descending) and then by timestamp (descending)
  results.sort((a, b) => {
    if (Math.abs(a.relevanceScore - b.relevanceScore) > 0.01) {
      return b.relevanceScore - a.relevanceScore
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })
  
  // Return top results
  return results.slice(0, maxResults)
}

/**
 * Highlight matched text in a string
 * Returns an array of text segments with match flags
 */
export function highlightMatches(
  text: string,
  query: string
): Array<{ text: string; isMatch: boolean }> {
  if (!query.trim()) {
    return [{ text, isMatch: false }]
  }
  
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const segments: Array<{ text: string; isMatch: boolean }> = []
  
  let lastIndex = 0
  let searchIndex = 0
  
  while (searchIndex < lowerText.length) {
    const matchIndex = lowerText.indexOf(lowerQuery, searchIndex)
    
    if (matchIndex === -1) {
      // No more matches, add remaining text
      if (lastIndex < text.length) {
        segments.push({ text: text.substring(lastIndex), isMatch: false })
      }
      break
    }
    
    // Add text before match
    if (matchIndex > lastIndex) {
      segments.push({ text: text.substring(lastIndex, matchIndex), isMatch: false })
    }
    
    // Add matched text
    segments.push({
      text: text.substring(matchIndex, matchIndex + query.length),
      isMatch: true
    })
    
    lastIndex = matchIndex + query.length
    searchIndex = lastIndex
  }
  
  return segments
}

/**
 * Debounce function for search input
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }
    
    if (timeout) {
      clearTimeout(timeout)
    }
    
    timeout = setTimeout(later, wait)
  }
}
