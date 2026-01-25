'use client'

import React, { lazy, Suspense, useMemo } from 'react'
import { ChatMessage, MediaBlock } from '@/types/chat'
import { detectMediaBlocks } from '@/lib/content-block-detector'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Lazy load block components for better performance
const CommandExecutionBlock = lazy(() => import('@/components/blocks/CommandExecutionBlock'))
const CommandOutputBlock = lazy(() => import('@/components/blocks/CommandOutputBlock'))
const CodeBlock = lazy(() => import('@/components/blocks/CodeBlock'))
const FileBlock = lazy(() => import('@/components/blocks/FileBlock'))
const ImageBlock = lazy(() => import('@/components/blocks/ImageBlock'))
const ErrorBlock = lazy(() => import('@/components/blocks/ErrorBlock'))
const ThinkingBlock = lazy(() => import('@/components/blocks/ThinkingBlock'))
const CRUDBlock = lazy(() => import('@/components/blocks/CRUDBlock'))
const MermaidBlock = lazy(() => import('@/components/blocks/MermaidBlock'))
const JSONBlock = lazy(() => import('@/components/media-blocks/JSONBlock'))
const ChartBlock = lazy(() => import('@/components/media-blocks/ChartBlock'))
const TableBlock = lazy(() => import('@/components/media-blocks/TableBlock'))
const DesktopToolBlock = lazy(() => import('@/components/blocks/DesktopToolBlock'))
const ScreenshotBlock = lazy(() => import('@/components/chat/blocks/ScreenshotBlock'))

// Import MediaBlockManager for rich media blocks
const MediaBlockManager = lazy(() => import('@/components/media-blocks/MediaBlockManager'))

// Import SessionSuggestion directly (not lazy loaded for immediate display)
import SessionSuggestion from '@/components/SessionSuggestion'

// Import TypedText for character-by-character typing effect
import { TypedText } from '@/components/chat/TypedText'

// Loading fallback component
const BlockLoading = () => (
  <div className="animate-pulse bg-[#101218]/30 rounded-lg h-20 w-full" />
)

