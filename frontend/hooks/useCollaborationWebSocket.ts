import { useEffect, useRef, useState, useCallback } from 'react'

interface CollaborationMessage {
  type: string
  [key: string]: any
}

interface UseCollaborationWebSocketProps {
  projectId: string | null
  userId: string
  userName: string
  onSessionCreated?: (session: any) => void
  onSessionUpdated?: (sessionId: string, updates: any) => void
  onSessionDeleted?: (sessionId: string) => void
  onUserJoined?: (userId: string, userName: string) => void
  onUserLeft?: (userId: string, userName: string) => void
  onUserStatusChanged?: (userId: string, status: string) => void
  onProjectMembers?: (members: any[]) => void
  onCollaboratorJoined?: (userId: string, userName: string) => void
  onCollaboratorLeft?: (userId: string, userName: string) => void
  onCollaboratorRemoved?: (userId: string, userName: string) => void
  onCollaboratorVisibilityChanged?: (userId: string, userName: string, isVisible: boolean) => void
  onAllCollaboratorsVisibilityChanged?: (isVisible: boolean) => void
  onCustomModesUpdated?: () => void
  onModelsUpdated?: () => void
  onSettingsUpdated?: () => void
}

export function useCollaborationWebSocket({
  projectId,
  userId,
  userName,
  onSessionCreated,
  onSessionUpdated,
  onSessionDeleted,
  onUserJoined,
  onUserLeft,
  onUserStatusChanged,
  onProjectMembers,
  onCollaboratorJoined,
  onCollaboratorLeft,
  onCollaboratorRemoved,
  onCollaboratorVisibilityChanged,
  onAllCollaboratorsVisibilityChanged,
  onCustomModesUpdated,
  onModelsUpdated,
  onSettingsUpdated
}: UseCollaborationWebSocketProps) {
  const wsRef = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [collaborators, setCollaborators] = useState<any[]>([])
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5

  const connect = useCallback(() => {
    if (!projectId || !userId) return

    // Use NEXT_PUBLIC_BACKEND_URL if available, otherwise fallback to localhost
    const backendHttpUrl = typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:3002`)
      : 'http://backend:3002'
    
    // Convert HTTP URL to WebSocket URL
    const backendUrl = backendHttpUrl.replace(/^http/, 'ws')

    const wsUrl = `${backendUrl}?userId=${userId}&userName=${encodeURIComponent(userName)}&projectId=${projectId}`

    console.log('🔌 Connecting to collaboration WebSocket:', wsUrl)

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('✅ Collaboration WebSocket connected')
        setIsConnected(true)
        reconnectAttemptsRef.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const message: CollaborationMessage = JSON.parse(event.data)
          console.log('📨 Collaboration message:', message.type)

          switch (message.type) {
            case 'session-created':
              onSessionCreated?.(message.session)
              break

            case 'session-updated':
              onSessionUpdated?.(message.sessionId, message.updates)
              break

            case 'session-deleted':
              onSessionDeleted?.(message.sessionId)
              break

            case 'user-joined':
              onUserJoined?.(message.userId, message.userName)
              break

            case 'user-left':
              onUserLeft?.(message.userId, message.userName)
              break

            case 'user-status-changed':
              onUserStatusChanged?.(message.userId, message.status)
              setCollaborators(prev =>
                prev.map(c =>
                  c.userId === message.userId ? { ...c, status: message.status } : c
                )
              )
              break

            case 'project-members':
              setCollaborators(message.members)
              onProjectMembers?.(message.members)
              break

            case 'collaborator-joined':
              // New collaborator authenticated - refresh the members list
              console.log('📥 New collaborator joined:', message.userName)
              onCollaboratorJoined?.(message.userId, message.userName)
              // Request updated members list
              sendMessage({ type: 'refresh-collaborators' })
              break

            case 'collaborator-left':
              // Collaborator left the project - refresh the members list
              console.log('📥 Collaborator left:', message.userName)
              onCollaboratorLeft?.(message.userId, message.userName)
              // Request updated members list
              sendMessage({ type: 'refresh-collaborators' })
              break

            case 'collaborator-removed':
              // Collaborator was removed by owner - refresh the members list
              console.log('📥 Collaborator removed:', message.userName)
              onCollaboratorRemoved?.(message.userId, message.userName)
              // Request updated members list
              sendMessage({ type: 'refresh-collaborators' })
              break

            case 'collaborator-visibility-changed':
              // Collaborator visibility changed - refresh the members list
              console.log('📥 Collaborator visibility changed:', message.userName, 'visible:', message.isVisible)
              onCollaboratorVisibilityChanged?.(message.userId, message.userName, message.isVisible)
              // Request updated members list
              sendMessage({ type: 'refresh-collaborators' })
              break

            case 'all-collaborators-visibility-changed':
              // All collaborators visibility changed - refresh the members list
              console.log('📥 All collaborators visibility changed, visible:', message.isVisible)
              onAllCollaboratorsVisibilityChanged?.(message.isVisible)
              // Request updated members list
              sendMessage({ type: 'refresh-collaborators' })
              break

            case 'custom-modes-updated':
              // Custom modes were updated - reload them
              console.log('📥 Custom modes updated')
              onCustomModesUpdated?.()
              break

            case 'models-updated':
              // Models were updated - reload them
              console.log('📥 Models updated')
              onModelsUpdated?.()
              break

            case 'settings-updated':
              // Settings were updated - reload them
              console.log('📥 Settings updated')
              onSettingsUpdated?.()
              break

            default:
              console.log('Unknown message type:', message.type)
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('❌ Collaboration WebSocket error:', error)
      }

      ws.onclose = () => {
        console.log('🔌 Collaboration WebSocket disconnected')
        setIsConnected(false)
        wsRef.current = null

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000)
          console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delay)
        } else {
          console.error('❌ Max reconnection attempts reached')
        }
      }
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
    }
  }, [projectId, userId, userName, onSessionCreated, onSessionUpdated, onSessionDeleted, onUserJoined, onUserLeft, onUserStatusChanged, onProjectMembers])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsConnected(false)
    setCollaborators([])
  }, [])

  const sendMessage = useCallback((message: CollaborationMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket not connected, cannot send message')
    }
  }, [])

  const notifySessionCreated = useCallback((session: any) => {
    sendMessage({
      type: 'session-created',
      session
    })
  }, [sendMessage])

  const notifySessionUpdated = useCallback((sessionId: string, updates: any) => {
    sendMessage({
      type: 'session-updated',
      sessionId,
      updates
    })
  }, [sendMessage])

  const notifySessionDeleted = useCallback((sessionId: string) => {
    sendMessage({
      type: 'session-deleted',
      sessionId
    })
  }, [sendMessage])

  const updateStatus = useCallback((status: 'online' | 'active' | 'away') => {
    sendMessage({
      type: 'status-update',
      status
    })
  }, [sendMessage])

  // Connect when projectId changes
  useEffect(() => {
    if (projectId) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Update status to active on user activity
  useEffect(() => {
    if (!isConnected) return

    const handleActivity = () => {
      updateStatus('active')
    }

    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('keydown', handleActivity)
    window.addEventListener('click', handleActivity)

    return () => {
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('click', handleActivity)
    }
  }, [isConnected, updateStatus])

  return {
    isConnected,
    collaborators,
    notifySessionCreated,
    notifySessionUpdated,
    notifySessionDeleted,
    updateStatus,
    sendMessage
  }
}
