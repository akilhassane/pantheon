'use client'

import React from 'react'
import { ChatMessage } from '@/types/chat'
import type { UIMessage } from 'ai'
import { Brain, FolderOpen } from 'lucide-react'
import { Project } from '@/types/session'

// Type alias for convenience
type Message = UIMessage
import MessageRenderer from './MessageRenderer'

export interface AttachedFile {
  file: File
  preview?: string
  type: 'image' | 'video' | 'text' | 'other'
  base64?: string
}

interface CursorStyleChatProps {
  chatHistory: ChatMessage[]
  messages?: Message[]  // NEW: Support for Vercel AI SDK messages with parts
  isLoading: boolean
  status?: 'submitted' | 'streaming' | 'ready' | 'error'
  message: string
  setMessage: (msg: string) => void
  handleSendMessage: () => void
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  handleFileAttachment: () => void
  handleAudioInput: () => void
  isRecording: boolean
  selectedModel: string
  models: Array<{ id: string; name: string; description: string }>
  setSelectedModel: (model: string) => void
  showModelDropdown: boolean
  setShowModelDropdown: (show: boolean) => void
  onCreateNewSession?: () => void
  onDismissSessionSuggestion?: () => void
  thinkingContent?: string
  onStop?: () => void
  attachedFiles?: AttachedFile[]
  setAttachedFiles?: React.Dispatch<React.SetStateAction<AttachedFile[]>>
  allSessionsHistory?: ChatMessage[] // All messages from all sessions for command history
  // Custom modes
  customModes?: Array<{ id: string; name: string; description: string; systemPrompt: string }>
  selectedCustomMode?: string | null
  setSelectedCustomMode?: (mode: string | null) => void
  showModeDropdown?: boolean
  setShowModeDropdown?: (show: boolean) => void
  // Projects
  projects?: Project[]
  selectedProjectId?: string | null
  setSelectedProjectId?: (projectId: string | null) => void
  showProjectDropdown?: boolean
  setShowProjectDropdown?: (show: boolean) => void
}

