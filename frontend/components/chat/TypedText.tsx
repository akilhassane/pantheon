'use client'

import React, { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface TypedTextProps {
  text: string
  isStreaming: boolean
  speed?: number // characters per frame (default: 2)
  markdownComponents?: any
  onComplete?: () => void // Callback when typing animation completes
}

/**
 * TypedText component that displays text character-by-character with a typing effect
 * Only applies typing effect during streaming, shows full text immediately when not streaming
 */
export const TypedText: React.FC<TypedTextProps> = React.memo(({ 
  text, 
  isStreaming, 
  speed = 2,
  markdownComponents,
  onComplete
}) => {
  // Clean text by removing extra backticks
  const cleanText = React.useMemo(() => {
    if (!text) return text;
    
    let cleaned = text;
    
    // Remove ALL double backticks and replace with single backticks
    // This is the most direct approach: `` -> `
    cleaned = cleaned.replace(/``/g, '`');
    
    // Remove escaped backticks (\\`)
    cleaned = cleaned.replace(/\\`/g, '`');
    
    return cleaned;
  }, [text]);

  const [displayedText, setDisplayedText] = useState(() => {
    // Initialize with full text if not streaming
    return isStreaming ? '' : cleanText;
  })
  const displayedLengthRef = useRef(isStreaming ? 0 : cleanText.length)
  const animationFrameRef = useRef<number | null>(null)
  const lastTextRef = useRef(cleanText)
  const hasCompletedRef = useRef(!isStreaming) // Track if animation has completed
  const wasStreamingRef = useRef(isStreaming) // Track previous streaming state

  useEffect(() => {
    // CRITICAL: If we were streaming and now we're not, keep the displayed text
    // This prevents flicker when transitioning from streaming to complete
    if (wasStreamingRef.current && !isStreaming) {
      wasStreamingRef.current = false
      // Keep current displayed text, don't reset
      if (displayedText !== cleanText) {
        setDisplayedText(cleanText)
        displayedLengthRef.current = cleanText.length
      }
      
      // Mark as completed
      if (onComplete && !hasCompletedRef.current) {
        hasCompletedRef.current = true
        onComplete()
      }
      return
    }
    
    wasStreamingRef.current = isStreaming
    
    // If not streaming, show full text immediately
    if (!isStreaming) {
      // Only update if text actually changed
      if (cleanText !== displayedText) {
        setDisplayedText(cleanText)
        displayedLengthRef.current = cleanText.length
        lastTextRef.current = cleanText
      }
      
      // Call onComplete immediately since we're showing all text
      if (onComplete && cleanText.length > 0 && !hasCompletedRef.current) {
        hasCompletedRef.current = true
        onComplete()
      }
      return
    }

    // If text hasn't changed, don't restart animation
    if (cleanText === lastTextRef.current) {
      return
    }

    lastTextRef.current = cleanText

    // If text got shorter (shouldn't happen but handle it), reset
    if (cleanText.length < displayedLengthRef.current) {
      displayedLengthRef.current = 0
      setDisplayedText('')
      hasCompletedRef.current = false
    }

    // Animate new characters
    const animate = () => {
      if (displayedLengthRef.current < cleanText.length) {
        // Add multiple characters per frame for smoother effect
        const newLength = Math.min(
          displayedLengthRef.current + speed,
          cleanText.length
        )
        displayedLengthRef.current = newLength
        setDisplayedText(cleanText.substring(0, newLength))
        
        // Continue animation
        animationFrameRef.current = requestAnimationFrame(animate)
      } else {
        // Animation complete - show full text
        setDisplayedText(cleanText)
        
        // Call onComplete callback if provided
        if (onComplete && !hasCompletedRef.current) {
          hasCompletedRef.current = true
          onComplete()
        }
      }
    }

    // Start animation
    animationFrameRef.current = requestAnimationFrame(animate)

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [cleanText, isStreaming, speed, onComplete, displayedText])

  return (
    <div className="text-[13px] text-gray-300 leading-snug prose prose-invert prose-sm max-w-none" style={{ transition: 'none' }}>
      {React.useMemo(() => (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {displayedText}
        </ReactMarkdown>
      ), [displayedText, markdownComponents])}
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary rerenders
  // If not streaming, only rerender if text actually changed
  if (!prevProps.isStreaming && !nextProps.isStreaming) {
    return prevProps.text === nextProps.text;
  }
  // During streaming, allow all updates
  return false;
})