// Helper function to clean text by removing extra backticks
const cleanMarkdownText = (text: string): string => {
  if (!text) return text;
  
  // Debug: log if we find double backticks
  if (text.includes('``')) {
    console.log('Found double backticks in text:', text.substring(0, 100));
  }
  
  let cleaned = text;
  
  // Remove ALL double backticks and replace with single backticks
  // This fixes cases like ``text`` -> `text`
  cleaned = cleaned.replace(/``/g, '`');
  
  // Also handle triple backticks that aren't code blocks (not at line start)
  cleaned = cleaned.replace(/([^\n])```([^\n])/g, '$1`$2');
  
  // Remove escaped backticks (\\`)
  cleaned = cleaned.replace(/\\`/g, '`');
  
  // Handle HTML-encoded backticks if they exist
  cleaned = cleaned.replace(/&#96;&#96;/g, '&#96;');
  cleaned = cleaned.replace(/&grave;&grave;/g, '&grave;');
  
  if (text !== cleaned) {
    console.log('Cleaned text:', cleaned.substring(0, 100));
  }
  
  return cleaned;
};

// Custom markdown components for proper rendering with inline styles
const markdownComponents = {
  p: ({ children }: any) => <p style={{ marginBottom: '0.5rem' }}>{children}</p>,
  h1: ({ children }: any) => <h1 style={{ fontSize: '1.5em', fontWeight: 600, marginBottom: '0.5rem', marginTop: '1rem' }}>{children}</h1>,
  h2: ({ children }: any) => <h2 style={{ fontSize: '1.3em', fontWeight: 600, marginBottom: '0.5rem', marginTop: '1rem' }}>{children}</h2>,
  h3: ({ children }: any) => <h3 style={{ fontSize: '1.1em', fontWeight: 600, marginBottom: '0.5rem', marginTop: '0.75rem' }}>{children}</h3>,
  h4: ({ children }: any) => <h4 style={{ fontSize: '1em', fontWeight: 600, marginBottom: '0.25rem', marginTop: '0.75rem' }}>{children}</h4>,
  h5: ({ children }: any) => <h5 style={{ fontSize: '1em', fontWeight: 600, marginBottom: '0.25rem', marginTop: '0.75rem' }}>{children}</h5>,
  h6: ({ children }: any) => <h6 style={{ fontSize: '1em', fontWeight: 600, marginBottom: '0.25rem', marginTop: '0.75rem' }}>{children}</h6>,
  ul: ({ children }: any) => <ul style={{ listStyleType: 'disc', listStylePosition: 'outside', marginBottom: '0.75rem', paddingLeft: '1.25rem', marginTop: '0.5rem' }}>{children}</ul>,
  ol: ({ children }: any) => <ol style={{ listStyleType: 'decimal', listStylePosition: 'outside', marginBottom: '0.75rem', paddingLeft: '1.25rem', marginTop: '0.5rem' }}>{children}</ol>,
  li: ({ children }: any) => <li style={{ marginBottom: '0.375rem', lineHeight: '1.6' }}>{children}</li>,
  strong: ({ children }: any) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
  em: ({ children }: any) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
  a: ({ href, children }: any) => <a href={href} style={{ color: '#60a5fa', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer">{children}</a>,
  blockquote: ({ children }: any) => <blockquote style={{ borderLeft: '3px solid #4b5563', paddingLeft: '1rem', fontStyle: 'italic', marginTop: '0.5rem', marginBottom: '0.5rem', color: '#9ca3af' }}>{children}</blockquote>,
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid #374151', marginTop: '1rem', marginBottom: '1rem' }} />,
  pre: ({ children }: any) => <pre style={{ backgroundColor: '#22252F', padding: '0.5rem', borderRadius: '0.25rem', overflowX: 'auto', margin: '0.5rem 0' }}>{children}</pre>,
  code: ({ inline, className, children, node, ...props }: any) => {
    // AGGRESSIVE CLEANING: Remove ALL backticks from code content
    let cleanChildren = children;
    if (children) {
      if (typeof children === 'string') {
        cleanChildren = children.replace(/[`´'']/g, '');
      } else if (Array.isArray(children)) {
        cleanChildren = children.map(child => 
          typeof child === 'string' ? child.replace(/[`´'']/g, '') : child
        );
      }
    }
    
    // Determine if this should be inline based on multiple factors
    const hasLanguageClass = className && className.startsWith('language-');
    const isMultiline = typeof children === 'string' && children.includes('\n');
    const shouldBeInline = !hasLanguageClass && !isMultiline;
    
    if (shouldBeInline) {
      // Use inline styles directly - they have highest specificity
      return (
        <code 
          style={{
            display: 'inline',
            background: 'rgba(100, 116, 139, 0.15)',
            padding: '1px 3px',
            borderRadius: '2px',
            fontSize: '0.88em',
            fontFamily: 'monospace',
            fontWeight: 400,
            whiteSpace: 'nowrap',
            margin: 0,
            lineHeight: 'inherit',
            verticalAlign: 'baseline'
          }}
          {...props}
        >{cleanChildren}</code>
      );
    } else {
      return (
        <code 
          className={className}
          style={{ 
            display: 'block', 
            backgroundColor: '#22252F', 
            padding: '0.5rem', 
            borderRadius: '0.25rem', 
            fontSize: '13px', 
            fontFamily: 'monospace', 
            overflowX: 'auto',
            color: '#cccccc'
          }}
          {...props}
        >{cleanChildren}</code>
      );
    }
  },
}

interface MessageRendererProps {
  message: ChatMessage
  index: number
  onCreateNewSession?: () => void
  onDismissSessionSuggestion?: () => void
  isStreaming?: boolean
}

const MessageRenderer = React.memo(function MessageRenderer({ message, index, onCreateNewSession, onDismissSessionSuggestion, isStreaming = false }: MessageRendererProps) {
  // Simple approach: just track if we've ever been streaming
  // Once streaming completes, we render the final content without any transition
  const wasStreamingRef = React.useRef(isStreaming)
  
  React.useEffect(() => {
    if (isStreaming) {
      wasStreamingRef.current = true
    }
  }, [isStreaming])
  // Detect media blocks from the message (memoized)
  // If we have streaming mediaBlocks, prefer those over content detection to avoid duplicates
  const mediaBlocks = useMemo(() => {
    // If we have streaming media blocks, use those instead of detecting from content
    if (message.mediaBlocks && message.mediaBlocks.length > 0) {
      return message.mediaBlocks;
    }

    const detected = detectMediaBlocks(message);
    return detected;
  }, [message.mediaBlocks, message.content])

  // Remove media block content from the text content (memoized)
  const getCleanTextContent = React.useCallback((content: string): string => {
    let cleanContent = content

    // Remove code blocks (including mermaid) - flexible whitespace
    cleanContent = cleanContent.replace(/```[\w]*(?::([^\n]+))?\s*[\s\S]*?```/g, '')

    // Remove error patterns
    cleanContent = cleanContent.replace(/Error:\s*([^\n]+)/gi, '')
    cleanContent = cleanContent.replace(/Exception:\s*([^\n]+)/gi, '')
    cleanContent = cleanContent.replace(/❌\s*([^\n]+)/gi, '')
    cleanContent = cleanContent.replace(/Failed:\s*([^\n]+)/gi, '')

    // Remove file operation patterns
    cleanContent = cleanContent.replace(/(?:read|write|create|delete)\s+file:\s*([^\n]+)/gi, '')

    // Remove CRUD operation patterns
    cleanContent = cleanContent.replace(/(CREATE|READ|UPDATE|DELETE)\s+(\w+):\s*([^\n]+)/gi, '')

    // Remove command execution patterns
    cleanContent = cleanContent.replace(/I will (?:now )?execute (?:the command )?`([^`]+)`/gi, '')
    cleanContent = cleanContent.replace(/I will execute `([^`]+)`/gi, '')
    cleanContent = cleanContent.replace(/Executing (?:command|the command)?:?\s*`([^`]+)`/gi, '')
    cleanContent = cleanContent.replace(/I will (?:now )?execute the `([^`]+)` command/gi, '')
    
    // Remove ALL "Analyzing result" patterns (don't show them at all)
    cleanContent = cleanContent.replace(/💭\s*Analyzing result\.{3}\s*/gi, '')

    return cleanContent.trim()
  }, [])

  const cleanTextContent = useMemo(() => getCleanTextContent(message.content), [message.content, getCleanTextContent])

  // Split content at command execution patterns to create proper flow (memoized)
  const splitContentAtCommands = React.useCallback((content: string): Array<{ type: 'text' | 'command-exec', content: string, command?: string }> => {
    const segments: Array<{ type: 'text' | 'command-exec', content: string, command?: string }> = []
    
    // Combined pattern to match all command execution formats
    const commandPattern = /I will (?:now )?execute (?:the command )?`([^`]+)`|I will execute `([^`]+)`|Executing (?:command|the command)?:?\s*`([^`]+)`|I will (?:now )?execute the `([^`]+)` command/gi
    
    let lastIndex = 0
    let match: RegExpExecArray | null
    
    while ((match = commandPattern.exec(content)) !== null) {
      // Add text before this command
      if (match.index > lastIndex) {
        const textBefore = content.substring(lastIndex, match.index)
        if (textBefore.trim()) {
          segments.push({ type: 'text', content: textBefore })
        }
      }
      
      // Extract the command from whichever capture group matched
      const command = (match[1] || match[2] || match[3] || match[4]).trim()
      
      // Add command execution segment
      segments.push({
        type: 'command-exec',
        content: match[0],
        command
      })
      
      lastIndex = match.index + match[0].length
    }
    
    // Add remaining text
    if (lastIndex < content.length) {
      const textAfter = content.substring(lastIndex)
      if (textAfter.trim()) {
        segments.push({ type: 'text', content: textAfter })
      }
    }
    
    return segments
  }, [])

  // Parse content to get text segments and their positions relative to media blocks (memoized)
  const parseContentWithBlocks = React.useCallback((content: string): Array<{ type: 'text' | 'block' | 'code' | 'mermaid', content: string, blockIndex?: number, language?: string, code?: string }> => {
    const segments: Array<{ type: 'text' | 'block' | 'code' | 'mermaid', content: string, blockIndex?: number, language?: string, code?: string }> = []

    // Find all block positions (command blocks, mermaid blocks, and regular code blocks)
    const commandBlockRegex = /\[COMMAND_BLOCK\]\s*```command\s*[\s\S]*?```\s*\[\/COMMAND_BLOCK\]/g
    const mermaidBlockRegex = /```mermaid\s*([\s\S]*?)```/g
    const codeBlockRegex = /```(\w+)?(?::([^\n]+))?\s*([\s\S]*?)```/g

    // Collect all matches with their positions
    const allMatches: Array<{ index: number, length: number, type: 'command' | 'code' | 'mermaid', match: RegExpExecArray }> = []

    let match: RegExpExecArray | null
    while ((match = commandBlockRegex.exec(content)) !== null) {
      allMatches.push({ index: match.index, length: match[0].length, type: 'command', match })
    }

    while ((match = mermaidBlockRegex.exec(content)) !== null) {
      allMatches.push({ index: match.index, length: match[0].length, type: 'mermaid', match })
    }

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1]?.toLowerCase() || 'text'
      // Skip special blocks that are handled separately
      if (language !== 'mermaid' && language !== 'command' && language !== 'json' && language !== 'chart') {
        allMatches.push({ index: match.index, length: match[0].length, type: 'code', match })
      }
    }

    // Sort by position
    allMatches.sort((a, b) => a.index - b.index)

    let lastIndex = 0
    let blockIndex = 0

    for (const matchInfo of allMatches) {
      // Add text before this block
      if (matchInfo.index > lastIndex) {
        const textBefore = content.substring(lastIndex, matchInfo.index).trim()
        if (textBefore) {
          segments.push({ type: 'text', content: textBefore })
        }
      }

      if (matchInfo.type === 'command') {
        // Add command block marker
        segments.push({ type: 'block', content: matchInfo.match[0], blockIndex: blockIndex++ })
      } else if (matchInfo.type === 'mermaid') {
        // Add mermaid block marker
        const code = matchInfo.match[1].trim()
        segments.push({ type: 'mermaid', content: matchInfo.match[0], code })
      } else if (matchInfo.type === 'code') {
        // Add code block
        const language = matchInfo.match[1] || 'text'
        const code = matchInfo.match[3].trim()
        segments.push({ type: 'code', content: matchInfo.match[0], language, code })
      }

      lastIndex = matchInfo.index + matchInfo.length
    }

    // Add remaining text
    if (lastIndex < content.length) {
      const textAfter = content.substring(lastIndex).trim()
      if (textAfter) {
        segments.push({ type: 'text', content: textAfter })
      }
    }

    return segments
  }, [])

  const contentSegments = useMemo(() => parseContentWithBlocks(message.content), [message.content, parseContentWithBlocks])
  const commandSplitSegments = useMemo(() => splitContentAtCommands(message.content), [message.content, splitContentAtCommands])
  
  // Track which command blocks have been rendered to avoid duplicates
  const renderedCommandBlocks = new Set()


  const renderMediaBlock = React.useCallback((block: MediaBlock, blockIndex: number) => {
    const key = `${block.type}-${blockIndex}`

    let blockContent = null

    switch (block.type) {
      case 'command-execution':
        if ('command' in block.data && 'status' in block.data) {
          const execData = block.data as import('@/types/chat').CommandExecutionBlockData
          blockContent = (
            <CommandExecutionBlock
              command={execData.command}
              status={execData.status}
              output={execData.output}
              exitCode={execData.exitCode}
              duration={execData.duration}
              focused={block.focused}
            />
          )
        }
        break

      case 'command':
        if ('command' in block.data && 'output' in block.data) {
          blockContent = (
            <CommandOutputBlock
              command={block.data.command}
              output={block.data.output}
              status={block.data.exitCode === 0 ? 'success' : 'error'}
              exitCode={block.data.exitCode}
              duration={block.data.duration}
              focused={block.focused}
            />
          )
        }
        break

      case 'code':
        if ('code' in block.data && 'language' in block.data) {
          blockContent = (
            <CodeBlock
              code={block.data.code}
              language={block.data.language}
              filename={block.data.filename}
              startLine={block.data.startLine}
              focused={block.focused}
            />
          )
        }
        break

      case 'file':
        if ('path' in block.data && 'content' in block.data) {
          blockContent = (
            <FileBlock
              path={block.data.path}
              content={block.data.content}
              language={block.data.language}
              operation={block.data.operation}
              modified={block.data.modified}
              focused={block.focused}
            />
          )
        }
        break

      case 'image':
        if ('url' in block.data) {
          blockContent = (
            <ImageBlock
              url={block.data.url}
              alt={block.data.alt}
              width={block.data.width}
              height={block.data.height}
              focused={block.focused}
            />
          )
        }
        break

      case 'error':
        if ('message' in block.data) {
          blockContent = (
            <ErrorBlock
              message={block.data.message}
              type={block.data.type}
              stack={block.data.stack}
              code={block.data.code}
              focused={block.focused}
            />
          )
        }
        break

      case 'screenshot':
        if ('screenData' in block.data) {
          blockContent = (
            <ScreenshotBlock
              screenData={block.data.screenData}
              imageData={block.data.imageData}
              timestamp={block.data.timestamp}
              focused={block.focused}
            />
          )
        }
        break

      case 'thinking':
        if ('steps' in block.data) {
          blockContent = (
            <ThinkingBlock
              steps={block.data.steps}
              collapsed={block.data.collapsed}
              focused={block.focused}
            />
          )
        }
        break

      case 'json':
        if ('data' in block.data) {
          const jsonData = block.data as import('@/types/chat').JSONBlockData
          blockContent = (
            <JSONBlock
              data={jsonData}
              focused={block.focused}
            />
          )
        }
        break

      case 'chart':
        if ('type' in block.data && 'data' in block.data) {
          const chartData = block.data as import('@/types/chat').ChartBlockData
          blockContent = (
            <ChartBlock
              data={chartData}
              focused={block.focused}
            />
          )
        }
        break

      case 'table':
        if ('headers' in block.data && 'rows' in block.data) {
          const tableData = block.data as import('@/types/chat').TableBlockData
          blockContent = (
            <TableBlock
              data={tableData}
              focused={block.focused}
            />
          )
        }
        break

      case 'desktop-tool':
        if ('toolName' in block.data && 'args' in block.data && 'output' in block.data) {
          const desktopData = block.data as import('@/types/chat').DesktopToolBlockData
          blockContent = (
            <DesktopToolBlock
              toolName={desktopData.toolName}
              args={desktopData.args}
              output={desktopData.output}
              status={desktopData.status}
              duration={desktopData.duration}
              imageData={desktopData.imageData}
              focused={block.focused}
            />
          )
        }
        break

      case 'crud':
        if ('operation' in block.data && 'resource' in block.data && 'status' in block.data) {
          blockContent = (
            <CRUDBlock
              operation={block.data.operation}
              resource={block.data.resource}
              data={block.data.data}
              beforeData={block.data.beforeData}
              afterData={block.data.afterData}
              status={block.data.status}
              timestamp={block.data.timestamp}
              sessionStateId={block.data.sessionStateId}
              changes={block.data.changes}
              focused={block.focused}
            />
          )
        }
        break

      case 'mermaid':
        if ('code' in block.data) {
          const mermaidData = block.data as { code: string; diagramType?: string; renderError?: string }
          blockContent = (
            <MermaidBlock
              code={mermaidData.code}
              diagramType={mermaidData.diagramType}
              renderError={mermaidData.renderError}
              focused={block.focused}
            />
          )
        }
        break

      case 'session-suggestion':
        if ('messageCount' in block.data) {
          const suggestionData = block.data as { messageCount: number; dismissed?: boolean }
          blockContent = (
            <SessionSuggestion
              messageCount={suggestionData.messageCount}
              onCreateNewSession={() => {
                if (onCreateNewSession) {
                  onCreateNewSession()
                }
              }}
              onDismiss={() => {
                if (onDismissSessionSuggestion) {
                  onDismissSessionSuggestion()
                }
              }}
            />
          )
        }
        break

      default:
        break
    }

    if (blockContent) {
      return (
        <Suspense key={key} fallback={<BlockLoading />}>
          {blockContent}
        </Suspense>
      );
    }
    return null;
  }, [])


  return (
    <div className="space-y-3" style={{ willChange: 'auto', contain: 'layout', transition: 'none', animation: 'none' }}>
      {/* User Message - Right Aligned in Block */}
      {message.role === 'user' && (
        <div className="flex justify-end mb-3">
          <div className="max-w-[75%] rounded-md px-3 py-1.5 shadow-sm" style={{ backgroundColor: '#252529' }}>
            <div className="text-[13px] text-gray-100 leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </div>
            
            {/* Attached Files - Display at bottom of message */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {message.attachments.map((attachment: any, idx: number) => (
                  <div key={idx} className="relative group">
                    {/* Image Attachment */}
                    {attachment.type === 'image' && attachment.data && (
                      <div className="relative w-24 h-24 rounded-lg border border-gray-600 overflow-hidden bg-gray-800">
                        <img 
                          src={attachment.data} 
                          alt={attachment.name || 'Attached image'} 
                          className="w-full h-full object-cover" 
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5">
                          <div className="text-[8px] text-gray-300 truncate">
                            {attachment.name || 'image'}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Video Attachment */}
                    {attachment.type === 'video' && attachment.data && (
                      <div className="relative w-24 h-24 rounded-lg border border-gray-600 overflow-hidden bg-gray-800">
                        <video src={attachment.data} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5">
                          <div className="text-[8px] text-gray-300 truncate">
                            {attachment.name || 'video'}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Text File Attachment */}
                    {attachment.type === 'text' && (
                      <div className="relative w-32 h-24 rounded-lg border border-gray-600 bg-gray-800 p-2 overflow-hidden">
                        <div className="text-[9px] text-gray-400 font-mono leading-tight line-clamp-5">
                          {typeof attachment.data === 'string' ? attachment.data.substring(0, 100) : ''}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5">
                          <div className="text-[8px] text-gray-300 truncate">
                            {attachment.name || 'text file'}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Other File Types */}
                    {attachment.type === 'other' && (
                      <div className="relative w-24 h-24 rounded-lg border border-gray-600 bg-gray-800 flex flex-col items-center justify-center p-2">
                        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5">
                          <div className="text-[8px] text-gray-300 truncate">
                            {attachment.name || 'file'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assistant Message - Left Aligned */}
      {message.role === 'assistant' && (
        <div className="flex justify-start mb-3" style={{ animation: 'none', transition: 'none' }}>
          <div 
            className="max-w-[85%] space-y-2" 
            style={{ 
              animation: 'none', 
              transition: 'none',
              willChange: isStreaming ? 'contents' : 'auto',
              contain: 'layout style'
            }}
          >
            {/* Single unified render path for both streaming and non-streaming */}
            {/* During streaming: show TypedText with streaming content */}
            {/* After streaming: show structured blocks */}
            {isStreaming ? (
              // STREAMING: Show simple typed text
              <div key="streaming-content" style={{ contain: 'layout style' }}>
                {!message.mediaBlocks?.length ? (
                  <TypedText
                    key="streaming-text"
                    text={(message as any)._streamingText || message.content || ''}
                    isStreaming={true}
                    speed={30}
                    markdownComponents={markdownComponents}
                  />
                ) : (
                  <div className="flex flex-col space-y-4">
                    {message.mediaBlocks.map((block, idx) => {
                      if (block.type === 'text') {
                        const textData = block.data as any;
                        return (
                          <TypedText
                            key={block.id}
                            text={textData.text}
                            isStreaming={false}
                            speed={30}
                            markdownComponents={markdownComponents}
                          />
                        );
                      } else {
                        return (
                          <Suspense key={block.id} fallback={<BlockLoading />}>
                            {renderMediaBlock(block as MediaBlock, idx)}
                          </Suspense>
                        );
                      }
                    })}
                    {(() => {
                      const streamingText = (message as any)._streamingText || '';
                      const processedLength = (message as any).processedTextLength || 0;
                      const newText = streamingText.substring(processedLength);
                      if (newText.trim()) {
                        return (
                          <TypedText
                            key={`streaming-new-${processedLength}`}
                            text={newText}
                            isStreaming={true}
                            speed={30}
                            markdownComponents={markdownComponents}
                          />
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
              </div>
            ) : (
              // NON-STREAMING: Show structured content
              <div key="final-content" style={{ contain: 'layout style' }}>
            {/* If we have media blocks (with or without introText), use custom rendering */}
            {message.mediaBlocks && message.mediaBlocks.length > 0 ? (
              <div className="flex flex-col space-y-4">
                {/* Render intro text before media blocks if it exists */}
                {message.introText && message.introText.trim() && (
                  <div className="text-[13px] text-gray-300 leading-snug prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{cleanMarkdownText(message.introText)}</ReactMarkdown>
                  </div>
                )}
                {/* Render ALL media blocks including text blocks - they're already in the correct order */}
                <Suspense fallback={<BlockLoading />}>
                  <MediaBlockManager blocks={message.mediaBlocks} />
                </Suspense>
                {/* FALLBACK: If there's content but no text blocks, show it */}
                {(() => {
                  const hasTextBlocks = message.mediaBlocks.some(b => b.type === 'text');
                  const content = message.content || (message as any)._streamingText || '';
                  
                  // If we have content but no text blocks to display it, show it as fallback
                  if (!hasTextBlocks && content.trim()) {
                    return (
                      <div className="text-[13px] text-gray-300 leading-snug prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{cleanMarkdownText(content)}</ReactMarkdown>
                      </div>
                    );
                  }
                  return null;
                })()}
                {/* Don't render remaining text - it's already in text blocks or not needed */}
              </div>
            ) : contentSegments.some(s => s.type === 'code' || s.type === 'block' || s.type === 'mermaid') ? (
              // Render content segments with embedded blocks
              <>
                {contentSegments.map((segment, idx) => {
                  if (segment.type === 'text') {
                    const cleanText = getCleanTextContent(segment.content)
                    return cleanText ? (
                      <div key={`text-${idx}`} className="text-[13px] text-gray-300 leading-snug prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{cleanMarkdownText(cleanText)}</ReactMarkdown>
                      </div>
                    ) : null
                  } else if (segment.type === 'mermaid' && segment.code) {
                    // Render inline Mermaid diagram
                    const firstLine = segment.code.split('\n')[0].trim()
                    let diagramType = 'flowchart'
                    if (firstLine.startsWith('sequenceDiagram')) diagramType = 'sequence'
                    else if (firstLine.startsWith('classDiagram')) diagramType = 'class'
                    else if (firstLine.startsWith('stateDiagram')) diagramType = 'state'
                    else if (firstLine.startsWith('erDiagram')) diagramType = 'er'
                    else if (firstLine.startsWith('gantt')) diagramType = 'gantt'
                    else if (firstLine.startsWith('pie')) diagramType = 'pie'
                    else if (firstLine.startsWith('graph')) diagramType = 'flowchart'
                    
                    return (
                      <Suspense key={`mermaid-${idx}`} fallback={<BlockLoading />}>
                        <MermaidBlock
                          code={segment.code}
                          diagramType={diagramType}
                          focused={false}
                        />
                      </Suspense>
                    )
                  } else if (segment.type === 'code' && segment.code && segment.language) {
                    // Render inline code block
                    return (
                      <Suspense key={`code-${idx}`} fallback={<BlockLoading />}>
                        <CodeBlock
                          code={segment.code}
                          language={segment.language}
                          focused={false}
                        />
                      </Suspense>
                    )
                  } else if (segment.type === 'block' && segment.blockIndex !== undefined) {
                    const block = mediaBlocks[segment.blockIndex]
                    return block ? renderMediaBlock(block as MediaBlock, segment.blockIndex) : null
                  }
                  return null
                })}

                {/* Also render streaming media blocks if any (excluding mermaid which is handled above) */}
                {message.mediaBlocks && message.mediaBlocks.filter(b => b.type !== 'mermaid').length > 0 && (
                  <>
                    <Suspense fallback={<BlockLoading />}>
                      <MediaBlockManager blocks={message.mediaBlocks.filter(b => b.type !== 'mermaid')} />
                    </Suspense>
                  </>
                )}
              </>
            ) : commandSplitSegments.length > 1 ? (
              // Render with command execution blocks interleaved
              <>
                {commandSplitSegments.map((segment, idx) => {
                  if (segment.type === 'text') {
                    const cleanText = getCleanTextContent(segment.content)
                    if (!cleanText) return null
                    
                    // Remove "Analyzing result" text completely
                    const textWithoutAnalyzing = cleanText.replace(/💭\s*Analyzing result\.{3}\s*/gi, '').trim()
                    
                    // Only render if there's actual content after removing the analyzing text
                    if (!textWithoutAnalyzing) return null
                    
                    return (
                      <div key={`text-${idx}`} className="text-[13px] text-gray-300 leading-snug prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{cleanMarkdownText(textWithoutAnalyzing)}</ReactMarkdown>
                      </div>
                    )
                  } else if (segment.type === 'command-exec' && segment.command) {
                    // Skip if already rendered
                    if (renderedCommandBlocks.has(segment.command)) {
                      return null
                    }
                    renderedCommandBlocks.add(segment.command)
                    
                    // Check if we have actual command results in mediaBlocks
                    const commandBlock = message.mediaBlocks?.find(
                      block => block.type === 'command' && 'command' in block.data && block.data.command === segment.command
                    )
                    
                    if (commandBlock) {
                      // Render the actual command result block
                      return renderMediaBlock(commandBlock as any, idx)
                    } else {
                      // Render loading block
                      return (
                        <Suspense key={`cmd-exec-${idx}`} fallback={<BlockLoading />}>
                          <CommandExecutionBlock
                            command={segment.command}
                            status="executing"
                            focused={false}
                          />
                        </Suspense>
                      )
                    }
                  }
                  return null
                })}
                
                {/* Render non-command media blocks */}
                {message.mediaBlocks && message.mediaBlocks.filter(block => block.type !== 'command').length > 0 && (
                  <Suspense fallback={<BlockLoading />}>
                    <MediaBlockManager blocks={message.mediaBlocks.filter(block => block.type !== 'command')} />
                  </Suspense>
                )}
              </>
            ) : message.mediaBlocks && message.mediaBlocks.length > 0 ? (
              // Smart rendering: Interleave text and blocks based on order
              <>
                {(() => {
                  // Split content into segments and interleave with media blocks
                  const blocks = message.mediaBlocks || [];
                  const introText = message.introText || '';
                  
                  return (
                    <>
                      {/* Render intro text (before first tool call) if it exists */}
                      {introText && introText.trim() && (
                        <div className="text-[13px] text-gray-300 leading-snug mb-2 prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{cleanMarkdownText(introText)}</ReactMarkdown>
                        </div>
                      )}
                      
                      {/* Render all media blocks in order, including text blocks */}
                      <div className="space-y-4">
                        {blocks.map((block, idx) => {
                          if (block.type === 'text') {
                            // Render text block inline
                            const textData = block.data as any;
                            return (
                              <div key={block.id} className="text-[13px] text-gray-300 leading-snug prose prose-invert prose-sm max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{cleanMarkdownText(textData.text)}</ReactMarkdown>
                              </div>
                            );
                          } else {
                            // Render other media blocks
                            return (
                              <Suspense key={block.id} fallback={<BlockLoading />}>
                                {renderMediaBlock(block as MediaBlock, idx)}
                              </Suspense>
                            );
                          }
                        })}
                      </div>
                    </>
                  );
                })()}
              </>
            ) : (
              <>
                {/* Fallback: Render blocks from content detection */}
                {mediaBlocks.length > 0 && (
                  <div className="space-y-2">
                    {mediaBlocks.map((block, blockIndex) => renderMediaBlock(block, blockIndex))}
                  </div>
                )}

                {/* AI Response Text - NO BLOCK, just plain text */}
                {cleanTextContent && (
                  <div className="text-[13px] text-gray-300 leading-snug prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{cleanMarkdownText(cleanTextContent)}</ReactMarkdown>
                  </div>
                )}
              </>
            )}
            </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary rerenders
  
  // During streaming, always allow rerenders to show updates
  if (nextProps.isStreaming) {
    return false;
  }
  
  // CRITICAL: When transitioning from streaming to non-streaming,
  // check if the content is actually the same. If the final content
  // matches what was being streamed, skip the rerender to prevent flicker
  if (prevProps.isStreaming && !nextProps.isStreaming) {
    const prevStreamingText = (prevProps.message as any)._streamingText || prevProps.message.content;
    const nextFinalContent = nextProps.message.content;
    
    // If the content is essentially the same, skip rerender
    if (prevStreamingText === nextFinalContent) {
      return true; // Skip rerender - content is the same
    }
    
    // Otherwise allow rerender to show structured blocks
    return false;
  }
  
  // For stable non-streaming messages, do deep comparison
  if (prevProps.message === nextProps.message) {
    return true;
  }
  
  const contentSame = prevProps.message.content === nextProps.message.content;
  const roleSame = prevProps.message.role === nextProps.message.role;
  const mediaBlocksSame = prevProps.message.mediaBlocks === nextProps.message.mediaBlocks;
  const introTextSame = prevProps.message.introText === nextProps.message.introText;
  const attachmentsSame = prevProps.message.attachments === nextProps.message.attachments;
  const indexSame = prevProps.index === nextProps.index;
  
  return contentSame && roleSame && mediaBlocksSame && introTextSame && attachmentsSame && indexSame;
})

export default MessageRenderer
