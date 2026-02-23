'use client'

import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { useRouter } from 'next/navigation'
import RotatingEarth from '@/components/ui/wireframe-dotted-globe'
import { BlurText } from '@/components/ui/animated-blur-text'
import { Session, TaskList, Task, TaskStatus, ToastNotification, ChatMessage } from '@/types/chat'
import { Plus, X, History, ListChecks, Mic, Loader2, Volume2, Brain, Monitor, FolderOpen, Check } from 'lucide-react'
import CursorStyleChat from '@/components/chat/CursorStyleChat'
import SessionSuggestion from '@/components/SessionSuggestion'
import { historyManager, DEFAULT_TRUNCATION_CONFIG } from '@/utils/historyManager'
import { useChat } from '@ai-sdk/react'
import { messagesToChatMessages, chatMessagesToMessages } from '@/utils/messageConverter'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/sidebar/AppSidebar'
import { Project } from '@/types/session'
import { useLayoutSettings } from '@/hooks/useLayoutSettings'
import { ProjectCreationModal } from '@/components/modals/ProjectCreationModal'
import { ShareProjectModal } from '@/components/modals/ShareProjectModal'
import { AddCollaborationModal } from '@/components/modals/AddCollaborationModal'
import { DeleteProjectModal } from '@/components/modals/DeleteProjectModal'
import { CollaboratorsSidebar } from '@/components/sidebar/CollaboratorsSidebar'
import { AddUserToCollabModal } from '@/components/modals/AddUserToCollabModal'
import { LeaveCollaborationModal } from '@/components/modals/LeaveCollaborationModal'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { ModelSettings } from '@/components/settings/ModelSettings'
import { ModesSettings } from '@/components/settings/ModesSettings'
import { OperatingSystemsSettings } from '@/components/settings/OperatingSystemsSettings'
import { AppearanceSettings } from '@/components/settings/AppearanceSettings'
import { BehaviorSettings } from '@/components/settings/BehaviorSettings'
import { KeyboardSettings } from '@/components/settings/KeyboardSettings'
import { AdvancedSettings } from '@/components/settings/AdvancedSettings'
import { Users as UsersIcon } from 'lucide-react'
import { useCollaborationWebSocket } from '@/hooks/useCollaborationWebSocket'
import { useGlobalWebSocket } from '@/hooks/useGlobalWebSocket'
import { keycloakAuth } from '@/lib/keycloak-auth'
import { SignInButton } from '@/components/auth/SignInButton'
import { KeycloakCallbackHandler } from '@/components/auth/KeycloakCallbackHandler'
import AutoRefreshTerminal from '@/components/AutoRefreshTerminal'
import { mode } from 'd3'

// Component for desktop iframe - waits for VNC server to actually be ready
const DesktopIframe = ({ project, isModalOpen, isVisible }: { project: Project; isModalOpen: boolean; isVisible: boolean }) => {
  const [shouldLoad, setShouldLoad] = useState(false)
  
  useEffect(() => {
    let mounted = true
    let loadTimer: NodeJS.Timeout
    
    // Only load when modal is closed AND desktop tab is visible
    if (!isModalOpen && isVisible) {
      console.log('🔍 Desktop tab visible, loading VNC iframe...')
      
      // Small delay to ensure container is ready (especially for Ubuntu)
      loadTimer = setTimeout(() => {
        if (mounted) {
          console.log('✅ Loading VNC iframe for project:', project.name)
          setShouldLoad(true)
        }
      }, 1000) // 1 second delay
      
      return () => {
        mounted = false
        if (loadTimer) clearTimeout(loadTimer)
      }
    } else {
      setShouldLoad(false)
    }
  }, [isModalOpen, isVisible, project.name, project.novncPort])
  
  // Reset when project changes
  useEffect(() => {
    // Silently reset - only log errors
    // console.log('🔄 Project changed, resetting shouldLoad')
    setShouldLoad(false)
  }, [project.id])
  
  if (!shouldLoad) {
    return <div className="w-full h-full bg-black rounded-lg" />
  }
  
  // Build VNC URL - use direct connection to noVNC port
  // The noVNC port is exposed on the host, so we can connect directly
  const vncUrl = `http://localhost:${project.novncPort}/vnc_lite.html?autoconnect=1&resize=remote&reconnect=1&show_dot=0&view_only=0&quality=9&compression=2`
  
  // Silently configure VNC - only log errors
  // console.log('🔗 VNC URL Configuration:', {
  //   projectName: project.name,
  //   projectId: project.id,
  //   containerName: project.containerName,
  //   novncPort: project.novncPort,
  //   directVncUrl: vncUrl
  // })
  
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#000', zIndex: 10, overflow: 'hidden' }}>
      <style jsx>{`
        iframe {
          border: none !important;
        }
        /* Hide noVNC control bar */
        :global(#noVNC_control_bar_anchor) {
          display: none !important;
        }
        :global(.noVNC_status_button) {
          display: none !important;
        }
      `}</style>
      <iframe
        key={`desktop-${project.id}-${project.novncPort}-${project.containerId || 'new'}`}
        src={vncUrl}
        className="border-none"
        onLoad={(e) => {
          // Inject CSS to hide controls in the iframe
          try {
            const iframe = e.currentTarget as HTMLIFrameElement
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
            if (iframeDoc) {
              const style = iframeDoc.createElement('style')
              style.textContent = `
                /* Hide all noVNC controls */
                #noVNC_control_bar_anchor,
                #noVNC_control_bar,
                .noVNC_control_bar,
                .noVNC_status,
                #noVNC_status,
                #noVNC_status_bar {
                  display: none !important;
                  visibility: hidden !important;
                  opacity: 0 !important;
                  height: 0 !important;
                  width: 0 !important;
                }
                
                /* Make body and html fill the iframe */
                body, html {
                  overflow: hidden !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  width: 100% !important;
                  height: 100% !important;
                }
                
                /* Make noVNC container fill entire space */
                #noVNC_container {
                  position: absolute !important;
                  top: 0 !important;
                  left: 0 !important;
                  width: 100% !important;
                  height: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                
                /* Make canvas fill container and scale properly */
                #noVNC_canvas {
                  position: absolute !important;
                  top: 0 !important;
                  left: 0 !important;
                  width: 100% !important;
                  height: 100% !important;
                  object-fit: contain !important;
                }
                
                /* Hide any scrollbars */
                ::-webkit-scrollbar {
                  display: none !important;
                }
              `
              iframeDoc.head.appendChild(style)
              
              // Also try to remove elements directly
              setTimeout(() => {
                const controlBar = iframeDoc.getElementById('noVNC_control_bar_anchor')
                if (controlBar) controlBar.remove()
              }, 1000)
            }
          } catch (err) {
            console.log('Could not inject CSS into iframe (CORS):', err)
          }
          
          // Silently load iframe - only log errors
          // console.log('========================================')
          // console.log('🖥️ DESKTOP IFRAME LOADED')
          // console.log('   Project Name:', project.name)
          // console.log('   Project ID:', project.id)
          // console.log('   Container ID:', project.containerId)
          // console.log('   noVNC Port:', project.novncPort)
          // console.log('   VNC URL from DB:', project.vncUrl || 'not set')
          // console.log('   Operating System:', project.operatingSystem || 'unknown')
          // console.log('   Final URL:', vncUrl)
          // console.log('========================================')
        }}
        onError={(e) => {
          console.error('❌ Desktop iframe error!')
          console.error('   Project:', project.name)
          console.error('   Project ID:', project.id)
          console.error('   Port:', project.novncPort)
        }}
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%', 
          height: '100%', 
          border: 'none',
          backgroundColor: '#000',
          display: 'block',
          zIndex: 20
        }}
        title={`Desktop (noVNC) - ${project.name}`}
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    </div>
  )
}

// Generate unique toast ID
let toastCounter = 0
const generateToastId = () => `toast_${Date.now()}_${++toastCounter}`

