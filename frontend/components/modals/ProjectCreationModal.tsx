'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, Loader2, Minus } from 'lucide-react'

interface ProjectCreationModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateProject: (name: string, os?: string) => Promise<void>
  creationProgress?: {
    active: boolean
    step: string
    message: string
    progress: number
    projectId?: string
  } | null
  onCancelCreation?: (projectId: string) => Promise<void>
}

type CreationStage = 'input' | 'creating' | 'pulling-image' | 'starting-container' | 'initializing' | 'complete' | 'error'

const getDefaultOSId = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('default-os') || 'windows-11'
  }
  return 'windows-11'
}

const getAvailableOS = () => {
  const defaultOSId = getDefaultOSId()
  return [
    { id: 'windows-11', name: 'Windows 11', version: 'Professional', description: 'Full Windows 11 with MCP integration', isDefault: defaultOSId === 'windows-11' }
  ]
}

export function ProjectCreationModal({ isOpen, onClose, onCreateProject, creationProgress, onCancelCreation }: ProjectCreationModalProps) {
  const [projectName, setProjectName] = useState('')
  const [mounted, setMounted] = useState(false)
  const [availableOS, setAvailableOS] = useState(() => {
    // Initialize with default values (no localStorage access during SSR)
    return [
      { id: 'windows-11', name: 'Windows 11', version: 'Professional', description: 'Full Windows 11 with MCP integration', isDefault: true }
    ]
  })
  const [selectedOS, setSelectedOS] = useState('windows-11')
  
  // Initialize from localStorage after mount (client-side only)
  useEffect(() => {
    setMounted(true)
    const updatedOS = getAvailableOS()
    setAvailableOS(updatedOS)
    const defaultOS = updatedOS.find(os => os.isDefault)
    setSelectedOS(defaultOS ? defaultOS.id : 'windows-11')
  }, [])
  
  // Update available OS when modal opens
  useEffect(() => {
    if (isOpen && mounted) {
      console.log('🔵 Modal opened, creationProgress:', creationProgress)
      const updatedOS = getAvailableOS()
      setAvailableOS(updatedOS)
      const defaultOS = updatedOS.find(os => os.isDefault)
      setSelectedOS(defaultOS ? defaultOS.id : 'windows-11')
      
      // Always reset to input stage when opening modal, unless there's active creation progress
      if (!creationProgress?.active) {
        console.log('✅ Resetting to input stage')
        setStage('input')
        setError(null)
        setProgress(0)
        setIsCancelling(false)
      } else {
        console.log('⚠️ Skipping reset - creation in progress')
      }
    }
  }, [isOpen, mounted])
  
  const [showOSDropdown, setShowOSDropdown] = useState(false)
  const [stage, setStage] = useState<CreationStage>('input')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [isCancelling, setIsCancelling] = useState(false)
  
  // Drag functionality with localStorage persistence
  const [position, setPosition] = useState<{ x: number | null, y: number | null }>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('projectCreationModalPosition')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          return { x: null, y: null }
        }
      }
    }
    return { x: null, y: null }
  })
  const [isDragging, setIsDragging] = useState(false)
  const [hasDragged, setHasDragged] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isMinimized, setIsMinimized] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('projectCreationModalMinimized')
      return saved === 'true'
    }
    return false
  })
  const notificationRef = useRef<HTMLDivElement>(null)
  const minimizedRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  
  // Save position to localStorage whenever it changes
  useEffect(() => {
    if (position.x !== null && position.y !== null) {
      localStorage.setItem('projectCreationModalPosition', JSON.stringify(position))
    }
  }, [position])
  
  // Save minimized state to localStorage
  useEffect(() => {
    localStorage.setItem('projectCreationModalMinimized', String(isMinimized))
  }, [isMinimized])

  const handleCreate = async () => {
    if (!projectName.trim()) {
      setError('Project name is required')
      return
    }

    setStage('creating')
    setError(null)
    setProgress(0)
    
    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController()

    try {
      await onCreateProject(projectName, selectedOS)
      
      // Success - will be closed by parent component
      setStage('complete')
      setProgress(100)
      
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Cancelled by user
        setStage('error')
        setError('Project creation cancelled')
      } else {
        setStage('error')
        setError(err instanceof Error ? err.message : 'Failed to create project')
      }
    } finally {
      abortControllerRef.current = null
    }
  }
  
  // Update progress from parent
  useEffect(() => {
    console.log('🔄 creationProgress changed:', creationProgress, 'current stage:', stage)
    if (creationProgress?.active) {
      console.log('⚡ Setting stage to creating')
      setStage('creating')
      setProgress(creationProgress.progress || 0)
    } else if (creationProgress === null && stage === 'creating') {
      console.log('✅ Creation complete')
      // Creation complete
      setStage('complete')
      setProgress(100)
      setTimeout(() => {
        handleClose()
      }, 500)
    }
  }, [creationProgress])

  const handleClose = async () => {
    // Cancel ongoing creation if any
    if (stage === 'creating' && creationProgress?.projectId && onCancelCreation) {
      setIsCancelling(true)
      try {
        await onCancelCreation(creationProgress.projectId)
      } catch (error) {
        console.error('Failed to cancel project creation:', error)
      }
    }
    
    if (stage === 'creating' && abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    setProjectName('')
    const defaultOS = availableOS.find(os => os.isDefault)
    setSelectedOS(defaultOS ? defaultOS.id : 'windows-11')
    setShowOSDropdown(false)
    setStage('input')
    setError(null)
    setProgress(0)
    setIsMinimized(false)
    setIsCancelling(false)
    setPosition({ x: null, y: null })
    
    // Clear localStorage when closing
    localStorage.removeItem('projectCreationModalPosition')
    localStorage.removeItem('projectCreationModalMinimized')
    
    onClose()
  }
  
  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent, isMinimizedVersion = false) => {
    // For minimized version, allow dragging from anywhere except the button itself
    if (isMinimizedVersion) {
      const target = e.target as HTMLElement
      // Only prevent drag if clicking directly on the button text/icon, not the container
      if (target.tagName === 'BUTTON' || target.closest('svg')) return
    } else {
      // For full modal, don't drag when clicking buttons or input elements
      const target = e.target as HTMLElement
      if (target.closest('button') || target.closest('input')) return
    }
    
    e.preventDefault() // Prevent text selection
    e.stopPropagation()
    setIsDragging(true)
    setHasDragged(false) // Reset drag flag
    
    // Get the modal's current position on screen
    const modalElement = isMinimizedVersion ? minimizedRef.current : (isInputStage ? modalRef.current : notificationRef.current)
    if (!modalElement) return
    
    const rect = modalElement.getBoundingClientRect()
    
    setDragStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
    
    // Set initial position if not already set
    if (position.x === null || position.y === null) {
      setPosition({
        x: rect.left,
        y: rect.top
      })
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      
      e.preventDefault() // Prevent text selection during drag
      
      const newX = e.clientX - dragStart.x
      const newY = e.clientY - dragStart.y
      
      // Mark as dragged if moved more than 5px
      if (!hasDragged && (Math.abs(newX - (position.x ?? 0)) > 5 || Math.abs(newY - (position.y ?? 0)) > 5)) {
        setHasDragged(true)
      }
      
      // Get current element dimensions
      const currentRef = isInputStage ? modalRef.current : (isMinimized ? minimizedRef.current : notificationRef.current)
      const width = currentRef?.offsetWidth || 320
      const height = currentRef?.offsetHeight || 200
      
      // Keep within viewport bounds
      const maxX = window.innerWidth - width
      const maxY = window.innerHeight - height
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove, { passive: false })
      document.addEventListener('mouseup', handleMouseUp)
      // Prevent text selection during drag
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'grabbing'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isDragging, dragStart, isMinimized, position, hasDragged])

  // Calculate isInputStage before early return
  const isInputStage = stage === 'input' || stage === 'error'
  
  // Initialize position when notification first appears
  useEffect(() => {
    if (!isInputStage && isOpen && position.x === null && position.y === null) {
      // Set initial position to bottom-right
      const initialX = window.innerWidth - 336 // 320px width + 16px margin
      const initialY = window.innerHeight - 216 // approximate height + 16px margin
      setPosition({ x: initialX, y: initialY })
    }
  }, [isInputStage, isOpen, position])

  if (!isOpen) return null

  const selectedOSName = availableOS.find(os => os.id === selectedOS)?.name || 'OS'
  
  const getCurrentMessage = () => {
    if (creationProgress?.active) {
      return creationProgress.message
    }
    
    const stageMessages: Record<CreationStage, string> = {
      'input': 'Enter project details',
      'creating': 'Creating project...',
      'pulling-image': `Pulling ${selectedOSName} image...`,
      'starting-container': 'Starting Docker container...',
      'initializing': 'Initializing services...',
      'complete': 'Project created successfully!',
      'error': 'Failed to create project'
    }
    
    return stageMessages[stage]
  }
  
  return (
    <>
      {/* Full modal for input */}
      {isInputStage && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
          onClick={(e) => {
            // Close modal when clicking backdrop (but not when clicking the modal itself)
            if (e.target === e.currentTarget) {
              handleClose()
            }
          }}
        >
          <div 
            ref={modalRef}
            className="rounded-lg p-6 w-full max-w-md relative z-[10000] select-none" 
            style={{ 
              backgroundColor: '#0A0A0A', 
              borderColor: '#27272A', 
              borderWidth: '1px',
              left: position.x !== null ? `${position.x}px` : '50%',
              top: position.y !== null ? `${position.y}px` : '50%',
              transform: position.x === null ? 'translate(-50%, -50%)' : 'none',
              position: 'fixed',
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
            onMouseDown={(e) => handleMouseDown(e, false)}
          >
            <div className="flex items-center justify-between mb-4 pointer-events-none">
              <h2 className="text-xl font-semibold">Create New Project</h2>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-white pointer-events-auto"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

        {stage === 'input' && (
          <div className="space-y-4 pointer-events-auto">
            <div>
              <label className="block text-sm font-medium mb-2">Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My Pentest Project"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-white"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Operating System</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowOSDropdown(!showOSDropdown)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-white flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-monitor w-4 h-4 text-white flex-shrink-0">
                      <rect width="20" height="14" x="2" y="3" rx="2"></rect>
                      <line x1="8" x2="16" y1="21" y2="21"></line>
                      <line x1="12" x2="12" y1="17" y2="21"></line>
                    </svg>
                    <div>
                      <div className="text-sm font-medium text-white">
                        {availableOS.find(os => os.id === selectedOS)?.name}
                      </div>
                      <div className="text-xs text-gray-400">
                        Version {availableOS.find(os => os.id === selectedOS)?.version}
                      </div>
                    </div>
                  </div>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${showOSDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showOSDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                    {availableOS.map((os) => (
                      <button
                        key={os.id}
                        type="button"
                        onClick={() => {
                          setSelectedOS(os.id)
                          setShowOSDropdown(false)
                        }}
                        className={`w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors ${
                          selectedOS === os.id ? 'bg-gray-700' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-monitor w-4 h-4 text-white flex-shrink-0 mt-0.5">
                            <rect width="20" height="14" x="2" y="3" rx="2"></rect>
                            <line x1="8" x2="16" y1="21" y2="21"></line>
                            <line x1="12" x2="12" y1="17" y2="21"></line>
                          </svg>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">{os.name}</span>
                            </div>
                            <div className="text-xs text-gray-400">Version {os.version}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{os.description}</div>
                          </div>
                          {os.isDefault && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-700 text-white rounded border border-gray-600 flex-shrink-0">
                              DEFAULT
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 text-sm bg-white hover:bg-gray-200 text-black rounded-md"
              >
                Create Project
              </button>
            </div>
          </div>
        )}

        {stage === 'error' && (
          <div className="space-y-4 pointer-events-auto">
            <p className="text-red-500 text-sm">{error}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-md"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setStage('input')
                  setError(null)
                }}
                className="px-4 py-2 text-sm bg-white hover:bg-gray-200 text-black rounded-md"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
          </div>
        </div>
      )}

      {/* Compact progress notification - draggable */}
      {!isInputStage && isOpen && !isMinimized && (
        <div 
          ref={notificationRef}
          className="fixed z-[9999] select-none"
          style={{
            left: position.x !== null ? `${position.x}px` : 'auto',
            top: position.y !== null ? `${position.y}px` : 'auto',
            right: position.x === null ? '1rem' : 'auto',
            bottom: position.y === null ? '1rem' : 'auto',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none'
          }}
          onMouseDown={(e) => handleMouseDown(e, false)}
        >
          <div 
            className="rounded-lg p-4 w-80 shadow-2xl" 
            style={{ 
              backgroundColor: '#0A0A0A', 
              borderColor: '#27272A', 
              borderWidth: '1px',
              userSelect: 'none'
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 flex-1 min-w-0 pointer-events-none">
                <Loader2 className="h-4 w-4 animate-spin text-white flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold">Creating Project</h3>
                  <p className="text-xs text-gray-400 truncate">{projectName}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2 pointer-events-auto">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsMinimized(true)
                  }}
                  className="text-gray-400 hover:text-white p-1"
                  title="Minimize"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleClose()
                  }}
                  className="text-gray-400 hover:text-red-400 p-1"
                  title="Cancel project creation"
                  disabled={isCancelling}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>

            <div className="space-y-2 pointer-events-none">
              <p className="text-xs text-gray-300">{isCancelling ? 'Cancelling...' : getCurrentMessage()}</p>
              
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div
                  className="bg-white h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, progress || 0))}%` }}
                />
              </div>
              
              <p className="text-xs text-gray-500 text-right">{Math.round(progress || 0)}% complete</p>
            </div>

            {stage === 'complete' && (
              <p className="text-green-500 text-xs mt-2 pointer-events-none">✓ Project created successfully!</p>
            )}
          </div>
        </div>
      )}
      
      {/* Minimized indicator - also draggable */}
      {!isInputStage && isOpen && isMinimized && (
        <div 
          ref={minimizedRef}
          className="fixed z-[9999] select-none"
          style={{
            left: position.x !== null ? `${position.x}px` : 'auto',
            top: position.y !== null ? `${position.y}px` : 'auto',
            right: position.x === null ? '1rem' : 'auto',
            bottom: position.y === null ? '1rem' : 'auto',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none'
          }}
          onMouseDown={(e) => handleMouseDown(e, true)}
        >
          <div
            onClick={(e) => {
              // Only expand if we didn't drag (just clicked)
              if (!hasDragged) {
                e.stopPropagation()
                setIsMinimized(false)
              }
            }}
            className="rounded-lg px-3 py-2 shadow-2xl flex items-center gap-2 hover:scale-105 transition-transform cursor-pointer"
            style={{ backgroundColor: '#0A0A0A', borderColor: '#27272A', borderWidth: '1px' }}
            title="Click to expand, drag to move"
          >
            <Loader2 className="h-3 w-3 animate-spin text-white pointer-events-none" />
            <span className="text-xs text-gray-300 pointer-events-none">Creating project... {Math.round(progress || 0)}%</span>
          </div>
        </div>
      )}
    </>
  )
}