export default function CursorStyleChat({
  chatHistory,
  messages,
  isLoading,
  status = 'ready',
  message,
  setMessage,
  handleSendMessage,
  handleKeyDown,
  handleFileAttachment,
  handleAudioInput,
  isRecording,
  selectedModel,
  models,
  setSelectedModel,
  showModelDropdown,
  setShowModelDropdown,
  onCreateNewSession,
  onDismissSessionSuggestion,
  thinkingContent = '',
  onStop,
  attachedFiles: externalAttachedFiles,
  setAttachedFiles: externalSetAttachedFiles,
  allSessionsHistory,
  customModes = [],
  selectedCustomMode = null,
  setSelectedCustomMode,
  showModeDropdown = false,
  setShowModeDropdown
}: CursorStyleChatProps) {
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const [isUserScrolling, setIsUserScrolling] = React.useState(false)
  const [shouldAutoScroll, setShouldAutoScroll] = React.useState(true)
  
  // Debug: Log when selectedCustomMode changes (disabled to reduce log spam)
  // React.useEffect(() => {
  //   console.log('🎨 [CursorStyleChat] Mode state changed:', {
  //     selectedCustomMode,
  //     customModesCount: customModes.length,
  //     modeName: selectedCustomMode ? customModes.find(m => m.id === selectedCustomMode)?.name : 'Default Mode'
  //   })
  // }, [selectedCustomMode, customModes])
  
  // Command history state - now includes attachments
  const [commandHistory, setCommandHistory] = React.useState<Array<{ message: string; attachments: AttachedFile[] }>>([])
  const [historyIndex, setHistoryIndex] = React.useState(-1)
  const [currentDraft, setCurrentDraft] = React.useState('')
  const [currentDraftAttachments, setCurrentDraftAttachments] = React.useState<AttachedFile[]>([])

  // Always use chatHistory for MessageRenderer
  // MessageRenderer handles all message types including streaming
  const displayMessages = React.useMemo(() => chatHistory, [chatHistory])
  
  // Track rendered message count to avoid rerendering existing messages
  const renderedCountRef = React.useRef(0)
  const [forceRenderKey, setForceRenderKey] = React.useState(0)
  
  // Memoize the message rendering to prevent unnecessary rerenders
  const renderedMessages = React.useMemo(() => {
    const messages = displayMessages.map((msg, idx) => {
      const isLastMessage = idx === displayMessages.length - 1;
      const isAssistant = msg.role === 'assistant';
      const isCurrentlyStreaming = status === 'streaming' && isLastMessage && isAssistant;
      
      // Use a stable key based on timestamp or index - don't change key based on streaming state
      // This prevents React from unmounting/remounting the component when streaming completes
      const messageKey = msg.timestamp ? `msg-${msg.timestamp}` : `msg-idx-${idx}`;
      
      // Check if this is a new message (beyond what we've rendered before)
      const isNewMessage = idx >= renderedCountRef.current;
      
      return (
        <MessageRenderer 
          key={messageKey}
          message={msg} 
          index={idx}
          onCreateNewSession={onCreateNewSession}
          onDismissSessionSuggestion={onDismissSessionSuggestion}
          isStreaming={isCurrentlyStreaming}
        />
      );
    });
    
    // Update rendered count only when we have more messages
    if (displayMessages.length > renderedCountRef.current) {
      renderedCountRef.current = displayMessages.length;
    }
    
    return messages;
  }, [displayMessages, status, onCreateNewSession, onDismissSessionSuggestion, forceRenderKey])
  
  // Build command history from user messages with attachments - use all sessions if provided
  React.useEffect(() => {
    // Use all sessions history if provided, otherwise use current session only
    const historySource = allSessionsHistory || chatHistory
    
    const userMessages = historySource
      .filter(msg => msg.role === 'user' && msg.content.trim())
      .map(msg => ({
        message: msg.content, // Keep original formatting including newlines
        attachments: msg.attachments?.map(att => ({
          file: new File([], att.name, { type: att.mimeType }),
          preview: att.type === 'image' || att.type === 'video' ? att.data : att.type === 'text' ? att.data.substring(0, 100) : undefined,
          type: att.type,
          base64: att.data
        })) || []
      }))
    
    // Sort by timestamp if available (most recent last)
    const sortedMessages = userMessages.sort((a, b) => {
      const aMsg = historySource.find(m => m.content === a.message)
      const bMsg = historySource.find(m => m.content === b.message)
      if (aMsg?.timestamp && bMsg?.timestamp) {
        return new Date(aMsg.timestamp).getTime() - new Date(bMsg.timestamp).getTime()
      }
      return 0
    })
    
    setCommandHistory(sortedMessages)
    setHistoryIndex(-1) // Reset to end of history
  }, [chatHistory, allSessionsHistory])
  
  // Ref to track cursor position before arrow key
  const cursorBeforeArrowRef = React.useRef<number | null>(null)
  // Ref to track textarea element
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  // File input ref
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  
  // State for attached files - use external state if provided, otherwise use local state
  const [localAttachedFiles, setLocalAttachedFiles] = React.useState<AttachedFile[]>([])
  const attachedFiles = externalAttachedFiles ?? localAttachedFiles
  const setAttachedFiles = externalSetAttachedFiles ?? setLocalAttachedFiles
  
  // State for audio visualization
  const [audioLevels, setAudioLevels] = React.useState<number[]>(Array(40).fill(0))
  const audioContextRef = React.useRef<AudioContext | null>(null)
  const analyserRef = React.useRef<AnalyserNode | null>(null)
  const animationFrameRef = React.useRef<number | null>(null)
  
  // Speech recognition
  const recognitionRef = React.useRef<any>(null)
  const [interimTranscript, setInterimTranscript] = React.useState('')
  
  // Track if textarea is expanded (more than one line)
  const [isTextareaExpanded, setIsTextareaExpanded] = React.useState(false)
  
  // Drag and drop state
  const [isDraggingOver, setIsDraggingOver] = React.useState(false)
  const dragCounterRef = React.useRef(0)
  
  // Helper function to resize textarea based on content
  const resizeTextarea = React.useCallback((textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto'
    const newHeight = Math.min(textarea.scrollHeight, 200)
    textarea.style.height = newHeight + 'px'
    // Update expanded state based on height
    setIsTextareaExpanded(newHeight > 28)
  }, [])
  
  // Helper function to reset textarea to initial state
  const resetTextarea = React.useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '28px' // Reset to initial height
    }
  }, [])
  
  // Auto-resize textarea when message or interimTranscript changes
  React.useEffect(() => {
    if (textareaRef.current) {
      resizeTextarea(textareaRef.current)
    }
  }, [message, interimTranscript, resizeTextarea])
  
  // Audio visualization effect
  React.useEffect(() => {
    if (isRecording) {
      // Start audio visualization
      const startVisualization = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          const audioContext = new AudioContext()
          const analyser = audioContext.createAnalyser()
          const source = audioContext.createMediaStreamSource(stream)
          
          analyser.fftSize = 128
          source.connect(analyser)
          
          audioContextRef.current = audioContext
          analyserRef.current = analyser
          
          const dataArray = new Uint8Array(analyser.frequencyBinCount)
          
          const updateLevels = () => {
            if (analyserRef.current) {
              analyserRef.current.getByteFrequencyData(dataArray)
              
              // Sample 40 bars from the frequency data
              const bars = 40
              const step = Math.floor(dataArray.length / bars)
              const levels = Array.from({ length: bars }, (_, i) => {
                const value = dataArray[i * step] / 255
                return Math.min(value * 1.5, 1) // Amplify and cap at 1
              })
              
              setAudioLevels(levels)
              animationFrameRef.current = requestAnimationFrame(updateLevels)
            }
          }
          
          updateLevels()
        } catch (error) {
          console.error('Error accessing microphone:', error)
        }
      }
      
      startVisualization()
      
      // Start speech recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        
        // Common languages to try - covers most use cases
        // The API will use the first one, but we set maxAlternatives high
        // to get better recognition across languages
        const commonLanguages = [
          navigator.language, // User's browser language first
          'en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 
          'zh-CN', 'ja-JP', 'ko-KR', 'ar-SA', 'ru-RU', 'hi-IN'
        ]
        
        recognition.lang = commonLanguages[0]
        recognition.maxAlternatives = 10
        
        recognition.onresult = (event: any) => {
          let interim = ''
          let final = ''
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript
            if (event.results[i].isFinal) {
              final += transcript + ' '
            } else {
              interim += transcript
            }
          }
          
          if (final) {
            // Add final transcript to message
            setMessage(message + final)
            setInterimTranscript('')
          } else {
            // Show interim transcript
            setInterimTranscript(interim)
          }
        }
        
        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error)
          // Don't stop on errors like 'no-speech' or 'audio-capture'
          // These are temporary and recognition will continue
          if (event.error === 'aborted' || event.error === 'not-allowed') {
            // Only stop for critical errors
            if (recognitionRef.current) {
              recognitionRef.current.stop()
              recognitionRef.current = null
            }
          }
        }
        
        recognition.onend = () => {
          // Auto-restart if still recording (prevents stopping on focus loss)
          if (isRecording && recognitionRef.current) {
            try {
              recognition.start()
            } catch (error) {
              console.error('Failed to restart recognition:', error)
            }
          }
        }
        
        recognition.start()
        recognitionRef.current = recognition
      } else {
        console.warn('Speech recognition not supported in this browser')
      }
    } else {
      // Stop visualization
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      setAudioLevels(Array(40).fill(0))
      
      // Stop speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
      setInterimTranscript('')
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [isRecording, setMessage])
  
  // Helper function to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = error => reject(error)
    })
  }

  // Handle file selection
  const handleFileSelect = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    const processedFiles = await Promise.all(files.map(async (file) => {
      let type: 'image' | 'video' | 'text' | 'other' = 'other'
      let preview: string | undefined
      let base64: string | undefined
      
      if (file.type.startsWith('image/')) {
        type = 'image'
        preview = URL.createObjectURL(file)
        // Convert to base64 for sending to AI
        base64 = await fileToBase64(file)
      } else if (file.type.startsWith('video/')) {
        type = 'video'
        preview = URL.createObjectURL(file)
        base64 = await fileToBase64(file)
      } else if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        type = 'text'
        // Read text content
        const text = await file.text()
        preview = text.split('\n').slice(0, 5).join('\n')
        base64 = text // For text files, just store the text content
      } else {
        // For other file types, try to read as text or convert to base64
        try {
          const text = await file.text()
          type = 'text'
          preview = text.split('\n').slice(0, 5).join('\n')
          base64 = text
        } catch {
          // If can't read as text, convert to base64
          base64 = await fileToBase64(file)
        }
      }
      
      return { file, preview, type, base64 }
    }))
    
    setAttachedFiles(prev => [...prev, ...processedFiles])
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [setAttachedFiles])
  
  // Remove attached file
  const removeFile = React.useCallback((index: number) => {
    setAttachedFiles(prev => {
      const newFiles = [...prev]
      const removed = newFiles.splice(index, 1)[0]
      // Revoke object URL if it exists
      if (removed.preview && (removed.type === 'image' || removed.type === 'video')) {
        URL.revokeObjectURL(removed.preview)
      }
      return newFiles
    })
  }, [setAttachedFiles])
  
  // Handle drag and drop
  const handleDragEnter = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true)
    }
  }, [])
  
  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDraggingOver(false)
    }
  }, [])
  
  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])
  
  const handleDrop = React.useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
    dragCounterRef.current = 0
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return
    
    const processedFiles = await Promise.all(files.map(async (file) => {
      let type: 'image' | 'video' | 'text' | 'other' = 'other'
      let preview: string | undefined
      let base64: string | undefined
      
      if (file.type.startsWith('image/')) {
        type = 'image'
        preview = URL.createObjectURL(file)
        base64 = await fileToBase64(file)
      } else if (file.type.startsWith('video/')) {
        type = 'video'
        preview = URL.createObjectURL(file)
        base64 = await fileToBase64(file)
      } else if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        type = 'text'
        const text = await file.text()
        preview = text.split('\n').slice(0, 5).join('\n')
        base64 = text
      } else {
        try {
          const text = await file.text()
          type = 'text'
          preview = text.split('\n').slice(0, 5).join('\n')
          base64 = text
        } catch {
          base64 = await fileToBase64(file)
        }
      }
      
      return { file, preview, type, base64 }
    }))
    
    setAttachedFiles(prev => [...prev, ...processedFiles])
  }, [setAttachedFiles])
  
  // Handle paste event
  const handlePaste = React.useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items)
    const files = items
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter((file): file is File => file !== null)
    
    if (files.length === 0) return
    
    // Prevent default paste behavior when files are detected
    e.preventDefault()
    
    const processedFiles = await Promise.all(files.map(async (file) => {
      let type: 'image' | 'video' | 'text' | 'other' = 'other'
      let preview: string | undefined
      let base64: string | undefined
      
      if (file.type.startsWith('image/')) {
        type = 'image'
        preview = URL.createObjectURL(file)
        base64 = await fileToBase64(file)
      } else if (file.type.startsWith('video/')) {
        type = 'video'
        preview = URL.createObjectURL(file)
        base64 = await fileToBase64(file)
      } else if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        type = 'text'
        const text = await file.text()
        preview = text.split('\n').slice(0, 5).join('\n')
        base64 = text
      } else {
        try {
          const text = await file.text()
          type = 'text'
          preview = text.split('\n').slice(0, 5).join('\n')
          base64 = text
        } catch {
          base64 = await fileToBase64(file)
        }
      }
      
      return { file, preview, type, base64 }
    }))
    
    setAttachedFiles(prev => [...prev, ...processedFiles])
  }, [setAttachedFiles])
  
  // Handle arrow key navigation
  const handleHistoryNavigation = React.useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget
    const cursorPosition = textarea.selectionStart
    
    if (e.key === 'ArrowUp') {
      // Store current cursor position
      cursorBeforeArrowRef.current = cursorPosition
      
      // Check if we're at the very beginning
      if (cursorPosition === 0) {
        e.preventDefault()
        
        if (commandHistory.length === 0) return
        
        // Save current draft when starting to navigate
        if (historyIndex === -1) {
          setCurrentDraft(message)
          setCurrentDraftAttachments(attachedFiles)
        }
        
        // Move up in history (older messages)
        const newIndex = historyIndex === -1 
          ? commandHistory.length - 1 
          : Math.max(0, historyIndex - 1)
        
        setHistoryIndex(newIndex)
        const historyItem = commandHistory[newIndex]
        setMessage(historyItem.message)
        setAttachedFiles(historyItem.attachments)
        
        // Resize textarea and set cursor to beginning after message is set
        setTimeout(() => {
          resizeTextarea(textarea)
          textarea.setSelectionRange(0, 0)
        }, 0)
        return
      }
      
      // Allow default behavior first, then check if cursor moved
      setTimeout(() => {
        const newCursorPosition = textarea.selectionStart
        
        // If cursor didn't move, we're on the first line
        if (newCursorPosition === cursorBeforeArrowRef.current) {
          if (commandHistory.length === 0) return
          
          // Save current draft when starting to navigate
          if (historyIndex === -1) {
            setCurrentDraft(message)
            setCurrentDraftAttachments(attachedFiles)
          }
          
          // Move up in history (older messages)
          const newIndex = historyIndex === -1 
            ? commandHistory.length - 1 
            : Math.max(0, historyIndex - 1)
          
          setHistoryIndex(newIndex)
          const historyItem = commandHistory[newIndex]
          setMessage(historyItem.message)
          setAttachedFiles(historyItem.attachments)
          
          // Resize textarea and set cursor to beginning after message is set
          setTimeout(() => {
            resizeTextarea(textarea)
            textarea.setSelectionRange(0, 0)
          }, 0)
        }
      }, 0)
    } else if (e.key === 'ArrowDown') {
      // Store current cursor position
      cursorBeforeArrowRef.current = cursorPosition
      
      // Check if we're at the very end
      if (cursorPosition === message.length) {
        e.preventDefault()
        
        if (historyIndex === -1) return // Already at the end
        
        // Move down in history (newer messages)
        const newIndex = historyIndex + 1
        
        if (newIndex >= commandHistory.length) {
          // Restore draft when reaching the end
          setHistoryIndex(-1)
          setMessage(currentDraft)
          setAttachedFiles(currentDraftAttachments)
          // Resize textarea and set cursor to end after draft is restored
          setTimeout(() => {
            resizeTextarea(textarea)
            textarea.setSelectionRange(currentDraft.length, currentDraft.length)
          }, 0)
        } else {
          setHistoryIndex(newIndex)
          const historyItem = commandHistory[newIndex]
          setMessage(historyItem.message)
          setAttachedFiles(historyItem.attachments)
          // Resize textarea and set cursor to end after message is set
          setTimeout(() => {
            resizeTextarea(textarea)
            textarea.setSelectionRange(historyItem.message.length, historyItem.message.length)
          }, 0)
        }
        return
      }
      
      // Allow default behavior first, then check if cursor moved
      setTimeout(() => {
        const newCursorPosition = textarea.selectionStart
        
        // If cursor didn't move, we're on the last line
        if (newCursorPosition === cursorBeforeArrowRef.current) {
          if (historyIndex === -1) return // Already at the end
          
          // Move down in history (newer messages)
          const newIndex = historyIndex + 1
          
          if (newIndex >= commandHistory.length) {
            // Restore draft when reaching the end
            setHistoryIndex(-1)
            setMessage(currentDraft)
            setAttachedFiles(currentDraftAttachments)
            // Resize textarea and set cursor to end after draft is restored
            setTimeout(() => {
              resizeTextarea(textarea)
              textarea.setSelectionRange(currentDraft.length, currentDraft.length)
            }, 0)
          } else {
            setHistoryIndex(newIndex)
            const historyItem = commandHistory[newIndex]
            setMessage(historyItem.message)
            setAttachedFiles(historyItem.attachments)
            // Resize textarea and set cursor to end after message is set
            setTimeout(() => {
              resizeTextarea(textarea)
              textarea.setSelectionRange(historyItem.message.length, historyItem.message.length)
            }, 0)
          }
        }
      }, 0)
    }
  }, [commandHistory, historyIndex, message, currentDraft, setMessage])
  
  // Reset history navigation when message is sent
  const prevMessageRef = React.useRef(message)
  React.useEffect(() => {
    // Only run when message changes from non-empty to empty
    if (!message.trim() && prevMessageRef.current.trim()) {
      setHistoryIndex(-1)
      setCurrentDraft('')
      setCurrentDraftAttachments([])
      resetTextarea() // Reset textarea height when message is cleared
      
      // Clear attached files and revoke object URLs
      setAttachedFiles(prev => {
        prev.forEach(file => {
          if (file.preview && (file.type === 'image' || file.type === 'video')) {
            URL.revokeObjectURL(file.preview)
          }
        })
        return []
      })
    }
    prevMessageRef.current = message
  }, [message, resetTextarea, setAttachedFiles])

  // Detect if user is manually scrolling
  React.useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer
      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50
      
      // If user scrolls up, disable auto-scroll
      if (!isAtBottom) {
        setIsUserScrolling(true)
        setShouldAutoScroll(false)
      } else {
        // If user scrolls back to bottom, re-enable auto-scroll
        setIsUserScrolling(false)
        setShouldAutoScroll(true)
      }
    }

    scrollContainer.addEventListener('scroll', handleScroll)
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [])

  // Auto-scroll to bottom when new messages arrive (only if user hasn't scrolled up)
  React.useEffect(() => {
    if (shouldAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, chatHistory, isLoading, status, shouldAutoScroll])

  return (
    <div 
      className="flex flex-col overflow-hidden bg-[#17181F] rounded-b-xl mx-2 mb-1 relative"
      style={{ flex: 1, minHeight: '300px' }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-[#17181F]/95 border-2 border-gray-600 border-dashed rounded-xl flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#17181F] px-8 py-6 rounded-xl border border-gray-700 shadow-2xl">
            <div className="flex flex-col items-center gap-3">
              <svg className="w-24 h-24 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-200">Drop files to attach</div>
                <div className="text-sm text-gray-400 mt-1">Images, videos, text files, and more</div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Chat Messages Area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-6" style={{ animation: 'none', transition: 'none' }}>
        <div className="mx-auto space-y-4" style={{ animation: 'none', transition: 'none' }}>
          {/* Render all messages using MessageRenderer */}
          {renderedMessages}

          {/* Loading Indicator with Status-based Display */}
          {(status === 'streaming' || status === 'submitted' || isLoading) && (
            <div className="flex flex-col gap-2 mb-3">
              {/* Show just the streaming indicator - no content block */}
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span className="text-[12px] text-gray-400">
                  {status === 'streaming' ? 'Streaming' : status === 'submitted' ? 'Sending' : 'Thinking...'}
                </span>
              </div>
            </div>
          )}

          {/* Error State Display */}
          {status === 'error' && (
            <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>An error occurred. Please try again.</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="px-6 pb-4 pt-3">
        <div className="mx-auto">
          <div className="relative">
            {/* File Previews - Above Input (shown first, most prominent) */}
            {attachedFiles.length > 0 && (
              <div className="mb-3 p-3 bg-[#000000]/20 rounded-lg border border-[#101218]/30">
                <div className="flex flex-wrap gap-2">
                  {attachedFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      {/* Image Preview */}
                      {file.type === 'image' && file.preview && (
                        <div className="relative w-20 h-20 rounded-lg border border-gray-700 overflow-hidden bg-gray-900">
                          <img src={file.preview} alt={file.file.name} className="w-full h-full object-cover" />
                          <button
                            onClick={() => removeFile(index)}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove"
                          >
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}
                      
                      {/* Video Preview */}
                      {file.type === 'video' && file.preview && (
                        <div className="relative w-20 h-20 rounded-lg border border-gray-700 overflow-hidden bg-gray-900">
                          <video src={file.preview} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                          <button
                            onClick={() => removeFile(index)}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove"
                          >
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}
                      
                      {/* Text File Preview */}
                      {file.type === 'text' && (
                        <div className="relative w-28 h-20 rounded-lg border border-gray-700 bg-gray-900 p-2 overflow-hidden">
                          <div className="text-[9px] text-gray-400 font-mono leading-tight line-clamp-5">
                            {file.preview}
                          </div>
                          <button
                            onClick={() => removeFile(index)}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove"
                          >
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}
                      
                      {/* Other File Types */}
                      {file.type === 'other' && (
                        <div className="relative w-20 h-20 rounded-lg border border-gray-700 bg-gray-900 flex flex-col items-center justify-center p-2">
                          <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <div className="text-[8px] text-gray-500 mt-1 truncate w-full text-center">
                            {file.file.name}
                          </div>
                          <button
                            onClick={() => removeFile(index)}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove"
                          >
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Audio Visualization - Above Input when recording */}
            {isRecording && (
              <div className="mb-3 relative flex items-center justify-center gap-1 h-20 bg-[#000000]/20 rounded-lg border border-[#101218]/30 px-4 overflow-hidden">
                {/* Left gradient fade */}
                <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#000000]/40 to-transparent pointer-events-none z-10" />
                
                {audioLevels.map((level, index) => (
                  <div
                    key={index}
                    className="w-1 rounded-full transition-all duration-75"
                    style={{
                      backgroundColor: '#D1D5DB',
                      height: `${Math.max(level * 100, 8)}%`,
                      opacity: 0.8 + level * 0.2
                    }}
                  />
                ))}
                
                {/* Right gradient fade */}
                <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#000000]/40 to-transparent pointer-events-none z-10" />
              </div>
            )}
            
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept="*/*"
            />
            
            {/* Textarea Container */}
            <div className={`flex gap-2 bg-[#000000]/40 rounded-lg border border-[#101218]/30 focus-within:border-white transition-all duration-300 px-3 py-1.5 shadow-lg ${isTextareaExpanded ? 'items-end' : 'items-center'}`}>
              {/* Insert Media Button - Left Side */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2E2E2E] rounded-lg transition-all duration-200 border border-transparent shrink-0 ${isTextareaExpanded ? 'mb-[5px]' : ''}`}
                title="Attach file"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ transform: 'rotate(-45deg)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>

              <textarea
                ref={textareaRef}
                value={message + interimTranscript}
                onChange={(e) => {
                  // Only update if not recording (to prevent overwriting transcription)
                  if (!isRecording) {
                    setMessage(e.target.value)
                  }
                }}
                onKeyDown={(e) => {
                  // Handle arrow keys for history navigation
                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    handleHistoryNavigation(e)
                  } else {
                    handleKeyDown(e)
                  }
                }}
                onPaste={handlePaste}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = 'auto'
                  target.style.height = Math.min(target.scrollHeight, 200) + 'px'
                }}
                placeholder="Type your message..."
                disabled={false}
                className="flex-1 bg-transparent text-gray-200 text-[14px] px-1 resize-none focus:outline-none placeholder-gray-500 h-[28px] max-h-[200px] leading-[18px] scrollbar-hide"
                rows={1}
                style={{ 
                  minHeight: '28px', 
                  paddingTop: '5px', 
                  paddingBottom: '5px',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }}
              />

              {/* Action Buttons - Right Side */}
              <div className={`flex items-center gap-1 shrink-0 ${isTextareaExpanded ? 'mb-[5px]' : ''}`}>

                {/* Show Stop button when streaming */}
                {(status === 'streaming' || status === 'submitted') && onStop ? (
                  <button
                    onClick={onStop}
                    className="p-1.5 rounded-lg transition-all duration-200 shadow-sm border border-transparent"
                    style={{ backgroundColor: '#E5E7EB' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#D1D5DB'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E5E7EB'}
                    title="Stop generation"
                  >
                    {/* Large rotating square with slightly rounded corners */}
                    <svg className="w-4 h-4 animate-spin" fill="#0A0A0A" viewBox="0 0 6 6" style={{ animationDuration: '2s' }}>
                      <rect x="0" y="0" width="6" height="6" rx="0.8" ry="0.8" />
                    </svg>
                  </button>
                ) : isRecording ? (
                  /* Always show stop recording button when recording */
                  <button
                    onClick={handleAudioInput}
                    className="p-1.5 rounded-lg transition-all duration-200 shadow-sm border border-transparent"
                    style={{ backgroundColor: '#E5E7EB' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#D1D5DB'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E5E7EB'}
                    title="Stop recording"
                  >
                    {/* Large rotating square with hollow circle around it */}
                    <svg className="w-4 h-4" viewBox="0 0 600 600" style={{ overflow: 'visible' }}>
                      <style>{`
                        @keyframes pulse-circle {
                          0% { r: 450; }
                          70% { r: 380; }
                          100% { r: 450; }
                        }
                        @keyframes rotate-circle {
                          from { transform: rotate(0deg); }
                          to { transform: rotate(360deg); }
                        }
                        .pulsing-circle {
                          animation: pulse-circle 2s ease-in-out infinite;
                          transform-origin: center;
                        }
                        .rotating-inner {
                          animation: rotate-circle 2s linear infinite;
                          transform-origin: center;
                          transform-box: fill-box;
                        }
                      `}</style>
                      {/* Hollow circle - way bigger, almost touching button edges, with pulse animation */}
                      <circle className="pulsing-circle" cx="300" cy="300" r="450" fill="none" stroke="#0A0A0A" strokeWidth="24" />
                      {/* Rotating circle - centered */}
                      <rect className="rotating-inner" x="75" y="75" width="450" height="450" rx="225" ry="225" fill="#0A0A0A" />
                    </svg>
                  </button>
                ) : message.trim() ? (
                  <button
                    onClick={handleSendMessage}
                    disabled={isLoading}
                    className="p-1.5 bg-[#101218] hover:bg-[#2E2E2E] text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm border border-transparent"
                    title="Send message"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 11L12 4M12 4L19 11M12 4V21" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={handleAudioInput}
                    disabled={isLoading}
                    className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2E2E2E] rounded-lg transition-all duration-200 shadow-sm border border-transparent"
                    title="Record audio"
                  >
                    {/* 7 vertical bars icon */}
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 28 28">
                      <rect x="1" y="10" width="2.5" height="8" rx="1.25" />
                      <rect x="5" y="5" width="2.5" height="18" rx="1.25" />
                      <rect x="9" y="8" width="2.5" height="12" rx="1.25" />
                      <rect x="13" y="2" width="2.5" height="24" rx="1.25" />
                      <rect x="17" y="8" width="2.5" height="12" rx="1.25" />
                      <rect x="21" y="5" width="2.5" height="18" rx="1.25" />
                      <rect x="25" y="10" width="2.5" height="8" rx="1.25" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Model & Mode Selectors - Side by side */}
            <div className="mt-2 flex items-center gap-2">
              {/* Model Selector - Only show if models are available */}
              {models.length > 0 && (
                <div className="relative model-selector-container">
                  <button
                    onClick={() => setShowModelDropdown(!showModelDropdown)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-gray-400 hover:text-gray-200 hover:bg-[#2E2E2E] rounded-lg transition-all duration-200 border border-transparent"
                  >
                    <Brain className="w-3 h-3" />
                    <span className="font-medium">{models.find(m => m.id === selectedModel)?.name || 'Select Model'}</span>
                    <svg className={`w-3 h-3 transition-transform duration-200 ${showModelDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Model Dropdown */}
                  {showModelDropdown && (
                    <div className="absolute bottom-full left-0 mb-2 w-72 max-h-[60vh] border border-[#101218]/50 rounded-xl shadow-2xl overflow-hidden z-50 bg-[#17181F]">
                      <div className="p-1.5 overflow-y-auto max-h-[calc(60vh-8px)]">
                        {models.map((model) => (
                          <button
                            key={model.id}
                            onClick={() => {
                              setSelectedModel(model.id)
                              setShowModelDropdown(false)
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-200 mb-1 border ${selectedModel === model.id
                              ? 'bg-[#2E2E2E] text-white border-transparent'
                              : 'text-gray-300 hover:bg-[#2E2E2E] border-transparent'
                              }`}
                          >
                            <div className="font-semibold text-[12px]">{model.name}</div>
                            <div className={`text-[10px] mt-0.5 truncate ${selectedModel === model.id ? 'text-white/80' : 'text-gray-400'}`}>
                              {model.description}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mode Selector */}
              {setSelectedCustomMode && setShowModeDropdown && (
                <div className="relative mode-selector-container">
                  <button
                    onClick={() => setShowModeDropdown(!showModeDropdown)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-gray-400 hover:text-gray-200 hover:bg-[#2E2E2E] rounded-lg transition-all duration-200 border border-transparent"
                  >
                    <svg aria-hidden="true" focusable="false" className="w-3 h-3" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style={{display: 'inline-block', overflow: 'visible', verticalAlign: 'text-bottom'}}><path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"></path></svg>
                    <span className="font-medium">
                      {selectedCustomMode ? customModes.find(m => m.id === selectedCustomMode)?.name : 'Default Mode'}
                    </span>
                    <svg className={`w-3 h-3 transition-transform duration-200 ${showModeDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Mode Dropdown */}
                  {showModeDropdown && (
                    <div className="absolute bottom-full left-0 mb-2 w-72 max-h-[60vh] border border-[#101218]/50 rounded-xl shadow-2xl overflow-hidden z-50 bg-[#17181F]">
                      <div className="p-1.5 overflow-y-auto max-h-[calc(60vh-8px)]">
                        {/* Default Mode */}
                        <button
                          onClick={() => {
                            setSelectedCustomMode(null)
                            setShowModeDropdown(false)
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-200 mb-1 border ${!selectedCustomMode
                            ? 'bg-[#2E2E2E] text-white border-transparent'
                            : 'text-gray-300 hover:bg-[#2E2E2E] border-transparent'
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[12px]">Default Mode</span>
                          </div>
                          <div className={`text-[10px] mt-0.5 truncate ${!selectedCustomMode ? 'text-white/80' : 'text-gray-400'}`}>
                            Standard system behavior
                          </div>
                        </button>

                        {/* Custom Modes */}
                        {customModes.length > 0 && (
                          <>
                            <div className="px-3 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider">
                              Custom Modes
                            </div>
                            {customModes.map((customMode) => (
                              <button
                                key={customMode.id}
                                onClick={() => {
                                  setSelectedCustomMode(customMode.id)
                                  setShowModeDropdown(false)
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-200 mb-1 border ${selectedCustomMode === customMode.id
                                  ? 'bg-[#2E2E2E] text-white border-transparent'
                                  : 'text-gray-300 hover:bg-[#2E2E2E] border-transparent'
                                  }`}
                              >
                                <div className="font-semibold text-[12px]">{customMode.name}</div>
                                {customMode.description && (
                                  <div className={`text-[10px] mt-0.5 truncate ${selectedCustomMode === customMode.id ? 'text-white/80' : 'text-gray-400'}`}>
                                    {customMode.description}
                                  </div>
                                )}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