export default function Home() {
  const router = useRouter()
  const { sidebarPosition, chatPosition } = useLayoutSettings()
  
  // Debug: Log chat position changes
  React.useEffect(() => {
    // Silently track position - only log errors
    // console.log('🎯 page.tsx - chatPosition changed to:', chatPosition)
  }, [chatPosition])
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false)
  const [chatSidebarWidth, setChatSidebarWidth] = useState(686) // Default width in pixels - optimized for terminal/desktop space
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartX = React.useRef<number>(0)
  const resizeStartWidth = React.useRef<number>(0)
  const [message, setMessage] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<Array<{
    file: File
    preview?: string
    type: 'image' | 'video' | 'text' | 'other'
    base64?: string
  }>>([])
  const [showOrderText, setShowOrderText] = useState(true)
  const [gradientOpacity, setGradientOpacity] = useState(1)
  const [fadeInOpacity, setFadeInOpacity] = useState(0)
  const [textDisappearing, setTextDisappearing] = useState(false)
  const [guardianFading, setGuardianFading] = useState(false)
  const [lastInteractionTime, setLastInteractionTime] = useState<number | null>(null)
  const [chatInputRolledDown, setChatInputRolledDown] = useState(false)
  const [protocolFading, setProtocolFading] = useState(false)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  // Per-session loading state instead of global
  const [sessionLoadingStates, setSessionLoadingStates] = useState<Map<string, boolean>>(new Map())
  
  // Helper to set loading state for a specific session
  const setSessionLoading = (sessionId: string, loading: boolean) => {
    setSessionLoadingStates(prev => {
      const next = new Map(prev)
      next.set(sessionId, loading)
      return next
    })
  }
  
  // Compute if any session is loading (for backward compatibility)
  const isLoading = Array.from(sessionLoadingStates.values()).some(loading => loading)
  // Removed global streamingStatus - now per-session
  const [animationsDisabled, setAnimationsDisabled] = useState(false)
  const [activeTab, setActiveTab] = useState<'terminal' | 'desktop'>('desktop')
  const abortControllerRef = React.useRef<AbortController | null>(null)
  
  // Support multiple concurrent streams - one per session
  const streamingSessionsRef = React.useRef<Map<string, {
    chatHistory: ChatMessage[]
    abortController: AbortController | null
    lastActivity: number // Track last activity timestamp for connection monitoring
    keepaliveTimer: NodeJS.Timeout | null // Track keepalive timer
  }>>(new Map())
  
  // CRITICAL: Per-session cache to ensure complete isolation
  // Each session maintains its own cached chat history to prevent data bleeding
  const sessionCacheRef = React.useRef<Map<string, {
    chatHistory: ChatMessage[]
    lastUpdated: number
    isStreaming: boolean
  }>>(new Map())
  
  // Track which sessions are currently streaming (for UI indicators)
  // Changed from single sessionId to a Set to support concurrent streaming
  const [streamingSessionIds, setStreamingSessionIds] = React.useState<Set<string>>(new Set())
  
  // Helper functions to manage streaming sessions
  const addStreamingSession = (sessionId: string) => {
    setStreamingSessionIds(prev => new Set(prev).add(sessionId))
  }
  
  const removeStreamingSession = (sessionId: string) => {
    setStreamingSessionIds(prev => {
      const next = new Set(prev)
      next.delete(sessionId)
      return next
    })
  }
  
  const isSessionStreaming = (sessionId: string) => {
    return streamingSessionIds.has(sessionId)
  }
  
  // Helper functions to manage session cache
  const updateSessionCache = (sessionId: string, chatHistory: ChatMessage[], isStreaming: boolean = false) => {
    if (!sessionId) {
      console.error('❌ updateSessionCache called with no sessionId!');
      return;
    }
    
    // CRITICAL: Create completely isolated copy to prevent reference sharing
    const isolatedHistory = chatHistory.map(msg => ({ ...msg }));
    
    sessionCacheRef.current.set(sessionId, {
      chatHistory: isolatedHistory,
      lastUpdated: Date.now(),
      isStreaming
    })
  }
  
  const getSessionCache = (sessionId: string) => {
    if (!sessionId) {
      console.error('❌ getSessionCache called with no sessionId!');
      return null;
    }
    
    const cached = sessionCacheRef.current.get(sessionId);
    return cached;
  }
  
  const clearSessionCache = (sessionId: string) => {
    if (!sessionId) {
      console.error('❌ clearSessionCache called with no sessionId!');
      return;
    }
    
    sessionCacheRef.current.delete(sessionId)
    console.log(`🗑️ [${sessionId}] Cache cleared`)
  }
  
  // Debug function to verify cache isolation
  const debugCacheIsolation = () => {
    console.log('🔍 === CACHE ISOLATION DEBUG ===');
    console.log(`Total cached sessions: ${sessionCacheRef.current.size}`);
    sessionCacheRef.current.forEach((cache, sessionId) => {
      console.log(`  [${sessionId}]: ${cache.chatHistory.length} messages, streaming: ${cache.isStreaming}`);
      if (cache.chatHistory.length > 0) {
        const firstMsg = cache.chatHistory[0];
        const lastMsg = cache.chatHistory[cache.chatHistory.length - 1];
        console.log(`    First: "${firstMsg.content?.substring(0, 30)}..."`);
        console.log(`    Last: "${lastMsg.content?.substring(0, 30)}..."`);
      }
    });
    console.log('🔍 === END DEBUG ===');
  }
  
  // Expose debug function to window for manual testing
  if (typeof window !== 'undefined') {
    (window as any).debugCacheIsolation = debugCacheIsolation;
  }
  
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  
  // Initialize selectedModel with NO default - user must explicitly select
  // This ensures collaborators can't send messages without choosing a model
  const [selectedModel, setSelectedModel] = useState<string>('')
  
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string; description: string }>>([])

  // OS Selector State
  const [showOSDropdown, setShowOSDropdown] = useState(false)
  const [osMounted, setOsMounted] = useState(false)
  
  // Initialize with default values (no localStorage during SSR)
  const [availableOS, setAvailableOS] = useState([
    { id: 'windows-11', name: 'Windows 11', version: 'Professional', isDefault: true }
  ])
  const [selectedOS, setSelectedOS] = useState('windows-11')
  
  // Load from localStorage after mount (client-side only)
  useEffect(() => {
    setOsMounted(true)
    const defaultOSId = typeof window !== 'undefined' ? localStorage.getItem('default-os') || 'windows-11' : 'windows-11'
    const updatedOSList = [
      { id: 'windows-11', name: 'Windows 11', version: 'Professional', isDefault: defaultOSId === 'windows-11' }
    ]
    setAvailableOS(updatedOSList)
    const defaultOS = updatedOSList.find(os => os.isDefault)
    setSelectedOS(defaultOS ? defaultOS.id : 'windows-11')
  }, [])
  
  // Listen for default OS changes
  useEffect(() => {
    if (!osMounted) return
    
    const handleDefaultOSChange = (event: CustomEvent) => {
      const newDefaultOSId = event.detail.osId
      setAvailableOS(prev => prev.map(os => ({
        ...os,
        isDefault: os.id === newDefaultOSId
      })))
      setSelectedOS(newDefaultOSId)
    }
    
    window.addEventListener('default-os-changed', handleDefaultOSChange as EventListener)
    return () => window.removeEventListener('default-os-changed', handleDefaultOSChange as EventListener)
  }, [osMounted])

  // Mode for backend to determine which system prompt to use
  const [mode, setMode] = useState<'terminal' | 'desktop'>('desktop')
  const [showModeDropdown, setShowModeDropdown] = useState(false)
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)
  const [customModes, setCustomModes] = useState<Array<{
    id: string
    name: string
    description: string
    systemPrompt: string
  }>>([])
  const [selectedCustomMode, setSelectedCustomMode] = useState<string | null>(() => {
    try {
      if (typeof window !== 'undefined') {
        const settingsStr = localStorage.getItem('app-settings')
        if (settingsStr) {
          const settings = JSON.parse(settingsStr)
          const defaultModeId = settings.defaultModeId || null
          console.log('🎯 [INIT] Loading default mode from settings:', {
            defaultModeId,
            hasSettings: !!settings,
            settingsKeys: Object.keys(settings)
          })
          return defaultModeId
        }
      }
    } catch (error) {
      console.error('Failed to load default mode from settings:', error)
    }
    return null
  })

  // Session Management State
  const [sessions, setSessions] = useState<Session[]>([])
  const sessionsRef = React.useRef<Session[]>([]) // Ref to access sessions without triggering effects
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [showSessionDropdown, setShowSessionDropdown] = useState(false)
  const [deletedSessions, setDeletedSessions] = useState<Session[]>([])
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const isCreatingSessionRef = React.useRef(false) // Ref-based guard for extra safety
  const sessionCreationCallCountRef = React.useRef(0) // Debug: track call count

  // Combine all sessions' chat history for command history (arrow keys)
  const allSessionsHistory = React.useMemo(() => {
    const allMessages: ChatMessage[] = []
    sessions.forEach(session => {
      if (session.chatHistory && session.chatHistory.length > 0) {
        allMessages.push(...session.chatHistory)
      }
    })
    // Sort by timestamp (oldest first)
    return allMessages.sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      }
      return 0
    })
  }, [sessions])

  // Get streaming status from active session
  // Show streaming status if the session is actually streaming (even in background)
  const streamingStatus = React.useMemo(() => {
    if (!activeSessionId) return 'ready'
    
    // Find the active session
    const activeSession = sessions.find(s => s.id === activeSessionId)
    if (!activeSession) return 'ready'
    
    // CRITICAL: Use the session's streamingStatus as the source of truth
    // This ensures the stop button shows/hides based on the session's status
    return activeSession.streamingStatus || 'ready'
  }, [sessions, activeSessionId])
  
  // Compute loading state for active session only
  // This prevents showing "Thinking..." in sessions that aren't actively streaming
  const isActiveSessionLoading = React.useMemo(() => {
    if (!activeSessionId) return false
    
    // Only show loading if this session is in the streaming set
    if (!streamingSessionIds.has(activeSessionId)) return false
    
    // Return the per-session loading state
    return sessionLoadingStates.get(activeSessionId) || false
  }, [sessionLoadingStates, activeSessionId, streamingSessionIds])

  // Task Management State
  const [taskLists, setTaskLists] = useState<TaskList[]>([])
  const [activeTaskList, setActiveTaskList] = useState<TaskList | null>(null)
  const [showTaskPanel, setShowTaskPanel] = useState(false)

  // UI State
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmDialogData, setConfirmDialogData] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)
  const [toasts, setToasts] = useState<ToastNotification[]>([])
  const [showTerminalArea, setShowTerminalArea] = useState(true)
  const [showChatArea, setShowChatArea] = useState(true)

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false)
  const [showSoundBar, setShowSoundBar] = useState(true) // Sound bar visible for first 35 seconds
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])
  const [interimTranscript, setInterimTranscript] = useState('')
  const recognitionRef = React.useRef<any>(null)
  const audioContextRef = React.useRef<AudioContext | null>(null)
  const analyserRef = React.useRef<AnalyserNode | null>(null)
  const animationFrameRef = React.useRef<number | null>(null)
  const [audioLevels, setAudioLevels] = React.useState<number[]>(Array(40).fill(0))
  
  // Drag and drop state
  const [isDraggingOver, setIsDraggingOver] = React.useState(false)
  const dragCounterRef = React.useRef(0)

  // Session Suggestion State
  const [showSessionSuggestion, setShowSessionSuggestion] = useState(false)
  const [sessionSuggestionDismissed, setSessionSuggestionDismissed] = useState(false)

  // Project Management State
  const [projects, setProjects] = useState<Project[]>([])
  const [collaborations, setCollaborations] = useState<any[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [selectedProjectIdForNewSession, setSelectedProjectIdForNewSession] = useState<string | null>(null) // Project selected in dropdown for next message
  const [createNewProjectOnSend, setCreateNewProjectOnSend] = useState(true) // Flag to create new project when sending message - default to true
  const [pendingMessageToSend, setPendingMessageToSend] = useState<string | null>(null) // Message waiting to be sent after session creation
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [creationProgress, setCreationProgress] = useState<{
    active: boolean
    step: string
    message: string
    progress: number
    projectId?: string
  } | null>(null)
  
  // Track max progress to prevent going backwards
  const maxProgressRef = React.useRef<number>(0)
  
  // Track active project monitoring to allow cancellation
  const activeMonitoringRef = React.useRef<string | null>(null)
  
  // Helper function to set progress that never goes backwards
  const setCreationProgressSafe = (progress: {
    active: boolean
    step: string
    message: string
    progress: number
    projectId?: string
  } | null) => {
    if (progress === null) {
      maxProgressRef.current = 0
      setCreationProgress(null)
      // Clear from localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('projectCreationProgress')
      }
    } else {
      // Ensure progress never goes backwards
      const newProgress = Math.max(progress.progress, maxProgressRef.current)
      if (newProgress !== progress.progress) {
        console.log(`📊 Progress adjusted: ${progress.progress}% -> ${newProgress}% (max: ${maxProgressRef.current}%)`)
      }
      maxProgressRef.current = newProgress
      const updatedProgress = {
        ...progress,
        progress: newProgress
      }
      setCreationProgress(updatedProgress)
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('projectCreationProgress', JSON.stringify(updatedProgress))
      }
    }
  }
  
  // Collaborators Sidebar State
  const [showCollaboratorsSidebar, setShowCollaboratorsSidebar] = useState(false)
  const [collaboratorsSidebarWidth, setCollaboratorsSidebarWidth] = useState(450) // Match chat sidebar width
  const [projectCollaborators, setProjectCollaborators] = useState<any[]>([])
  
  // Authentication State
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [collaborationToLeave, setCollaborationToLeave] = useState<{ id: string; name: string } | null>(null)
  
  // Get active project data (with safety check)
  // Check both owned projects and collaborations
  const activeProject = React.useMemo(() => {
    if (!activeProjectId) return undefined
    
    // First check owned projects
    const ownedProject = Array.isArray(projects) ? projects.find(p => p.id === activeProjectId) : undefined
    if (ownedProject) return ownedProject
    
    // Then check collaborations
    const collaboration = Array.isArray(collaborations) ? collaborations.find(c => 
      c.project?.id === activeProjectId || c.projectId === activeProjectId
    ) : undefined
    
    return collaboration?.project
  }, [activeProjectId, projects, collaborations])
  
  // Debug: Log active project changes (removed session reload to prevent loops)
  React.useEffect(() => {
    // Silently track project changes - only log errors
    // console.log('========================================')
    // console.log('🎯 ACTIVE PROJECT CHANGED')
    // console.log('   Project ID:', activeProjectId)
    // console.log('   Project Name:', activeProject?.name || 'none')
    // console.log('   Container ID:', activeProject?.containerId || 'none')
    // console.log('   Terminal Port:', activeProject?.terminalPort || 'none')
    // console.log('   Terminal URL:', activeProject ? `http://localhost:${activeProject.terminalPort}/` : 'none')
    // console.log('   VNC Port:', activeProject?.vncPort || 'none')
    // console.log('   noVNC Port:', activeProject?.novncPort || 'none')
    // console.log('   Desktop URL:', activeProject ? `http://localhost:${activeProject.novncPort}/vnc.html` : 'none')
    // console.log('========================================')
  }, [activeProjectId, activeProject])
  
  // Ensure active project is valid
  React.useEffect(() => {
    if (activeProjectId && !activeProject && projects.length > 0) {
      console.log('⚠️ Active project ID set but project not found, searching...')
      const project = projects.find(p => p.id === activeProjectId)
      if (!project && projects.length > 0) {
        console.log('🔄 Setting first available project as active')
        setActiveProjectId(projects[0].id)
      }
    }
  }, [activeProjectId, activeProject, projects])
  
  // Sync mode with active project's operating system
  React.useEffect(() => {
    if (activeProject && activeProject.operatingSystem) {
      const os = activeProject.operatingSystem
      let newMode: 'terminal' | 'desktop' = mode
      
      if (os === 'windows-11' || os === 'windows-10') {
        newMode = 'desktop' // Windows uses desktop mode
      } else if (os === 'kali-linux' || os.startsWith('kali')) {
        newMode = 'terminal' // Kali uses terminal mode by default
      } else if (os.startsWith('ubuntu')) {
        newMode = 'terminal' // Ubuntu uses terminal mode by default
      }
      
      if (newMode !== mode) {
        console.log(`🔄 Syncing mode with project OS: ${os} -> ${newMode}`)
        setMode(newMode)
      }
    }
  }, [activeProject?.operatingSystem])
  
  const [showShareModal, setShowShareModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [activeCategory, setActiveCategory] = useState<'models' | 'modes' | 'os' | 'appearance' | 'behavior' | 'keyboard' | 'advanced'>('models')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [collaborators, setCollaborators] = useState<any[]>([])

  // Ref to track if we're currently switching sessions (to prevent duplicate messages)
  const isSwitchingSession = React.useRef(false)
  
  // Per-session sending state to prevent duplicate sends
  // Changed from global ref to Map to support concurrent sending
  const isSendingMessageMap = React.useRef<Map<string, boolean>>(new Map())

  // Collaboration WebSocket
  const {
    isConnected: wsConnected,
    collaborators: wsCollaborators,
    notifySessionCreated,
    notifySessionUpdated,
    notifySessionDeleted
  } = useCollaborationWebSocket({
    projectId: activeProjectId,
    userId: user?.id || null,
    userName: user?.email || user?.user_metadata?.full_name || 'Anonymous',
    onSessionCreated: (session) => {
      console.log('📥 Session created via WebSocket:', session)
      setSessions(prev => {
        // Check if session already exists
        const existingIndex = prev.findIndex(s => s.id === session.id)
        if (existingIndex !== -1) {
          console.log('⚠️ Session already exists (likely created by this user), updating it:', session.id)
          // Update the existing session to ensure we have latest data
          const updated = [...prev]
          updated[existingIndex] = { ...prev[existingIndex], ...session }
          return updated
        }
        console.log('✅ Adding session from WebSocket (created by collaborator):', session.id)
        
        // Only show toast if this is from a collaborator (not the current user)
        addToast({
          id: generateToastId(),
          type: 'info',
          message: `New session "${session.name}" created by collaborator`,
          duration: 3000
        })
        
        return [...prev, session]
      })
    },
    onSessionUpdated: (sessionId, updates) => {
      console.log('📥 Session updated by collaborator:', sessionId, updates)
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ...updates } : s))
    },
    onSessionDeleted: (sessionId) => {
      console.log('📥 Session deleted by collaborator:', sessionId)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      if (activeSessionId === sessionId) {
        setActiveSessionId(null)
      }
    },
    onProjectMembers: (members) => {
      console.log('📥 Project members from WebSocket:', members, 'count:', members.length)
      console.log('📥 WebSocket members data:', JSON.stringify(members, null, 2))
      
      // Merge with existing collaborators to preserve avatarUrl and other fetched data
      setProjectCollaborators(prev => {
        console.log('📥 Previous collaborators:', prev.length)
        console.log('📥 Previous collaborators data:', JSON.stringify(prev, null, 2))
        
        // Don't use WebSocket data as initial data since it doesn't have avatarUrl
        // Wait for the fetch to complete first
        if (prev.length === 0) {
          console.log('⚠️ No fetched collaborators yet, skipping WebSocket update')
          return prev
        }
        
        if (members.length === 0) {
          // Don't clear if WebSocket sends empty array
          console.log('⚠️ WebSocket sent empty members, keeping existing')
          return prev
        }
        
        // Check if there are new members we don't have yet
        let hasNewMembers = false
        members.forEach(wsMember => {
          if (!prev.find(c => c.userId === wsMember.userId)) {
            hasNewMembers = true
          }
        })
        
        // If there are new members, trigger a fetch to get their full data (including avatars)
        if (hasNewMembers && activeProjectId) {
          console.log('� Newe members detected, fetching updated collaborators list')
          // Use setTimeout to avoid calling setState during render
          setTimeout(() => {
            fetchProjectCollaborators(activeProjectId)
          }, 100)
        }
        
        // Merge: update status from WebSocket, keep other data from fetch
        // Only include members that are in the WebSocket list (removes deleted members)
        const wsMap = new Map(members.map(m => [m.userId, m]))
        const merged = prev
          .filter(collab => wsMap.has(collab.userId)) // Remove members not in WebSocket list
          .map(collab => {
            const wsMember = wsMap.get(collab.userId)!
            const mergedCollab = {
              ...collab, // Keep avatarUrl and other fetched data
              status: wsMember.status,
              lastActivity: wsMember.lastActivity
            }
            console.log(`🔀 Merged ${collab.userName}: avatarUrl preserved = ${!!mergedCollab.avatarUrl}`)
            return mergedCollab
          })
        
        // Add any new members from WebSocket (temporarily without avatars)
        members.forEach(wsMember => {
          if (!prev.find(c => c.userId === wsMember.userId)) {
            console.log('➕ Adding new member from WebSocket (will fetch full data):', wsMember.userName)
            merged.push({
              ...wsMember,
              isVisible: true // Default to visible
            })
          }
        })
        
        console.log('📥 Merged project members:', merged.length)
        console.log('📥 Merged data:', JSON.stringify(merged, null, 2))
        return merged
      })
    },
    onUserJoined: (userId, userName) => {
      console.log('👋 User joined:', userName)
      addToast({
        id: `toast_${Date.now()}`,
        type: 'info',
        message: `${userName} joined the project`,
        duration: 3000
      })
    },
    onUserLeft: (userId, userName) => {
      console.log('👋 User left:', userName)
      addToast({
        id: `toast_${Date.now()}`,
        type: 'info',
        message: `${userName} left the project`,
        duration: 3000
      })
    },
    onCollaboratorJoined: (userId, userName) => {
      console.log('🎉 New collaborator authenticated:', userName)
      addToast({
        id: generateToastId(),
        type: 'success',
        message: `${userName} has been authenticated and joined the project`,
        duration: 4000
      })
      // Fetch updated collaborators list to get the new user's profile data (including avatar)
      if (activeProjectId) {
        console.log('🔄 Fetching updated collaborators after new user joined')
        fetchProjectCollaborators(activeProjectId)
      }
    },
    onCollaboratorLeft: (userId, userName) => {
      console.log('👋 Collaborator left:', userName)
      addToast({
        id: generateToastId(),
        type: 'info',
        message: `${userName} left the project`,
        duration: 3000
      })
      // Remove the user from the collaborators list immediately
      setProjectCollaborators(prev => prev.filter(c => c.userId !== userId))
      // Also fetch updated list to ensure consistency
      if (activeProjectId) {
        console.log('🔄 Fetching updated collaborators after user left')
        fetchProjectCollaborators(activeProjectId)
      }
    },
    onCollaboratorRemoved: (userId, userName) => {
      console.log('🚫 Collaborator removed:', userName)
      
      // Check if the removed user is the current user
      if (user && userId === user.id) {
        // Current user was removed - kick them out
        addToast({
          id: generateToastId(),
          type: 'error',
          message: 'You have been removed from this project',
          duration: 5000
        })
        
        // Clear active project and session
        setActiveProjectId(null)
        setActiveSessionId(null)
        
        // Reload collaborations to remove this project from the list
        loadCollaborations(user.id, true)
        
        return
      }
      
      // Someone else was removed
      addToast({
        id: generateToastId(),
        type: 'warning',
        message: `${userName} was removed from the project`,
        duration: 3000
      })
      // Remove the user from the collaborators list immediately
      setProjectCollaborators(prev => prev.filter(c => c.userId !== userId))
      // Also fetch updated list to ensure consistency
      if (activeProjectId) {
        console.log('🔄 Fetching updated collaborators after user removed')
        fetchProjectCollaborators(activeProjectId)
      }
    },
    onCollaboratorVisibilityChanged: (userId, userName, isVisible) => {
      console.log('👁️ Collaborator visibility changed:', userName, 'visible:', isVisible)
      addToast({
        id: generateToastId(),
        type: 'info',
        message: `${userName} is now ${isVisible ? 'visible' : 'hidden'}`,
        duration: 2000
      })
      // Fetch updated list to reflect visibility changes
      if (activeProjectId) {
        console.log('🔄 Fetching updated collaborators after visibility change')
        fetchProjectCollaborators(activeProjectId)
      }
    },
    onAllCollaboratorsVisibilityChanged: (isVisible) => {
      console.log('👁️ All collaborators visibility changed, visible:', isVisible)
      addToast({
        id: generateToastId(),
        type: 'info',
        message: `All collaborators are now ${isVisible ? 'visible' : 'hidden'}`,
        duration: 2000
      })
      // Fetch updated list to reflect visibility changes
      if (activeProjectId) {
        console.log('🔄 Fetching updated collaborators after all visibility change')
        fetchProjectCollaborators(activeProjectId)
      }
    },
    onCustomModesUpdated: () => {
      console.log('⚙️ Custom modes updated via WebSocket, reloading...')
      // Trigger reload of custom modes
      window.dispatchEvent(new CustomEvent('settings-updated'))
    },
    onModelsUpdated: () => {
      console.log('🤖 Models updated via WebSocket, reloading...')
      // Trigger reload of models
      window.dispatchEvent(new CustomEvent('settings-updated'))
    },
    onSettingsUpdated: () => {
      console.log('⚙️ Settings updated via WebSocket, reloading...')
      // Trigger reload of all settings
      window.dispatchEvent(new CustomEvent('settings-updated'))
    }
  })

  // ═══════════════════════════════════════════════════════════════════════════════
  // GLOBAL WEBSOCKET: Always-on connection for user-level events
  // ═══════════════════════════════════════════════════════════════════════════════
  
  useGlobalWebSocket({
    userId: user?.id || null,
    userName: user?.email || user?.user_metadata?.full_name || 'Anonymous',
    onCollaborationAdded: (projectId, projectName) => {
      console.log('🎉 Added to collaboration:', projectName)
      addToast({
        id: generateToastId(),
        type: 'success',
        message: `You've been added to "${projectName}"`,
        duration: 4000
      })
      // Reload collaborations list after a short delay to ensure database is updated
      if (user) {
        setTimeout(() => {
          console.log('🔄 Reloading collaborations after being added...')
          loadCollaborations(user.id, true)
        }, 500)
      }
    },
    onCollaborationRemoved: (projectId) => {
      console.log('🚫 Removed from collaboration:', projectId)
      addToast({
        id: generateToastId(),
        type: 'error',
        message: 'You have been removed from a project',
        duration: 4000
      })
      // If this is the active project, clear it
      if (activeProjectId === projectId) {
        setActiveProjectId(null)
        setActiveSessionId(null)
      }
      // Reload collaborations list
      if (user) {
        loadCollaborations(user.id, true)
      }
    }
  })

  // ═══════════════════════════════════════════════════════════════════════════════
  // SESSION PERSISTENCE: Save and restore activeSessionId
  // ═══════════════════════════════════════════════════════════════════════════════
  
  // Save activeSessionId to localStorage when it changes
  React.useEffect(() => {
    if (activeSessionId && activeProjectId) {
      const key = `activeSession_${activeProjectId}`
      localStorage.setItem(key, activeSessionId)
      console.log(`💾 Saved active session: ${activeSessionId} for project: ${activeProjectId}`)
    }
  }, [activeSessionId, activeProjectId])

  // Restore activeSessionId on page load and load its history
  React.useEffect(() => {
    if (!activeProjectId || sessions.length === 0) return
    
    // Check if we already have an active session (don't override)
    if (activeSessionId) return
    
    // Try to restore from localStorage
    const key = `activeSession_${activeProjectId}`
    const savedSessionId = localStorage.getItem(key)
    
    if (savedSessionId) {
      // Check if this session still exists
      const session = sessions.find(s => s.id === savedSessionId)
      if (session) {
        // CRITICAL: Only restore if the session has its chatHistory loaded
        // This prevents restoring before the history is fetched from backend
        if (session.chatHistory !== undefined) {
          console.log(`🔄 Restoring active session: ${savedSessionId} with ${session.chatHistory.length} messages`)
          // Use switchToSession to properly load history
          switchToSession(savedSessionId)
        } else {
          console.log(`⏳ Waiting for session ${savedSessionId} chat history to load...`)
          // The useEffect will run again when the session's chatHistory is loaded
          // We need to check the specific session's chatHistory, not just sessions array
        }
      } else {
        console.log(`⚠️  Saved session ${savedSessionId} not found, clearing`)
        localStorage.removeItem(key)
      }
    }
  }, [activeProjectId, sessions, activeSessionId])
  
  // Additional effect to handle session restoration when chatHistory becomes available
  // This ensures restoration happens even if the sessions array doesn't change
  React.useEffect(() => {
    if (!activeProjectId || sessions.length === 0 || activeSessionId) return
    
    const key = `activeSession_${activeProjectId}`
    const savedSessionId = localStorage.getItem(key)
    
    if (savedSessionId) {
      const session = sessions.find(s => s.id === savedSessionId)
      // If we find the session and it now has chatHistory defined, restore it
      if (session && session.chatHistory !== undefined) {
        console.log(`✅ Chat history loaded for session ${savedSessionId}, restoring now`)
        switchToSession(savedSessionId)
      }
    }
  }, [sessions.map(s => s.chatHistory !== undefined ? `${s.id}-loaded` : `${s.id}-loading`).join(','), activeProjectId, activeSessionId])
  // ═══════════════════════════════════════════════════════════════════════════════

  // Vercel AI SDK useChat Hook
  // Use environment variable or detect if running in Docker
  const backendUrl = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:3002`)
    : 'http://backend:3002';

  const chatHelpers = useChat({
    body: {
      model: selectedModel,
      mode: mode,
      sessionId: activeSessionId,  // ← CRITICAL: Pass sessionId for message persistence
      projectId: activeProjectId   // ← Pass projectId for context
    },
    initialMessages: [], // Start with empty messages - no initial message
    onFinish: (message) => {
      // Don't update sessions here - the message is already persisted in the backend
      // and will be loaded when needed. This prevents excessive re-renders.
    },
    onError: (error) => {
      console.error('❌ Chat error:', error);
      addToast({
        id: `toast_${Date.now()}`,
        type: 'error',
        message: error.message || 'Failed to send message',
        duration: 5000
      });
    }
  })

  // Extract properties from chatHelpers
  const messages = (chatHelpers as any).messages || []
  const status = (chatHelpers as any).status || 'ready'
  const stop = (chatHelpers as any).stop || (() => {})
  const setMessages = (chatHelpers as any).setMessages || (() => {})

  // Track the last loaded session to prevent infinite loops
  const lastLoadedSessionRef = useRef<string | null>(null)
  const lastSessionsHashRef = useRef<string>('')

  // Load messages when active session changes
  useEffect(() => {
    if (!activeSessionId || sessions.length === 0) return
    
    const activeSession = sessions.find(s => s.id === activeSessionId)
    if (!activeSession) return
    
    // Create a hash of the session's chatHistory to detect actual changes
    const chatHistoryHash = activeSession.chatHistory 
      ? `${activeSession.id}-${activeSession.chatHistory.length}-${activeSession.chatHistory[activeSession.chatHistory.length - 1]?.timestamp}`
      : `${activeSession.id}-empty`
    
    // Only reload if the session changed OR the chat history actually changed
    if (lastLoadedSessionRef.current === activeSessionId && lastSessionsHashRef.current === chatHistoryHash) {
      return
    }
    
    // CRITICAL: If this session is currently streaming, don't reload from sessions state
    // The streaming state is the source of truth and already being displayed
    const streamingState = streamingSessionsRef.current.get(activeSessionId)
    if (streamingState && streamingState.isStreaming) {
      console.log(`⏭️ Skipping reload for streaming session ${activeSessionId}`)
      // Update the refs to prevent future reloads with the same data
      lastLoadedSessionRef.current = activeSessionId
      lastSessionsHashRef.current = chatHistoryHash
      return
    }
    
    // Load messages from cached chatHistory
    // Keep them in ChatMessage format to preserve exact structure (mediaBlocks, etc.)
    if (activeSession.chatHistory && activeSession.chatHistory.length > 0) {
      // Deduplicate messages by timestamp + role + content
      const deduplicatedHistory = activeSession.chatHistory.filter((msg, index, self) => {
        return index === self.findIndex(m => 
          m.role === msg.role && 
          m.content === msg.content &&
          new Date(m.timestamp).getTime() === new Date(msg.timestamp).getTime()
        );
      });
      
      // Set chatHistory directly - NO CONVERSION
      // This preserves the exact structure from streaming/database
      setChatHistory(deduplicatedHistory)
      setMessages([]) // Clear AI SDK messages - we'll use chatHistory instead
      lastLoadedSessionRef.current = activeSessionId
      lastSessionsHashRef.current = chatHistoryHash
    } else {
      setMessages([])
      setChatHistory([])
      lastLoadedSessionRef.current = activeSessionId
      lastSessionsHashRef.current = chatHistoryHash
    }
  }, [activeSessionId, sessions])

  // Document-level drag and drop listeners
  React.useEffect(() => {
    const handleDocDragEnter = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current++
      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
        setIsDraggingOver(true)
      }
    }
    
    const handleDocDragLeave = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current--
      if (dragCounterRef.current === 0) {
        setIsDraggingOver(false)
      }
    }
    
    const handleDocDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }
    
    const handleDocDrop = async (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDraggingOver(false)
      dragCounterRef.current = 0
      
      const files = Array.from(e.dataTransfer?.files || [])
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
    }
    
    document.addEventListener('dragenter', handleDocDragEnter)
    document.addEventListener('dragleave', handleDocDragLeave)
    document.addEventListener('dragover', handleDocDragOver)
    document.addEventListener('drop', handleDocDrop)
    
    return () => {
      document.removeEventListener('dragenter', handleDocDragEnter)
      document.removeEventListener('dragleave', handleDocDragLeave)
      document.removeEventListener('dragover', handleDocDragOver)
      document.removeEventListener('drop', handleDocDrop)
    }
  }, [])

  // Auto-resize textarea based on message content (including transcription)
  React.useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current
      const currentValue = message + interimTranscript;
      
      // Reset to single line if empty
      if (currentValue.trim() === '') {
        textarea.style.height = '28px'
        textarea.style.overflow = 'hidden';
        return;
      }
      
      // Set to minimum height and check if content overflows
      textarea.style.height = '28px';
      textarea.style.overflow = 'hidden';
      
      // Check if scrollHeight significantly exceeds the visible height
      // Only expand if scrollHeight is at least 48px (indicating wrapped text)
      if (textarea.scrollHeight >= 48) {
        textarea.style.overflow = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 80) + 'px';
      } else {
        textarea.style.overflow = 'hidden';
      }
    }
  }, [message, interimTranscript])
  
  // Keep cursor at end during recording and scroll to bottom
  React.useEffect(() => {
    if (isRecording && textareaRef.current) {
      const textarea = textareaRef.current
      const length = textarea.value.length
      
      // Move cursor to end
      textarea.setSelectionRange(length, length)
      
      // Scroll to bottom to keep the last line visible
      textarea.scrollTop = textarea.scrollHeight
    }
  }, [message, interimTranscript, isRecording])

  // Hide sound bar after 35 seconds
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShowSoundBar(false)
    }, 25000) // 25 seconds

    return () => clearTimeout(timer)
  }, [])

  // Load models from settings - ONLY when user is logged in
  useEffect(() => {
    const loadModels = async () => {
      // CRITICAL: Only load models if user is logged in
      if (!user?.id) {
        console.log('⚠️ No user logged in, clearing models')
        setAvailableModels([])
        setSelectedModel('')
        return
      }

      try {
        // Load from backend database via userSettingsService (not localStorage)
        const { userSettingsService } = await import('@/utils/userSettingsService')
        const settings = await userSettingsService.load(user.id)
        
        // Get visible configured models
        const visibleModels = settings.models.configuredModels
          .filter(m => m.visible)
          .map(m => ({
            id: m.id,
            name: m.name,
            description: m.description || `${m.provider || 'AI'} model`
          }))
        
        console.log('📋 [useEffect] Loaded models from database:', {
          userId: user.id,
          defaultModel: settings.models.defaultModel,
          visibleCount: visibleModels.length,
          firstVisibleModel: visibleModels[0]?.id,
          currentSelectedModel: selectedModel
        })
        
        setAvailableModels(visibleModels)
        
        // Auto-select default model on initial load
        if (!selectedModel || selectedModel === '') {
          const defaultModelFromSettings = visibleModels.find(m => m.id === settings.models.defaultModel)
          const modelToSelect = defaultModelFromSettings || visibleModels[0]
          
          if (modelToSelect) {
            console.log('🎯 [useEffect] Auto-selecting default model:', {
              id: modelToSelect.id,
              name: modelToSelect.name,
              reason: defaultModelFromSettings ? 'from settings' : 'first visible model'
            })
            setSelectedModel(modelToSelect.id)
          } else {
            console.log('⚠️ No models available to select')
          }
        } else {
          // Check if current model is still valid
          const isCurrentModelValid = visibleModels.some(m => m.id === selectedModel)
          
          console.log('🔍 [useEffect] Validating current model:', {
            currentModel: selectedModel,
            isValid: isCurrentModelValid
          })
          
          if (!isCurrentModelValid) {
            // Current model is not valid, select default
            const defaultModelFromSettings = visibleModels.find(m => m.id === settings.models.defaultModel)
            const modelToSelect = defaultModelFromSettings || visibleModels[0]
            
            if (modelToSelect) {
              console.log('🔄 [useEffect] Current model invalid, switching to default:', {
                from: selectedModel,
                to: modelToSelect.id,
                toName: modelToSelect.name
              })
              setSelectedModel(modelToSelect.id)
            }
          } else {
            console.log('✅ [useEffect] Current model is valid:', {
              id: selectedModel,
              name: visibleModels.find(m => m.id === selectedModel)?.name
            })
          }
        }
      } catch (error) {
        console.error('❌ Failed to load models from database:', error)
        // No fallback models - user must configure models in settings
        setAvailableModels([])
        setSelectedModel('')
      }
    }
    
    loadModels()
    
    // Listen for storage changes to reload models when settings change
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'app-settings') {
        console.log('⚙️ Settings changed, reloading models...')
        loadModels()
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    // Also listen for custom event for same-window updates
    const handleSettingsUpdate = () => {
      // console.log('⚙️ Settings updated (custom event), reloading models...') // Disabled
      // loadModels() // Disabled verbose reload
    }
    
    window.addEventListener('settings-updated', handleSettingsUpdate)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('settings-updated', handleSettingsUpdate)
    }
  }, [user?.id])

  // Load custom modes from backend API (local database)
  useEffect(() => {
    const loadCustomModes = async () => {
      try {
        // Get current user from Keycloak auth
        const session = await keycloakAuth.getSession()
        
        if (!session?.user) {
          console.log('No user logged in, loading custom modes from localStorage')
          // Fallback to localStorage if not logged in
          const { SettingsManager } = await import('@/utils/settingsManager')
          const settings = SettingsManager.load()
          const modes = (settings as any).customModes || []
          setCustomModes(modes)
          console.log('📋 Loaded custom modes from localStorage:', {
            count: modes.length,
            modes: modes.map((m: any) => ({ id: m.id, name: m.name }))
          })
          return
        }

        // Fetch custom modes from backend API (local database)
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/custom-modes?userId=${session.user.id}`)
        
        if (!response.ok) {
          throw new Error(`Failed to load custom modes: ${response.statusText}`)
        }

        const { modes: data } = await response.json()

        // Transform backend data to match our interface
        const modes = (data || []).map((mode: any) => ({
          id: mode.id,
          name: mode.name,
          description: mode.description || '',
          systemPrompt: mode.system_prompt,
          createdAt: new Date(mode.created_at).getTime()
        }))

        setCustomModes(modes)
        
        // Also sync to localStorage for offline access
        const { SettingsManager } = await import('@/utils/settingsManager')
        SettingsManager.update('customModes', modes)
        
        // console.log('📋 Loaded custom modes from backend API (local database):', { ... }) // Disabled
      } catch (error) {
        console.error('❌ Failed to load custom modes:', error)
        // Fallback to localStorage on error
        try {
          const { SettingsManager } = await import('@/utils/settingsManager')
          const settings = SettingsManager.load()
          const modes = (settings as any).customModes || []
          setCustomModes(modes)
          console.log('📋 Loaded custom modes from localStorage (fallback):', {
            count: modes.length
          })
        } catch (fallbackError) {
          console.error('❌ Failed to load from localStorage too:', fallbackError)
        }
      }
    }
    
    loadCustomModes()
    
    // Listen for storage changes to reload modes when settings change
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'app-settings') {
        console.log('⚙️ Settings changed, reloading custom modes...')
        loadCustomModes()
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    // Also listen for custom event for same-window updates
    const handleSettingsUpdate = () => {
      // console.log('⚙️ Settings updated (custom event), reloading custom modes...') // Disabled
      loadCustomModes()
    }
    
    window.addEventListener('settings-updated', handleSettingsUpdate)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('settings-updated', handleSettingsUpdate)
    }
  }, [])

  // Sync selectedCustomMode with defaultModeId from settings when customModes are loaded
  useEffect(() => {
    // console.log('🔄 [SYNC] Checking if we need to sync selectedCustomMode:', { ... }) // Disabled
    
    if (customModes.length > 0) {
      try {
        const settingsStr = localStorage.getItem('app-settings')
        if (settingsStr) {
          const settings = JSON.parse(settingsStr)
          const defaultModeId = settings.defaultModeId
          
          console.log('🔄 [SYNC] Settings loaded:', {
            defaultModeId,
            currentSelectedMode: selectedCustomMode,
            modeExists: customModes.some(m => m.id === defaultModeId),
            availableModes: customModes.map(m => ({ id: m.id, name: m.name }))
          })
          
          // Only update if there's a default mode set and it exists in customModes
          if (defaultModeId && customModes.some(m => m.id === defaultModeId)) {
            if (selectedCustomMode !== defaultModeId) {
              setSelectedCustomMode(defaultModeId)
              console.log('✅ [SYNC] Updated selectedCustomMode to default from settings:', defaultModeId)
            } else {
              console.log('✅ [SYNC] selectedCustomMode already matches default:', defaultModeId)
            }
          } else if (defaultModeId) {
            console.warn('⚠️ [SYNC] Default mode ID not found in customModes:', defaultModeId)
          }
        }
      } catch (error) {
        console.error('❌ [SYNC] Failed to sync default mode:', error)
      }
    }
  }, [customModes])

  // Save model changes to active session in Supabase
  useEffect(() => {
    const saveModelToSession = async () => {
      if (!activeSessionId || !selectedModel || !user) return
      
      // CRITICAL: Skip if this is an optimistic session ID (not yet persisted)
      if (activeSessionId.startsWith('session_')) {
        console.log(`⏭️ Skipping model save for optimistic session: ${activeSessionId}`)
        return
      }
      
      const activeSession = sessions.find(s => s.id === activeSessionId)
      if (!activeSession) return
      
      // Only update if model actually changed
      if (activeSession.model === selectedModel) return
      
      try {
        console.log(`💾 Saving model to session: ${selectedModel}`)
        
        const headers = await getAuthHeaders()
        const response = await fetch(`${backendUrl}/api/sessions/${activeSessionId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ model: selectedModel })
        })
        
        if (!response.ok) {
          throw new Error('Failed to update session model')
        }
        
        // Update local session state
        setSessions(prev => prev.map(s => 
          s.id === activeSessionId ? { ...s, model: selectedModel } : s
        ))
        
        console.log(`✅ Model saved to session: ${selectedModel}`)
      } catch (error) {
        console.error('❌ Failed to save model to session:', error)
      }
    }
    
    // Debounce to avoid too many updates
    const timeoutId = setTimeout(saveModelToSession, 500)
    return () => clearTimeout(timeoutId)
  }, [selectedModel, activeSessionId])

  // Ref to track the latest activeSessionId to avoid stale closures
  const activeSessionIdRef = React.useRef<string | null>(activeSessionId)
  
  // Ref to track the debounce timeout for custom mode saving
  const customModeSaveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  
  // Update ref whenever activeSessionId changes and cancel any pending saves
  React.useEffect(() => {
    // Cancel any pending debounced save when session changes
    if (customModeSaveTimeoutRef.current) {
      console.log('🚫 Cancelling pending custom mode save due to session change')
      clearTimeout(customModeSaveTimeoutRef.current)
      customModeSaveTimeoutRef.current = null
    }
    
    activeSessionIdRef.current = activeSessionId
  }, [activeSessionId])
  
  // Save custom mode changes to active session in Supabase
  useEffect(() => {
    const saveCustomModeToSession = async () => {
      // CRITICAL: Use ref to get the LATEST session ID, not the one from closure
      const currentSessionId = activeSessionIdRef.current
      
      if (!currentSessionId || !user) return
      
      // CRITICAL: Skip if this is an optimistic session ID (not yet persisted)
      if (currentSessionId.startsWith('session_')) {
        console.log(`⏭️ Skipping custom mode save for optimistic session: ${currentSessionId}`)
        return
      }
      
      // CRITICAL: Validate that this is a real UUID before attempting to save
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(currentSessionId)) {
        console.log(`⏭️ Skipping custom mode save for non-UUID session: ${currentSessionId}`)
        return
      }
      
      // CRITICAL: Skip if we're currently creating a session
      if (isCreatingSessionRef.current) {
        console.log(`⏭️ Skipping custom mode save during session creation: ${currentSessionId}`)
        return
      }
      
      const activeSession = sessions.find(s => s.id === currentSessionId)
      if (!activeSession) {
        console.log(`⏭️ Skipping custom mode save - session not found: ${currentSessionId}`)
        return
      }
      
      // Only update if custom mode actually changed
      if (activeSession.customModeId === selectedCustomMode) return
      
      // CRITICAL FIX: Update local session state IMMEDIATELY before async save
      // This prevents race conditions where the old value is read before the save completes
      setSessions(prev => prev.map(s => 
        s.id === currentSessionId ? { ...s, customModeId: selectedCustomMode } : s
      ))
      
      try {
        console.log(`💾 Saving custom mode to session ${currentSessionId}: ${selectedCustomMode || 'default'}`)
        
        const headers = await getAuthHeaders()
        const response = await fetch(`${backendUrl}/api/sessions/${currentSessionId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ customModeId: selectedCustomMode })
        })
        
        if (!response.ok) {
          throw new Error('Failed to update session custom mode')
        }
        
        console.log(`✅ Custom mode saved to session: ${selectedCustomMode || 'default'}`)
      } catch (error) {
        console.error('❌ Failed to save custom mode to session:', error)
        // Revert local state on error
        setSessions(prev => prev.map(s => 
          s.id === currentSessionId ? { ...s, customModeId: activeSession.customModeId } : s
        ))
      }
    }
    
    // Cancel any existing timeout before setting a new one
    if (customModeSaveTimeoutRef.current) {
      clearTimeout(customModeSaveTimeoutRef.current)
    }
    
    // Debounce to avoid too many updates
    customModeSaveTimeoutRef.current = setTimeout(saveCustomModeToSession, 500)
    
    return () => {
      if (customModeSaveTimeoutRef.current) {
        clearTimeout(customModeSaveTimeoutRef.current)
        customModeSaveTimeoutRef.current = null
      }
    }
  }, [selectedCustomMode, activeSessionId, sessions, user])

  // Validate selected model whenever available models change
  // This ensures that if a session has an invalid model, it gets corrected
  useEffect(() => {
    if (availableModels.length === 0) {
      return // Wait for models to load
    }
    
    // Check if current selected model is valid
    const isValid = availableModels.some(m => m.id === selectedModel)
    
    if (!isValid && selectedModel !== '') {
      console.warn('⚠️ [Model Validation] Selected model is not in available models:', selectedModel)
      // Clear invalid model - user must select a valid one
      console.log('🔄 [Model Validation] Clearing invalid model selection')
      setSelectedModel('')
    } else if (isValid) {
      // console.log('✅ [Model Validation] Selected model is valid:', selectedModel) // Disabled
    }
  }, [availableModels, selectedModel])

  const models = availableModels

  // ============================================================================
  // Session Management Functions
  // ============================================================================

  /**
   * Generate a unique session ID
   */
  const generateSessionId = (): string => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Create a new session
   */
  const createNewSession = async (name?: string): Promise<Session> => {
    // Always use the default model from settings for new sessions
    let sessionModel = 'gemini-2.5-flash' // Fallback
    try {
      const { SettingsManager } = require('@/utils/settingsManager')
      const settings = SettingsManager.load()
      const visibleModels = settings.models.configuredModels.filter(m => m.visible)
      const defaultModel = visibleModels.find(m => m.id === settings.models.defaultModel)
      
      if (defaultModel) {
        sessionModel = defaultModel.id
        console.log('🎯 [Create Session] Using default model from settings:', sessionModel)
      } else if (visibleModels.length > 0) {
        sessionModel = visibleModels[0].id
        console.log('🔍 [Create Session] No default set, using first visible model:', sessionModel)
      }
    } catch (error) {
      console.error('Failed to load model settings:', error)
    }
    
    // Use active project ID if available, otherwise use default
    const projectId = activeProjectId || 'default-project';
    
    // If we have a valid project, use the API to persist the session
    if (projectId && projectId !== 'default-project') {
      return await createNewSessionForProject(projectId, name)
    }
    
    // Fallback to local-only session for default project
    const newSession: Session = {
      id: generateSessionId(),
      name: name || `Session ${sessions.length + 1}`,
      projectId: projectId,
      createdAt: new Date(),
      lastActive: new Date(),
      chatHistory: [],
      model: sessionModel,
      activeUsers: ['user-123'],
      isShared: false
    }

    setSessions(prev => {
      // Limit to 20 sessions maximum
      const updatedSessions = [...prev, newSession]
      if (updatedSessions.length > 20) {
        // Remove oldest session (by createdAt)
        updatedSessions.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        updatedSessions.shift()
      }
      return updatedSessions
    })

    setActiveSessionId(newSession.id)
    setChatHistory([])
    setMessages([]) // Clear useChat messages to prevent initial message
    setCreateNewProjectOnSend(false) // Reset flag when creating new session

    // Show toast notification
    addToast({
      id: generateToastId(),
      type: 'success',
      message: `Created new session: ${newSession.name}`,
      duration: 3000
    })

    return newSession
  }

  /**
   * Update streaming status for a specific session
   */
  const updateSessionStreamingStatus = (sessionId: string, status: 'ready' | 'submitted' | 'streaming' | 'error') => {
    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, streamingStatus: status } : s
    ))
  }

  /**
   * Switch to a different session
   * 
   * This function handles switching between chat sessions and ensures the terminal
   * iframe is visible when a session is selected. It manages multiple state updates
   * to guarantee proper visibility:
   * 
   * 1. Opens the chat sidebar (chatSidebarOpen = true)
   * 2. Shows the terminal area (showTerminalArea = true)
   * 3. Shows the chat area (showChatArea = true)
   * 4. Sets active tab to 'terminal' (activeTab = 'terminal')
   * 
   * The terminal visibility is further enforced by a useEffect hook that monitors
   * activeSessionId and chatSidebarOpen states.
   * 
   * @param sessionId - The ID of the session to switch to
   */
  const switchToSession = async (sessionId: string) => {
    console.log('🔄 Switching to session:', sessionId)
    console.log('📊 Current states before switch:', {
      chatSidebarOpen,
      showTerminalArea,
      showChatArea,
      activeTab,
      activeSessionId,
      isStreaming: streamingSessionsRef.current.size > 0,
      streamingSessionIds: Array.from(streamingSessionIds)
    })

    const session = sessions.find(s => s.id === sessionId)
    if (!session) {
      console.error(`❌ Session ${sessionId} not found`)
      return
    }

    // Set flag to prevent message duplication during switch
    isSwitchingSession.current = true
    
    // CRITICAL: If we're switching away from a streaming session, don't clear the streaming state
    // The stream should continue in the background, but we shouldn't show its updates in the UI
    // The streaming sessions will remain in the set, but updateChatHistory will check both
    // if session is streaming AND if it's active before updating the visible chat
    if (streamingSessionIds.has(sessionId)) {
      console.log(`📡 Switching to streaming session ${sessionId}`)
    } else if (activeSessionId && streamingSessionIds.has(activeSessionId)) {
      console.log(`📡 Leaving streaming session ${activeSessionId} to continue in background`)
      // Don't clear streaming state - let it continue streaming
      // Don't abort the stream - let it complete
    }

    // Save current session's chat history before switching
    // CRITICAL: Always save to both session state AND session cache for isolation
    if (activeSessionId) {
      const streamingState = streamingSessionsRef.current.get(activeSessionId);
      if (streamingState) {
        // Save from streaming state
        const historyToSave = streamingState.chatHistory;
        setSessions(prev => prev.map(s =>
          s.id === activeSessionId
            ? { ...s, chatHistory: historyToSave, lastActive: new Date() }
            : s
        ))
        // Update session cache
        updateSessionCache(activeSessionId, historyToSave, true);
      } else {
        // Save from global chatHistory
        setSessions(prev => prev.map(s =>
          s.id === activeSessionId
            ? { ...s, chatHistory, lastActive: new Date() }
            : s
        ))
        // Update session cache
        updateSessionCache(activeSessionId, chatHistory, false);
      }
    }

    // Switch to new session
    console.log('🔄 Switching to session:', session.id, 'Project:', session.projectId, 'Session model:', session.model)
    
    // Don't auto-sync model from session - user must explicitly select
    // This ensures collaborators can't send messages without choosing a model
    if (session.model && session.model !== selectedModel) {
      console.log(`⚠️ Session has model ${session.model}, but not auto-syncing. User must select manually.`)
    }
    
    if (session.customModeId !== selectedCustomMode) {
      // Determine which mode to use:
      // 1. If session has a custom mode, use it
      // 2. If session doesn't have a custom mode, use the default from settings
      let modeToUse: string | null = null
      
      if (session.customModeId) {
        // Session has a specific mode
        modeToUse = session.customModeId
      } else {
        // Session doesn't have a mode, use default from settings
        try {
          const settingsStr = localStorage.getItem('app-settings')
          if (settingsStr) {
            const settings = JSON.parse(settingsStr)
            modeToUse = settings.defaultModeId || null
            console.log('🎯 [SESSION-SWITCH] Using default mode from settings:', modeToUse)
          }
        } catch (error) {
          console.error('Failed to load default mode from settings:', error)
        }
      }
      
      console.log(`🔄 Syncing custom mode from session: ${selectedCustomMode} -> ${modeToUse || 'default'}`)
      setSelectedCustomMode(modeToUse)
    }
    
    // Reset the ref so the useEffect can load messages for this session
    lastLoadedSessionRef.current = null
    
    setActiveSessionId(session.id)
    setCreateNewProjectOnSend(false) // Reset flag when switching to existing session
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // MESSAGE PERSISTENCE: Load chat history with strict isolation
    // Priority: 1. Streaming state (if actively streaming), 2. Session cache, 3. Session.chatHistory, 4. Backend
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log(`💾 [${sessionId}] Loading chat history with strict isolation...`)
    
    // PRIORITY 1: If this session is currently streaming, ALWAYS load from streaming state (most up-to-date)
    if (streamingSessionsRef.current.has(sessionId)) {
      const streamingState = streamingSessionsRef.current.get(sessionId)!;
      
      // Update refs FIRST to prevent useEffect from interfering
      lastLoadedSessionRef.current = sessionId
      const chatHistoryHash = `${sessionId}-${streamingState.chatHistory.length}-${streamingState.chatHistory[streamingState.chatHistory.length - 1]?.timestamp}`
      lastSessionsHashRef.current = chatHistoryHash
      
      // Then update state to trigger immediate render - FORCE NEW ARRAY
      setChatHistory([...streamingState.chatHistory]) // Create new array to force re-render
      const cachedMessages = chatMessagesToMessages(streamingState.chatHistory)
      setMessages(cachedMessages)
      
      // Update session cache for future switches
      updateSessionCache(sessionId, streamingState.chatHistory, true);
    }
    // PRIORITY 2: Check session cache (reliable for non-streaming sessions)
    else if (getSessionCache(sessionId)) {
      const cachedSession = getSessionCache(sessionId)!;
      
      // CRITICAL: Validate that this is the correct session's data
      if (cachedSession.chatHistory.length > 0) {
        console.log(`   First message: "${cachedSession.chatHistory[0].content?.substring(0, 30)}..."`);
      }
      
      // Update refs FIRST to prevent useEffect from interfering
      lastLoadedSessionRef.current = sessionId
      const chatHistoryHash = `${sessionId}-${cachedSession.chatHistory.length}-${cachedSession.chatHistory[cachedSession.chatHistory.length - 1]?.timestamp}`
      lastSessionsHashRef.current = chatHistoryHash
      
      // Then update state to trigger immediate render - FORCE NEW ARRAY
      setChatHistory([...cachedSession.chatHistory]) // Create new array to force re-render
      const cachedMessages = chatMessagesToMessages(cachedSession.chatHistory)
      setMessages(cachedMessages)
    }
    // PRIORITY 3: Check if session has chatHistory with messages
    // Only use session.chatHistory if it has actual messages
    else if (session.chatHistory && session.chatHistory.length > 0) {
      console.log(`✅ Using session.chatHistory (${session.chatHistory.length} messages)`)
      
      // Update refs FIRST to prevent useEffect from interfering
      lastLoadedSessionRef.current = sessionId
      const chatHistoryHash = `${sessionId}-${session.chatHistory.length}-${session.chatHistory[session.chatHistory.length - 1]?.timestamp}`
      lastSessionsHashRef.current = chatHistoryHash
      
      // Then update state to trigger immediate render
      setChatHistory([...session.chatHistory]) // Create new array to force re-render
      const cachedMessages = chatMessagesToMessages(session.chatHistory)
      setMessages(cachedMessages)
      
      // Update session cache for future switches
      updateSessionCache(sessionId, session.chatHistory, false);
      
      console.log(`🎨 Loaded from session.chatHistory: ${session.chatHistory.length} messages`)
    } else {
      // No cached history or empty history, fetch from backend
      console.log('📡 Fetching chat history from backend...')
      try {
        const response = await fetch(`${backendUrl}/api/sessions/${sessionId}/history?limit=100`)
        const data = await response.json()
        
        if (data.success && data.history && Array.isArray(data.history)) {
          console.log(`✅ Loaded ${data.history.length} messages from backend`)
          
          // Convert backend messages to format expected by useChat
          const loadedMessages = data.history.map((msg: any) => {
            const message: any = {
              id: `${sessionId}_${msg.timestamp}`,
              role: msg.role,
              content: msg.content,
              createdAt: new Date(msg.timestamp)
            };
            
            // Include metadata fields so they're available in the messages array
            if (msg.mediaBlocks) message.mediaBlocks = msg.mediaBlocks;
            if (msg.commandOutputs) message.commandOutputs = msg.commandOutputs;
            if (msg.images) message.images = msg.images;
            if (msg.introText) message.introText = msg.introText;
            if (msg.thinkingProcess) message.thinkingProcess = msg.thinkingProcess;
            
            return message;
          })
          
          // Set messages in useChat hook
          setMessages(loadedMessages)
          
          // Use messages EXACTLY as stored - no conversion needed
          // The database stores complete message structure with all fields
          const chatHistoryFormat = data.history.map((msg: any) => {
            // Ensure timestamp is a Date object
            if (msg.timestamp && !(msg.timestamp instanceof Date)) {
              msg.timestamp = new Date(msg.timestamp);
            }
            
            // Keep role as-is (should be 'user' or 'assistant', NOT 'model')
            return msg;
          })
          setChatHistory(chatHistoryFormat)
          
          // Update the session's cached chatHistory
          setSessions(prev => prev.map(s =>
            s.id === sessionId ? { ...s, chatHistory: chatHistoryFormat } : s
          ))
          
          const messagesWithBlocks = chatHistoryFormat.filter((m: any) => m.mediaBlocks || m.commandOutputs);
          console.log(`✅ Chat history loaded and cached (${chatHistoryFormat.length} messages, ${messagesWithBlocks.length} with rich content)`)
          
          // Mark this session as loaded to prevent useEffect from loading again
          lastLoadedSessionRef.current = sessionId
          
          // Update the hash to prevent useEffect from reloading
          const chatHistoryHash = chatHistoryFormat.length > 0
            ? `${sessionId}-${chatHistoryFormat.length}-${chatHistoryFormat[chatHistoryFormat.length - 1]?.timestamp}`
            : `${sessionId}-empty`
          lastSessionsHashRef.current = chatHistoryHash
          
          // Update session cache for future switches
          updateSessionCache(sessionId, chatHistoryFormat, false);
        } else {
          console.log('⚠️  No history found or invalid response, starting with empty history')
          setMessages([])
          setChatHistory([])
          lastLoadedSessionRef.current = sessionId
          lastSessionsHashRef.current = `${sessionId}-empty`
          
          // Update session cache with empty history
          updateSessionCache(sessionId, [], false);
        }
      } catch (error) {
        console.error('❌ Failed to load chat history from backend:', error)
        console.log('⚠️  Starting with empty history')
        setMessages([])
        setChatHistory([])
        lastLoadedSessionRef.current = sessionId
        lastSessionsHashRef.current = `${sessionId}-empty`
        
        // Update session cache with empty history
        updateSessionCache(sessionId, [], false);
      }
    }
    // ═══════════════════════════════════════════════════════════════════════════════
    
    // Keep the currently selected model when switching sessions
    // The user's model selection persists across sessions until page refresh
    console.log('🎯 [Switch Session] Keeping current model selection:', selectedModel)
    
    setShowSessionDropdown(false)
    
    // When clicking a session, hide the modal but keep the creating project selected
    // This allows working with sessions while a project is being created in background
    if (showProjectModal) {
      console.log('✅ Hiding creation modal to work with session')
      setShowProjectModal(false)
    }
    
    // Switch to the session's project (this changes terminal/desktop)
    // BUT: Don't switch away from a creating project unless explicitly selecting a different project
    if (session.projectId && session.projectId !== activeProjectId) {
      console.log('🔄 Session wants to switch to project:', session.projectId)
      
      // Check if current active project is being created
      const currentProject = projects.find(p => p.id === activeProjectId)
      const isCurrentProjectCreating = currentProject && (currentProject.status === 'creating' || currentProject.is_creating)
      
      if (isCurrentProjectCreating) {
        console.log('📦 Current project is being created, keeping it selected (but hiding modal)')
        // Don't switch projects - keep the creating project active
        // Modal is already hidden above
      } else {
        // Current project is ready or no active project, safe to switch
        console.log('🔄 Switching to session project:', session.projectId)
        setActiveProjectId(session.projectId)
      }
    }

    // Open chat sidebar to show terminal and chat
    console.log('🎨 Setting visibility states...')
    setChatSidebarOpen(true)
    setAnimationsDisabled(true)
    setShowOrderText(false)
    
    // Ensure both terminal and chat areas are visible
    setShowTerminalArea(true)
    setShowChatArea(true)
    
    // Set active tab to desktop
    setActiveTab('desktop')

    console.log('✅ New states set:', {
      chatSidebarOpen: true,
      showTerminalArea: true,
      showChatArea: true,
      activeTab: 'desktop',
      newActiveSessionId: session.id
    })

    // Update last active time
    setSessions(prev => prev.map(s =>
      s.id === sessionId
        ? { ...s, lastActive: new Date() }
        : s
    ))

    // Reset the flag after a short delay to allow state updates to complete
    setTimeout(() => {
      isSwitchingSession.current = false
    }, 100)

    console.log('🖥️ Terminal iframe should now be visible')
  }

  /**
   * Close a session
   * OPTIMIZED: Instant deletion with fire-and-forget backend sync
   */
  const closeSession = async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return

    // Store the project ID before deleting
    const sessionProjectId = session.projectId

    // IMMEDIATELY remove from local state (optimistic update)
    const remainingSessions = sessions.filter(s => s.id !== sessionId)
    setSessions(remainingSessions)
    
    // Add to deleted sessions list immediately
    setDeletedSessions(prev => [...prev, { ...session, deletedAt: new Date() }])

    // Delete from backend in background (fire-and-forget, no error handling)
    // This ensures instant UI response without waiting for backend
    fetch(`${backendUrl}/api/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders()
    }).catch(() => {
      // Silently fail - deletion already happened in UI
      // Backend will eventually sync or user can restore from deleted sessions
    })

    // If closing the active session, switch to another one
    if (sessionId === activeSessionId) {
      // Check for remaining sessions IN THE SAME PROJECT
      const remainingProjectSessions = remainingSessions.filter(s => s.projectId === sessionProjectId)
      
      if (remainingProjectSessions.length > 0) {
        // Switch to most recently active session in the same project
        const sortedSessions = [...remainingProjectSessions].sort((a, b) =>
          new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
        )
        switchToSession(sortedSessions[0].id)
      } else {
        // No more sessions in this project - create a new one for the same project
        console.log('🔄 Last session in project deleted, creating new session for project:', sessionProjectId)
        
        if (sessionProjectId && sessionProjectId !== 'default-project') {
          // Create a new session for the same project
          createNewSessionForProject(sessionProjectId, 'New Session').then(newSession => {
            console.log('✅ Created new session for project:', sessionProjectId)
          }).catch(error => {
            console.error('Failed to create new session for project:', error)
          })
        } else {
          // For default project, create a local session
          createNewSession('New Session').then(newSession => {
            setSessions([newSession])
            setActiveSessionId(newSession.id)
            setChatHistory([])
          }).catch(error => {
            console.error('Failed to create new session:', error)
          })
        }
      }
    }

    setSessions(remainingSessions)

    addToast({
      id: generateToastId(),
      type: 'info',
      message: `Closed session: ${session.name}`,
      duration: 3000
    })
  }

  /**
   * Update session name
   */
  const updateSessionName = (sessionId: string, newName: string) => {
    setSessions(prev => prev.map(s =>
      s.id === sessionId
        ? { ...s, name: newName }
        : s
    ))
  }

  /**
   * Fetch deleted sessions for the active project
   */
  const fetchDeletedSessions = async () => {
    console.log('🗑️ Fetching deleted sessions for project:', activeProjectId)
    
    if (!activeProjectId) {
      console.log('❌ No active project ID')
      return
    }

    try {
      const headers = await getAuthHeaders()
      const url = `${backendUrl}/api/sessions/projects/${activeProjectId}/deleted`
      console.log('📡 Fetching from:', url)
      
      const response = await fetch(url, { headers })
      console.log('📥 Response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        console.log('✅ Deleted sessions data:', data)
        console.log('📊 Number of deleted sessions:', data.sessions?.length || 0)
        setDeletedSessions(data.sessions || [])
      } else {
        console.error('❌ Failed to fetch deleted sessions:', response.status)
        const errorText = await response.text()
        console.error('Error response:', errorText)
        setDeletedSessions([])
      }
    } catch (error) {
      console.error('❌ Error fetching deleted sessions:', error)
      setDeletedSessions([])
    }
  }

  /**
   * Restore a deleted session
   */
  const restoreSession = async (sessionId: string) => {
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${backendUrl}/api/sessions/${sessionId}/restore`, {
        method: 'POST',
        headers
      })

      if (!response.ok) {
        console.error('Failed to restore session:', response.status)
        addToast({
          id: generateToastId(),
          type: 'error',
          message: 'Failed to restore session',
          duration: 3000
        })
        return
      }

      const data = await response.json()
      console.log('✅ Session restored:', data.session)

      // Load chat history for the restored session
      let chatHistory = []
      try {
        const historyResponse = await fetch(`${backendUrl}/api/sessions/${sessionId}/history?limit=100`, {
          headers
        })
        const historyData = await historyResponse.json()
        
        if (historyData.success && historyData.history && Array.isArray(historyData.history)) {
          chatHistory = historyData.history.map((msg: any) => {
            // Ensure timestamp is a Date object
            if (msg.timestamp && !(msg.timestamp instanceof Date)) {
              msg.timestamp = new Date(msg.timestamp);
            }
            
            // Remove duplicate text blocks that match introText
            if (msg.introText && msg.mediaBlocks && Array.isArray(msg.mediaBlocks)) {
              msg.mediaBlocks = msg.mediaBlocks.filter((block: any) => {
                if (block.type !== 'text') return true;
                const blockText = block.data?.text?.trim();
                const introText = msg.introText?.trim();
                return blockText !== introText;
              });
            }
            
            return msg;
          })
          console.log(`  ✅ Loaded ${chatHistory.length} messages for restored session`)
        }
      } catch (error) {
        console.error(`  ⚠️  Failed to load history for restored session:`, error)
      }

      // Remove from deleted sessions
      setDeletedSessions(prev => prev.filter(s => s.id !== sessionId))

      // Create session object with chat history
      const restoredSession = {
        id: data.session.id,
        name: data.session.name,
        projectId: data.session.projectId || data.session.project_id,
        createdAt: new Date(data.session.createdAt || data.session.created_at),
        lastActive: new Date(data.session.lastActive || data.session.last_active),
        chatHistory: chatHistory,
        model: data.session.model,
        activeUsers: ['user-123'],
        isShared: false
      }

      // Add to active sessions with chat history
      setSessions(prev => [...prev, restoredSession])

      // Switch to the restored session (now with chat history loaded)
      switchToSession(sessionId)

      addToast({
        id: generateToastId(),
        type: 'success',
        message: `Restored session: ${data.session.name}`,
        duration: 3000
      })
    } catch (error) {
      console.error('Error restoring session:', error)
      addToast({
        id: generateToastId(),
        type: 'error',
        message: 'Failed to restore session',
        duration: 3000
      })
    }
  }

  /**
   * Get the active session object
   */
  const getActiveSession = (): Session | null => {
    return sessions.find(s => s.id === activeSessionId) || null
  }

  // ============================================================================
  // Toast Notification Functions
  // ============================================================================

  /**
   * Add a toast notification
   */
  const addToast = (toast: ToastNotification) => {
    setToasts(prev => [...prev, toast])

    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        removeToast(toast.id)
      }, toast.duration)
    }
  }

  /**
   * Remove a toast notification
   */
  const removeToast = (toastId: string) => {
    setToasts(prev => prev.filter(t => t.id !== toastId))
  }

  // ============================================================================
  // Project Management Functions
  // ============================================================================

  // Helper function to get session token
  const getSessionToken = async (): Promise<string | null> => {
    try {
      const session = await keycloakAuth.getSession();
      return session?.access_token || null;
    } catch (error) {
      console.error('[getSessionToken] Error getting token:', error);
      return null;
    }
  };

  // Helper function to get auth headers
  const getAuthHeaders = async () => {
    const token = await getSessionToken()
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : 'Bearer test-token' // Fallback to test token for development
    }
  }

  // Fetch collaborators for the active project
  const fetchProjectCollaborators = React.useCallback(async (projectId: string) => {
    if (!projectId) return
    
    try {
      console.log('👥 Fetching collaborators for project:', projectId)
      const headers = await getAuthHeaders()
      // Include userId in query params for visibility filtering (if user is available)
      const url = user 
        ? `${backendUrl}/api/projects/${projectId}/collaborators?userId=${user.id}`
        : `${backendUrl}/api/projects/${projectId}/collaborators`
      const response = await fetch(url, {
        headers
      })
      
      if (!response.ok) {
        console.error('Failed to fetch collaborators:', response.status)
        return
      }
      
      const data = await response.json()
      console.log('👥 API Response:', data)
      console.log('👥 API Response (full):', JSON.stringify(data, null, 2))
      
      if (data.success && Array.isArray(data.collaborators)) {
        console.log('👥 Loaded', data.collaborators.length, 'collaborators')
        console.log('👥 Raw collaborator data:', data.collaborators)
        console.log('👥 Raw collaborator data (full):', JSON.stringify(data.collaborators, null, 2))
        
        // Transform collaborators to match the expected format
        const formattedCollaborators = data.collaborators.map((collab: any) => {
          const formatted = {
            userId: collab.user_id || collab.userId,
            userName: collab.user_name || collab.userName || 'Unknown',
            email: collab.email,
            avatarUrl: collab.avatar_url || collab.avatarUrl,
            status: 'offline', // Default to offline, WebSocket will update
            lastActivity: Date.now(),
            isOwner: collab.is_owner || collab.isOwner || false,
            isVisible: collab.is_visible !== false
          }
          console.log(`👤 Formatted ${formatted.userName}:`, {
            userId: formatted.userId,
            isOwner: formatted.isOwner,
            avatarUrl: formatted.avatarUrl,
            avatarUrlLast10: formatted.avatarUrl?.slice(-10)
          })
          return formatted
        })
        
        console.log('👥 Formatted collaborators:', formattedCollaborators)
        console.log('👥 Formatted collaborators (full):', JSON.stringify(formattedCollaborators, null, 2))
        setProjectCollaborators(formattedCollaborators)
      } else {
        console.error('❌ Invalid API response:', data)
      }
    } catch (error) {
      console.error('Error fetching collaborators:', error)
    }
  }, [backendUrl, user])

  // Load collaborators when active project changes
  React.useEffect(() => {
    if (activeProjectId) {
      fetchProjectCollaborators(activeProjectId)
    } else {
      // Clear collaborators when no project is active
      setProjectCollaborators([])
    }
  }, [activeProjectId, fetchProjectCollaborators])

  const createProject = async (name: string, os: string = 'kali-linux') => {
    try {
      if (!user) {
        addToast({ id: Date.now().toString(), type: 'error', message: 'Please sign in to create projects', duration: 3000 })
        return
      }
      
      console.log('Creating project:', name, 'with OS:', os)
      
      const headers = await getAuthHeaders()
      
      // Step 1: Create project in database with status='creating'
      const createResponse = await fetch(`${backendUrl}/api/projects/create-placeholder`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, userId: user.id, os })
      })
      
      if (!createResponse.ok) {
        const errorText = await createResponse.text()
        console.error('Failed to create placeholder:', errorText)
        throw new Error(`Failed to create project placeholder: ${errorText}`)
      }
      
      const placeholderData = await createResponse.json()
      console.log('Placeholder response:', placeholderData)
      
      if (!placeholderData.success || !placeholderData.project) {
        throw new Error('Invalid placeholder response')
      }
      
      const projectId = placeholderData.project.id
      const projectCreatedAt = placeholderData.project.createdAt || placeholderData.project.created_at
      
      console.log('✅ Created placeholder project:', projectId)
      console.log('📅 Project created at:', projectCreatedAt)
      
      // Reload projects to show the creating project
      if (user?.id) {
        await loadProjects(user.id, true)
      }
      
      // Set as active project
      setActiveProjectId(projectId)
      
      // Show progress in modal
      setCreationProgressSafe({
        active: true,
        step: 'init',
        message: 'Initializing project...',
        progress: 5,
        projectId: projectId
      })
      
      // Simulate progress updates while waiting for backend
      const progressInterval = setInterval(() => {
        setCreationProgress(prev => {
          if (!prev || prev.progress >= 85) return prev
          const newProgress = Math.min(prev.progress + 5, 85)
          maxProgressRef.current = Math.max(newProgress, maxProgressRef.current)
          return {
            ...prev,
            progress: newProgress
          }
        })
      }, 1000)
      
      // Step 2: Actually create the container and infrastructure
      const response = await fetch(`${backendUrl}/api/projects/${projectId}/initialize`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ os })
      })
      
      clearInterval(progressInterval)
      
      console.log('Response status:', response.status)
      
      const text = await response.text()
      const data = JSON.parse(text)
      console.log('Response data:', data)
      
      if (data.success && data.project) {
        console.log('✅ Project initialized successfully:', data.project)
        
        // Use shared monitoring function with project creation time from placeholder
        const monitoringSuccess = await monitorProjectCreation(projectId, os, projectCreatedAt)
        
        // If monitoring was cancelled or failed, don't continue
        if (!monitoringSuccess) {
          console.log('⚠️ Monitoring cancelled or failed, stopping project creation')
          return
        }
        
        // After monitoring completes, set up the project
        // CRITICAL: Clear active project first to force unmount of old iframes
        setActiveProjectId(null)
        
        // Wait for unmount to complete
        await new Promise(resolve => setTimeout(resolve, 50))
        
        // Reload projects from backend to ensure proper indexing and fresh state
        if (user?.id) {
          await loadProjects(user.id, true) // Force reload after creation
        }
        
        // Wait for state to propagate
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Now set the new project as active - this ensures fresh mount with correct data
        setActiveProjectId(data.project.id)
        console.log('✅ Set active project ID:', data.project.id)
        
        // Create initial chat session
        console.log('Creating initial chat session for project:', data.project.id)
        const sessionName = 'Session 1'
        await createNewSessionForProject(data.project.id, sessionName)
        
        // Open UI
        setChatSidebarOpen(true)
        setShowTerminalArea(true)
        setShowChatArea(true)
        setActiveTab('desktop')
        setAnimationsDisabled(true)
        setShowOrderText(false)
        
        // For Ubuntu projects, wait for desktop to be ready
        const isUbuntu = os === 'ubuntu-24' || os === 'ubuntu-22'
        if (isUbuntu) {
          setCreationProgressSafe({
            active: true,
            step: 'desktop',
            message: 'Initializing VNC server, GNOME desktop, and services...',
            progress: 90,
            projectId: projectId
          })
          
          // Poll desktop readiness - try to actually connect
          let attempts = 0
          const maxAttempts = 45 // 90 seconds max
          let vncReady = false
          
          while (attempts < maxAttempts && !vncReady) {
            try {
              // Try a real fetch (not HEAD, not no-cors) to see if we get a response
              const checkResponse = await fetch(`http://localhost:${data.project.novncPort}/vnc_tunnel.html`, {
                method: 'GET',
                cache: 'no-cache'
              })
              
              if (checkResponse.ok) {
                console.log('✅ VNC server is responding!')
                vncReady = true
                break
              } else {
                console.log(`⏳ VNC server returned status ${checkResponse.status}`)
              }
            } catch (error) {
              console.log(`⏳ Waiting for VNC server... (${attempts + 1}/${maxAttempts})`)
            }
            
            attempts++
            
            // Update progress message
            setCreationProgressSafe({
              active: true,
              step: 'desktop',
              message: `Starting VNC server and GNOME desktop... (${attempts}/${maxAttempts})`,
              progress: 90 + Math.min(Math.floor(attempts / 4.5), 9),
              projectId: projectId
            })
            
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
          
          if (!vncReady) {
            console.warn('⚠️ VNC server did not respond in time, but continuing anyway')
          }
        }
        
        setCreationProgressSafe({
          active: true,
          step: 'complete',
          message: 'Project ready!',
          progress: 100,
          projectId: projectId
        })
        
        // Clear progress and close modal
        setTimeout(() => {
          setCreationProgressSafe(null)
          setShowProjectModal(false)
        }, 500)
        
        addToast({ id: Date.now().toString(), type: 'success', message: `Project "${data.project.name}" created!`, duration: 3000 })
      } else {
        console.error('Project initialization failed:', data)
        // Mark project as error in database
        await fetch(`${backendUrl}/api/projects/${projectId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: 'error' })
        })
        // Reload to show error state
        if (user?.id) {
          await loadProjects(user.id, true)
        }
        setActiveProjectId(null)
        throw new Error(data.message || 'Failed to initialize project')
      }
    } catch (error) {
      console.error('Failed to create project:', error)
      setCreationProgressSafe(null)
      addToast({ id: Date.now().toString(), type: 'error', message: `Failed: ${error.message}`, duration: 5000 })
      throw error
    }
  }
  
  // Create a new session in a collaboration
  const createNewSessionForCollaboration = async (shareToken: string, projectId: string, sessionName?: string) => {
    try {
      if (!user) {
        addToast({ id: Date.now().toString(), type: 'error', message: 'Please sign in to create sessions', duration: 3000 })
        return
      }
      
      const collab = collaborations.find(c => c.collaboration?.share_token === shareToken || c.shareToken === shareToken)
      const collabSessions = sessions.filter(s => s.shareToken === shareToken)
      const defaultName = sessionName || `Session ${collabSessions.length + 1}`
      
      // Call backend API to create session in collaboration
      const headers = await getAuthHeaders()
      const response = await fetch(`${backendUrl}/api/collaborations/${shareToken}/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: user.id,
          userName: user.email || user.user_metadata?.full_name || 'User',
          name: defaultName,
          model: selectedModel || 'gemini-2.0-flash-exp'
        })
      })
      
      const data = await response.json()
      
      if (!data.success || !data.session) {
        throw new Error(data.message || 'Failed to create session')
      }
      
      // Convert backend session format to frontend format
      const newSession: Session = {
        id: data.session.id,
        name: data.session.name,
        projectId: data.session.projectId || data.session.project_id || projectId,
        createdAt: new Date(data.session.createdAt || data.session.created_at),
        lastActive: new Date(data.session.lastActive || data.session.last_active),
        chatHistory: [],
        model: data.session.model,
        activeUsers: ['user-123'],
        isShared: true,
        shareToken: shareToken,
        isCollaboration: true
      }
      
      // Add to local state (check for duplicates first)
      setSessions(prev => {
        // Check if session already exists
        if (prev.some(s => s.id === newSession.id)) {
          console.log('⚠️ Collaboration session already exists, not adding duplicate:', newSession.id)
          return prev
        }
        console.log('✅ Adding new collaboration session to state:', newSession.id)
        return [...prev, newSession]
      })
      setActiveSessionId(newSession.id)
      setActiveProjectId(projectId)
      setChatHistory([])
      setMessages([]) // Clear useChat messages to prevent initial message
      setCreateNewProjectOnSend(false) // Reset flag when creating collaboration session
      setChatSidebarOpen(true)
      setShowTerminalArea(true) // Ensure terminal area is visible
      setShowChatArea(true) // Ensure chat area is visible
      setActiveTab('desktop') // Set active tab to desktop
      
      addToast({ id: generateToastId(), type: 'success', message: `Session "${newSession.name}" created`, duration: 3000 })
      console.log('✅ Created collaboration session:', newSession.id)
      
      // Refresh projects and collaborations to show the new session
      refreshData()
      
      return newSession
    } catch (error) {
      console.error('Failed to create collaboration session:', error)
      addToast({ id: Date.now().toString(), type: 'error', message: `Failed: ${error.message}`, duration: 5000 })
      throw error
    }
  }

  // Create a new session for a specific project
  const createNewSessionForProject = async (projectId: string, sessionName?: string) => {
    // CRITICAL: Immediate synchronous check before any async operations
    sessionCreationCallCountRef.current++
    const callNumber = sessionCreationCallCountRef.current
    console.log(`🔔 Session creation called (call #${callNumber})`)
    
    if (isCreatingSessionRef.current) {
      console.log(`⚠️ BLOCKED call #${callNumber}: Session creation already in progress (immediate ref check)`)
      return
    }
    
    // Set ref guard IMMEDIATELY before any other code
    isCreatingSessionRef.current = true
    console.log(`🔒 Session creation guard SET (call #${callNumber})`)
    
    try {
      if (!user) {
        addToast({ id: Date.now().toString(), type: 'error', message: 'Please sign in to create sessions', duration: 3000 })
        return
      }
      
      // State-based check (secondary)
      if (isCreatingSession) {
        console.log(`⚠️ BLOCKED call #${callNumber}: Session creation already in progress (state check)`)
        return
      }
      
      // Set state guard
      setIsCreatingSession(true)
      
      console.log(`🔵 createNewSessionForProject executing (call #${callNumber}):`, { projectId, sessionName, userId: user.id })
      
      // Get the default model from settings to use for new session
      let modelToUse = 'gemini-2.0-flash-exp' // Fallback
      try {
        const { SettingsManager } = require('@/utils/settingsManager')
        const settings = SettingsManager.load()
        const visibleModels = settings.models.configuredModels.filter((m: any) => m.visible)
        const defaultModel = visibleModels.find((m: any) => m.id === settings.models.defaultModel)
        
        if (defaultModel) {
          modelToUse = defaultModel.id
          console.log('🎯 [Create Session] Using default model from settings:', modelToUse)
        } else if (visibleModels.length > 0) {
          modelToUse = visibleModels[0].id
          console.log('🔍 [Create Session] No default set, using first visible model:', modelToUse)
        }
      } catch (error) {
        console.error('Failed to load default model for new session:', error)
      }
      
      const projectSessions = sessions.filter(s => s.projectId === projectId)
      const defaultName = sessionName || `Session ${projectSessions.length + 1}`
      
      // OPTIMISTIC CREATION: Create session locally first for instant UI response
      const tempSessionId = generateSessionId()
      const optimisticSession: Session = {
        id: tempSessionId,
        name: defaultName,
        projectId: projectId,
        createdAt: new Date(),
        lastActive: new Date(),
        chatHistory: [],
        model: modelToUse,
        activeUsers: [user.id],
        isShared: false,
        _pendingSync: true // Mark as pending backend sync
      }
      
      // Add to UI immediately (check for duplicates first)
      setSessions(prev => {
        // Check if a session with this temp ID already exists (shouldn't happen but safety check)
        if (prev.some(s => s.id === tempSessionId)) {
          console.warn('⚠️ Optimistic session with this ID already exists, not adding duplicate')
          return prev
        }
        
        // Check if we already have a session with the same name for this project (created in last 5 seconds)
        const recentDuplicate = prev.find(s => 
          s.projectId === projectId && 
          s.name === defaultName &&
          (Date.now() - new Date(s.createdAt).getTime()) < 5000
        )
        
        if (recentDuplicate) {
          console.warn('⚠️ Recent session with same name exists, not adding duplicate:', recentDuplicate.id)
          return prev
        }
        
        return [...prev, optimisticSession]
      })
      setActiveSessionId(tempSessionId)
      setChatHistory([])
      setMessages([])
      setCreateNewProjectOnSend(false) // Reset flag when creating new session
      
      console.log('✅ Created optimistic session locally:', tempSessionId)
      
      // Now try to persist to backend in the background
      // If it fails, the session still works locally
      try {
        // Check if backend is reachable (with short timeout)
        const healthCheck = await fetch(`${backendUrl}/health`, { 
          method: 'GET',
          signal: AbortSignal.timeout(2000)
        }).catch(() => null)
        
        if (!healthCheck || !healthCheck.ok) {
          console.warn('⚠️ Backend not reachable, session will work locally only')
          addToast({ 
            id: Date.now().toString(), 
            type: 'warning', 
            message: 'Session created locally. Backend sync will retry later.', 
            duration: 3000 
          })
          setIsCreatingSession(false)
          isCreatingSessionRef.current = false // Reset ref guard
          return optimisticSession
        }
        
        // Check if this project is part of a collaboration
        const collab = collaborations.find(c => 
          (c.project?.id === projectId || c.projectId === projectId)
        )
        
        // If it's a collaboration, use the collaboration endpoint
        if (collab) {
          const shareToken = collab.collaboration?.share_token || collab.shareToken
          if (shareToken) {
            setIsCreatingSession(false)
            isCreatingSessionRef.current = false // Reset ref guard
            return await createNewSessionForCollaboration(shareToken, projectId, sessionName)
          }
        }
        
        console.log('📡 Persisting session to backend:', {
          url: `${backendUrl}/api/sessions`,
          projectId,
          userId: user.id,
          name: defaultName,
          model: modelToUse
        })
        
        const headers = await getAuthHeaders()
        
        // Add timeout to fetch request (shorter timeout for background sync)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
        
        let response
        try {
          response = await fetch(`${backendUrl}/api/sessions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              projectId: projectId,
              userId: user.id,
              userName: user.email || user.user_metadata?.full_name || 'User',
              name: defaultName,
              model: modelToUse
            }),
            signal: controller.signal
          })
        } catch (fetchError: any) {
          clearTimeout(timeoutId)
          if (fetchError.name === 'AbortError') {
            console.warn('⚠️ Session persistence timeout - session works locally')
            addToast({ 
              id: Date.now().toString(), 
              type: 'warning', 
              message: 'Session created locally. Backend sync will retry later.', 
              duration: 3000 
            })
            setIsCreatingSession(false)
            isCreatingSessionRef.current = false // Reset ref guard
            return optimisticSession
          }
          console.error('❌ Fetch error:', fetchError)
          throw new Error(`Network error: ${fetchError.message}`)
        }
        
        clearTimeout(timeoutId)
        
        console.log('📡 Session creation response status:', response.status)
        console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()))
        
        // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('❌ Non-JSON response:', text.substring(0, 500))
        console.error('❌ Full response status:', response.status, response.statusText)
        
        // Check if it's a 502 Bad Gateway
        if (response.status === 502) {
          throw new Error('Backend server is not responding (502 Bad Gateway). Please check if the backend is running on port 3002.')
        }
        
        throw new Error(`Server returned non-JSON response (${response.status} ${response.statusText}). Response: ${text.substring(0, 200)}`)
      }
      
      const data = await response.json()
      console.log('📡 Session creation response data:', data)
      
      if (!data.success || !data.session) {
        console.error('❌ Session creation failed:', {
          success: data.success,
          hasSession: !!data.session,
          message: data.message,
          fullResponse: data
        })
        throw new Error(data.message || 'Failed to create session')
      }
      
      // Convert backend session format to frontend format
      const newSession: Session = {
        id: data.session.id,
        name: data.session.name,
        projectId: data.session.projectId || data.session.project_id,
        createdAt: new Date(data.session.createdAt || data.session.created_at),
        lastActive: new Date(data.session.lastActive || data.session.last_active),
        chatHistory: [],
        model: data.session.model,
        activeUsers: ['user-123'],
        isShared: false,
        _pendingSync: false // Successfully synced
      }
      
      // CRITICAL: Update activeSessionId FIRST to prevent race conditions
      // This ensures any effects triggered by session changes use the new UUID
      setActiveSessionId(newSession.id)
      setCreateNewProjectOnSend(false) // Reset flag when session is confirmed
      
      // Replace the optimistic session with the backend session
      setSessions(prev => {
        // Find and replace the optimistic session (by temp ID)
        const optimisticIndex = prev.findIndex(s => s.id === tempSessionId)
        if (optimisticIndex !== -1) {
          console.log('✅ Replacing optimistic session with backend session:', tempSessionId, '->', newSession.id)
          const updated = [...prev]
          updated[optimisticIndex] = newSession
          return updated
        }
        
        // If optimistic session not found (shouldn't happen), just add the new one
        console.log('⚠️ Optimistic session not found, adding backend session:', newSession.id)
        return [...prev, newSession]
      })
      setActiveProjectId(projectId)
      setChatHistory([])
      setMessages([]) // Clear useChat messages to prevent initial message
      setChatSidebarOpen(true)
      setShowTerminalArea(true) // Ensure terminal area is visible
      setShowChatArea(true) // Ensure chat area is visible
      setActiveTab('desktop') // Set active tab to desktop
      
        console.log('✅ Created and persisted session:', newSession.id)
        addToast({ id: generateToastId(), type: 'success', message: `Session "${defaultName}" created`, duration: 3000 })
        
        // Refresh projects and collaborations to show the new session
        refreshData()
        
        // Note: WebSocket notification is handled by backend
        
        return newSession
      } catch (backendError: any) {
        // Backend persistence failed, but optimistic session still works
        console.error('❌ Failed to persist session to backend:', backendError)
        addToast({ 
          id: Date.now().toString(), 
          type: 'warning', 
          message: 'Session created locally. Backend sync failed.', 
          duration: 3000 
        })
        return optimisticSession
      }
    } catch (error) {
      console.error('❌ Failed to create session:', error)
      addToast({ id: Date.now().toString(), type: 'error', message: `Failed to create session: ${error.message}`, duration: 5000 })
      throw error
    } finally {
      setIsCreatingSession(false)
      isCreatingSessionRef.current = false // Reset ref guard
    }
  }
  
  // Handler for creating new session from sidebar context menu
  const handleNewSessionForProject = (projectId: string) => {
    // Debounce: prevent multiple rapid calls
    if (isCreatingSessionRef.current) {
      console.log('⚠️ Ignoring duplicate session creation call (debounced)')
      return
    }
    
    createNewSessionForProject(projectId)
  }

  // Handler for project selection with proper state refresh
  const handleProjectSelect = (projectId: string) => {
    console.log('🎯 Project selected:', projectId)
    
    // Check if this project is being created
    const selectedProject = projects.find(p => p.id === projectId)
    if (selectedProject && (selectedProject.status === 'creating' || selectedProject.is_creating)) {
      console.log('📦 Selected project is being created, showing progress modal')
      setShowProjectModal(true)
      // Always set as active, even if already active (to ensure it stays selected)
      setActiveProjectId(projectId)
      return
    }
    
    // If selecting a ready project, close the modal if it's open
    if (showProjectModal) {
      console.log('✅ Selected ready project, closing creation modal')
      setShowProjectModal(false)
    }
    
    // If selecting a different project, clear active first to force iframe unmount
    if (activeProjectId && activeProjectId !== projectId) {
      console.log('🔄 Switching projects, clearing active project first')
      setActiveProjectId(null)
      
      // Small delay to ensure unmount, then set new project
      setTimeout(() => {
        setActiveProjectId(projectId)
        console.log('✅ New project set as active:', projectId)
      }, 50)
    } else {
      // Same project or no active project, just set it
      setActiveProjectId(projectId)
    }
  }

  // Cache timestamp to prevent unnecessary reloads
  const projectsLoadedRef = React.useRef<number>(0)
  const CACHE_DURATION = 30000 // 30 seconds cache
  
  /**
   * Monitor project creation status and update progress
   */
  const monitorProjectCreation = async (projectId: string, os: string, createdAt?: string) => {
    const isWindows = os === 'windows-11' || os === 'windows-10'
    const headers = await getAuthHeaders()
    
    console.log(`⏳ Starting to monitor project ${projectId} (${isWindows ? 'Windows' : 'Linux'})`)
    
    // Set this project as actively monitored
    activeMonitoringRef.current = projectId
    
    // Use project creation time if available, otherwise use current time
    const projectStartTime = createdAt ? new Date(createdAt).getTime() : Date.now()
    
    let attempts = 0
    const maxAttempts = isWindows ? 3600 : 120
    let isReady = false
    
    while (attempts < maxAttempts && !isReady && activeMonitoringRef.current === projectId) {
      try {
        const statusResponse = await fetch(`${backendUrl}/api/projects/${projectId}/status`, { headers })
        const statusData = await statusResponse.json()
        
        if (statusData.success && statusData.status) {
          const { ready, message, containerRunning } = statusData.status
          
          if (ready) {
            console.log(`✅ Project ${projectId} is ready`)
            isReady = true
            
            // Check if monitoring was cancelled
            if (activeMonitoringRef.current !== projectId) {
              console.log('⚠️ Monitoring was cancelled, not showing success')
              return false
            }
            
            // Reload projects and close modal
            if (user?.id) {
              await loadProjects(user.id, true)
            }
            
            setCreationProgressSafe({
              active: true,
              step: 'complete',
              message: 'Project ready!',
              progress: 100,
              projectId: projectId
            })
            
            setTimeout(() => {
              setCreationProgressSafe(null)
              setShowProjectModal(false)
            }, 500)
            
            break
          }
          
          // Calculate elapsed time from project creation
          const elapsedSeconds = Math.floor((Date.now() - projectStartTime) / 1000)
          const elapsedMinutes = Math.floor(elapsedSeconds / 60)
          const elapsedSecondsRemainder = elapsedSeconds % 60
          
          // Format elapsed time
          const elapsedTimeDisplay = elapsedMinutes > 0 
            ? `${elapsedMinutes}m ${elapsedSecondsRemainder}s`
            : `${elapsedSeconds}s`
          
          // Use the actual status message from backend, or default
          const statusMessage = message || 'Setting up the container...'
          const displayMessage = `${statusMessage} • ${elapsedTimeDisplay} elapsed (avg. 25 min)`
          
          // Calculate continuous progress based on elapsed time
          // Adjusted for Windows projects (avg. 25 min):
          // 0-10 minutes (600s): 0% -> 50% (continuous, ~0.083% per second)
          // 10-20 minutes (600-1200s): 50% -> 75% (continuous, ~0.042% per second)
          // 20-30 minutes (1200-1800s): 75% -> 90% (continuous, ~0.025% per second)
          // 30+ minutes: stay at 90% until ready
          let progressPercent = 0
          
          if (elapsedSeconds <= 600) {
            // First 10 minutes: 0% to 50%
            progressPercent = Math.floor((elapsedSeconds / 600) * 50)
          } else if (elapsedSeconds <= 1200) {
            // Next 10 minutes (10-20 min): 50% to 75%
            const secondsInPhase = elapsedSeconds - 600
            progressPercent = 50 + Math.floor((secondsInPhase / 600) * 25)
          } else if (elapsedSeconds <= 1800) {
            // Next 10 minutes (20-30 min): 75% to 90%
            const secondsInPhase = elapsedSeconds - 1200
            progressPercent = 75 + Math.floor((secondsInPhase / 600) * 15)
          } else {
            // After 30 minutes: stay at 90%
            progressPercent = 90
          }
          
          // Ensure we always show at least 1% progress
          progressPercent = Math.max(1, progressPercent)
          
          setCreationProgressSafe({
            active: true,
            step: 'finalizing',
            message: displayMessage,
            progress: progressPercent,
            projectId: projectId
          })
        }
      } catch (error) {
        console.warn('Failed to poll project status:', error)
      }
      
      attempts++
      // Poll every second for continuous updates
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    if (!isReady) {
      console.warn(`⚠️ Project ${projectId} monitoring timed out or was cancelled`)
      setCreationProgressSafe(null)
      return false
    }
    
    return true
  }

  const loadProjects = async (userId?: string, forceReload = false) => {
    try {
      const effectiveUserId = userId || user?.id
      
      if (!effectiveUserId) {
        console.log('📦 No user signed in, skipping project load')
        return
      }

      // Check cache - skip if recently loaded and not forcing reload
      const now = Date.now()
      const timeSinceLastLoad = now - projectsLoadedRef.current
      if (!forceReload && timeSinceLastLoad < CACHE_DURATION && projects.length > 0) {
        console.log('📦 Using cached projects (loaded', timeSinceLastLoad, 'ms ago)')
        return
      }
      
      console.log('📦 Loading projects for user:', effectiveUserId)
      const headers = await getAuthHeaders()
      console.log('📦 Auth headers:', headers)
      
      const url = `${backendUrl}/api/projects?userId=${effectiveUserId}`
      console.log('📦 Fetching from:', url)
      
      const response = await fetch(url, { headers })
      
      console.log('📦 Response status:', response.status, response.statusText)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('📦 Response error:', errorText)
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }
      
      const data = await response.json()
      console.log('📦 Load projects response:', data)
      console.log('📦 Projects count:', data.projects?.length || 0)
      
      if (data.success && Array.isArray(data.projects)) {
        console.log('📦 Setting projects:', data.projects)
        
        // Sort projects by creation date, newest first
        const sortedProjects = data.projects.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.created_at || 0).getTime()
          const dateB = new Date(b.createdAt || b.created_at || 0).getTime()
          return dateB - dateA
        })
        
        setProjects(sortedProjects)
        projectsLoadedRef.current = now // Update cache timestamp
        console.log('📦 Projects state updated with', sortedProjects.length, 'projects')
        
        // Log all project statuses for debugging
        sortedProjects.forEach(p => {
          console.log(`📦 Project: ${p.name}, Status: ${p.status}, ID: ${p.id}`)
        })
        
        // Check if there's a project being created and start monitoring (but don't show modal)
        const creatingProject = sortedProjects.find(p => p.status === 'creating' || p.is_creating)
        if (creatingProject) {
          console.log('📦 Found creating project on page load:', creatingProject.name, 'ID:', creatingProject.id)
          console.log('📦 Project status:', creatingProject.status)
          console.log('📦 Starting background monitoring (modal will only show if user clicks on project)')
          
          // Don't automatically open modal or set as active project
          // User can click on the project in sidebar to see progress
          
          // Try to restore progress from localStorage first
          let initialProgress = 5
          if (typeof window !== 'undefined') {
            const savedProgress = localStorage.getItem('projectCreationProgress')
            if (savedProgress) {
              try {
                const parsed = JSON.parse(savedProgress)
                if (parsed.projectId === creatingProject.id) {
                  console.log('📦 Restored progress from cache:', parsed.progress, '%')
                  console.log('📦 Setting maxProgressRef to:', parsed.progress)
                  initialProgress = parsed.progress
                  maxProgressRef.current = parsed.progress
                } else {
                  console.log('📦 Cached progress is for different project, ignoring')
                }
              } catch (e) {
                console.warn('Failed to parse saved progress:', e)
              }
            } else {
              console.log('📦 No cached progress found')
            }
          }
          
          // If no cached progress, calculate based on elapsed time
          if (initialProgress === 5) {
            const createdAt = new Date(creatingProject.created_at || creatingProject.createdAt).getTime()
            const elapsedSeconds = Math.floor((Date.now() - createdAt) / 1000)
            
            if (elapsedSeconds <= 420) {
              initialProgress = Math.max(5, Math.floor((elapsedSeconds / 420) * 75))
            } else if (elapsedSeconds <= 840) {
              const secondsInPhase = elapsedSeconds - 420
              initialProgress = 75 + Math.floor((secondsInPhase / 420) * 10)
            } else {
              initialProgress = 85
            }
            
            // Ensure progress never goes backwards
            initialProgress = Math.max(initialProgress, maxProgressRef.current)
            maxProgressRef.current = initialProgress
          }
          
          // Start polling for this project's status (in background)
          setCreationProgressSafe({
            active: true,
            step: 'init',
            message: 'Resuming project creation...',
            progress: initialProgress,
            projectId: creatingProject.id
          })
          
          // Start monitoring the project status in background
          monitorProjectCreation(creatingProject.id, creatingProject.operating_system || 'windows-11', creatingProject.created_at || creatingProject.createdAt)
        } else {
          console.log('📦 No creating projects found')
        }
        
        // Load sessions for all projects in parallel (much faster)
        await Promise.all(
          data.projects.map(project => loadSessionsForProject(project.id))
        )
      } else {
        console.warn('📦 Invalid projects data received:', data)
        // Don't clear projects on error - keep localStorage data
      }
    } catch (error) {
      console.error('📦 Failed to load projects:', error)
      // Don't clear projects on error - keep localStorage data
    }
  }

  const loadSessionsForProject = async (projectId: string) => {
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${backendUrl}/api/sessions/projects/${projectId}`, {
        headers
      })
      const data = await response.json()
      
      if (data.success && Array.isArray(data.sessions)) {
        console.log(`📥 Loaded ${data.sessions.length} sessions for project ${projectId}`)
        
        // CRITICAL: Filter out sessions that are in deletedSessions state
        // This prevents deleted sessions from reappearing due to race conditions
        const deletedSessionIds = new Set(deletedSessions.map(s => s.id))
        const filteredSessions = data.sessions.filter((session: any) => {
          const isDeleted = deletedSessionIds.has(session.id)
          if (isDeleted) {
            console.log(`🗑️ Filtering out deleted session: ${session.id} (${session.name})`)
          }
          return !isDeleted
        })
        
        console.log(`📥 After filtering: ${filteredSessions.length} sessions (removed ${data.sessions.length - filteredSessions.length} deleted)`)
        
        // Load chat history for each session in parallel
        const sessionsWithHistory = await Promise.all(
          filteredSessions.map(async (session: any) => {
            let chatHistory = []
            
            try {
              // Load message history from backend
              const historyResponse = await fetch(`${backendUrl}/api/sessions/${session.id}/history?limit=100`, {
                headers
              })
              const historyData = await historyResponse.json()
              
              if (historyData.success && historyData.history && Array.isArray(historyData.history)) {
                // Use messages EXACTLY as stored in database - no conversion needed
                // The database stores the complete message structure in metadata
                chatHistory = historyData.history.map((msg: any) => {
                  // Ensure timestamp is a Date object
                  if (msg.timestamp && !(msg.timestamp instanceof Date)) {
                    msg.timestamp = new Date(msg.timestamp);
                  }
                  
                  // CRITICAL FIX: Remove duplicate text blocks that match introText
                  // This happens when a message is saved with both introText and a text block containing the same content
                  if (msg.introText && msg.mediaBlocks && Array.isArray(msg.mediaBlocks)) {
                    msg.mediaBlocks = msg.mediaBlocks.filter((block: any) => {
                      // Keep all non-text blocks
                      if (block.type !== 'text') return true;
                      
                      // For text blocks, only keep if they're different from introText
                      const blockText = block.data?.text?.trim();
                      const introText = msg.introText?.trim();
                      return blockText !== introText;
                    });
                  }
                  
                  // Keep role as-is (should be 'user' or 'assistant', NOT 'model')
                  // MessageRenderer expects 'assistant', not 'model'
                  return msg;
                })
                console.log(`  ✅ Loaded ${chatHistory.length} messages for session ${session.name}`)
                
                // Log if any messages have rich content
                const messagesWithBlocks = chatHistory.filter((m: any) => m.mediaBlocks || m.commandOutputs);
                if (messagesWithBlocks.length > 0) {
                  console.log(`     📦 ${messagesWithBlocks.length} messages with rich content (blocks/outputs)`)
                }
              }
            } catch (error) {
              console.error(`  ⚠️  Failed to load history for session ${session.id}:`, error)
              // Continue with empty history if loading fails
            }
            
            return {
              id: session.id,
              name: session.name,
              projectId: session.projectId || session.project_id,
              createdAt: new Date(session.createdAt || session.created_at),
              lastActive: new Date(session.lastActive || session.last_active),
              chatHistory: chatHistory,
              model: session.model,
              activeUsers: ['user-123'],
              isShared: false
            }
          })
        )
        
        const projectSessions = sessionsWithHistory
        
        // Batch update sessions to prevent multiple re-renders
        setSessions(prev => {
          // CRITICAL: Get current deleted session IDs to filter them out
          const deletedSessionIds = new Set(deletedSessions.map(s => s.id))
          
          // Use a Map to deduplicate sessions by ID
          const allSessionsMap = new Map()
          
          // First, add existing sessions from OTHER projects (not this one)
          // Also filter out any deleted sessions
          prev.forEach(s => {
            if (s.projectId !== projectId && !deletedSessionIds.has(s.id)) {
              allSessionsMap.set(s.id, s)
            }
          })
          
          // Then add sessions from backend for THIS project (backend is source of truth)
          // Filter out deleted sessions here too
          projectSessions.forEach(s => {
            if (!deletedSessionIds.has(s.id)) {
              allSessionsMap.set(s.id, s)
            } else {
              console.log(`🗑️ Skipping deleted session in batch update: ${s.id} (${s.name})`)
            }
          })
          
          // Convert back to array
          const newSessions = Array.from(allSessionsMap.values())
          
          // Only update if there are actual changes (compare IDs and count)
          const prevIds = prev.map(s => s.id).sort().join(',')
          const newIds = newSessions.map(s => s.id).sort().join(',')
          
          if (prevIds === newIds && prev.length === newSessions.length) {
            return prev
          }
          
          console.log(`📊 Session update: ${prev.length} -> ${newSessions.length} sessions`)
          return newSessions
        })
      }
    } catch (error) {
      console.error(`Failed to load sessions for project ${projectId}:`, error)
    }
  }

  const shareProject = async (projectId: string) => {
    try {
      if (!user) {
        addToast({ id: Date.now().toString(), type: 'error', message: 'Please sign in to share projects', duration: 3000 })
        return
      }
      
      const headers = await getAuthHeaders()
      const response = await fetch(`${backendUrl}/api/collaborations/projects/${projectId}/share`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId: user.id })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to share project')
      }
      
      const data = await response.json()
      console.log('✅ Share project response:', data)
      // Backend returns share_token in collaboration object
      const shareToken = data.shareToken || data.collaboration?.share_token
      return { shareToken }
    } catch (error) {
      console.error('Failed to share project:', error)
      throw error
    }
  }

  const joinProject = async (shareToken: string) => {
    try {
      if (!user) {
        addToast({ id: Date.now().toString(), type: 'error', message: 'Please sign in to join projects', duration: 3000 })
        return
      }
      
      const headers = await getAuthHeaders()
      const response = await fetch(`${backendUrl}/api/collaborations/join`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          shareToken, 
          userId: user.id, 
          userName: user.email || user.user_metadata?.full_name || 'User'
        })
      })
      const data = await response.json()
      if (data.success) {
        console.log('✅ Successfully joined project:', data)
        
        // Immediately add the collaboration to state
        if (data.collaboration && data.project) {
          const newCollab = {
            ...data.collaboration,
            projectId: data.project.id,
            projectName: data.project.name,
            ownerName: data.project.ownerName || 'Unknown Owner',
            shareToken: data.collaboration.shareToken,
            project: data.project
          }
          
          setCollaborations(prev => {
            // Check if already exists
            if (prev.some(c => c.projectId === newCollab.projectId)) {
              return prev
            }
            return [...prev, newCollab]
          })
          
          // Set as active project
          setActiveProjectId(data.project.id)
        }
        
        // Then reload all collaborations to sync
        await loadCollaborations()
        
        addToast({ id: Date.now().toString(), type: 'success', message: 'Joined project!', duration: 3000 })
      }
    } catch (error) {
      console.error('Failed to join project:', error)
      throw error
    }
  }
  // Cache timestamp for collaborations
  const collaborationsLoadedRef = React.useRef<number>(0)

  const loadCollaborations = async (userId?: string, forceReload = false) => {
    console.log('🚀 loadCollaborations called with:', { userId, forceReload, userFromState: user?.id })
    const effectiveUserId = userId || user?.id
    
    if (!effectiveUserId) {
      console.log('🔄 No user signed in, skipping collaborations load')
      return
    }

    // Check cache - skip if recently loaded and not forcing reload
    const now = Date.now()
    const timeSinceLastLoad = now - collaborationsLoadedRef.current
    if (!forceReload && timeSinceLastLoad < CACHE_DURATION && collaborations.length > 0) {
      console.log('🔄 Using cached collaborations (loaded', timeSinceLastLoad, 'ms ago)')
      return
    }
    
    console.log('🔄 Loading collaborations for user:', effectiveUserId)
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${backendUrl}/api/collaborations?userId=${effectiveUserId}`, {
        headers
      })
      const data = await response.json()
      console.log('📥 Collaborations response:', data)
      if (data.success) {
        console.log(`📥 Found ${data.collaborations.length} collaborations`)
        
        // Enrich collaboration data with proper structure
        const enrichedCollaborations = data.collaborations.map((collab: any) => {
          console.log('🔍 Processing collaboration:', JSON.stringify(collab, null, 2))
          
          // Convert project data from snake_case to camelCase if needed
          const project = collab.project ? {
            id: collab.project.id,
            name: collab.project.name,
            description: collab.project.description,
            ownerId: collab.project.owner_id || collab.project.ownerId,
            containerId: collab.project.container_id || collab.project.containerId,
            containerName: collab.project.container_name || collab.project.containerName,
            terminalPort: collab.project.terminal_port || collab.project.terminalPort,
            vncPort: collab.project.vnc_port || collab.project.vncPort,
            novncPort: collab.project.novnc_port || collab.project.novncPort,
            status: collab.project.status,
            createdAt: collab.project.created_at || collab.project.createdAt,
            lastActive: collab.project.last_active || collab.project.lastActive,
            ownerName: collab.project.ownerName || collab.ownerName || 'Unknown Owner'
          } : null
          
          const enriched = {
            ...collab,
            project, // Use converted project
            projectId: collab.project?.id, // Backend returns project.id directly
            projectName: collab.project?.name || 'Unknown Project',
            ownerName: project?.ownerName || collab.ownerName || 'Unknown Owner',
            shareToken: collab.projectShare?.share_token
          }
          
          console.log('✅ Enriched collaboration:', JSON.stringify(enriched, null, 2))
          return enriched
        })
        
        console.log('📦 Setting collaborations state with', enrichedCollaborations.length, 'items')
        setCollaborations(enrichedCollaborations)
        collaborationsLoadedRef.current = now // Update cache timestamp
        
        // Load sessions for each collaboration project
        // Note: We load sessions by project ID, not by share token, to avoid duplicates
        for (const collab of enrichedCollaborations) {
          const projectId = collab.project?.id || collab.projectId
          if (projectId) {
            await loadSessionsForProject(projectId)
          }
        }
      }
    } catch (error) {
      console.error('Failed to load collaborations:', error)
    }
  }

  const deleteProject = (projectId: string) => {
    if (!Array.isArray(projects)) {
      console.error('Projects is not an array:', projects)
      return
    }
    const project = projects.find(p => p.id === projectId)
    if (project) {
      setProjectToDelete({ id: project.id, name: project.name })
      setShowDeleteModal(true)
    }
  }
  
  const confirmDeleteProject = async () => {
    if (!projectToDelete) return
    
    try {
      console.log('🗑️ Deleting project:', projectToDelete.id)
      const headers = await getAuthHeaders()
      const response = await fetch(`${backendUrl}/api/projects/${projectToDelete.id}`, {
        method: 'DELETE',
        headers
      })
      
      console.log('Delete response status:', response.status)
      const data = await response.json()
      console.log('Delete response data:', data)
      
      if (data.success) {
        console.log('✅ Project deleted successfully')
        
        // Remove project from state
        setProjects(prev => {
          const updated = prev.filter(p => p.id !== projectToDelete.id)
          console.log('Updated projects:', updated)
          return updated
        })
        
        // If deleting active project, close sidebar and clear active project
        if (activeProjectId === projectToDelete.id) {
          setActiveProjectId(null)
          setChatSidebarOpen(false)
          
          // Also delete all sessions for this project
          setSessions(prev => prev.filter(s => s.projectId !== projectToDelete.id))
          setActiveSessionId(null)
          setChatHistory([])
        }
        
        // Close the modal
        setShowDeleteModal(false)
        setProjectToDelete(null)
        
        // Reload projects to ensure sync with backend
        await loadProjects(undefined, true) // Force reload after deletion
        
        addToast({ id: Date.now().toString(), type: 'success', message: 'Project deleted successfully', duration: 3000 })
      } else {
        throw new Error(data.message || 'Failed to delete project')
      }
    } catch (error) {
      console.error('Failed to delete project:', error)
      addToast({ id: Date.now().toString(), type: 'error', message: error instanceof Error ? error.message : 'Failed to delete project', duration: 5000 })
      throw error
    }
  }

  const cancelProjectCreation = async (projectId: string) => {
    try {
      console.log('🛑 Cancelling project creation:', projectId)
      
      // Stop monitoring immediately
      if (activeMonitoringRef.current === projectId) {
        console.log('🛑 Stopping project monitoring')
        activeMonitoringRef.current = null
      }
      
      const headers = await getAuthHeaders()
      const response = await fetch(`${backendUrl}/api/projects/${projectId}`, {
        method: 'DELETE',
        headers
      })
      
      const data = await response.json()
      
      if (data.success) {
        console.log('✅ Project creation cancelled and deleted')
        
        // Remove project from state immediately
        setProjects(prev => prev.filter(p => p.id !== projectId))
        
        // Clear active project if it was the cancelled one
        if (activeProjectId === projectId) {
          setActiveProjectId(null)
          setChatSidebarOpen(false)
        }
        
        // Clear creation progress immediately
        console.log('🧹 Clearing creationProgress')
        setCreationProgress(null)
        maxProgressRef.current = 0
        
        addToast({ id: Date.now().toString(), type: 'info', message: 'Project creation cancelled', duration: 3000 })
      } else {
        throw new Error(data.message || 'Failed to cancel project creation')
      }
    } catch (error) {
      console.error('Failed to cancel project creation:', error)
      addToast({ id: Date.now().toString(), type: 'error', message: error instanceof Error ? error.message : 'Failed to cancel project', duration: 5000 })
      throw error
    }
  }

  const renameProject = async (projectId: string, newName: string) => {
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${backendUrl}/api/projects/${projectId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ name: newName })
      })
      const data = await response.json()
      if (data.success) {
        setProjects(prev => Array.isArray(prev) ? prev.map(p => p.id === projectId ? { ...p, name: newName } : p) : [])
      }
    } catch (error) {
      console.error('Failed to rename project:', error)
    }
  }

  // ============================================================================
  // Session Persistence Functions
  // ============================================================================

  const STORAGE_KEY_SESSIONS = 'chat-sessions'

  /**
   * Save sessions to backend (Supabase via API)
   * Note: Sessions are automatically saved to Supabase when created/updated
   * This function is kept for compatibility but doesn't use localStorage
   */
  const saveSessionsToStorage = () => {
    // Sessions are now persisted in Supabase automatically
    // No need for localStorage
    console.log('💾 Sessions are persisted in Supabase')
  }

  /**
   * Load sessions from localStorage
   */
  const loadSessionsFromStorage = () => {
    // Sessions are now loaded from Supabase via loadProjects() and loadCollaborations()
    // No need for localStorage
    console.log('📂 Sessions will be loaded from Supabase per-project')
    return
  }
    
    /* OLD LOCALSTORAGE CODE - DISABLED - REMOVED
    const loadSessionsFromStorageOLD = () => {
    try {
      console.log('📂 Loading sessions from localStorage...')
      const stored = localStorage.getItem(STORAGE_KEY_SESSIONS)
      if (!stored) {
        console.log('⚠️ No stored sessions found, creating default session')
        // No stored sessions, create a default one
        const defaultSession: Session = {
          id: generateSessionId(),
          name: 'New Session',
          projectId: 'default-project',
          createdAt: new Date(),
          lastActive: new Date(),
          chatHistory: [],
          model: selectedModel,
          activeUsers: ['user-123'],
          isShared: false
        }
        setSessions([defaultSession])
        setActiveSessionId(defaultSession.id)
        return
      }

      const data = JSON.parse(stored)
      console.log('✅ Found stored sessions:', { 
        sessionCount: data.sessions?.length, 
        activeSessionId: data.activeSessionId 
      })

      // Validate and parse the data
      if (data.sessions && Array.isArray(data.sessions)) {
        const parsedSessions: Session[] = data.sessions.map((s: any) => ({
          ...s,
          projectId: s.projectId || 'default-project',
          createdAt: new Date(s.createdAt),
          lastActive: new Date(s.lastActive),
          // Migrate old model names to new valid models
          model: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash-8b', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.0-flash-exp', 'gemini-2.5-flash-latest', 'gemini-2.5-pro-latest', 'gemini-2.5-flash-lite-latest'].includes(s.model)
            ? 'gemini-2.5-flash'
            : s.model,
          activeUsers: s.activeUsers || ['user-123'],
          isShared: s.isShared || false,
          shareToken: s.shareToken,
          // Restore chatHistory with mediaBlocks
          chatHistory: s.chatHistory?.map((msg: any) => ({
            ...msg,
            timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined,
            // Restore mediaBlocks with parsed timestamps
            mediaBlocks: msg.mediaBlocks?.map((block: any) => ({
              ...block,
              timestamp: block.timestamp ? new Date(block.timestamp) : new Date()
            }))
          })) || [],
          // Restore raw messages to preserve parts structure
          _rawMessages: s._rawMessages || []
        }))

        setSessions(parsedSessions)

        // Set active session
        if (data.activeSessionId && parsedSessions.find(s => s.id === data.activeSessionId)) {
          console.log('🎯 Restoring active session:', data.activeSessionId)
          setActiveSessionId(data.activeSessionId)
          const activeSession = parsedSessions.find(s => s.id === data.activeSessionId)
          if (activeSession) {
            console.log('📝 Restoring chat history:', { 
              messageCount: activeSession.chatHistory?.length || 0,
              rawMessageCount: (activeSession as any)._rawMessages?.length || 0,
              sessionModel: activeSession.model
            })
            setChatHistory(activeSession.chatHistory || [])
            
            // Don't auto-set model - user must explicitly select
            console.log('⚠️ [Session Restore] Not auto-setting model - user must select manually')
            
            // Restore messages to useChat hook - use raw messages if available
            const restoredMessages = (activeSession as any)._rawMessages?.length > 0 
              ? (activeSession as any)._rawMessages 
              : chatMessagesToMessages(activeSession.chatHistory)
            setMessages(restoredMessages)
          }
        } else if (parsedSessions.length > 0) {
          console.log('⚠️ Active session not found, using first session')
          // Fallback to first session
          setActiveSessionId(parsedSessions[0].id)
          setChatHistory(parsedSessions[0].chatHistory)
          
          // Don't auto-set model - user must explicitly select
          console.log('⚠️ [Session Restore] Not auto-setting model - user must select manually')
          
          // Restore messages to useChat hook - use raw messages if available
          const restoredMessages = (parsedSessions[0] as any)._rawMessages?.length > 0
            ? (parsedSessions[0] as any)._rawMessages
            : chatMessagesToMessages(parsedSessions[0].chatHistory)
          setMessages(restoredMessages)
        }
      } else {
        throw new Error('Invalid session data format')
      }
    } catch (error) {
      console.error('Failed to load sessions from localStorage:', error)
      // No localStorage cleanup needed anymore
      // localStorage.removeItem(STORAGE_KEY_SESSIONS)
      const defaultSession: Session = {
        id: generateSessionId(),
        name: 'New Session',
        projectId: 'default-project',
        createdAt: new Date(),
        lastActive: new Date(),
        chatHistory: [],
        model: selectedModel,
        activeUsers: ['user-123'],
        isShared: false
      }
      setSessions([defaultSession])
      setActiveSessionId(defaultSession.id)
    }
  }
  */ // END OLD LOCALSTORAGE CODE

  // Load sessions on mount - only run once
  useEffect(() => {
    loadSessionsFromStorage()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Initialize auth (supports both Supabase and Keycloak)
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check if we're in the middle of an OAuth callback
        const urlParams = new URLSearchParams(window.location.search)
        const hasOAuthCode = urlParams.has('code')
        
        if (hasOAuthCode) {
          console.log('🔐 OAuth callback detected, waiting for session to be saved...')
          // Wait for the callback handler to complete and set the flag
          let attempts = 0
          const maxAttempts = 20 // 2 seconds total (20 * 100ms)
          
          while (attempts < maxAttempts) {
            if (sessionStorage.getItem('keycloak_callback_complete') === 'true') {
              console.log('🔐 Callback complete flag detected')
              sessionStorage.removeItem('keycloak_callback_complete')
              break
            }
            await new Promise(resolve => setTimeout(resolve, 100))
            attempts++
          }
          
          // Extra wait to ensure localStorage is updated
          await new Promise(resolve => setTimeout(resolve, 200))
        }
        
        // Try Keycloak auth
        const keycloakSession = await keycloakAuth.getSession()
        
        if (keycloakSession?.user) {
          console.log('🔐 Keycloak session found:', keycloakSession.user)
          
          // Use Keycloak user directly
          const user = keycloakSession.user
          
          setUser(user)
          setAuthLoading(false)
          
          console.log('🔐 Auth initialized (Keycloak):', keycloakSession.user.email)
          
          // Sync Keycloak user to local database
          try {
            // Silently sync user - only log errors
            const headers = await getAuthHeaders()
            const response = await fetch(`${backendUrl}/api/auth/sync-user`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                userId: keycloakSession.user.id,
                email: keycloakSession.user.email,
                username: keycloakSession.user.email?.split('@')[0] || 'user',
                name: keycloakSession.user.name || keycloakSession.user.email
              })
            })
            
            if (response.ok) {
              const syncResult = await response.json()
              
              // CRITICAL: Use the database user ID, not the Keycloak ID
              const databaseUserId = syncResult.user?.id
              if (databaseUserId) {
                // Silently use database ID
                
                // Update the user object with the database ID
                const updatedUser = {
                  ...keycloakSession.user,
                  id: databaseUserId
                }
                setUser(updatedUser)
                
                // Load data with the database user ID
                loadProjects(databaseUserId)
                loadCollaborations(databaseUserId)
              } else {
                console.error('❌ No user ID returned from sync')
                // Fallback to Keycloak ID
                loadProjects(keycloakSession.user.id)
                loadCollaborations(keycloakSession.user.id)
              }
            } else {
              console.error('❌ Failed to sync Keycloak user:', await response.text())
              // Fallback to Keycloak ID
              loadProjects(keycloakSession.user.id)
              loadCollaborations(keycloakSession.user.id)
            }
          } catch (error) {
            console.error('❌ Error syncing Keycloak user:', error)
            // Fallback to Keycloak ID
            loadProjects(keycloakSession.user.id)
            loadCollaborations(keycloakSession.user.id)
          }
          return
        }
        
        // No session found
        setUser(null)
        setAuthLoading(false)
        console.log('🔐 Auth initialized: Not signed in')
      } catch (error) {
        console.error('Failed to initialize auth:', error)
        setAuthLoading(false)
      }
    }
    
    initAuth()
    
    // Listen for Keycloak auth changes through AuthContext
    const unsubscribe = keycloakAuth.onAuthStateChange(async (session) => {
      if (session?.user) {
        console.log('🔐 Keycloak session updated:', session.user.email)
        console.log('🔍 Keycloak ID:', session.user.id)
        
        // Sync user and get database ID
        try {
          const headers = await getAuthHeaders()
          const response = await fetch(`${backendUrl}/api/auth/sync-user`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              userId: session.user.id,
              email: session.user.email,
              username: session.user.email?.split('@')[0] || 'user',
              name: session.user.name || session.user.email
            })
          })
          
          if (response.ok) {
            const syncResult = await response.json()
            const databaseUserId = syncResult.user?.id
            
            if (databaseUserId) {
              console.log(`🔑 Using database user ID: ${databaseUserId}`)
              
              // Update user with database ID
              const updatedUser = {
                ...session.user,
                id: databaseUserId
              }
              setUser(updatedUser)
              loadProjects(databaseUserId)
              loadCollaborations(databaseUserId)
              return
            }
          }
        } catch (error) {
          console.error('❌ Error syncing user on auth change:', error)
        }
        
        // Fallback: use Keycloak ID
        setUser(session.user)
        loadProjects(session.user.id)
        loadCollaborations(session.user.id)
      } else {
        console.log('🔐 User signed out')
        setUser(null)
        setProjects([])
        setCollaborations([])
        setSessions([])
        setActiveProjectId(null)
        setActiveSessionId(null)
      }
    })
    
    return () => {
      unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Retry failed message saves when connection is restored
  useEffect(() => {
    const retryFailedSaves = async () => {
      try {
        const failedSavesStr = localStorage.getItem('failedMessageSaves');
        if (!failedSavesStr) return;
        
        const failedSaves = JSON.parse(failedSavesStr);
        if (failedSaves.length === 0) return;
        
        console.log(`🔄 Retrying ${failedSaves.length} failed message saves...`);
        
        const headers = await getAuthHeaders();
        const successfulSaves: number[] = [];
        
        for (let i = 0; i < failedSaves.length; i++) {
          const { sessionId, message } = failedSaves[i];
          try {
            const response = await fetch(`${backendUrl}/api/sessions/${sessionId}/messages`, {
              method: 'POST',
              headers: {
                ...headers,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(message),
              signal: AbortSignal.timeout(5000)
            });
            
            if (response.ok) {
              const result = await response.json();
              if (result.success) {
                console.log(`✅ Retry successful for message ${i + 1}`);
                successfulSaves.push(i);
              }
            }
          } catch (error) {
            console.log(`⏭️ Retry failed for message ${i + 1}, will try again later`);
          }
        }
        
        // Remove successful saves from localStorage
        if (successfulSaves.length > 0) {
          const remainingFailed = failedSaves.filter((_: any, idx: number) => !successfulSaves.includes(idx));
          localStorage.setItem('failedMessageSaves', JSON.stringify(remainingFailed));
          console.log(`✅ ${successfulSaves.length} messages saved, ${remainingFailed.length} remaining`);
        }
      } catch (error) {
        console.error('❌ Error retrying failed saves:', error);
      }
    };
    
    // Retry on mount
    if (user?.id) {
      retryFailedSaves();
    }
    
    // Retry periodically (every 2 minutes)
    const retryInterval = setInterval(() => {
      if (user?.id) {
        retryFailedSaves();
      }
    }, 120000);
    
    return () => clearInterval(retryInterval);
  }, [user?.id, backendUrl]);

  // Retry pending session syncs when connection is restored
  useEffect(() => {
    const retryPendingSessionSyncs = async () => {
      try {
        // Use ref to get current sessions without adding to dependencies
        const currentSessions = sessionsRef.current || sessions;
        
        // Find sessions that are pending sync
        const pendingSessions = currentSessions.filter(s => s._pendingSync === true);
        if (pendingSessions.length === 0) return;
        
        console.log(`🔄 Retrying ${pendingSessions.length} pending session sync(s)...`);
        
        const headers = await getAuthHeaders();
        
        for (const session of pendingSessions) {
          try {
            console.log(`📡 Attempting to sync session: ${session.id}`);
            
            const response = await fetch(`${backendUrl}/api/sessions`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                projectId: session.projectId,
                userId: user?.id,
                userName: user?.email || user?.user_metadata?.full_name || 'User',
                name: session.name,
                model: session.model
              }),
              signal: AbortSignal.timeout(10000)
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.session) {
                console.log(`✅ Successfully synced session ${session.id} -> ${data.session.id}`);
                
                // Replace the pending session with the backend session
                setSessions(prev => prev.map(s => {
                  if (s.id === session.id) {
                    return {
                      ...s,
                      id: data.session.id,
                      _pendingSync: false,
                      createdAt: new Date(data.session.createdAt || data.session.created_at),
                      lastActive: new Date(data.session.lastActive || data.session.last_active)
                    };
                  }
                  return s;
                }));
                
                // Update active session ID if this was the active session
                if (activeSessionId === session.id) {
                  setActiveSessionId(data.session.id);
                }
                
                addToast({ 
                  id: Date.now().toString(), 
                  type: 'success', 
                  message: `Session "${session.name}" synced to backend`, 
                  duration: 3000 
                });
              }
            }
          } catch (error) {
            console.log(`⏭️ Retry failed for session ${session.id}, will try again later`);
          }
        }
      } catch (error) {
        console.error('❌ Error retrying pending session syncs:', error);
      }
    };
    
    // Don't retry on mount - only on interval
    // This prevents the loop from starting immediately
    
    // Retry periodically (every 2 minutes)
    const retryInterval = setInterval(() => {
      if (user?.id) {
        retryPendingSessionSyncs();
      }
    }, 120000);
    
    return () => clearInterval(retryInterval);
  }, [user?.id, backendUrl, activeSessionId]); // REMOVED sessions from dependencies to prevent loop

  // Refresh data function - callable from anywhere
  const lastRefreshTimeRef = React.useRef(Date.now())
  
  const refreshData = React.useCallback(() => {
    // Debounce: only refresh if at least 5 seconds have passed
    const now = Date.now()
    if (now - lastRefreshTimeRef.current < 5000) {
      return
    }
    
    if (user?.id) {
      console.log('🔄 Refreshing projects and collaborations...')
      lastRefreshTimeRef.current = now
      loadProjects(user.id, true) // Force reload on manual refresh
      loadCollaborations(user.id)
    }
  }, [user?.id, loadProjects, loadCollaborations])

  // Refresh data when window regains focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user?.id) {
        console.log('👁️ Window visible, refreshing data...')
        refreshData()
      } else if (document.hidden) {
        console.log('👁️ Window hidden - streams will continue in background')
        // Log which sessions are currently streaming
        const streamingSessions = Array.from(streamingSessionIds)
        if (streamingSessions.length > 0) {
          console.log(`   ${streamingSessions.length} session(s) streaming in background:`, streamingSessions)
        }
      }
    }

    // Note: Removed periodic polling (was refreshing every 30 seconds)
    // Data now only refreshes when:
    // 1. User performs an action (create/delete project, send message, etc.)
    // 2. Window regains focus after being hidden
    // 3. A new session is created
    // This reduces unnecessary API calls and console noise

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user?.id, refreshData, streamingSessionIds])

  // Sync sessions to ref for use in effects without triggering loops
  useEffect(() => {
    sessionsRef.current = sessions
  }, [sessions])

  // Save sessions whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      // Add a small delay to batch multiple updates
      const timeoutId = setTimeout(() => {
        saveSessionsToStorage()
      }, 100)
      
      return () => clearTimeout(timeoutId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, activeSessionId])

  // Debug: Log visibility states
  useEffect(() => {
    console.log('🔍 Visibility States:', {
      chatSidebarOpen,
      showTerminalArea,
      showChatArea,
      activeTab,
      activeProjectId,
      activeSessionId,
      hasActiveProject: !!activeProject
    })
  }, [chatSidebarOpen, showTerminalArea, showChatArea, activeTab, activeProjectId, activeSessionId, activeProject])

  // Sync messages from useChat to chatHistory and sessions
  useEffect(() => {
    // Skip syncing if we're currently switching sessions to prevent duplicates
    if (isSwitchingSession.current) {
      console.log('⏭️ Skipping message sync during session switch')
      return
    }

    if (messages.length > 0) {
      console.log('🔄 Syncing messages to session:', { 
        messageCount: messages.length, 
        activeSessionId 
      })
      
      // Convert messages to ChatMessage format
      const chatMessages = messagesToChatMessages(messages)
      
      // Update local chatHistory (keep this for backward compatibility)
      setChatHistory(chatMessages)
      
      // Update active session's chat history
      // Store BOTH chatHistory (for storage) and preserve original messages structure
      if (activeSessionId) {
        setSessions(prev => prev.map(s =>
          s.id === activeSessionId
            ? { 
                ...s, 
                chatHistory: chatMessages, 
                lastActive: new Date(),
                // Store original messages to preserve parts structure
                _rawMessages: messages 
              }
            : s
        ))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, activeSessionId])

  /**
   * Enforce terminal visibility when session is active
   * 
   * This useEffect hook acts as a safety mechanism to ensure the terminal iframe
   * remains visible when a session is active. It monitors activeSessionId and
   * chatSidebarOpen states and forces the terminal to be visible if it's not.
   * 
   * This prevents edge cases where the terminal might be hidden due to:
   * - Race conditions during state updates
   * - User manually hiding the terminal
   * - Unexpected state changes from other components
   * 
   * Dependencies: [activeSessionId, chatSidebarOpen]
   */
  useEffect(() => {
    if (activeSessionId && chatSidebarOpen) {
      console.log('🖥️ Terminal visibility check:', {
        activeSessionId,
        chatSidebarOpen,
        showTerminalArea,
        activeTab
      })
      
      // Force terminal visibility if not already set
      if (!showTerminalArea) {
        console.log('⚠️ Terminal area was hidden, forcing visible')
        setShowTerminalArea(true)
      }
      // Removed: Don't force terminal tab - let user's choice persist
    }
  }, [activeSessionId, chatSidebarOpen])

  /**
   * Log iframe rendering details when terminal is visible
   * 
   * This useEffect hook provides detailed logging about the terminal iframe's
   * rendering state for debugging purposes. It logs:
   * - iframe src URL
   * - iframe dimensions (width, height)
   * - CSS display and visibility properties
   * - Whether the iframe exists in the DOM
   * 
   * The setTimeout ensures the DOM has been updated before querying the iframe.
   * 
   * Dependencies: [chatSidebarOpen, showTerminalArea, activeTab]
   */
  useEffect(() => {
    if (chatSidebarOpen && showTerminalArea && activeTab === 'terminal') {
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
        const terminalIframe = document.querySelector('iframe[title*="Terminal"]') as HTMLIFrameElement
        if (terminalIframe) {
          console.log('📺 Terminal iframe rendered:', {
            src: terminalIframe.src,
            width: terminalIframe.offsetWidth,
            height: terminalIframe.offsetHeight,
            display: window.getComputedStyle(terminalIframe).display,
            visibility: window.getComputedStyle(terminalIframe).visibility,
            isInDOM: document.body.contains(terminalIframe)
          })
        } else {
          console.warn('⚠️ Terminal iframe not found in DOM')
        }
      }, 100)
    }
  }, [chatSidebarOpen, showTerminalArea, activeTab])

  // ============================================================================
  // Task Management Functions
  // ============================================================================

  /**
   * Execute a task
   */
  const executeTask = async (task: Task) => {
    if (!task.command) {
      addToast({
        id: `toast_${Date.now()}`,
        type: 'error',
        message: 'Task has no command to execute',
        duration: 3000
      })
      return
    }

    // Update task status to running
    if (activeTaskList) {
      setActiveTaskList(prev => prev ? {
        ...prev,
        tasks: prev.tasks.map(t =>
          t.id === task.id ? { ...t, status: 'running' as TaskStatus } : t
        )
      } : null)
    }

    try {
      // Send task command to backend
      const backendUrl = typeof window !== 'undefined'
        ? window.location.protocol + '//' + window.location.hostname + ':3003'
        : 'http://localhost:3003'

      // Prepare history with truncation
      const { truncatedHistory } = historyManager.prepareHistoryForSend(chatHistory, DEFAULT_TRUNCATION_CONFIG);

      const response = await fetch(`${backendUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: task.command,
          history: truncatedHistory,  // Use truncated history
          model: selectedModel,
          mode: mode,
          projectId: activeProjectId, // Send active project ID so backend uses correct container
          sessionId: activeSessionId  // CRITICAL: Send session ID for message persistence
        })
      })

      if (response.ok) {
        const data = await response.json()
        const result = data.response || 'No response'

        // Update task status to completed
        if (activeTaskList) {
          setActiveTaskList(prev => prev ? {
            ...prev,
            tasks: prev.tasks.map(t =>
              t.id === task.id ? { ...t, status: 'completed' as TaskStatus, result } : t
            )
          } : null)
        }

        // Add result to chat
        setChatHistory(prev => [...prev,
        { role: 'user', content: `Executed task: ${task.title}` },
        { role: 'assistant', content: result }
        ])

        addToast({
          id: `toast_${Date.now()}`,
          type: 'success',
          message: `Task "${task.title}" completed`,
          duration: 3000
        })
      } else {
        throw new Error('Failed to execute task')
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'

      // Update task status to failed
      if (activeTaskList) {
        setActiveTaskList(prev => prev ? {
          ...prev,
          tasks: prev.tasks.map(t =>
            t.id === task.id ? { ...t, status: 'failed' as TaskStatus, error: errorMsg } : t
          )
        } : null)
      }

      addToast({
        id: `toast_${Date.now()}`,
        type: 'error',
        message: `Task "${task.title}" failed: ${errorMsg}`,
        duration: 4000
      })
    }
  }

  /**
   * Load task lists (placeholder - can be extended to load from file/API)
   */
  const loadTaskLists = () => {
    // Example task list
    const exampleTaskList: TaskList = {
      id: 'example-1',
      name: 'Example Tasks',
      description: 'Sample tasks for demonstration',
      tasks: [
        {
          id: 'task-1',
          title: 'Check system info',
          command: 'uname -a',
          description: 'Display system information',
          status: 'pending'
        },
        {
          id: 'task-2',
          title: 'List files',
          command: 'ls -la',
          description: 'List all files in current directory',
          status: 'pending'
        },
        {
          id: 'task-3',
          title: 'Check disk usage',
          command: 'df -h',
          description: 'Display disk usage',
          status: 'pending'
        }
      ]
    }

    setTaskLists([exampleTaskList])
    setActiveTaskList(exampleTaskList)
  }

  // Load task lists on mount
  useEffect(() => {
    loadTaskLists()
  }, [])

  // Handle sidebar resize - optimized for instant response, works for both left and right positions
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      // Calculate the delta from where the user initially clicked
      const deltaX = e.clientX - resizeStartX.current

      // Calculate new width based on chat position
      let newWidth: number
      if (chatPosition === 'left') {
        // When chat is on left, moving right increases width
        newWidth = resizeStartWidth.current + deltaX
      } else {
        // When chat is on right, moving left increases width
        newWidth = resizeStartWidth.current - deltaX
      }
      
      // Minimum 300px, maximum 800px - increased range for better flexibility
      if (newWidth >= 300 && newWidth <= 800) {
        setChatSidebarWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, chatPosition])

  // Sync collaborators sidebar width with chat sidebar width when it opens
  React.useEffect(() => {
    if (showCollaboratorsSidebar) {
      setCollaboratorsSidebarWidth(chatSidebarWidth)
    }
  }, [showCollaboratorsSidebar, chatSidebarWidth])

  // Check ttyd connection when sidebar opens
  React.useEffect(() => {
    if (chatSidebarOpen) {
      console.log(`?? Sidebar opened - ttyd should be loading at ${typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:7681` : 'http://127.0.0.1:7681'}`)
      // Give iframe time to load
      const timer = setTimeout(() => {
        console.log('? iframe load timeout passed')
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [chatSidebarOpen])

  // Close model dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showModelDropdown) {
        const target = e.target as HTMLElement
        if (!target.closest('.model-selector-container')) {
          setShowModelDropdown(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showModelDropdown])

  // Close OS dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showOSDropdown) {
        const target = e.target as HTMLElement
        if (!target.closest('.os-selector-container')) {
          setShowOSDropdown(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showOSDropdown])

  // Close mode dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showModeDropdown) {
        const target = e.target as HTMLElement
        if (!target.closest('.mode-selector-container')) {
          setShowModeDropdown(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showModeDropdown])

  // Close project dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showProjectDropdown) {
        const target = e.target as HTMLElement
        if (!target.closest('.project-selector-container')) {
          setShowProjectDropdown(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showProjectDropdown])

  // Debug: Log projects state changes
  React.useEffect(() => {
    console.log('🔍 Projects state updated:', {
      projectsCount: projects.length,
      collaborationsCount: collaborations.length,
      activeProjectId,
      selectedProjectIdForNewSession,
      projects: projects.map(p => ({ id: p.id, name: p.name, status: p.status })),
      collaborations: collaborations.map(c => ({ id: c.id, projectId: c.projectId, projectName: c.project?.name }))
    })
  }, [projects, collaborations, activeProjectId, selectedProjectIdForNewSession])

  // Send pending message when session becomes active
  React.useEffect(() => {
    if (pendingMessageToSend && activeSessionId && activeProjectId) {
      console.log('📤 Sending pending message after session creation:', pendingMessageToSend);
      
      // Set the message in the textarea
      setMessage(pendingMessageToSend);
      
      // Clear the pending message
      setPendingMessageToSend(null);
      
      // Trigger send after a short delay to ensure state is updated
      setTimeout(() => {
        handleSendMessage();
      }, 300);
    }
  }, [pendingMessageToSend, activeSessionId, activeProjectId])

  // Close session dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showSessionDropdown) {
        const target = e.target as HTMLElement
        // Check if click is outside the session manager bar
        if (!target.closest('.session-manager-bar')) {
          setShowSessionDropdown(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSessionDropdown])

  // Handle keyboard navigation for session dropdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showSessionDropdown && e.key === 'Escape') {
        setShowSessionDropdown(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showSessionDropdown])

  // Auto-start animations on page load for demo
  React.useEffect(() => {
    const autoStartTimer = setTimeout(() => {
      setLastInteractionTime(Date.now())
    }, 500)
    return () => clearTimeout(autoStartTimer)
  }, [])

  React.useEffect(() => {
    // Only start checking inactivity if user has interacted
    if (lastInteractionTime === null) return
    // If animations are disabled (first message sent), stop all animations
    if (animationsDisabled) return

    const checkInactivity = setInterval(() => {
      const timeSinceLastInteraction = Date.now() - lastInteractionTime

      // Fade out NEW ORDER text before any animations (at 15 seconds)
      if (timeSinceLastInteraction >= 15000 && protocolFading === false) {
        setProtocolFading(true)
      }

      // Start fading out GUARDIAN text at 16 seconds (3 seconds before rolldown)
      if (timeSinceLastInteraction >= 16000 && !guardianFading) {
        setGuardianFading(true)
      }

      // Roll down chat input at 19 seconds (after GUARDIAN fade completes)
      if (timeSinceLastInteraction >= 19000 && !chatInputRolledDown) {
        setChatInputRolledDown(true)
      }

      // Fade in content at 20 seconds
      if (timeSinceLastInteraction >= 20000 && fadeInOpacity === 0) {
        setFadeInOpacity(1)
        clearInterval(checkInactivity)
      }
    }, 100)

    return () => {
      clearInterval(checkInactivity)
    }
  }, [lastInteractionTime, chatInputRolledDown, fadeInOpacity, protocolFading, guardianFading, animationsDisabled])

  // Separate effect for animation timers
  React.useEffect(() => {
    if (fadeInOpacity === 0) return
    if (animationsDisabled) return

    // Start disappear animation 13 seconds after fade-in (at 33 seconds total)
    const disappearTimer = setTimeout(() => {
      setTextDisappearing(true)
    }, 13000)

    // Completely hide after 15 seconds after fade-in (at 35 seconds total)
    const hideTimer = setTimeout(() => {
      setShowOrderText(false)
    }, 15000)

    return () => {
      clearTimeout(disappearTimer)
      clearTimeout(hideTimer)
    }
  }, [fadeInOpacity, animationsDisabled])

  React.useEffect(() => {
    const fadeInterval = setInterval(() => {
      setGradientOpacity((prev) => Math.max(0, prev - 0.001))
    }, 100)
    return () => clearInterval(fadeInterval)
  }, [])

  // Handler to create a new terminal session while keeping the same chat session
  const handleNewTerminalSession = async () => {
    if (!activeSessionId) {
      addToast({
        id: `toast_${Date.now()}`,
        type: 'warning',
        message: 'No active session. Please start a conversation first.',
        duration: 3000
      });
      return;
    }

    try {
      console.log('🔄 Creating new terminal session for chat session:', activeSessionId);
      
      const response = await fetch(`${backendUrl}/api/new-terminal-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: activeSessionId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create new terminal session');
      }

      const result = await response.json();
      
      console.log('✅ New terminal session created:', result);
      
      addToast({
        id: `toast_${Date.now()}`,
        type: 'success',
        message: `New terminal session created (PID: ${result.terminalPid})`,
        duration: 4000
      });

      // Optionally reload the terminal iframe to show the new session
      const terminalIframe = document.querySelector('iframe[title*="Terminal"]') as HTMLIFrameElement;
      if (terminalIframe) {
        terminalIframe.src = terminalIframe.src; // Reload iframe
      }

    } catch (error) {
      console.error('❌ Failed to create new terminal session:', error);
      addToast({
        id: `toast_${Date.now()}`,
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to create new terminal session',
        duration: 5000
      });
    }
  };

  // Handler for search button
  const handleSearch = () => {
    addToast({
      id: `toast_${Date.now()}`,
      type: 'info',
      message: 'Search functionality coming soon!',
      duration: 3000
    });
    console.log('Search clicked');
  };

  // Render settings content based on active category
  const renderSettingsContent = () => {
    switch (activeCategory) {
      case 'models':
        return <ModelSettings isVisible={showSettings} />
      case 'modes':
        return <ModesSettings />
      case 'os':
        return <OperatingSystemsSettings />
      case 'appearance':
        return <AppearanceSettings />
      case 'behavior':
        return <BehaviorSettings />
      case 'keyboard':
        return <KeyboardSettings />
      case 'advanced':
        return <AdvancedSettings />
      default:
        return <ModelSettings isVisible={showSettings} />
    }
  };

  // Stop streaming function
  const handleStopStreaming = () => {
    if (activeSessionId) {
      console.log('🛑 Stopping stream for session:', activeSessionId);
      
      // Get the streaming state for this session
      const streamingState = streamingSessionsRef.current.get(activeSessionId);
      
      if (streamingState?.abortController) {
        // Mark that this was a manual stop so the finally block doesn't interfere
        (streamingState as any).manualStop = true;
        
        streamingState.abortController.abort();
        streamingState.abortController = null;
        console.log(`✅ Aborted stream for session ${activeSessionId}`);
      }
      
      // Clear keepalive timer
      if (streamingState?.keepaliveTimer) {
        clearTimeout(streamingState.keepaliveTimer);
        streamingState.keepaliveTimer = null;
        console.log(`✅ Cleared keepalive timer for session ${activeSessionId}`);
      }
      
      // CRITICAL: Save the partial message content before cleaning up
      if (streamingState?.chatHistory) {
        console.log(`💾 Saving partial message content for session ${activeSessionId}`, {
          historyLength: streamingState.chatHistory.length,
          lastMessage: streamingState.chatHistory[streamingState.chatHistory.length - 1]
        });
        
        // Update the session with the partial content
        setSessions(prev => prev.map(s =>
          s.id === activeSessionId
            ? { ...s, chatHistory: streamingState.chatHistory, lastActive: new Date() }
            : s
        ));
        
        // Update the main chat history display
        setChatHistory(streamingState.chatHistory);
      }
      
      updateSessionStreamingStatus(activeSessionId, 'ready');
      removeStreamingSession(activeSessionId); // Remove from streaming set
      setSessionLoading(activeSessionId, false);
      
      // DON'T delete the streaming state yet - let the finally block handle it
      // This ensures the state is available if needed
      // streamingSessionsRef.current.delete(activeSessionId);
    }
  };

  // Helper to update chatHistory and sync to active session
  const updateChatHistory = (updater: (prev: ChatMessage[]) => ChatMessage[], sessionId: string) => {
    // CRITICAL: Validate session ID
    if (!sessionId) {
      console.error('❌ updateChatHistory called with no sessionId!');
      return;
    }
    
    // Get the streaming state for this session
    let streamingState = streamingSessionsRef.current.get(sessionId);
    
    // If no streaming state exists, create one from the current session's history
    if (!streamingState) {
      console.warn(`⚠️ No streaming state found for session ${sessionId}, creating one`);
      const currentSession = sessions.find(s => s.id === sessionId);
      const currentHistory = currentSession?.chatHistory || [];
      streamingState = {
        chatHistory: [...currentHistory],
        abortController: null,
        lastActivity: Date.now(),
        keepaliveTimer: null
      };
      streamingSessionsRef.current.set(sessionId, streamingState);
    }
    
    // CRITICAL: Create a completely isolated copy of the history
    const isolatedHistory = [...streamingState.chatHistory];
    const newHistory = updater(isolatedHistory);
    
    // Validate that we're not accidentally sharing references
    if (newHistory === isolatedHistory) {
      console.warn(`⚠️ History reference not changed for session ${sessionId} - forcing new array`);
      streamingState.chatHistory = [...newHistory];
    } else {
      streamingState.chatHistory = newHistory;
    }
    
    // CRITICAL: Update the sessions state array so the history persists when switching sessions
    // ONLY update the session that matches sessionId - NEVER touch other sessions
    setSessions(prev => {
      const updated = prev.map(s => {
        if (s.id === sessionId) {
          return { ...s, chatHistory: [...newHistory], lastActive: new Date() }; // Force new array
        }
        return s; // Don't modify other sessions
      });
      return updated;
    });
    
    // CRITICAL: Update session cache to maintain isolation
    updateSessionCache(sessionId, newHistory, true);
    
    // CRITICAL FIX: Update visible chatHistory if this is the active session
    // This ensures the UI updates even if the session is not in streamingSessionIds
    const isThisSessionActive = sessionId === activeSessionId;
    
    if (isThisSessionActive) {
      setChatHistory([...newHistory]); // Force new array
    }
  };

  // Simplified message handler using useChat
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    console.log('🚀 handleSendMessage called at', new Date().toISOString());
    console.log('🔒 isSendingMessage for session:', activeSessionId, isSendingMessageMap.current.get(activeSessionId || ''));
    
    // Prevent duplicate sends (race condition protection) - per session
    if (activeSessionId && isSendingMessageMap.current.get(activeSessionId)) {
      console.log('⏭️ Already sending a message in this session, skipping duplicate call');
      return;
    }
    
    // CRITICAL FIX: Only prevent sending if THIS session is loading
    // Check if the active session is in the streaming set and loading
    // This allows sending messages from other sessions while one is streaming
    const isActiveSessionCurrentlyLoading = activeSessionId ? (sessionLoadingStates.get(activeSessionId) || false) : false
    if (activeSessionId && streamingSessionIds.has(activeSessionId) && isActiveSessionCurrentlyLoading) {
      addToast({
        id: `toast_${Date.now()}`,
        type: 'warning',
        message: 'Please wait for the current message to complete',
        duration: 3000
      });
      return;
    }
    
    if (message.trim()) {
      // Mark as sending to prevent duplicates - per session
      if (activeSessionId) {
        isSendingMessageMap.current.set(activeSessionId, true);
      }
      
      // Check if user is signed in first
      if (!user) {
        addToast({
          id: `toast_${Date.now()}`,
          type: 'warning',
          message: 'Please sign in to send messages',
          duration: 3000
        });
        if (activeSessionId) {
          isSendingMessageMap.current.set(activeSessionId, false); // Reset flag
        }
        return;
      }
      
      // Check if a model is selected
      if (!selectedModel || selectedModel === '') {
        addToast({
          id: `toast_${Date.now()}`,
          type: 'warning',
          message: 'Please select a model before sending messages',
          duration: 3000
        });
        if (activeSessionId) {
          isSendingMessageMap.current.set(activeSessionId, false); // Reset flag
        }
        return;
      }
      
      // NEW: If "New Project" was selected, create it now
      if (createNewProjectOnSend) {
        console.log('🆕 Creating new project as requested');
        
        // Store the message to send after project creation
        setPendingMessageToSend(message.trim());
        
        addToast({
          id: `toast_${Date.now()}`,
          type: 'info',
          message: 'Creating new project...',
          duration: 3000
        });
        
        // Reset the sending flag
        if (activeSessionId) {
          isSendingMessageMap.current.set(activeSessionId, false);
        }
        
        // Create project asynchronously
        createProject(`Project ${projects.length + 1}`)
          .then(() => {
            setCreateNewProjectOnSend(false);
            addToast({
              id: `toast_${Date.now()}`,
              type: 'success',
              message: 'Project created!',
              duration: 2000
            });
          })
          .catch((error) => {
            console.error('Failed to create project:', error);
            setPendingMessageToSend(null); // Clear pending message on error
            addToast({
              id: `toast_${Date.now()}`,
              type: 'error',
              message: 'Failed to create project. Please try again.',
              duration: 5000
            });
          });
        
        return; // Exit early, message will be sent by useEffect
      }
      
      // NEW: If a project is selected in the dropdown but not active, create a new session in that project
      if (selectedProjectIdForNewSession && selectedProjectIdForNewSession !== activeProjectId) {
        console.log(`🆕 Creating new session in selected project: ${selectedProjectIdForNewSession}`);
        
        // Store the message to send after session creation
        setPendingMessageToSend(message.trim());
        
        addToast({
          id: `toast_${Date.now()}`,
          type: 'info',
          message: 'Creating new session...',
          duration: 2000
        });
        
        // Reset the sending flag
        if (activeSessionId) {
          isSendingMessageMap.current.set(activeSessionId, false);
        }
        
        // Create session asynchronously
        const newSessionName = `Session ${sessions.filter(s => s.projectId === selectedProjectIdForNewSession).length + 1}`;
        createNewSessionForProject(selectedProjectIdForNewSession, newSessionName)
          .then(() => {
            setSelectedProjectIdForNewSession(null);
            addToast({
              id: `toast_${Date.now()}`,
              type: 'success',
              message: 'New session created!',
              duration: 2000
            });
          })
          .catch((error) => {
            console.error('Failed to create session:', error);
            setPendingMessageToSend(null); // Clear pending message on error
            addToast({
              id: `toast_${Date.now()}`,
              type: 'error',
              message: 'Failed to create session. Please try again.',
              duration: 5000
            });
          });
        
        return; // Exit early, message will be sent by useEffect
      }
      
      // Check if project is selected
      if (!activeProjectId) {
        addToast({
          id: `toast_${Date.now()}`,
          type: 'warning',
          message: 'Please select or create a project first',
          duration: 3000
        });
        if (activeSessionId) {
          isSendingMessageMap.current.set(activeSessionId, false); // Reset flag
        }
        return;
      }
      
      // Open sidebar on first message and disable animations
      if (!chatSidebarOpen) {
        setChatSidebarOpen(true)
        setAnimationsDisabled(true)
        setShowOrderText(false)
        setFadeInOpacity(0)
        setProtocolFading(true)
      }

      // Check if we've hit the message limit (50+ messages)
      if (messages.length >= 50 && !sessionSuggestionDismissed) {
        // Show session suggestion instead of sending message
        addToast({
          id: `toast_${Date.now()}`,
          type: 'info',
          message: 'Consider starting a new session for better performance',
          duration: 5000
        });
      }

      // Send message using direct API call
      const userMessage = message.trim();
      const messageSentInSessionId = activeSessionId; // Capture the session ID at send time
      setMessage(''); // Clear input
      
      // Clear attached files after capturing them for sending
      const filesToSend = [...attachedFiles]
      setAttachedFiles([])
      
      // Revoke object URLs to free memory
      filesToSend.forEach(file => {
        if (file.preview && (file.type === 'image' || file.type === 'video')) {
          URL.revokeObjectURL(file.preview)
        }
      })
      
      setSessionLoading(messageSentInSessionId, true);
      
      // Add user message to chat history with attachments
      const userChatMessage: ChatMessage = {
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
        attachments: filesToSend.map(file => ({
          name: file.file.name,
          type: file.type,
          mimeType: file.file.type,
          data: file.base64 || '',
          size: file.file.size
        }))
      };
      
      // DON'T update global chatHistory here - it will be updated by the session loading logic
      // Instead, directly update the session's chatHistory
      
      // Initialize streaming state for this session
      if (messageSentInSessionId) {
        // Get the current session's history
        const currentSession = sessions.find(s => s.id === messageSentInSessionId);
        const currentHistory = currentSession?.chatHistory || [];
        const newHistory = [...currentHistory, userChatMessage];
        
        // Create streaming state for this session with the updated history
        streamingSessionsRef.current.set(messageSentInSessionId, {
          chatHistory: newHistory,
          abortController: null,
          lastActivity: Date.now(),
          keepaliveTimer: null
        });
        
        // CRITICAL: Update session cache immediately with user message
        updateSessionCache(messageSentInSessionId, newHistory, true);
        console.log(`💾 Session cache updated with user message for session ${messageSentInSessionId}`);
        
        // Update visible chatHistory ONLY if this is the active session
        if (messageSentInSessionId === activeSessionId) {
          setChatHistory(newHistory);
        }
      }
      
      // Update session's cached chatHistory
      if (messageSentInSessionId) {
        setSessions(prev => prev.map(s => {
          if (s.id === messageSentInSessionId) {
            return { 
              ...s, 
              chatHistory: [...(s.chatHistory || []), userChatMessage]
            }
          }
          return s
        }))
        
        // Save user message to database immediately with retry
        const saveUserMessage = async (retries = 3) => {
          for (let attempt = 1; attempt <= retries; attempt++) {
            try {
              console.log(`💾 Saving user message to database (attempt ${attempt}/${retries}) at`, new Date().toISOString());
              const headers = await getAuthHeaders();
              const response = await fetch(`${backendUrl}/api/sessions/${messageSentInSessionId}/messages`, {
                method: 'POST',
                headers: {
                  ...headers,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(userChatMessage),
                signal: AbortSignal.timeout(10000) // 10 second timeout
              });
              
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }
              
              const result = await response.json();
              console.log('✅ User message saved to database at', new Date().toISOString(), result);
              return; // Success, exit
            } catch (error) {
              console.error(`❌ Failed to save user message (attempt ${attempt}/${retries}):`, error);
              if (attempt < retries) {
                const delay = attempt * 1000; // Exponential backoff: 1s, 2s, 3s
                console.log(`⏳ Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
              } else {
                console.error('❌ All retry attempts failed. Message may not be persisted.');
                // Store in localStorage as backup
                try {
                  const failedSaves = JSON.parse(localStorage.getItem('failedMessageSaves') || '[]');
                  failedSaves.push({
                    sessionId: messageSentInSessionId,
                    message: userChatMessage,
                    timestamp: new Date().toISOString()
                  });
                  localStorage.setItem('failedMessageSaves', JSON.stringify(failedSaves));
                  console.log('💾 Message stored in localStorage for later retry');
                } catch (storageError) {
                  console.error('❌ Failed to store in localStorage:', storageError);
                }
              }
            }
          }
        };
        
        saveUserMessage();
      }
      
      // Call the API with error handling
      try {
        if (messageSentInSessionId) {
          updateSessionStreamingStatus(messageSentInSessionId, 'submitted');
          addStreamingSession(messageSentInSessionId); // Add to streaming set
        }
        
        // CRITICAL: Use per-session abort controller for concurrent streaming
        const controller = new AbortController();
        
        // Store the abort controller in the session's streaming state
        const streamingState = streamingSessionsRef.current.get(messageSentInSessionId);
        if (streamingState) {
          streamingState.abortController = controller;
          streamingState.lastActivity = Date.now();
          console.log(`✅ Stored abort controller for session ${messageSentInSessionId}`);
          
          // Set up connection monitoring - check every 15 seconds if stream is still active
          const monitorConnection = () => {
            const state = streamingSessionsRef.current.get(messageSentInSessionId);
            if (!state) {
              console.log(`⏹️ Stream monitoring stopped - session ${messageSentInSessionId} no longer streaming`);
              return;
            }
            
            const timeSinceLastActivity = Date.now() - state.lastActivity;
            const isStale = timeSinceLastActivity > 30000; // 30 seconds without activity
            
            if (isStale) {
              console.warn(`⚠️ Stream for session ${messageSentInSessionId} appears stale (${Math.round(timeSinceLastActivity / 1000)}s since last activity)`);
              console.warn(`   This may indicate a connection issue or backend timeout`);
              // Don't abort automatically - let the timeout handle it
            }
            
            // Schedule next check if still streaming
            if (streamingSessionIds.has(messageSentInSessionId)) {
              state.keepaliveTimer = setTimeout(monitorConnection, 15000);
            }
          };
          
          // Start monitoring after 15 seconds
          streamingState.keepaliveTimer = setTimeout(monitorConnection, 15000);
        }
        
        // Longer timeout for terminal commands and MCP operations (5 minutes)
        const timeoutId = setTimeout(() => controller.abort(), 300000);

        console.log(`📤 Sending message with mode: ${mode}, model: ${selectedModel}`);
        console.log(`📤 Backend URL: ${backendUrl}/api/chat`);
        console.log(`📤 Project ID: ${activeProjectId}`);
        console.log(`🎯 Custom Mode ID: ${selectedCustomMode || 'none (using default)'}`);
        
        // CRITICAL: Get the history from streaming state (includes the user's message)
        // Don't use chatHistory state as it's stale (React state updates are async)
        const historyToSend = streamingState?.chatHistory || chatHistory;
        console.log(`📤 Sending history with ${historyToSend.length} messages (last: "${historyToSend[historyToSend.length - 1]?.content?.substring(0, 30)}...")`);
        
        // Prepare attachments for sending
        const attachments = await Promise.all(filesToSend.map(async (file) => {
          return {
            name: file.file.name,
            type: file.type,
            mimeType: file.file.type,
            data: file.base64 || '',
            size: file.file.size
          }
        }))

        // Get API key for the selected model
        let modelApiKey = '';
        try {
          const { SettingsManager } = await import('@/utils/settingsManager');
          const settings = SettingsManager.load();
          const modelConfig = settings.models.configuredModels.find((m: any) => m.id === selectedModel);
          if (modelConfig && modelConfig.apiKey) {
            modelApiKey = modelConfig.apiKey;
            console.log(`🔑 Found API key for model: ${selectedModel}`);
          } else {
            console.log(`⚠️ No API key found for model: ${selectedModel}`);
          }
        } catch (error) {
          console.error('❌ Failed to load API key:', error);
        }

        const requestBody = {
          message: userMessage,
          history: historyToSend,  // CRITICAL: Use streaming state history, not stale chatHistory
          model: selectedModel,
          apiKey: modelApiKey, // Include API key for the model
          mode: mode,
          projectId: activeProjectId, // Send active project ID so backend uses correct container
          sessionId: messageSentInSessionId,  // CRITICAL: Use captured session ID for message persistence
          customModeId: selectedCustomMode, // Send custom mode ID if selected
          userId: user?.id, // Send user ID for usage tracking
          attachments: attachments.length > 0 ? attachments : undefined // Include attachments if any
        };
        
        console.log(`📦 Request body keys:`, Object.keys(requestBody));
        console.log(`📦 customModeId in request:`, requestBody.customModeId);

        const response = await fetch(`${backendUrl}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        }).catch(fetchError => {
          console.error('❌ Fetch failed:', fetchError);
          console.error('   Error name:', fetchError.name);
          console.error('   Error message:', fetchError.message);
          console.error('   Error stack:', fetchError.stack);
          throw fetchError;
        });

        clearTimeout(timeoutId);
        console.log('✅ Response received, status:', response.status);
        if (messageSentInSessionId) {
          updateSessionStreamingStatus(messageSentInSessionId, 'streaming');
          // streamingSessionIdRef and streamingChatHistoryRef already set after user message
        }

        if (!response.ok) {
          console.error('❌ Response not OK:', response.status, response.statusText);
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error || `Server error: ${response.status}`;
          throw new Error(errorMessage);
        }

        // Handle streaming response from Vercel AI SDK data stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let assistantMessage = '';
        let streamError = false;
        let hasSeenCommandOutput = false; // Track if we've seen a command output block

        console.log('📖 Starting to read stream for session:', messageSentInSessionId);
        if (reader) {
          try {
            // Create a temporary assistant message that we'll update as we stream
            const tempMessageIndex = chatHistory.length + 1;
            let chunkCount = 0;
            let receivedEvents = []; // Track all received events for debugging
            
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                console.log(`✅ Stream completed for session ${messageSentInSessionId} after ${chunkCount} chunks`);
                console.log(`📊 Received events in order:`, receivedEvents.map(e => e.type).join(' → '));
                const streamingState = streamingSessionsRef.current.get(messageSentInSessionId);
                if (streamingState) {
                  const timeSinceLastActivity = Date.now() - streamingState.lastActivity;
                  console.log(`   Last activity was ${Math.round(timeSinceLastActivity / 1000)}s ago`);
                }
                break;
              }
              
              chunkCount++;
              const chunk = decoder.decode(value);
              
              // Parse data stream format (lines starting with "0:" contain text)
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.startsWith('0:')) {
                  try {
                    const data = JSON.parse(line.substring(2));
                    
                    receivedEvents.push({ type: data.type, timestamp: Date.now() }); // Track event
                    
                    // Handle connection confirmation
                    if (data.type === 'connection') {
                      console.log('✅ Stream connection established');
                      continue;
                    }
                    
                    // Handle thought/status messages - ignore them, we'll use text-delta instead
                    if (data.type === 'thought') {
                      console.log('💭 Thought (ignored):', data.content);
                      // Skip synthetic thinking messages - we want the model's natural text instead
                      continue;
                    }
                    
                    // Handle keepalive messages
                    if (data.type === 'keepalive') {
                      console.log('💓 Keepalive received for session:', messageSentInSessionId);
                      
                      // Update last activity timestamp
                      const streamingState = streamingSessionsRef.current.get(messageSentInSessionId);
                      if (streamingState) {
                        streamingState.lastActivity = Date.now();
                        console.log(`✅ Updated activity timestamp for session ${messageSentInSessionId}`);
                      }
                      continue;
                    }
                    
                    // Handle done message
                    if (data.type === 'done') {
                      console.log('✅ Stream completed:', data);
                      
                      // CRITICAL: Check if this is an error completion (message contains error text)
                      const isErrorCompletion = assistantMessage.includes('A network error occurred. Please try again.');
                      if (isErrorCompletion) {
                        console.log('🛑 Done event after network error - cleaning up streaming state IMMEDIATELY');
                        
                        // Use flushSync to force immediate state updates
                        ReactDOM.flushSync(() => {
                          // Clean up streaming state immediately
                          removeStreamingSession(messageSentInSessionId);
                          updateSessionStreamingStatus(messageSentInSessionId, 'ready');
                          setSessionLoading(messageSentInSessionId, false);
                        });
                        
                        // Clean up streaming state ref
                        const streamingState = streamingSessionsRef.current.get(messageSentInSessionId);
                        if (streamingState) {
                          if (streamingState.keepaliveTimer) {
                            clearTimeout(streamingState.keepaliveTimer);
                          }
                          if (streamingState.abortController) {
                            streamingState.abortController.abort();
                          }
                          streamingSessionsRef.current.delete(messageSentInSessionId);
                        }
                        
                        console.log('✅ Streaming state cleaned up in done event with flushSync');
                      }
                      
                      // Wait a bit to ensure all text-delta events have been processed
                      await new Promise(resolve => setTimeout(resolve, 100));
                      
                      // Create final text block for any remaining text after the last tool call
                      updateChatHistory(prev => {
                        const newHistory = [...prev];
                        const lastMsg = newHistory[newHistory.length - 1];
                        if (lastMsg && lastMsg.role === 'assistant') {
                          const currentText = lastMsg._streamingText || lastMsg.content || '';
                          const processedLength = lastMsg.processedTextLength || 0;
                          const remainingText = currentText.substring(processedLength).trim();
                          
                          console.log('🔍 Checking for final text block:', {
                            processedLength,
                            currentTextLength: currentText.length,
                            remainingTextLength: remainingText.length,
                            introText: lastMsg.introText,
                            hasMediaBlocks: !!lastMsg.mediaBlocks,
                            mediaBlocksCount: lastMsg.mediaBlocks?.length || 0
                          });
                          
                          // CRITICAL: Always preserve content - this is the source of truth
                          lastMsg.content = currentText;
                          console.log(`✅ Preserved final content in lastMsg.content: ${currentText.length} chars`);
                          
                          // If there's remaining text after the last tool call, create a text block for it
                          if (remainingText) {
                            // Ensure mediaBlocks array exists
                            if (!lastMsg.mediaBlocks) {
                              lastMsg.mediaBlocks = [];
                            }
                            
                            // Add final text block
                            lastMsg.mediaBlocks.push({
                              id: `text-final-${Date.now()}`,
                              type: 'text',
                              data: { text: remainingText },
                              timestamp: new Date().toISOString()
                            });
                            
                            console.log(`✅ Created final text block with ${remainingText.length} chars`);
                            
                            // Update processed length to include all text
                            lastMsg.processedTextLength = currentText.length;
                          }
                          
                          // Mark streaming as complete
                          lastMsg._streamingComplete = true;
                          
                          // DON'T delete _streamingText - keep it as backup
                          // The MessageRenderer will use content or _streamingText as fallback
                          delete lastMsg._pendingToolCalls;
                        }
                        return newHistory;
                      }, messageSentInSessionId);
                      
                      // Dispatch event to notify that chat is complete (for usage tracking refresh)
                      window.dispatchEvent(new Event('chat-complete'));
                      console.log('📊 Dispatched chat-complete event');
                      
                      // Sync chatHistory to sessions and save complete message structure to database
                      if (messageSentInSessionId) {
                        // Use setChatHistory callback to get the latest chatHistory
                        setChatHistory(currentHistory => {
                          setSessions(prev => prev.map(s =>
                            s.id === messageSentInSessionId  // ← FIX: Use messageSentInSessionId, not activeSessionId
                              ? { ...s, chatHistory: currentHistory, lastActive: new Date() }
                              : s
                          ));
                          console.log(`💾 Synced ${currentHistory.length} messages to session ${messageSentInSessionId} after streaming`);
                          
                          // Save the complete assistant message structure to database
                          const lastMessage = currentHistory[currentHistory.length - 1];
                          if (lastMessage && lastMessage.role === 'assistant') {
                            console.log('💾 Saving complete assistant message to database...');
                            console.log('📦 Message structure:', {
                              role: lastMessage.role,
                              contentLength: lastMessage.content?.length || 0,
                              hasMediaBlocks: !!lastMessage.mediaBlocks,
                              mediaBlocksCount: lastMessage.mediaBlocks?.length || 0,
                              hasIntroText: !!lastMessage.introText,
                              hasImages: !!lastMessage.images
                            });
                            
                            // Send the COMPLETE message object as-is with retry logic
                            // No conversion, no metadata extraction - just the raw object
                            const saveAssistantMessage = async (retries = 3) => {
                              for (let attempt = 1; attempt <= retries; attempt++) {
                                try {
                                  console.log(`💾 Saving assistant message to session ${messageSentInSessionId} (attempt ${attempt}/${retries})`);
                                  const headers = await getAuthHeaders();
                                  const response = await fetch(`${backendUrl}/api/sessions/${messageSentInSessionId}/messages`, {
                                    method: 'POST',
                                    headers: {
                                      ...headers,
                                      'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify(lastMessage),
                                    signal: AbortSignal.timeout(10000) // 10 second timeout
                                  });
                                  
                                  if (!response.ok) {
                                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                                  }
                                  
                                  const result = await response.json();
                                  if (result.success) {
                                    console.log('✅ Complete message object saved to database');
                                    return; // Success
                                  } else {
                                    throw new Error(result.error || 'Unknown error');
                                  }
                                } catch (err) {
                                  console.error(`❌ Error saving assistant message (attempt ${attempt}/${retries}):`, err);
                                  if (attempt < retries) {
                                    const delay = attempt * 1000;
                                    console.log(`⏳ Retrying in ${delay}ms...`);
                                    await new Promise(resolve => setTimeout(resolve, delay));
                                  } else {
                                    console.error('❌ All retry attempts failed for assistant message');
                                    // Store in localStorage as backup
                                    try {
                                      const failedSaves = JSON.parse(localStorage.getItem('failedMessageSaves') || '[]');
                                      failedSaves.push({
                                        sessionId: messageSentInSessionId,
                                        message: lastMessage,
                                        timestamp: new Date().toISOString()
                                      });
                                      localStorage.setItem('failedMessageSaves', JSON.stringify(failedSaves));
                                      console.log('💾 Assistant message stored in localStorage for later retry');
                                    } catch (storageError) {
                                      console.error('❌ Failed to store in localStorage:', storageError);
                                    }
                                  }
                                }
                              }
                            };
                            
                            saveAssistantMessage();
                          }
                          
                          return currentHistory; // Return unchanged
                        });
                      }
                      
                      break;
                    }
                    
                    // Handle error messages
                    if (data.type === 'error') {
                      console.error('❌ Stream error received:', data);
                      console.error('   Error content:', data.content);
                      
                      // Check if this error is after a successful desktop tool execution
                      // If so, don't display it as it's likely an AI processing error, not a tool error
                      const hasRecentDesktopTool = (() => {
                        const lastMsg = chatHistory[chatHistory.length - 1];
                        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.mediaBlocks) {
                          const now = Date.now();
                          return lastMsg.mediaBlocks.some(block => {
                            if (block.type !== 'desktop-tool') return false;
                            const timeDiff = now - (block.timestamp?.getTime() || 0);
                            return timeDiff < 5000; // Within last 5 seconds
                          });
                        }
                        return false;
                      })();
                      
                      if (hasRecentDesktopTool) {
                        console.log('⚠️ Skipping error display - recent desktop tool execution was successful');
                        break;
                      }
                      
                      // Add error as a media block in the chat
                      const errorBlock = {
                        id: `error_${Date.now()}_${Math.random()}`,
                        type: 'error',
                        data: {
                          message: data.content || 'An error occurred',
                          details: data.details || null
                        },
                        timestamp: new Date()
                      };
                      
                      console.log('📦 Created error block:', errorBlock);
                      
                      // Add error block to the current assistant message
                      updateChatHistory(prev => {
                        const newHistory = [...prev];
                        const lastMsg = newHistory[newHistory.length - 1];
                        
                        console.log('📝 Current chat history length:', newHistory.length, messageSentInSessionId);
                        console.log('📝 Last message:', lastMsg);
                        
                        if (lastMsg && lastMsg.role === 'assistant') {
                          if (!lastMsg.mediaBlocks) {
                            lastMsg.mediaBlocks = [];
                          }
                          
                          // Check for duplicate error blocks (same message within last 100ms)
                          const now = Date.now();
                          const isDuplicate = lastMsg.mediaBlocks.some(
                            block => {
                              if (block.type !== 'error') return false;
                              const timeDiff = now - (block.timestamp?.getTime() || 0);
                              const sameMessage = block.data.message === errorBlock.data.message;
                              const recent = timeDiff < 100; // Within 100ms
                              return sameMessage && recent;
                            }
                          );
                          
                          if (!isDuplicate) {
                            lastMsg.mediaBlocks.push(errorBlock);
                            console.log('✅ Added error block to existing assistant message');
                          } else {
                            console.log('⚠️ Skipped duplicate error block');
                          }
                        } else {
                          newHistory.push({
                            role: 'assistant',
                            content: '',
                            mediaBlocks: [errorBlock],
                            timestamp: new Date()
                          });
                          console.log('✅ Created new assistant message with error block');
                        }
                        
                        console.log('📝 Updated chat history:', newHistory);
                        return newHistory;
                      }, messageSentInSessionId);
                      
                      // Don't throw - let the stream continue
                      console.log('🛑 Breaking stream after error');
                      break;
                    }
                    
                    // Handle text deltas - stream the model's natural thinking/reasoning
                    if (data.type === 'text-delta' && data.textDelta) {
                      // Update last activity timestamp
                      const streamingState = streamingSessionsRef.current.get(messageSentInSessionId);
                      if (streamingState) {
                        streamingState.lastActivity = Date.now();
                      }
                      
                      assistantMessage += data.textDelta;
                      
                      // CRITICAL: Detect network error message from backend and stop streaming
                      if (assistantMessage.includes('A network error occurred. Please try again.')) {
                        console.log('🛑 Detected network error message from backend - stopping streaming');
                        streamError = true;
                        
                        // Clean up streaming state immediately
                        removeStreamingSession(messageSentInSessionId);
                        updateSessionStreamingStatus(messageSentInSessionId, 'ready');
                        setSessionLoading(messageSentInSessionId, false);
                        
                        // Clean up streaming state ref
                        if (streamingState) {
                          if (streamingState.keepaliveTimer) {
                            clearTimeout(streamingState.keepaliveTimer);
                          }
                          if (streamingState.abortController) {
                            streamingState.abortController.abort();
                          }
                          streamingSessionsRef.current.delete(messageSentInSessionId);
                        }
                        
                        console.log('✅ Streaming state cleaned up after detecting network error');
                      }
                      
                      // Update chat history in real-time with immediate render
                      // Use flushSync to force React to render immediately for smooth character-by-character effect
                      ReactDOM.flushSync(() => {
                        updateChatHistory(prev => {
                          const newHistory = [...prev];
                          const lastMsg = newHistory[newHistory.length - 1];
                          if (lastMsg && lastMsg.role === 'assistant') {
                            // Always update both content and streaming text
                            lastMsg.content = assistantMessage;
                            lastMsg._streamingText = assistantMessage;
                          } else {
                            // Create new assistant message
                            newHistory.push({
                              role: 'assistant',
                              content: assistantMessage,
                              _streamingText: assistantMessage,
                              timestamp: new Date()
                            });
                          }
                          return newHistory;
                        }, messageSentInSessionId);
                      });
                    }
                    
                    // Handle text-replace events (hide tool call syntax)
                    if (data.type === 'text-replace' && data.text !== undefined) {
                      console.log('🔄 Text replace event - hiding tool call syntax');
                      console.log('   Replacing with:', data.text);
                      
                      // Replace the assistant message content with the text before tool call
                      assistantMessage = data.text;
                      
                      ReactDOM.flushSync(() => {
                        updateChatHistory(prev => {
                          const newHistory = [...prev];
                          const lastMsg = newHistory[newHistory.length - 1];
                          if (lastMsg && lastMsg.role === 'assistant') {
                            lastMsg.content = assistantMessage;
                            lastMsg._streamingText = assistantMessage;
                          }
                          return newHistory;
                        }, messageSentInSessionId);
                      });
                    }
                    
                    // Handle command output events
                    else if (data.type === 'command-output') {
                      console.log('📦 Frontend received command-output:', data);
                      
                      // Mark that we've seen a command output
                      if (!hasSeenCommandOutput) {
                        hasSeenCommandOutput = true;
                        console.log('📍 First command output received - text before this is intro, text after is analysis');
                      }
                      
                      const mediaBlock = {
                        id: `command_${Date.now()}_${Math.random()}`,
                        type: 'command',
                        data: {
                          command: data.command,
                          output: data.output,
                          status: data.status,
                          exitCode: data.exitCode,
                          duration: data.duration
                        },
                        timestamp: new Date()
                      };
                      
                      // Add media block to the current assistant message
                      updateChatHistory(prev => {
                        const newHistory = [...prev];
                        const lastMsg = newHistory[newHistory.length - 1];
                        if (lastMsg && lastMsg.role === 'assistant') {
                          if (!lastMsg.mediaBlocks) {
                            lastMsg.mediaBlocks = [];
                          }
                          
                          // Check for duplicates (same command within last 100ms)
                          const now = Date.now();
                          const isDuplicate = lastMsg.mediaBlocks.some(
                            block => {
                              if (block.type !== 'command') return false;
                              const timeDiff = now - (block.timestamp?.getTime() || 0);
                              const sameCommand = block.data.command === data.command;
                              const recent = timeDiff < 100; // Within 100ms
                              return sameCommand && recent;
                            }
                          );
                          
                          if (!isDuplicate) {
                            // Track processed text length to track what text we've seen
                            if (!lastMsg.processedTextLength) {
                              lastMsg.processedTextLength = 0;
                            }
                            
                            // Get text from the message's streaming text field
                            const currentText = lastMsg._streamingText || lastMsg.content || '';
                            
                            // DON'T create text blocks during streaming - let text continue streaming
                            // Text blocks will be created when stream is done
                            // Just track that we've seen this text
                            lastMsg.processedTextLength = currentText.length;
                            
                            // Add the command block
                            lastMsg.mediaBlocks.push(mediaBlock);
                            console.log('📦 Added command block to existing message. Total blocks:', lastMsg.mediaBlocks.length);
                            
                            // CRITICAL: Keep content in sync with _streamingText so it's preserved when saved
                            lastMsg.content = currentText;
                            console.log('✅ Preserved content in lastMsg.content:', currentText.length, 'chars');
                          } else {
                            console.log('⚠️ Skipped duplicate command block (same command within 100ms)');
                          }
                        }
                        return newHistory;
                      }, messageSentInSessionId);
                    }
                    
                    // Handle desktop tool output events
                    else if (data.type === 'desktop-tool-output') {
                      console.log('🚨🚨🚨 NEW CODE LOADED - desktop-tool-output handler v3 🚨🚨🚨');
                      // Update last activity timestamp
                      const streamingState = streamingSessionsRef.current.get(messageSentInSessionId);
                      if (streamingState) {
                        streamingState.lastActivity = Date.now();
                      }
                      
                      console.log('📦 Frontend received desktop-tool-output:', {
                        type: data.type,
                        toolName: data.toolName,
                        hasArgs: !!data.args,
                        hasOutput: !!data.output,
                        outputLength: data.output?.length,
                        status: data.status,
                        duration: data.duration,
                        fullData: data
                      });
                      
                      // Mark that we've seen a tool output
                      if (!hasSeenCommandOutput) {
                        hasSeenCommandOutput = true;
                        console.log('📍 First tool output received - text before this is intro, text after is analysis');
                      }
                      
                      // Update or create the tool block
                      updateChatHistory(prev => {
                        console.log('🔧 updateChatHistory called for desktop-tool-output, history length:', prev.length);
                        const newHistory = [...prev];
                        let lastMsg = newHistory[newHistory.length - 1];
                        console.log('🔧 Last message:', lastMsg?.role, 'mediaBlocks:', lastMsg?.mediaBlocks?.length);
                        
                        // CRITICAL: Create assistant message if it doesn't exist
                        // This ensures desktop-tool blocks are added to the same message that will receive text-delta updates
                        if (!lastMsg || lastMsg.role !== 'assistant') {
                          const newAssistantMsg = {
                            role: 'assistant',
                            content: '',
                            _streamingText: '',
                            mediaBlocks: [],
                            timestamp: new Date()
                          };
                          newHistory.push(newAssistantMsg);
                          lastMsg = newAssistantMsg;
                          console.log('✅ Created new assistant message for desktop-tool block');
                        }
                        
                        if (!lastMsg.mediaBlocks) {
                          lastMsg.mediaBlocks = [];
                        }
                          
                          // Get text from the message's streaming text field
                          const currentText = lastMsg._streamingText || lastMsg.content || '';
                          
                          console.log('📊 Tool output received:', {
                            currentTextLength: currentText.length,
                            processedTextLength: lastMsg.processedTextLength || 0,
                            currentTextPreview: currentText.substring(0, 100)
                          });
                          
                          // CRITICAL: Find the pending block to update it
                          let pendingBlockIndex = -1;
                          if (lastMsg.mediaBlocks) {
                            console.log('🔍 Searching for pending block in', lastMsg.mediaBlocks.length, 'blocks');
                            console.log('🔍 Incoming toolCallId:', data.toolCallId, 'type:', typeof data.toolCallId);
                            lastMsg.mediaBlocks.forEach((block, idx) => {
                              console.log(`  Block ${idx}:`, {
                                type: block.type,
                                status: block.data?.status,
                                toolName: block.data?.toolName,
                                hasPendingId: !!block._pendingToolCallId,
                                pendingId: block._pendingToolCallId,
                                pendingIdType: typeof block._pendingToolCallId,
                                incomingToolCallId: data.toolCallId,
                                idsMatch: block._pendingToolCallId === data.toolCallId,
                                idsMatchStrict: block._pendingToolCallId === String(data.toolCallId)
                              });
                            });
                            
                            // FIXED: First try to find by toolCallId (most accurate)
                            if (data.toolCallId) {
                              pendingBlockIndex = lastMsg.mediaBlocks.findIndex(
                                block => block.type === 'desktop-tool' && 
                                         block._pendingToolCallId === data.toolCallId
                              );
                              console.log('🔍 Search by toolCallId result:', pendingBlockIndex);
                            }
                            
                            // Fallback: If no match by ID, find the first pending block
                            // (This handles cases where the ID wasn't set properly)
                            if (pendingBlockIndex === -1) {
                              pendingBlockIndex = lastMsg.mediaBlocks.findIndex(
                                block => block.type === 'desktop-tool' && 
                                         block.data.status === 'pending'
                              );
                              console.log('🔍 Fallback search by status result:', pendingBlockIndex);
                            }
                          }
                          
                          // CRITICAL: Check if we already have a completed block for THIS SPECIFIC tool call
                          // This prevents duplicate blocks when the same tool output is received multiple times
                          // BUT allows multiple calls to the same tool (e.g., multiple clicks)
                          const hasCompletedBlock = lastMsg.mediaBlocks?.some(
                            block => block.type === 'desktop-tool' && 
                                     block.data.status !== 'pending' &&
                                     block._pendingToolCallId === data.toolCallId && // Match by ID, not tool name
                                     block.data.output === data.output
                          );
                          
                          if (hasCompletedBlock) {
                            console.log('⚠️ Skipping duplicate tool output for toolCallId:', data.toolCallId);
                            return newHistory;
                          }
                          
                          console.log('🔍 Pending block search result:', {
                            found: pendingBlockIndex !== -1,
                            index: pendingBlockIndex,
                            totalBlocks: lastMsg.mediaBlocks?.length || 0,
                            incomingToolName: data.toolName,
                            incomingStatus: data.status
                          });
                          
                          if (pendingBlockIndex !== -1) {
                            // Update the existing pending block with the output
                            console.log('✅ Updating pending block at index', pendingBlockIndex, 'with:', {
                              toolName: data.toolName,
                              status: data.status,
                              hasOutput: !!data.output,
                              outputLength: data.output?.length,
                              duration: data.duration
                            });
                            
                            const oldBlock = lastMsg.mediaBlocks[pendingBlockIndex];
                            console.log('📋 Old block before update:', {
                              type: oldBlock.type,
                              status: oldBlock.data?.status,
                              toolName: oldBlock.data?.toolName
                            });
                            
                            lastMsg.mediaBlocks[pendingBlockIndex] = {
                              ...lastMsg.mediaBlocks[pendingBlockIndex],
                              data: {
                                toolName: data.toolName,
                                args: data.args,
                                output: data.output,
                                status: data.status,
                                duration: data.duration
                              },
                              _pendingToolCallId: undefined // Remove the pending marker
                            };
                            
                            console.log('📋 New block after update:', {
                              type: lastMsg.mediaBlocks[pendingBlockIndex].type,
                              status: lastMsg.mediaBlocks[pendingBlockIndex].data?.status,
                              toolName: lastMsg.mediaBlocks[pendingBlockIndex].data?.toolName
                            });
                            console.log('📦 Updated pending desktop tool block with output');
                          } else {
                            // Create a new tool block with the output (no pending block found)
                            console.log('⚠️ No pending block found, creating new block');
                            const newToolBlock = {
                              id: `desktop_tool_${Date.now()}_${Math.random()}`,
                              type: 'desktop-tool',
                              data: {
                                toolName: data.toolName,
                                args: data.args,
                                output: data.output,
                                status: data.status,
                                duration: data.duration
                              },
                              timestamp: new Date()
                            };
                            lastMsg.mediaBlocks.push(newToolBlock);
                            console.log('📦 Created new desktop tool block (no pending block found):', {
                              id: newToolBlock.id,
                              type: newToolBlock.type,
                              hasOutput: !!newToolBlock.data.output,
                              outputLength: newToolBlock.data.output?.length,
                              status: newToolBlock.data.status,
                              toolName: newToolBlock.data.toolName
                            });
                          }
                          
                          // CRITICAL: Keep content in sync with _streamingText so it's preserved when saved
                          lastMsg.content = currentText;
                          console.log('✅ Preserved content in lastMsg.content:', currentText.length, 'chars');
                          
                          // Clean up pending tool calls marker
                          delete lastMsg._pendingToolCalls;
                        return newHistory;
                      }, messageSentInSessionId);
                    }
                    
                    // Handle tool call start events
                    else if (data.type === 'tool-call-start') {
                      console.log('🔧 Frontend received tool-call-start:', data);
                      
                      // Update last activity timestamp
                      const streamingState = streamingSessionsRef.current.get(messageSentInSessionId);
                      if (streamingState) {
                        streamingState.lastActivity = Date.now();
                      }
                      
                      // Helper function to get user-friendly action message from tool name
                      const getToolActionMessage = (toolName: string): string => {
                        const toolActions: Record<string, string> = {
                          'windows_take_screenshot': 'Taking screenshot',
                          'windows_see_screen': 'Taking screenshot',
                          'windows_get_mouse_position': 'Getting mouse position',
                          'windows_move_mouse': 'Moving cursor',
                          'windows_click': 'Clicking position',
                          'windows_double_click': 'Double clicking',
                          'windows_right_click': 'Right clicking',
                          'windows_type_text': 'Typing text',
                          'windows_press_key': 'Pressing key',
                          'windows_scroll': 'Scrolling',
                          'windows_drag': 'Dragging',
                          'windows_open_application': 'Opening application',
                          'windows_close_application': 'Closing application',
                          'windows_get_window_info': 'Getting window info',
                          'windows_list_windows': 'Listing windows',
                          'windows_focus_window': 'Focusing window',
                          'windows_minimize_window': 'Minimizing window',
                          'windows_maximize_window': 'Maximizing window',
                          'windows_restore_window': 'Restoring window',
                          'windows_close_window': 'Closing window'
                        };
                        
                        return toolActions[toolName] || 'Executing action';
                      };
                      
                      // Create a pending tool block to show loading state
                      updateChatHistory(prev => {
                        const newHistory = [...prev];
                        let lastMsg = newHistory[newHistory.length - 1];
                        
                        console.log('🔧 tool-call-start: Checking last message:', {
                          exists: !!lastMsg,
                          role: lastMsg?.role,
                          hasContent: !!lastMsg?.content,
                          contentLength: lastMsg?.content?.length || 0,
                          hasStreamingText: !!lastMsg?._streamingText,
                          streamingTextLength: lastMsg?._streamingText?.length || 0,
                          hasIntroText: !!lastMsg?.introText,
                          hasMediaBlocks: !!lastMsg?.mediaBlocks,
                          mediaBlocksCount: lastMsg?.mediaBlocks?.length || 0
                        });
                        
                        // Create assistant message if it doesn't exist
                        if (!lastMsg || lastMsg.role !== 'assistant') {
                          const newAssistantMsg = {
                            role: 'assistant',
                            content: '',
                            _streamingText: '',
                            mediaBlocks: [],
                            timestamp: new Date()
                          };
                          newHistory.push(newAssistantMsg);
                          lastMsg = newAssistantMsg;
                          console.log('✅ Created new assistant message (tool call starting)');
                        }
                        
                        if (!lastMsg.mediaBlocks) {
                          lastMsg.mediaBlocks = [];
                        }
                        
                        // CRITICAL: Create a text block for any text that came BEFORE this tool
                        // This ensures proper ordering: text → tool → text → tool
                        const currentText = lastMsg._streamingText || lastMsg.content || '';
                        const lastProcessedLength = lastMsg.processedTextLength || 0;
                        
                        console.log('🔧 tool-call-start: Text segmentation:', {
                          currentTextLength: currentText.length,
                          lastProcessedLength: lastProcessedLength,
                          hasNewText: currentText.length > lastProcessedLength,
                          newTextPreview: currentText.substring(lastProcessedLength, lastProcessedLength + 100)
                        });
                        
                        // If there's new text since the last tool (or since start), create a text block
                        if (currentText.length > lastProcessedLength) {
                          const textSegment = currentText.substring(lastProcessedLength);
                          
                          // Only create text block if there's actual content (not just whitespace)
                          if (textSegment.trim()) {
                            const textBlock = {
                              id: `text_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
                              type: 'text',
                              data: {
                                text: textSegment.trim()
                              },
                              timestamp: new Date(),
                              _textPosition: lastProcessedLength // Track where this text started
                            };
                            
                            lastMsg.mediaBlocks.push(textBlock);
                            console.log('📝 Created text block before tool:', {
                              textLength: textSegment.trim().length,
                              textPreview: textSegment.trim().substring(0, 50),
                              position: lastProcessedLength
                            });
                          }
                          
                          // Update processed length to current position
                          lastMsg.processedTextLength = currentText.length;
                        }
                        
                        // Get user-friendly action message
                        const actionMessage = getToolActionMessage(data.toolName || '');
                        
                        // CRITICAL FIX: Mark that a tool call is pending
                        // Don't add the loading block yet - wait for the next render cycle
                        // This ensures introText is set and rendered BEFORE the loading block appears
                        lastMsg._pendingToolCall = {
                          id: data.toolCallId,
                          toolName: data.toolName,
                          actionMessage: actionMessage,
                          timestamp: Date.now()
                        };
                        
                        console.log('🔧 Marked pending tool call, will add loading block on next update');
                        
                        return newHistory;
                      }, messageSentInSessionId);
                      
                      // Add the loading block in a separate state update after a microtask
                      // This ensures the introText is rendered first
                      setTimeout(() => {
                        updateChatHistory(prev => {
                          const newHistory = [...prev];
                          const lastMsg = newHistory[newHistory.length - 1];
                          
                          if (lastMsg && lastMsg.role === 'assistant' && lastMsg._pendingToolCall) {
                            const pendingInfo = lastMsg._pendingToolCall;
                            
                            // CRITICAL: Check if we already have a pending block for this tool call ID
                            // This prevents duplicate loading blocks from appearing
                            const existingPendingBlock = lastMsg.mediaBlocks?.find(
                              block => block._pendingToolCallId === pendingInfo.id
                            );
                            
                            if (existingPendingBlock) {
                              console.log('⚠️ Skipping duplicate pending block for tool call:', pendingInfo.id);
                              delete lastMsg._pendingToolCall;
                              return newHistory;
                            }
                            
                            // Now add the loading block
                            const pendingBlock = {
                              id: `desktop_tool_pending_${Date.now()}_${Math.random()}`,
                              type: 'desktop-tool',
                              data: {
                                toolName: pendingInfo.toolName || 'Loading...',
                                args: {},
                                output: pendingInfo.actionMessage + '...', // Show friendly action message as output
                                status: 'pending',
                                duration: null
                              },
                              timestamp: new Date(),
                              _pendingToolCallId: pendingInfo.id // Mark this as pending so we can update it later
                            };
                            
                            console.log('🔧 Creating pending block with toolCallId:', {
                              toolCallId: pendingInfo.id,
                              toolCallIdType: typeof pendingInfo.id,
                              toolName: pendingInfo.toolName,
                              actionMessage: pendingInfo.actionMessage
                            });
                            
                            if (!lastMsg.mediaBlocks) {
                              lastMsg.mediaBlocks = [];
                            }
                            lastMsg.mediaBlocks.push(pendingBlock);
                            
                            // Clean up the pending marker
                            delete lastMsg._pendingToolCall;
                            
                            console.log('🔧 Added loading block after introText was set:', pendingInfo.actionMessage);
                          }
                          
                          return newHistory;
                        }, messageSentInSessionId);
                      }, 0); // Use setTimeout with 0 to defer to next event loop tick
                    }
                    
                    // Handle tool call update events (tool name updates)
                    else if (data.type === 'tool-call-update') {
                      console.log('🔧 Frontend received tool-call-update:', data);
                      
                      // Update the tool name in the pending block
                      updateChatHistory(prev => {
                        const newHistory = [...prev];
                        const lastMsg = newHistory[newHistory.length - 1];
                        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.mediaBlocks) {
                          // Find the most recent desktop-tool block that's still pending
                          for (let i = lastMsg.mediaBlocks.length - 1; i >= 0; i--) {
                            const block = lastMsg.mediaBlocks[i];
                            if (block.type === 'desktop-tool' && block.data.status === 'pending') {
                              // Update the tool name
                              lastMsg.mediaBlocks[i] = {
                                ...block,
                                data: {
                                  ...block.data,
                                  toolName: data.toolName
                                }
                              };
                              console.log('🔧 Updated tool name to:', data.toolName);
                              break;
                            }
                          }
                        }
                        return newHistory;
                      }, messageSentInSessionId);
                    }
                    
                    // Handle screenshot data events
                    else if (data.type === 'screenshot-data') {
                      console.log('📸 Frontend received screenshot-data:', {
                        screenshotId: data.screenshotId,
                        hasImageData: data.hasImageData,
                        hasScreenData: data.hasScreenData,
                        imageDataLength: data.imageDataLength,
                        timestamp: data.timestamp
                      });
                      
                      // Fetch the full screenshot data from the cache endpoint
                      if (data.screenshotId) {
                        console.log(`📸 Fetching full screenshot data for ID: ${data.screenshotId}`);
                        
                        fetch(`${backendUrl}/api/screenshot-cache/${data.screenshotId}`)
                          .then(response => response.json())
                          .then(result => {
                            if (result.success) {
                              console.log(`📸 Received full screenshot data (${result.imageData?.length || 0} chars)`);
                              
                              // Find the most recent desktop-tool block and replace output with imageData
                              updateChatHistory(prev => {
                                const newHistory = [...prev];
                                const lastMsg = newHistory[newHistory.length - 1];
                                if (lastMsg && lastMsg.role === 'assistant' && lastMsg.mediaBlocks) {
                                  console.log('📸 Looking for desktop-tool block to update, mediaBlocks count:', lastMsg.mediaBlocks.length);
                                  
                                  // Find the LAST screenshot block (most recent) by searching backwards
                                  let lastScreenshotIndex = -1;
                                  for (let i = lastMsg.mediaBlocks.length - 1; i >= 0; i--) {
                                    const block = lastMsg.mediaBlocks[i];
                                    if (block.type === 'desktop-tool' && 
                                        (block.data.toolName?.includes('screenshot') || block.data.toolName?.includes('see_screen')) &&
                                        !block.data.output?.startsWith('iVBORw0KGgo')) { // Only update if it doesn't already have image data
                                      lastScreenshotIndex = i;
                                      break;
                                    }
                                  }
                                  
                                  if (lastScreenshotIndex !== -1) {
                                    // Create a new mediaBlocks array with the updated block
                                    lastMsg.mediaBlocks = lastMsg.mediaBlocks.map((block, i) => {
                                      if (i === lastScreenshotIndex) {
                                        console.log('📸 Found matching block at index', i, ':', {
                                          toolName: block.data.toolName,
                                          imageDataLength: result.imageData?.length || 0,
                                          oldOutputLength: block.data.output?.length || 0
                                        });
                                        // Create a completely new block object to trigger React re-render
                                        return {
                                          ...block,
                                          data: {
                                            ...block.data,
                                            output: result.imageData,
                                            imageData: result.imageData,
                                            screenData: result.screenData
                                          }
                                        };
                                      }
                                      return block;
                                    });
                                    console.log('📸 Successfully updated desktop-tool block with imageData');
                                  } else {
                                    console.warn('⚠️  No matching desktop-tool block found to update');
                                  }
                                }
                                return newHistory;
                              }, messageSentInSessionId);
                            } else {
                              console.error('❌ Failed to fetch screenshot data:', result.error);
                            }
                          })
                          .catch(error => {
                            console.error('❌ Error fetching screenshot data:', error);
                          });
                      }
                    }
                    
                    // Handle media block events
                    else if (data.type === 'media-block') {
                      console.log('📦 Frontend received media-block:', data.mediaType, data.data);
                      
                      const mediaBlock = {
                        id: `media_${Date.now()}_${Math.random()}`,
                        type: data.mediaType,
                        data: data.data,
                        timestamp: new Date()
                      };
                      
                      // Add media block to the current assistant message
                      updateChatHistory(prev => {
                        const newHistory = [...prev];
                        const lastMsg = newHistory[newHistory.length - 1];
                        if (lastMsg && lastMsg.role === 'assistant') {
                          if (!lastMsg.mediaBlocks) {
                            lastMsg.mediaBlocks = [];
                          }
                          
                          // Check for duplicates (same command within last 100ms)
                          const now = Date.now();
                          const isDuplicate = data.mediaType === 'command' && lastMsg.mediaBlocks.some(
                            block => {
                              if (block.type !== 'command') return false;
                              const timeDiff = now - (block.timestamp?.getTime() || 0);
                              const sameCommand = block.data.command === data.data.command;
                              const recent = timeDiff < 100; // Within 100ms
                              return sameCommand && recent;
                            }
                          );
                          
                          if (!isDuplicate) {
                            lastMsg.mediaBlocks.push(mediaBlock);
                            console.log('📦 Added media block to existing message. Total blocks:', lastMsg.mediaBlocks.length);
                          } else {
                            console.log('⚠️ Skipped duplicate media block (same command within 100ms)');
                          }
                        } else {
                          // Create new assistant message with media block
                          newHistory.push({
                            role: 'assistant',
                            content: assistantMessage,
                            timestamp: new Date(),
                            mediaBlocks: [mediaBlock]
                          });
                          console.log('📦 Created new message with media block');
                        }
                        return newHistory;
                      }, messageSentInSessionId);
                    }
                  } catch (parseErr) {
                    // Ignore parse errors for partial chunks
                    console.debug('Parse error (expected for partial chunks):', parseErr);
                  }
                }
              }
            }
          } catch (streamErr) {
            console.error(`❌ Stream reading error for session ${messageSentInSessionId}:`, streamErr);
            console.error('   Error name:', streamErr instanceof Error ? streamErr.name : 'Unknown');
            console.error('   Error message:', streamErr instanceof Error ? streamErr.message : String(streamErr));
            
            // Check if this was an abort
            if (streamErr instanceof Error && streamErr.name === 'AbortError') {
              console.log('🛑 Stream was aborted by user');
            } else {
              console.error('⚠️ Stream interrupted unexpectedly - this may indicate a connection issue');
              const streamingState = streamingSessionsRef.current.get(messageSentInSessionId);
              if (streamingState) {
                const timeSinceLastActivity = Date.now() - streamingState.lastActivity;
                console.error(`   Last activity was ${Math.round(timeSinceLastActivity / 1000)}s ago`);
                console.error(`   This suggests the connection may have timed out or been closed by the server`);
              }
            }
            
            streamError = true;
            
            // If we got partial content, show it with error indicator
            if (assistantMessage) {
              assistantMessage += '\n\n⚠️ Stream interrupted. Response may be incomplete.';
              updateChatHistory(prev => {
                const newHistory = [...prev];
                const lastMsg = newHistory[newHistory.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                  lastMsg.content = assistantMessage;
                }
                return newHistory;
              }, messageSentInSessionId);
            } else {
              // Re-throw the original error if it has a message, otherwise use generic message
              const errorMessage = streamErr instanceof Error && streamErr.message 
                ? streamErr.message 
                : 'Stream interrupted before receiving response';
              throw new Error(errorMessage);
            }
          }
        }

        // Ensure we have a final message in history
        if (assistantMessage && !streamError) {
          updateChatHistory(prev => {
            const newHistory = [...prev];
            const lastMsg = newHistory[newHistory.length - 1];
            if (!lastMsg || lastMsg.role !== 'assistant') {
              newHistory.push({
                role: 'assistant',
                content: assistantMessage || 'No response received',
                timestamp: new Date()
              }, messageSentInSessionId);
            }
            return newHistory;
          }, messageSentInSessionId);
        }

        // Show warning if stream was interrupted but we got partial content
        if (streamError && assistantMessage) {
          addToast({
            id: `toast_${Date.now()}`,
            type: 'warning',
            message: 'Response may be incomplete due to connection issue',
            duration: 5000
          });
        }
      } catch (error: any) {
        console.error('Error sending message:', error);
        if (activeSessionId) {
          updateSessionStreamingStatus(activeSessionId, 'error');
          removeStreamingSession(activeSessionId); // Remove from streaming set on error
        }
        
        // Determine error type and show appropriate message
        let errorMessage = 'Failed to send message';
        let isRetryable = false;

        if (error.name === 'AbortError') {
          errorMessage = 'Request timed out or was stopped. Try again or check if the backend is running.';
          isRetryable = true;
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          errorMessage = 'Network error. Please check your connection.';
          isRetryable = true;
        } else if (error.message.includes('Server error: 5')) {
          errorMessage = 'Server error. Please try again in a moment.';
          isRetryable = true;
        } else if (error.message) {
          errorMessage = error.message;
        }

        // Add error message to chat history
        const errorChatMessage: ChatMessage = {
          role: 'assistant',
          content: `❌ ${errorMessage}`,
          timestamp: new Date()
        };
        
        setChatHistory(prev => [...prev, errorChatMessage]);

        // Show toast with retry option for transient errors
        addToast({
          id: `toast_${Date.now()}`,
          type: 'error',
          message: errorMessage + (isRetryable ? ' Click to retry.' : ''),
          duration: isRetryable ? 10000 : 5000
        });

        // Log detailed error for debugging
        console.error('Detailed error info:', {
          error,
          message: userMessage,
          model: selectedModel,
          historyLength: chatHistory.length,
          timestamp: new Date().toISOString()
        });
      } finally {
        if (messageSentInSessionId) {
          setSessionLoading(messageSentInSessionId, false);
        }
        
        // Save final chatHistory to the streaming session and clean up
        if (messageSentInSessionId) {
          const streamingState = streamingSessionsRef.current.get(messageSentInSessionId);
          if (streamingState) {
            updateSessionStreamingStatus(messageSentInSessionId, 'ready');
            removeStreamingSession(messageSentInSessionId); // Remove from streaming set
            
            // Clear keepalive timer
            if (streamingState.keepaliveTimer) {
              clearTimeout(streamingState.keepaliveTimer);
              streamingState.keepaliveTimer = null;
              console.log(`✅ Cleared keepalive timer for session ${messageSentInSessionId}`);
            }
            
            // Save the final chatHistory to the session
            setSessions(prev => prev.map(s =>
              s.id === messageSentInSessionId
                ? { ...s, chatHistory: streamingState.chatHistory, lastActive: new Date() }
                : s
            ));
            
            // Clean up streaming state for this session
            streamingSessionsRef.current.delete(messageSentInSessionId);
          }
        }
        
        // Clean up per-session abort controller
        if (messageSentInSessionId) {
          const streamingState = streamingSessionsRef.current.get(messageSentInSessionId);
          if (streamingState) {
            streamingState.abortController = null;
          }
          isSendingMessageMap.current.set(messageSentInSessionId, false); // Reset flag when done
        }
      }
    }
  };

  // Fallback function for non-streaming chat
  const fallbackToNonStreaming = async (userMessage: string, truncatedHistory: ChatMessage[]) => {
    try {
      const backendUrl = typeof window !== 'undefined'
        ? window.location.protocol + '//' + window.location.hostname + ':3003'
        : 'http://localhost:3003';

      // Get active session to include project context
      const activeSession = sessions.find(s => s.id === activeSessionId);
      
      const response = await fetch(`${backendUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          history: truncatedHistory,  // Use truncated history
          model: selectedModel,
          mode: mode,
          sessionId: activeSessionId,
          projectId: activeSession?.projectId || activeProjectId
        })
      });

      if (response.ok) {
        const data = await response.json();
        const result = data.response || 'No response';
        const commandOutputs = data.commandOutputs || [];

        console.log('✅ Response from AI:', result);
        if (commandOutputs.length > 0) {
          console.log(`🔧 ${commandOutputs.length} command(s) executed`);
        }

        // Simulate streaming by progressively revealing the text
        const assistantMessage = {
          role: 'assistant' as const,
          content: '',
          commandOutputs: commandOutputs.length > 0 ? commandOutputs : undefined
        };

        // Add empty message first
        setChatHistory(prev => [...prev, assistantMessage]);

        // Progressively reveal text character by character
        const words = result.split(' ');
        let currentText = '';
        
        for (let i = 0; i < words.length; i++) {
          currentText += (i > 0 ? ' ' : '') + words[i];
          
          updateChatHistory(prev => {
            const newHistory = [...prev];
            newHistory[newHistory.length - 1] = {
              ...newHistory[newHistory.length - 1],
              content: currentText
            };
            return newHistory;
          }, messageSentInSessionId, messageSentInSessionId);
          
          // Delay between words for streaming effect (faster for better UX)
          await new Promise(resolve => setTimeout(resolve, 30));
        }

        // Update active session's chat history with final content
        if (activeSessionId) {
          setSessions(prev => prev.map(s =>
            s.id === activeSessionId
              ? { ...s, chatHistory: [...s.chatHistory, { ...assistantMessage, content: result }], lastActive: new Date() }
              : s
          ))
        }
      } else if (response.status === 413) {
        // Handle 413 Payload Too Large error - create new session automatically
        console.warn('⚠️ 413 Payload Too Large error - creating new session automatically');

        try {
          const errorData = await response.json();
          
          if (errorData.createNewSession) {
            // Create a new session automatically
            const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const newSession = {
              id: newSessionId,
              name: `Session ${sessions.length + 1}`,
              chatHistory: [],
              createdAt: new Date(),
              lastActive: new Date()
            };

            // Add the new session and switch to it
            setSessions(prev => [...prev, newSession]);
            setActiveSessionId(newSessionId);

            // Clear current chat history
            setChatHistory([]);

            // Show notification
            addToast({
              id: `toast_${Date.now()}`,
              type: 'info',
              message: 'Session history too large. Created new session and continuing...',
              duration: 5000
            });

            // Wait a bit for state to update, then resend the message
            setTimeout(() => {
              console.log('🔄 Resending message in new session:', newSessionId);
              // The message will be sent automatically since we're in the sendMessage function
              // Just need to trigger it with the new session
              sendMessage(userMessage);
            }, 100);

            return; // Exit current execution
          }
        } catch (retryError) {
          console.error('❌ Failed to create new session:', retryError);
        }

        // Fallback error message
        addToast({
          id: `toast_${Date.now()}`,
          type: 'error',
          message: 'Session too large. Please create a new session manually.',
          duration: 5000
        });
      } else {
        // Try to parse error response as JSON, but handle HTML responses
        let errorMessage = response.statusText;
        let errorDetails = '';
        
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || response.statusText;
            errorDetails = errorData.details || '';
          } else {
            // Backend returned HTML or other non-JSON response
            const textResponse = await response.text();
            if (textResponse.includes('<!DOCTYPE') || textResponse.includes('<html')) {
              errorMessage = `Backend returned HTML error page (Status: ${response.status})`;
              errorDetails = 'The backend may have crashed or encountered an error. Check backend logs.';
            } else {
              errorMessage = textResponse.substring(0, 200); // First 200 chars
            }
          }
        } catch (parseError) {
          errorMessage = `Failed to parse error response (Status: ${response.status})`;
          errorDetails = parseError instanceof Error ? parseError.message : 'Unknown parse error';
        }

        const timestamp = new Date().toISOString();
        console.error(`❌ [${timestamp}] Backend error:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorMessage,
          details: errorDetails
        });

        // Add error message to chat history
        const fullErrorMessage = errorDetails 
          ? `❌ Error: ${errorMessage}\n\n${errorDetails}`
          : `❌ Error: ${errorMessage}`;
          
        setChatHistory(prev => [...prev, { role: 'assistant', content: fullErrorMessage }]);

        // Update active session's chat history
        if (activeSessionId) {
          setSessions(prev => prev.map(s =>
            s.id === activeSessionId
              ? { ...s, chatHistory: [...s.chatHistory, { role: 'assistant', content: fullErrorMessage }], lastActive: new Date() }
              : s
          ))
        }
      }
    } catch (error) {
      const timestamp = new Date().toISOString();
      console.error(`❌ [${timestamp}] Network/fetch error:`, {
        error: error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // CRITICAL: Clean up streaming state on network error
      if (messageSentInSessionId) {
        console.log(`🛑 Cleaning up streaming state for session ${messageSentInSessionId} due to network error`);
        console.log(`   Current streaming sessions:`, Array.from(streamingSessionIds));
        console.log(`   Is session streaming?`, streamingSessionIds.has(messageSentInSessionId));
        
        // Abort any active controller FIRST
        const streamingState = streamingSessionsRef.current.get(messageSentInSessionId);
        if (streamingState) {
          if (streamingState.abortController) {
            try {
              streamingState.abortController.abort();
              console.log(`✅ Aborted controller for session ${messageSentInSessionId}`);
            } catch (abortError) {
              console.error(`❌ Error aborting controller:`, abortError);
            }
          }
          
          // Clear keepalive timer
          if (streamingState.keepaliveTimer) {
            clearTimeout(streamingState.keepaliveTimer);
            console.log(`✅ Cleared keepalive timer for session ${messageSentInSessionId}`);
          }
          
          // Remove from streaming state map
          streamingSessionsRef.current.delete(messageSentInSessionId);
          console.log(`✅ Removed streaming state for session ${messageSentInSessionId}`);
        }
        
        // Remove from streaming sessions set - this triggers UI update
        removeStreamingSession(messageSentInSessionId);
        console.log(`✅ Called removeStreamingSession for ${messageSentInSessionId}`);
        
        // Update session status to ready - this also triggers UI update
        updateSessionStreamingStatus(messageSentInSessionId, 'ready');
        console.log(`✅ Called updateSessionStreamingStatus to 'ready' for ${messageSentInSessionId}`);
        
        // Force session loading to false
        setSessionLoading(messageSentInSessionId, false);
        console.log(`✅ Set session loading to false for ${messageSentInSessionId}`);
      }

      // Provide user-friendly error message
      let errorMsg = 'Unable to connect to the backend server';
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED')) {
          errorMsg = 'Backend server is not running. Please start the backend server on port 3002.';
        } else {
          errorMsg = error.message;
        }
      }

      // Add error to chat history
      setChatHistory(prev => [...prev, { role: 'assistant', content: `❌ Connection Error: ${errorMsg}` }]);

      // Update active session's chat history
      if (activeSessionId) {
        setSessions(prev => prev.map(s =>
          s.id === activeSessionId
            ? { ...s, chatHistory: [...s.chatHistory, { role: 'assistant', content: `❌ Connection Error: ${errorMsg}` }], lastActive: new Date() }
            : s
        ))
      }

      // Show toast notification
      addToast({
        id: `toast_${Date.now()}`,
        type: 'error',
        message: 'A network error occurred. Please try again.',
        duration: 5000
      })
    } finally {
      // CRITICAL: Always clean up using messageSentInSessionId (the session that was streaming)
      if (messageSentInSessionId) {
        console.log(`🛑 Finally block: cleaning up session ${messageSentInSessionId}`);
        setSessionLoading(messageSentInSessionId, false);
        
        // Ensure streaming state is removed (in case catch block didn't run)
        removeStreamingSession(messageSentInSessionId);
        updateSessionStreamingStatus(messageSentInSessionId, 'ready');
        
        // Clean up streaming state ref
        const streamingState = streamingSessionsRef.current.get(messageSentInSessionId);
        if (streamingState) {
          if (streamingState.keepaliveTimer) {
            clearTimeout(streamingState.keepaliveTimer);
          }
          streamingSessionsRef.current.delete(messageSentInSessionId);
        }
        
        console.log(`✅ Finally block: completed cleanup for ${messageSentInSessionId}`);
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleInputInteraction = () => {
    setLastInteractionTime(Date.now())
  }

  const [terminalRefreshKey, setTerminalRefreshKey] = useState(0)
  
  const handleTabSwitch = (tab: 'terminal' | 'desktop') => {
    console.log(`🔄 Switching to ${tab} mode`);
    
    // If switching from desktop to terminal, refresh the terminal iframe
    if (activeTab === 'desktop' && tab === 'terminal') {
      console.log('🔄 Refreshing terminal iframe after desktop was active')
      setTerminalRefreshKey(prev => prev + 1)
    }
    
    setActiveTab(tab)
    setMode(tab)
    
    console.log(`✅ Mode updated to: ${tab}`);
  }

  const handleFileAttachment = () => {
    fileInputRef.current?.click()
  }
  
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
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])
  
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
  }, [])
  
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
  }, [])

  const handleAudioInput = async () => {
    if (isRecording) {
      // Stop recording and transcription
      setIsRecording(false)
      
      // Stop audio visualization
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
      
      // Stop media recorder
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop()
      }
    } else {
      // Start recording with real-time transcription
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        
        // Start audio visualization
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
        
        // Start speech recognition for real-time transcription
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (SpeechRecognition) {
          const recognition = new SpeechRecognition()
          recognition.continuous = true
          recognition.interimResults = true
          
          // Start with browser language, but we'll dynamically switch if needed
          // Using a broad set of common languages increases recognition accuracy
          recognition.lang = navigator.language || 'en-US'
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
              setMessage(prev => {
                const newMessage = prev + final
                // Move cursor to end and scroll to bottom after state update
                setTimeout(() => {
                  if (textareaRef.current) {
                    const length = newMessage.length
                    textareaRef.current.setSelectionRange(length, length)
                    textareaRef.current.scrollTop = textareaRef.current.scrollHeight
                    textareaRef.current.focus()
                  }
                }, 0)
                return newMessage
              })
              setInterimTranscript('')
            } else {
              // Show interim transcript
              setInterimTranscript(interim)
              // Move cursor to end and scroll to bottom for interim text too
              setTimeout(() => {
                if (textareaRef.current) {
                  const length = textareaRef.current.value.length
                  textareaRef.current.setSelectionRange(length, length)
                  textareaRef.current.scrollTop = textareaRef.current.scrollHeight
                  textareaRef.current.focus()
                }
              }, 0)
            }
          }
          
          recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error)
            // Don't stop on temporary errors
            if (event.error === 'aborted' || event.error === 'not-allowed') {
              if (recognitionRef.current) {
                recognitionRef.current.stop()
                recognitionRef.current = null
              }
              addToast({
                id: `toast_${Date.now()}`,
                type: 'error',
                message: 'Speech recognition error. Please try again.',
                duration: 3000
              })
            }
          }
          
          recognition.onend = () => {
            // Auto-restart if still recording
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
          addToast({
            id: `toast_${Date.now()}`,
            type: 'warning',
            message: 'Speech recognition not supported in this browser',
            duration: 4000
          })
        }
        
        // Start media recorder
        const recorder = new MediaRecorder(stream)
        const chunks: Blob[] = []

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data)
          }
        }

        recorder.onstop = () => {
          // Stop all tracks
          stream.getTracks().forEach(track => track.stop())
        }

        recorder.start()
        setMediaRecorder(recorder)
        setIsRecording(true)
        setAudioChunks([])

        addToast({
          id: `toast_${Date.now()}`,
          type: 'info',
          message: 'Recording... Speak now',
          duration: 2000
        })
      } catch (error) {
        console.error('Microphone access error:', error)
        addToast({
          id: `toast_${Date.now()}`,
          type: 'error',
          message: 'Microphone access denied. Please enable microphone permissions.',
          duration: 5000
        })
      }
    }
  }

  // Create default project with current sessions
  const defaultProject = {
    id: 'default-project',
    name: 'Default Project',
    description: 'Default Kali Linux environment',
    color: '#3b82f6',
    containerId: 'kali-pentest',
    containerName: 'kali-pentest',
    terminalPid: 0,
    tmuxSessionName: 'default',
    workingDirectory: '/root',
    sessionIds: sessions.filter(s => s && s.id).map(s => s.id),
    createdAt: new Date(),
    lastActive: new Date(),
    isRunning: true
  }

  // Add projectId to sessions
  const sessionsWithProject = sessions.filter(s => s && s.id).map(s => ({
    ...s,
    projectId: 'default-project'
  }))

  return (
    <SidebarProvider defaultOpen={false} className="animate-fadeIn">
      {/* Keycloak OAuth Callback Handler */}
      <KeycloakCallbackHandler />
      
      {/* Full-Screen Settings Overlay - Stays mounted for instant show/hide */}
      <div 
        className={`fixed inset-0 z-[10000] bg-[#0a0a0a] transition-all duration-300 ${
          showSettings ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex flex-col h-screen">
          {/* Settings Header */}
          <div className="sticky top-0 z-50 flex items-center gap-4 px-6 py-4 border-b border-zinc-800 bg-[#0a0a0a]">
            <button
              onClick={() => {
                setShowSettings(false);
                // Trigger page refresh to reload data
                if (user?.id) {
                  loadProjects(user.id, true);
                  loadCollaborations(user.id, true);
                  if (activeProjectId) {
                    fetchProjectCollaborators(activeProjectId);
                  }
                }
              }}
              className="flex items-center gap-2 text-zinc-400 hover:text-white transition-all duration-200 hover:scale-105"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold ml-4">Settings</h1>
          </div>

          {/* Settings Content */}
          <div className="flex flex-1 overflow-hidden" style={{ flexDirection: sidebarPosition === 'left' ? 'row' : 'row-reverse' }}>
            <SettingsNav
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              user={user ? {
                name: user.name || user.email?.split('@')[0] || 'User',
                email: user.email || '',
                avatar: user.picture
              } : undefined}
            />
            {/* Debug: Log user data - DISABLED */}
            {/* {user && console.log('🔍 Settings user data:', { ... })} */}

            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 px-8 py-8 overflow-y-auto">
                {showSettings && renderSettingsContent()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-Screen Drag and Drop Overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 bg-slate-900/95 border-4 border-blue-500 border-dashed flex items-center justify-center backdrop-blur-sm pointer-events-none" style={{ zIndex: 999999 }}>
          <div className="bg-slate-800 px-12 py-8 rounded-2xl border-2 border-blue-500 shadow-2xl">
            <div className="flex flex-col items-center gap-4">
              <svg className="w-32 h-32 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <div className="text-center">
                <div className="text-2xl font-bold text-white mb-2">Drop files anywhere to attach</div>
                <div className="text-base text-gray-300">Images, videos, text files, and more</div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Fixed Sign In Button - Only visible when NOT signed in */}
      {!user && (
        <div className="fixed top-4 right-4 z-50">
          <SignInButton user={user} onSignOut={() => {}} />
        </div>
      )}
      
      <div className="flex flex-row h-screen overflow-hidden w-full" style={{ flexDirection: sidebarPosition === 'left' ? 'row' : 'row-reverse', margin: 0, padding: 0 }}>
        <AppSidebar
          sessions={sessions}
          projects={projects}
          collaborations={collaborations}
          activeSessionId={activeSessionId}
          activeProjectId={activeProjectId}
          onSessionSelect={switchToSession}
          onProjectSelect={handleProjectSelect}
          onNewSession={() => {
            // Smart session creation: use active project if available
            if (activeProjectId && activeProjectId !== 'default-project') {
              handleNewSessionForProject(activeProjectId)
            } else if (projects.length > 0) {
              // If no active project but projects exist, use the first project
              handleNewSessionForProject(projects[0].id)
            } else {
              // Fallback to default project session
              createNewSession().catch(error => console.error('Failed to create session:', error))
            }
          }}
          onNewSessionForProject={handleNewSessionForProject}
          onNewProject={() => {
            if (!user) {
              addToast({ 
                id: Date.now().toString(), 
                type: 'info', 
                message: 'Please sign in to create projects', 
                duration: 3000 
              })
              // Redirect to sign-in page after a short delay
              setTimeout(() => {
                router.push('/auth/signin')
              }, 500)
              return
            }
            // Clear any existing creation progress before opening modal
            console.log('🆕 Opening new project modal, clearing creationProgress')
            setCreationProgress(null)
            maxProgressRef.current = 0
            setShowProjectModal(true)
          }}
          onShareProject={(id) => {
            setSelectedProjectId(id)
            setShowShareModal(true)
          }}
          onAddCollaboration={() => setShowJoinModal(true)}
          onLeaveCollaboration={(id) => {
            const collab = collaborations.find(c => c.projectId === id)
            if (collab) {
              setCollaborationToLeave({ id: collab.projectId, name: collab.project.name })
              setShowLeaveModal(true)
            }
          }}
          onRenameProject={renameProject}
          onDeleteProject={deleteProject}
          onSearch={handleSearch}
          onSettings={() => setShowSettings(true)}
          onShowCreationProgress={() => setShowProjectModal(true)}
          onSignOut={async () => {
            try {
              await keycloakAuth.signOut()
              // Clear localStorage to remove cached settings
              localStorage.clear()
              // Clear all state
              setProjects([])
              setCollaborations([])
              setSessions([])
              setActiveProjectId(null)
              setActiveSessionId(null)
              setUser(null)
              setAvailableModels([])
              setSelectedModel('')
              // Reload page to reset all state and go to initial page
              window.location.href = '/'
            } catch (error) {
              console.error('Sign out error:', error)
              addToast({ id: Date.now().toString(), type: 'error', message: 'Failed to sign out', duration: 3000 })
            }
          }}
          currentUser={user ? {
            name: user.name || user.email?.split('@')[0] || 'User',
            email: user.email || '',
            avatar: user.picture
          } : undefined}
        />
        {/* Debug: Log user data for sidebar - DISABLED */}
        {/* {user && console.log('🔍 Sidebar user data:', { ... })} */}
        <SidebarInset className="flex-1 flex h-screen overflow-hidden !m-0 !p-0 !rounded-none !ml-0 !mr-0 !mt-0 !mb-0" style={{ flexDirection: chatPosition === 'left' ? 'row-reverse' : 'row', margin: 0, padding: 0 }}>
        {/* Main Content Area - Terminal/Desktop - Always takes remaining space */}
        {showTerminalArea && (
        <div
          className="relative overflow-hidden transition-all duration-300 flex flex-col rounded-lg m-1"
          style={{
            opacity: chatSidebarOpen ? 1 : fadeInOpacity,
            transition: chatSidebarOpen ? 'none' : 'opacity 1s ease-in-out',
            backgroundColor: chatSidebarOpen ? '#101218' : 'transparent',
            flex: '1 1 0',
            minWidth: 0
          }}
        >
          {chatSidebarOpen ? (
            // KALI LINUX TERMINAL + DESKTOP DISPLAY
            <div className="w-full h-full flex flex-col" style={{ backgroundColor: '#101218' }}>
            {/* Tab Buttons */}
            <div 
              className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-[#2d2d2d]" 
              style={{ 
                backgroundColor: '#101218',
                flexDirection: chatPosition === 'left' ? 'row-reverse' : 'row'
              }}
            >
              {/* Terminal and Desktop Tabs - moved to left */}
              <div className="flex gap-0.5">
                {/* All projects: Terminal, Desktop */}
                <button
                  onClick={() => handleTabSwitch('terminal')}
                  className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-sm transition-all ${activeTab === 'terminal'
                    ? 'bg-[#2d2d2d] text-gray-200'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#2d2d2d]'
                    }`}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="stroke-[2]">
                    <path d="M4 17L10 11L4 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 19H20" stroke="currentColor" strokeLinecap="round" />
                  </svg>
                  Terminal
                </button>
                <button
                  onClick={() => handleTabSwitch('desktop')}
                  className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-sm transition-all ${activeTab === 'desktop'
                    ? 'bg-[#2d2d2d] text-gray-200'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#2d2d2d]'
                    }`}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="stroke-[2]">
                    <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" />
                    <path d="M8 21H16" stroke="currentColor" strokeLinecap="round" />
                    <path d="M12 17V21" stroke="currentColor" strokeLinecap="round" />
                  </svg>
                  Desktop
                </button>
              </div>

              {/* Collaborators button - only when chat is on LEFT */}
              {activeProject && activeProjectId && chatPosition === 'left' && (
                <button
                  onClick={() => setShowCollaboratorsSidebar(!showCollaboratorsSidebar)}
                  className="flex items-center gap-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2d2d2d] px-2 py-1 rounded-sm transition-colors"
                  aria-label="Collaborators"
                  title="Collaborators"
                >
                  <UsersIcon className="w-3.5 h-3.5" />
                  <span className="text-xs">{projectCollaborators.length}</span>
                </button>
              )}

              {/* Toggle Buttons */}
              <div className={`flex gap-0.5 ${chatPosition === 'left' ? 'flex-row-reverse' : ''}`}>
                {/* Fullscreen button - positioned based on chat position */}
                {activeTab === 'desktop' && (
                  <button
                    onClick={() => {
                      console.log('🖥️ Fullscreen button clicked');
                      // Find the iframe container div
                      const iframeContainer = document.querySelector('iframe[title*="Desktop"]')?.parentElement as HTMLElement;
                      console.log('Found iframe container:', iframeContainer);
                      
                      if (iframeContainer) {
                        if (!document.fullscreenElement) {
                          console.log('Entering fullscreen...');
                          iframeContainer.requestFullscreen().catch(err => {
                            console.error('Error entering fullscreen:', err);
                          });
                        } else {
                          console.log('Exiting fullscreen...');
                          document.exitFullscreen();
                        }
                      } else {
                        console.error('Could not find iframe container');
                      }
                    }}
                    className="p-1 text-gray-400 hover:text-gray-200 hover:bg-[#2d2d2d] rounded-sm transition-colors"
                    title="Toggle fullscreen"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => setShowTerminalArea(!showTerminalArea)}
                  className="p-1 text-gray-400 hover:text-gray-200 hover:bg-[#2d2d2d] rounded-sm transition-colors"
                  title={showTerminalArea ? "Hide terminal" : "Show terminal"}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    {showTerminalArea ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    )}
                  </svg>
                </button>
                <button
                  onClick={() => setShowChatArea(!showChatArea)}
                  className="p-1 text-gray-400 hover:text-gray-200 hover:bg-[#2d2d2d] rounded-sm transition-colors"
                  title={showChatArea ? "Hide chat" : "Show chat"}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div 
              className={`flex-1 overflow-hidden transition-all ${showTerminalArea ? 'flex flex-col' : 'hidden'}`}
              style={{ height: '100%' }}
            >
              {/* Desktop Tab */}
              <div 
                className={`w-full h-full overflow-hidden border-2 border-transparent focus-within:border-blue-500/50 transition-all ${activeTab === 'desktop' ? 'flex' : 'hidden'}`} 
                style={{ backgroundColor: '#101218', minHeight: '300px', display: activeTab === 'desktop' ? 'flex' : 'none', flexDirection: 'column', position: 'relative', flex: 1, zIndex: 5 }}
              >
                {activeProject ? (
                  activeProject.isMock ? (
                    <div className="flex items-center justify-center h-full text-gray-400 bg-[#0a0b0f]">
                      <div className="text-center max-w-md p-8">
                        <div className="mb-4 text-yellow-500">
                          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-lg mb-2 text-white">Mock Project Mode</p>
                        <p className="text-sm mb-4">This project is running in mock mode (Docker not available)</p>
                        <p className="text-xs text-gray-500">Desktop access requires a real Docker container. Start Docker Desktop to create real projects with VNC desktop access.</p>
                      </div>
                    </div>
                  ) : activeProject.novncPort ? (
                    <DesktopIframe project={activeProject} isModalOpen={showProjectModal} isVisible={activeTab === 'desktop'} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 bg-[#0a0b0f]">
                      <div className="text-center max-w-md p-8">
                        <div className="mb-4 text-white">
                          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite reverse' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </div>
                        <p className="text-lg mb-2 text-white">Initializing Desktop</p>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                      <p className="text-lg mb-2">No Active Project</p>
                      <p className="text-sm">Create or select a project to view the desktop</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Terminal Tab */}
              <div 
                className={`w-full h-full overflow-hidden border-2 border-transparent focus-within:border-blue-500/50 transition-all ${activeTab === 'terminal' ? 'flex' : 'hidden'}`} 
                style={{ overflow: 'hidden', backgroundColor: '#101218', minHeight: '300px' }}
              >
                {activeProject ? (
                  activeProject.isMock ? (
                    <div className="flex items-center justify-center h-full text-gray-400 bg-[#0a0b0f]">
                      <div className="text-center max-w-md p-8">
                        <div className="mb-4 text-yellow-500">
                          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <p className="text-lg mb-2 text-white">Mock Project Mode</p>
                        <p className="text-sm mb-4">This project is running in mock mode (Docker not available)</p>
                        <p className="text-xs text-gray-500">Terminal access requires a real Docker container. Start Docker Desktop to create real projects with terminal access.</p>
                      </div>
                    </div>
                  ) : activeProject.terminalPort ? (
                    <AutoRefreshTerminal
                      key={`terminal-${activeProject.id}-${terminalRefreshKey}`}
                      projectId={activeProject.id}
                      projectName={activeProject.name}
                      terminalPort={activeProject.terminalPort}
                      terminalUrl={activeProject.terminalUrl}
                      containerId={activeProject.containerId}
                      operatingSystem={activeProject.operatingSystem}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 bg-[#0a0b0f]">
                      <div className="text-center max-w-md p-8">
                        <div className="mb-4 text-white">
                          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite reverse' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </div>
                        <p className="text-lg mb-2 text-white">Initializing Terminal...</p>
                        <p className="text-sm mb-4">Setting up terminal connection</p>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                      <p className="text-lg mb-2">No Active Project</p>
                      <p className="text-sm">Create or select a project to view the terminal</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            </div>
          ) : (
          // ANIMATIONS AND GLOBE (Before first message)
          <>
            {!chatSidebarOpen && showOrderText && (
              <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50" style={{ transform: `translate(-50%, calc(-50% - 40px))` }}>
                <div className="flex flex-col items-center">
                  <BlurText
                    text="create"
                    delay={100}
                    initialDelay={0}
                    animateBy="words"
                    direction="top"
                    className="text-2xl font-light text-white"
                    animationFrom={textDisappearing ? { filter: "blur(0px)", opacity: 1, y: 0 } : { filter: "blur(10px)", opacity: 0, y: -50 }}
                    animationTo={textDisappearing ? [
                      { filter: "blur(5px)", opacity: 0.5, y: -25 },
                      { filter: "blur(10px)", opacity: 0, y: -50 }
                    ] : [
                      { filter: "blur(5px)", opacity: 0.5, y: -25 },
                      { filter: "blur(0px)", opacity: 1, y: 0 }
                    ]}
                    style={{ marginBottom: '2px' }}
                  />
                  <BlurText
                    text="ORDER"
                    delay={150}
                    initialDelay={0}
                    animateBy="words"
                    direction="top"
                    className="text-9xl font-black text-white"
                    stepDuration={0.5}
                    animationFrom={textDisappearing ? { filter: "blur(0px)", opacity: 1, y: 0 } : { filter: "blur(10px)", opacity: 0, y: -50 }}
                    animationTo={textDisappearing ? [
                      { filter: "blur(5px)", opacity: 0.5, y: -25 },
                      { filter: "blur(10px)", opacity: 0, y: -50 }
                    ] : [
                      { filter: "blur(5px)", opacity: 0.5, y: -25 },
                      { filter: "blur(0px)", opacity: 1, y: 0 }
                    ]}
                  />
                </div>
              </div>
            )}

            {!chatSidebarOpen && (
              <div className="fixed inset-0 z-0 flex items-center justify-center">
                <RotatingEarth width={typeof window !== 'undefined' ? window.innerWidth : 1840} height={typeof window !== 'undefined' ? window.innerHeight : 1080} isRecording={isRecording} />
              </div>
            )}
          </>
          )}
        </div>
        )}

        {/* Chat Sidebar - Fixed width, positioned based on chatPosition */}
        {chatSidebarOpen && showChatArea && (
          <div 
            className="relative h-full transition-all duration-150 ease-out flex flex-col shrink-0" 
            style={{ 
              width: showTerminalArea ? `${chatSidebarWidth}px` : '100%'
            }}
          >
        {/* Resize Handle - Positioned based on chatPosition */}
        <div
          onMouseDown={(e) => {
            setIsResizing(true)
            resizeStartX.current = e.clientX
            resizeStartWidth.current = chatSidebarWidth
          }}
          className={`absolute ${chatPosition === 'left' ? 'right-0' : 'left-0'} top-0 w-6 h-full bg-transparent hover:bg-blue-500/30 transition-all cursor-col-resize group z-50`}
          style={{
            opacity: isResizing ? 1 : 0,
            transitionProperty: 'opacity, background-color',
            transitionDuration: '150ms'
          }}
        >
          <div 
            className={`absolute ${chatPosition === 'left' ? 'right-1/2 translate-x-1/2' : 'left-1/2 -translate-x-1/2'} top-1/2 transform -translate-y-1/2 bg-blue-500 rounded-full w-1.5 h-12 opacity-0 group-hover:opacity-100 transition-opacity duration-150`} 
            style={{ pointerEvents: 'none' }}
          ></div>
        </div>

        {/* Session Manager Bar */}
        <div className="session-manager-bar h-[37px] border-b border-[#2d2d2d] px-2 flex items-center justify-between shrink-0 relative z-40 rounded-t-lg mx-2 mt-1" style={{ backgroundColor: '#101218' }}>
          {/* Left: Toggle Button (fixed) + Project Name + Session Tabs (scrollable) */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Toggle Terminal Button - Shows when terminal is hidden - LEFT of project name when chat is on RIGHT - FIXED */}
            {!showTerminalArea && chatPosition === 'right' && (
              <button
                onClick={() => setShowTerminalArea(true)}
                className="text-gray-400 hover:text-gray-200 hover:bg-[#2d2d2d] p-1 rounded-sm transition-colors shrink-0"
                aria-label="Show terminal"
                title="Show terminal"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            )}
            {/* Scrollable container for Project Name + Session Tabs */}
            <div className="flex items-center gap-2 flex-1 overflow-x-auto sessions-scrollbar-thin">
              {/* Session Tabs */}
              {sessions
                .filter(session => !activeProjectId || session.projectId === activeProjectId)
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                .map(session => (
                <div 
                  key={session.id}
                  onClick={() => session.id !== activeSessionId && switchToSession(session.id)}
                  className={`flex items-center gap-0.5 px-2 py-1 rounded-sm text-xs group transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 relative ${
                    session.id === activeSessionId 
                      ? 'bg-[#2d2d2d] text-gray-300' 
                      : 'bg-transparent text-gray-500 hover:bg-[#1e1e1e] hover:text-gray-400 hover:border-t hover:border-[#2d2d2d] hover:-mt-[1px] hover:z-50'
                  }`}
                >
                  <span className="truncate max-w-[120px]">{session.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      closeSession(session.id)
                    }}
                    className="ml-1 opacity-0 group-hover:opacity-100 hover:bg-[#424242] rounded-sm p-0.5 transition-all"
                    aria-label="Close session"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-0.5 ml-2">
            <button
              onClick={() => {
                if (activeProjectId) {
                  handleNewSessionForProject(activeProjectId)
                } else {
                  createNewSession().catch(error => console.error('Failed to create session:', error))
                }
              }}
              className="text-gray-400 hover:text-gray-200 hover:bg-[#2d2d2d] p-1 rounded-sm transition-colors"
              aria-label="New session"
              title="New session"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setShowSessionDropdown(!showSessionDropdown)
                if (!showSessionDropdown) {
                  fetchDeletedSessions()
                }
              }}
              className="text-gray-400 hover:text-gray-200 hover:bg-[#2d2d2d] p-1 rounded-sm transition-colors"
              aria-label="View sessions"
              title="View sessions"
            >
              <History className="w-3.5 h-3.5" />
            </button>
            {/* Show collaborators button here only when chat is on RIGHT */}
            {activeProjectId && chatPosition === 'right' && (
              <button
                onClick={() => setShowCollaboratorsSidebar(!showCollaboratorsSidebar)}
                className="flex items-center gap-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2d2d2d] px-2 py-1 rounded-sm transition-colors"
                aria-label="Collaborators"
                title="Collaborators"
              >
                <UsersIcon className="w-3.5 h-3.5" />
                <span className="text-xs">{projectCollaborators.length}</span>
              </button>
            )}
            {/* Toggle Terminal Button - Shows when terminal is hidden - RIGHT side when chat is on LEFT */}
            {!showTerminalArea && chatPosition === 'left' && (
              <button
                onClick={() => setShowTerminalArea(true)}
                className="text-gray-400 hover:text-gray-200 hover:bg-[#2d2d2d] p-1 rounded-sm transition-colors"
                aria-label="Show terminal"
                title="Show terminal"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            )}
          </div>

          {/* Session Dropdown */}
          {showSessionDropdown && (
            <div className="absolute top-10 right-4 w-64 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-2xl z-50 max-h-[300px] overflow-hidden flex flex-col" style={{ backgroundColor: '#0A0B0F' }}>
              <div className="p-1.5 overflow-y-auto">
                {deletedSessions.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-500 text-center">
                    No deleted sessions
                  </div>
                ) : (
                  deletedSessions
                    .sort((a, b) => {
                      const aTime = a.deletedAt ? new Date(a.deletedAt).getTime() : 0
                      const bTime = b.deletedAt ? new Date(b.deletedAt).getTime() : 0
                      return bTime - aTime
                    })
                    .map(session => (
                      <div
                        key={session.id}
                        className="group flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all"
                        style={{ 
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#141A25'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate text-gray-200">{session.name}</div>
                          <div className="text-[10px] text-gray-500 truncate">
                            Deleted {session.deletedAt ? new Date(session.deletedAt).toLocaleString() : 'recently'}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            restoreSession(session.id)
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-all shrink-0"
                          aria-label="Restore session"
                          title="Restore session"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Cursor-Style Chat Component */}
        <div className="flex-1 flex flex-col min-h-0">
          <CursorStyleChat
            chatHistory={chatHistory}
            messages={messages}
            isLoading={isActiveSessionLoading}
            message={message}
            setMessage={setMessage}
            handleSendMessage={handleSendMessage}
            handleKeyDown={handleKeyDown}
            handleFileAttachment={handleFileAttachment}
            handleAudioInput={handleAudioInput}
            isRecording={isRecording}
            selectedModel={selectedModel}
            models={models}
            setSelectedModel={setSelectedModel}
            showModelDropdown={showModelDropdown}
            setShowModelDropdown={setShowModelDropdown}
            customModes={customModes}
            selectedCustomMode={selectedCustomMode}
            setSelectedCustomMode={setSelectedCustomMode}
            showModeDropdown={showModeDropdown}
            setShowModeDropdown={setShowModeDropdown}
            onCreateNewSession={() => {
              createNewSession(`Session ${sessions.length + 1}`).catch(error => console.error('Failed to create session:', error))
              setSessionSuggestionDismissed(false)
            }}
            onDismissSessionSuggestion={() => {
              setSessionSuggestionDismissed(true)
              // Remove the suggestion message from chat history
              setChatHistory(prev => prev.filter(msg => 
                !msg.mediaBlocks?.some(block => block.type === 'session-suggestion')
              ))
            }}
            status={streamingStatus}
            onStop={handleStopStreaming}
            attachedFiles={attachedFiles}
            setAttachedFiles={setAttachedFiles}
            allSessionsHistory={allSessionsHistory}
            thinkingContent={(() => {
              // During streaming, extract content from chatHistory (which is updated in real-time)
              // After streaming completes, extract from messages array (which has parts structure)
              
              if (streamingStatus === 'streaming' || streamingStatus === 'submitted') {
                // While streaming, use chatHistory which is updated in real-time
                const lastChatMessage = chatHistory[chatHistory.length - 1]
                
                if (lastChatMessage && lastChatMessage.role === 'assistant') {
                  // Return the content that's being streamed
                  const content = lastChatMessage.content || ''
                  if (content) {
                    return content
                  }
                }
              } else {
                // After streaming, use messages array which has the parts structure
                const lastMessage = messages[messages.length - 1]
                
                if (lastMessage && lastMessage.role === 'assistant') {
                  // Check for parts array
                  if ((lastMessage as any).parts) {
                    const textParts = (lastMessage as any).parts.filter((p: any) => p.type === 'text')
                    if (textParts.length > 0) {
                      const content = textParts.map((p: any) => p.text).join('\n')
                      return content
                    }
                  }
                  
                  // Fallback: check for direct text or content property
                  const directText = (lastMessage as any).text || (lastMessage as any).content
                  if (directText) {
                    return directText
                  }
                }
              }
              
              return ''
            })()}
          />
        </div>


          </div>
        )}
      </SidebarInset>

      {/* Confirmation Dialog */}
      {showConfirmDialog && confirmDialogData && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: 'rgba(0, 12, 25, 0.5)' }}>
          <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                {confirmDialogData.title}
              </h3>
              <p className="text-sm text-gray-300 mb-6">
                {confirmDialogData.message}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowConfirmDialog(false)
                    setConfirmDialogData(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    confirmDialogData.onConfirm()
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-[10000] flex flex-col gap-2 pointer-events-none max-w-md overflow-hidden">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="px-4 py-3 rounded-lg shadow-lg border bg-zinc-800 border-white text-white flex items-center gap-3 min-w-[300px] pointer-events-auto"
            style={{ animation: 'slideInFromRight 0.12s ease-out' }}
          >
            {/* Icon on the left */}
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white flex items-center justify-center">
              {toast.type === 'success' && (
                <Check className="w-4 h-4 text-zinc-800" strokeWidth={4} />
              )}
              {toast.type === 'error' && (
                <X className="w-4 h-4 text-zinc-800" strokeWidth={4} />
              )}
              {toast.type === 'warning' && (
                <svg className="w-4 h-4 text-zinc-800" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C12 2 14 2 14 4L14 13C14 15 12 15 12 15C12 15 10 15 10 13L10 4C10 2 12 2 12 2Z" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              )}
              {toast.type === 'info' && (
                <Check className="w-4 h-4 text-zinc-800" strokeWidth={4} />
              )}
            </div>
            <span className="text-sm flex-1">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-current hover:opacity-70 transition-opacity flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Chat Input Overlay (Before First Message) */}
      {!chatSidebarOpen && (
        <div className={`absolute inset-0 flex flex-col items-center justify-end px-4 py-4 text-white pointer-events-none ${isRecording ? 'z-[99999]' : 'z-[9999]'}`}>
          <div className={`flex flex-col gap-0 justify-center w-full relative items-center xl:w-4/5 pb-4 pointer-events-auto ${chatInputRolledDown ? 'chat-input-rolldown' : 'chat-input-initial'}`} style={{ zIndex: isRecording ? 99999 : 'auto' }}>
            {showOrderText && (
              <div className="mb-4 text-6xl transition-opacity duration-[2000ms] text-white" style={{
                fontWeight: '900',
                letterSpacing: '-0.02em',
                fontFamily: 'SF Pro Display Heavy, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                opacity: guardianFading ? 0 : 1
              }}>
                PANTHEON
              </div>
            )}

            <div className="w-full max-w-4xl flex flex-col gap-2">
              {/* File Previews - Above Input */}
              {attachedFiles.length > 0 && (
                <div className="mb-2 p-3 bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-700">
                  <div className="flex flex-wrap gap-2">
                    {attachedFiles.map((file, index) => (
                      <div key={index} className="relative group">
                        {file.type === 'image' && file.preview && (
                          <div className="relative w-20 h-20 rounded-lg border border-gray-700 overflow-hidden bg-gray-900">
                            <img src={file.preview} alt={file.file.name} className="w-full h-full object-cover" />
                            <button
                              onClick={() => removeFile(index)}
                              className="absolute top-1 right-1 w-5 h-5 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        )}
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
                            >
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        )}
                        {file.type === 'text' && (
                          <div className="relative w-28 h-20 rounded-lg border border-gray-700 bg-gray-900 p-2 overflow-hidden">
                            <div className="text-[9px] text-gray-400 font-mono leading-tight line-clamp-5">
                              {file.preview}
                            </div>
                            <button
                              onClick={() => removeFile(index)}
                              className="absolute top-1 right-1 w-5 h-5 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        )}
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
              {/* Visible for first 35 seconds, then hidden */}
              {isRecording && (
                <div 
                  className="mb-2 relative flex items-center justify-center gap-1 h-20 bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-700 px-4 overflow-hidden transition-opacity duration-300"
                  style={{
                    opacity: showSoundBar ? 1 : 0,
                    visibility: showSoundBar ? 'visible' : 'hidden'
                  }}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-slate-800/90 to-transparent pointer-events-none z-10" />
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
                  <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-slate-800/90 to-transparent pointer-events-none z-10" />
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
              
              {/* Chat Input */}
              <div
                className={`rounded-t-[10rem] rounded-b-[10rem] query-bar group bg-slate-800/90 backdrop-blur-sm ring-slate-700 hover:ring-slate-700 focus-within:ring-slate-700 hover:focus-within:ring-slate-700 relative w-full overflow-visible shadow-sm ring-1 ring-inset pb-0 shadow-black/5 ${isRecording ? 'z-[99999]' : 'z-10'}`}
                style={{ transitionProperty: 'background-color, box-shadow, border-color', transitionDuration: '100ms', zIndex: isRecording ? 99999 : 10 }}
              >
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleFileAttachment}
                      className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium cursor-pointer transition-colors duration-100 select-none text-white hover:bg-slate-700 border border-transparent h-10 w-10 rounded-full flex-shrink-0"
                      aria-label="Attach"
                      tabIndex={0}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="stroke-[2] text-zinc-400"
                      >
                        <path d="M10 9V15C10 16.1046 10.8954 17 12 17V17C13.1046 17 14 16.1046 14 15V7C14 4.79086 12.2091 3 10 3V3C7.79086 3 6 4.79086 6 7V15C6 18.3137 8.68629 21 12 21V21C15.3137 21 18 18.3137 18 15V8" stroke="currentColor"></path>
                      </svg>
                    </button>

                    <div className="relative flex-1">
                      <textarea
                        ref={textareaRef}
                        aria-label="Ask anything"
                        placeholder="What do you want to do?"
                        value={message + interimTranscript}
                        onChange={(e) => {
                          if (!isRecording) {
                            setMessage(e.target.value)
                          }
                        }}
                        onKeyDown={handleKeyDown}
                        onInput={(e) => {
                          handleInputInteraction();
                          const target = e.target as HTMLTextAreaElement;
                          
                          // Reset to single line if empty
                          if (target.value.trim() === '') {
                            target.style.height = '28px';
                            return;
                          }
                          
                          // Set to minimum height and check if content overflows
                          target.style.height = '28px';
                          target.style.overflow = 'hidden';
                          
                          // Check if scrollHeight significantly exceeds the visible height
                          // scrollHeight includes padding, so for single line it should be ~28px
                          // Only expand if scrollHeight is at least 48px (indicating wrapped text)
                          if (target.scrollHeight >= 48) {
                            target.style.overflow = 'auto';
                            target.style.height = Math.min(target.scrollHeight, 80) + 'px';
                          } else {
                            target.style.overflow = 'hidden';
                          }
                        }}
                        disabled={creationProgress?.active || false}
                        className="w-full px-2 bg-transparent focus:outline-none text-white min-h-6 my-0 mb-0 text-input-animated scrollbar-hide"
                        style={{ 
                          resize: 'none', 
                          height: '28px', 
                          lineHeight: '20px',
                          paddingTop: '5px', 
                          paddingBottom: '3px',
                          scrollbarWidth: 'none',
                          msOverflowStyle: 'none',
                          overflow: 'hidden'
                        }}
                      />
                    </div>

                    {isRecording ? (
                      /* PRIORITY: Recording button always shows when recording, even if there's text */
                      <button
                        type="button"
                        onClick={handleAudioInput}
                        className="send-button-circle flex-shrink-0 relative"
                        aria-label="Stop recording"
                        tabIndex={0}
                        style={{ backgroundColor: 'white', color: 'black', zIndex: 99999, position: 'relative' }}
                      >
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
                          <circle className="pulsing-circle" cx="300" cy="300" r="450" fill="none" stroke="#0A0A0A" strokeWidth="24" />
                          <rect className="rotating-inner" x="75" y="75" width="450" height="450" rx="225" ry="225" fill="#0A0A0A" />
                        </svg>
                      </button>
                    ) : message.trim() ? (
                      <button
                        type="button"
                        onClick={handleSendMessage}
                        disabled={isLoading}
                        className="send-button-circle send-button-enter flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Send"
                        tabIndex={0}
                        style={{ backgroundColor: 'white', color: 'black' }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="stroke-[2] relative">
                          <path d="M5 11L12 4M12 4L19 11M12 4V21" stroke="currentColor"></path>
                        </svg>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleAudioInput}
                        disabled={isLoading}
                        className="send-button-circle flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Record audio"
                        tabIndex={0}
                        style={{ backgroundColor: 'white', color: 'black' }}
                      >
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
              </div>

              {/* Model & OS Selectors - Separate div BELOW input, left aligned */}
              <div className="flex items-center gap-3 pl-4">
                {/* Model Selector - Only show if user is logged in and has models */}
                {user && models.length > 0 && (
                  <div className="relative model-selector-container w-fit rounded-full">
                    <button
                      onClick={() => setShowModelDropdown(!showModelDropdown)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white bg-transparent hover:bg-slate-800/30 rounded-full transition-all group"
                      title={models.find(m => m.id === selectedModel)?.name || 'Select Model'}
                    >
                      <Brain className="w-4 h-4 text-white flex-shrink-0" />
                      <span className="text-left font-medium">{models.find(m => m.id === selectedModel)?.name || 'Select Model'}</span>
                      <svg className={`w-3 h-3 text-gray-400 group-hover:text-gray-200 transition-transform flex-shrink-0 ${showModelDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Model Dropdown Menu */}
                    {showModelDropdown && (
                      <div className="absolute bottom-full left-0 mb-1.5 w-64 max-h-[60vh] bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden z-50">
                        <div className="p-1 space-y-0.5 overflow-y-auto max-h-[calc(60vh-8px)]">
                          {models.map((model) => (
                            <button
                              key={model.id}
                              onClick={() => {
                                setSelectedModel(model.id)
                                setShowModelDropdown(false)
                              }}
                              className={`w-full text-left px-2.5 py-2 rounded-md transition-all ${selectedModel === model.id
                                ? 'bg-white/10 text-white'
                                : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                }`}
                            >
                              <div className="flex flex-col gap-0.5">
                                <div className="text-xs font-medium">{model.name}</div>
                                <div className="text-[10px] text-gray-500 truncate">{model.description}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* OS Selector */}
                <div className="relative os-selector-container w-fit rounded-full">
                  <button
                    onClick={() => setShowOSDropdown(!showOSDropdown)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white bg-transparent hover:bg-slate-800/30 rounded-full transition-all group"
                    title={availableOS.find(os => os.id === selectedOS)?.name || 'Select OS'}
                  >
                    <Monitor className="w-4 h-4 text-white flex-shrink-0" />
                    <span className="text-left font-medium">{availableOS.find(os => os.id === selectedOS)?.name || 'Select OS'}</span>
                    <svg className={`w-3 h-3 text-gray-400 group-hover:text-gray-200 transition-transform flex-shrink-0 ${showOSDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* OS Dropdown Menu */}
                  {showOSDropdown && (
                    <div className="absolute bottom-full left-0 mb-1.5 w-64 max-h-[60vh] bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden z-50">
                      <div className="p-1 space-y-0.5 overflow-y-auto max-h-[calc(60vh-8px)]">
                        {availableOS.map((os) => (
                          <button
                            key={os.id}
                            onClick={() => {
                              setSelectedOS(os.id)
                              setShowOSDropdown(false)
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded-md transition-all ${selectedOS === os.id
                              ? 'bg-white/10 text-white'
                              : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                              }`}
                          >
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">{os.name}</span>
                              </div>
                              <div className="text-[10px] text-gray-500 truncate">Version {os.version}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Mode Selector */}
                <div className="relative mode-selector-container w-fit rounded-full">
                  <button
                    onClick={() => setShowModeDropdown(!showModeDropdown)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white bg-transparent hover:bg-slate-800/30 rounded-full transition-all group"
                    title={selectedCustomMode ? customModes.find(m => m.id === selectedCustomMode)?.name : 'Default Mode'}
                  >
                    <svg aria-hidden="true" focusable="false" className="w-4 h-4 text-white flex-shrink-0" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style={{display: 'inline-block', overflow: 'visible', verticalAlign: 'text-bottom'}}><path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"></path></svg>
                    <span className="text-left font-medium">
                      {selectedCustomMode 
                        ? customModes.find(m => m.id === selectedCustomMode)?.name || 'Default Mode'
                        : 'Default Mode'}
                    </span>
                    <svg className={`w-3 h-3 text-gray-400 group-hover:text-gray-200 transition-transform flex-shrink-0 ${showModeDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Mode Dropdown Menu */}
                  {showModeDropdown && (
                    <div className="absolute bottom-full left-0 mb-1.5 w-64 max-h-[60vh] bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden z-50">
                      <div className="p-1 space-y-0.5 overflow-y-auto max-h-[calc(60vh-8px)]">
                        {/* Default Mode Option */}
                        <button
                          onClick={() => {
                            console.log(`🎯 Switched to default mode (no custom prompt)`);
                            setSelectedCustomMode(null)
                            setShowModeDropdown(false)
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-md transition-all ${!selectedCustomMode
                            ? 'bg-white/10 text-white'
                            : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                            }`}
                        >
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">Default Mode</span>
                            </div>
                            <div className="text-[10px] text-gray-500 truncate">Standard system behavior</div>
                          </div>
                        </button>
                        
                        {/* Custom Modes */}
                        {customModes.length > 0 && (
                          <>
                            <div className="px-2.5 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider">
                              Custom Modes
                            </div>
                            {customModes.map((customMode) => (
                              <button
                                key={customMode.id}
                                onClick={() => {
                                  console.log(`🎯 Custom mode selected: ${customMode.name} (${customMode.id})`);
                                  console.log(`🎯 Custom mode prompt length: ${customMode.systemPrompt?.length || 0} chars`);
                                  setSelectedCustomMode(customMode.id)
                                  setShowModeDropdown(false)
                                }}
                                className={`w-full text-left px-2.5 py-2 rounded-md transition-all ${selectedCustomMode === customMode.id
                                  ? 'bg-white/10 text-white'
                                  : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                  }`}
                              >
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs font-medium">{customMode.name}</span>
                                  {customMode.description && (
                                    <div className="text-[10px] text-gray-500 truncate">{customMode.description}</div>
                                  )}
                                </div>
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Project Selector */}
                <div className="relative project-selector-container w-fit rounded-full">
                  <button
                    onClick={() => {
                      console.log('🔍 Project dropdown clicked. Current state:', {
                        showProjectDropdown,
                        projectsCount: projects.length,
                        collaborationsCount: collaborations.length,
                        selectedProjectIdForNewSession,
                        createNewProjectOnSend,
                        projects: projects.map(p => p.name)
                      })
                      setShowProjectDropdown(!showProjectDropdown)
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white bg-transparent hover:bg-slate-800/30 rounded-full transition-all group"
                    title={createNewProjectOnSend 
                      ? 'New Project (will be created on send)'
                      : selectedProjectIdForNewSession 
                        ? (projects.find(p => p.id === selectedProjectIdForNewSession)?.name || collaborations.find(c => c.projectId === selectedProjectIdForNewSession)?.project?.name || 'Select Project')
                        : 'Select Project for Next Message'}
                  >
                    <FolderOpen className="w-4 h-4 text-white flex-shrink-0" />
                    <span className="text-left font-medium">
                      {createNewProjectOnSend 
                        ? 'New Project'
                        : selectedProjectIdForNewSession 
                          ? (projects.find(p => p.id === selectedProjectIdForNewSession)?.name || collaborations.find(c => c.projectId === selectedProjectIdForNewSession)?.project?.name || 'Select Project')
                          : 'Select Project'}
                    </span>
                    <svg className={`w-3 h-3 text-gray-400 group-hover:text-gray-200 transition-transform flex-shrink-0 ${showProjectDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Project Dropdown Menu */}
                  {showProjectDropdown && (
                    <div className="absolute bottom-full left-0 mb-1.5 w-64 max-h-[60vh] bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden z-50">
                      <div className="p-1 space-y-0.5 overflow-y-auto max-h-[calc(60vh-8px)]">
                        {console.log('🔍 Rendering project dropdown. Projects:', projects.length, 'Collaborations:', collaborations.length)}
                        
                        {/* New Project Option */}
                        <button
                          onClick={() => {
                            console.log('🎯 New project selected (will create on send)');
                            setCreateNewProjectOnSend(true)
                            setSelectedProjectIdForNewSession(null)
                            setShowProjectDropdown(false)
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-md transition-all ${createNewProjectOnSend
                            ? 'bg-white/10 text-white'
                            : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            <span className="text-xs font-medium">New Project</span>
                          </div>
                        </button>
                        
                        {/* Owned Projects */}
                        {Array.isArray(projects) && projects.length > 0 ? (
                          <>
                            <div className="px-2.5 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider">
                              My Projects ({projects.length})
                            </div>
                            {projects.map((project) => {
                              console.log('🔍 Rendering project:', project.name, project.id)
                              return (
                                <button
                                  key={project.id}
                                  onClick={() => {
                                    console.log(`🎯 Project selected for next message: ${project.name} (${project.id})`);
                                    setSelectedProjectIdForNewSession(project.id)
                                    setCreateNewProjectOnSend(false)
                                    setShowProjectDropdown(false)
                                  }}
                                  className={`w-full text-left px-2.5 py-2 rounded-md transition-all ${selectedProjectIdForNewSession === project.id
                                    ? 'bg-white/10 text-white'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                    }`}
                                >
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-xs font-medium">{project.name}</span>
                                    <div className="text-[10px] text-gray-500 truncate">
                                      {project.operatingSystem || project.operating_system || 'Unknown OS'}
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                          </>
                        ) : null}
                        
                        {/* Collaborations */}
                        {Array.isArray(collaborations) && collaborations.length > 0 ? (
                          <>
                            <div className="px-2.5 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider">
                              Shared Projects ({collaborations.length})
                            </div>
                            {collaborations.map((collab) => {
                              const project = collab.project
                              if (!project) {
                                console.log('🔍 Skipping collab with no project:', collab)
                                return null
                              }
                              console.log('🔍 Rendering collaboration project:', project.name, project.id)
                              return (
                                <button
                                  key={project.id}
                                  onClick={() => {
                                    console.log(`🎯 Collaboration project selected for next message: ${project.name} (${project.id})`);
                                    setSelectedProjectIdForNewSession(project.id)
                                    setCreateNewProjectOnSend(false)
                                    setShowProjectDropdown(false)
                                  }}
                                  className={`w-full text-left px-2.5 py-2 rounded-md transition-all ${selectedProjectIdForNewSession === project.id
                                    ? 'bg-white/10 text-white'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                    }`}
                                >
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-xs font-medium">{project.name}</span>
                                    <div className="text-[10px] text-gray-500 truncate">
                                      {project.operatingSystem || project.operating_system || 'Unknown OS'} • Shared
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                          </>
                        ) : null}
                        
                        {/* No Projects Message */}
                        {(!Array.isArray(projects) || projects.length === 0) && (!Array.isArray(collaborations) || collaborations.length === 0) && (
                          <div className="px-2.5 py-3 text-xs text-gray-500 text-center">
                            No projects yet. Create one to get started!
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Project Management Modals */}
      <ProjectCreationModal
        isOpen={showProjectModal}
        onClose={() => setShowProjectModal(false)}
        onCreateProject={createProject}
        creationProgress={creationProgress}
        onCancelCreation={cancelProjectCreation}
      />

      <ShareProjectModal
        isOpen={showShareModal}
        projectId={selectedProjectId}
        projectName={projects.find(p => p.id === selectedProjectId)?.name || ''}
        onClose={() => setShowShareModal(false)}
        onShare={shareProject}
        onUpdatePermissions={async () => {}}
        onRevokeAccess={async () => {}}
        collaborators={collaborators}
      />

      <AddCollaborationModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoinProject={joinProject}
      />

      <DeleteProjectModal
        isOpen={showDeleteModal}
        projectName={projectToDelete?.name || ''}
        onClose={() => {
          setShowDeleteModal(false)
          setProjectToDelete(null)
        }}
        onConfirm={confirmDeleteProject}
      />

      <LeaveCollaborationModal
        isOpen={showLeaveModal}
        projectName={collaborationToLeave?.name || ''}
        onClose={() => {
          setShowLeaveModal(false)
          setCollaborationToLeave(null)
        }}
        onConfirm={async () => {
          if (collaborationToLeave && user) {
            try {
              const headers = await getAuthHeaders()
              const response = await fetch(`${backendUrl}/api/collaborations/${collaborationToLeave.id}`, {
                method: 'DELETE',
                headers,
                body: JSON.stringify({ userId: user.id })
              })
              const data = await response.json()
              if (data.success) {
                setCollaborations(prev => prev.filter(c => c.projectId !== collaborationToLeave.id))
                if (activeProjectId === collaborationToLeave.id) {
                  setActiveProjectId(null)
                }
                addToast({ id: Date.now().toString(), type: 'success', message: 'Left collaboration successfully', duration: 3000 })
              }
            } catch (error) {
              console.error('Failed to leave collaboration:', error)
              addToast({ id: Date.now().toString(), type: 'error', message: 'Failed to leave collaboration', duration: 3000 })
            }
          }
        }}
      />

      {/* Collaborators Sidebar */}
      <CollaboratorsSidebar
        isOpen={showCollaboratorsSidebar}
        onClose={() => setShowCollaboratorsSidebar(false)}
        projectId={activeProjectId}
        projectName={
          projects.find(p => p.id === activeProjectId)?.name ||
          collaborations.find(c => c.projectId === activeProjectId)?.project.name ||
          'Project'
        }
        collaborators={projectCollaborators}
        currentUserId={user?.id || ''}
        isOwner={projects.some(p => p.id === activeProjectId)}
        width={collaboratorsSidebarWidth}
        onWidthChange={setCollaboratorsSidebarWidth}
        onAddCollaborator={() => setShowAddUserModal(true)}
        onRemoveCollaborator={async (userId) => {
          if (!activeProjectId || !user) return
          
          try {
            // Find the collaborator to get their name
            const collaborator = projectCollaborators.find(c => c.userId === userId)
            const userName = collaborator?.userName || 'User'
            
            // Optimistically remove from UI
            setProjectCollaborators(prev => prev.filter(c => c.userId !== userId))
            
            // Call API to remove collaborator
            const headers = await getAuthHeaders()
            const response = await fetch(`${backendUrl}/api/projects/${activeProjectId}/collaborators/${userId}`, {
              method: 'DELETE',
              headers
            })
            
            if (!response.ok) {
              const error = await response.text()
              throw new Error(error)
            }
            
            addToast({
              id: generateToastId(),
              type: 'success',
              message: `${userName} removed from project`,
              duration: 3000
            })
            
            // Refresh collaborators list to ensure consistency
            await fetchProjectCollaborators(activeProjectId)
            
          } catch (error) {
            console.error('Failed to remove collaborator:', error)
            addToast({
              id: generateToastId(),
              type: 'error',
              message: 'Failed to remove collaborator',
              duration: 3000
            })
            // Refresh to restore correct state
            if (activeProjectId) {
              await fetchProjectCollaborators(activeProjectId)
            }
          }
        }}
        onToggleVisibility={async (userId) => {
          if (!activeProjectId || !user) return
          
          try {
            // Find the collaborator to get current visibility state
            const collaborator = projectCollaborators.find(c => c.userId === userId)
            if (!collaborator) return
            
            const newVisibility = collaborator.isVisible !== false ? false : true
            
            // Optimistically update UI
            setProjectCollaborators(prev => prev.map(c => 
              c.userId === userId ? { ...c, isVisible: newVisibility } : c
            ))
            
            // Call API to update visibility
            const headers = await getAuthHeaders()
            const response = await fetch(`${backendUrl}/api/projects/${activeProjectId}/collaborators/${userId}/visibility`, {
              method: 'PATCH',
              headers,
              body: JSON.stringify({
                isVisible: newVisibility,
                ownerId: user.id
              })
            })
            
            if (!response.ok) {
              // Revert on error
              setProjectCollaborators(prev => prev.map(c => 
                c.userId === userId ? { ...c, isVisible: !newVisibility } : c
              ))
              addToast({
                id: generateToastId(),
                type: 'error',
                message: 'Failed to update visibility',
                duration: 3000
              })
            } else {
              addToast({
                id: generateToastId(),
                type: 'success',
                message: `User ${newVisibility ? 'shown' : 'hidden'} successfully`,
                duration: 2000
              })
            }
          } catch (error) {
            console.error('Error toggling visibility:', error)
          }
        }}
        onToggleAllVisibility={async (visible) => {
          if (!activeProjectId || !user) return
          
          try {
            // Optimistically update UI
            setProjectCollaborators(prev => prev.map(c => ({ ...c, isVisible: visible })))
            
            // Call API to update all visibility
            const headers = await getAuthHeaders()
            const response = await fetch(`${backendUrl}/api/projects/${activeProjectId}/collaborators/visibility/all`, {
              method: 'PATCH',
              headers,
              body: JSON.stringify({
                isVisible: visible,
                ownerId: user.id
              })
            })
            
            if (!response.ok) {
              // Revert on error
              setProjectCollaborators(prev => prev.map(c => ({ ...c, isVisible: !visible })))
              addToast({
                id: generateToastId(),
                type: 'error',
                message: 'Failed to update visibility',
                duration: 3000
              })
            } else {
              addToast({
                id: generateToastId(),
                type: 'success',
                message: `All users ${visible ? 'shown' : 'hidden'} successfully`,
                duration: 2000
              })
            }
          } catch (error) {
            console.error('Error toggling all visibility:', error)
          }
        }}
      />

      {/* Add User to Collaboration Modal */}
      <AddUserToCollabModal
        isOpen={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        projectId={activeProjectId || ''}
        projectName={
          projects.find(p => p.id === activeProjectId)?.name ||
          collaborations.find(c => c.projectId === activeProjectId)?.project.name ||
          'Project'
        }
        onAddUser={async (usernameOrEmail) => {
          if (!activeProjectId || !user) {
            throw new Error('No active project or user')
          }
          
          try {
            console.log('Adding user:', usernameOrEmail)
            const headers = await getAuthHeaders()
            const response = await fetch(`${backendUrl}/api/projects/${activeProjectId}/collaborators`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                usernameOrEmail,
                ownerId: user.id
              })
            })
            
            const data = await response.json()
            
            if (!response.ok) {
              if (data.error === 'USER_NOT_FOUND') {
                throw new Error('User not found with that email or username')
              } else if (data.error === 'ALREADY_COLLABORATOR') {
                throw new Error('User is already a collaborator')
              } else if (data.error === 'ALREADY_OWNER') {
                throw new Error('This user is the project owner')
              } else {
                throw new Error(data.message || 'Failed to add user')
              }
            }
            
            console.log('✅ User added successfully:', data.user)
            
            // Close the modal
            setShowAddUserModal(false)
            
            // Immediately fetch updated collaborators list
            await fetchProjectCollaborators(activeProjectId)
            
            // Show success toast
            addToast({
              id: generateToastId(),
              type: 'success',
              message: `${data.user.name} added successfully`,
              duration: 3000
            })
          } catch (error) {
            console.error('Error adding user:', error)
            throw error
          }
        }}
      />
    </SidebarProvider>
  )
}





