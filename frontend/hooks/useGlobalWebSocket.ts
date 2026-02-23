import { useEffect, useRef, useState, useCallback } from 'react'

interface GlobalMessage {
  type: string
  [key: string]: any
}

interface UseGlobalWebSocketProps {
  userId: string | null
  userName: string
  onCollaborationAdded?: (projectId: string, projectName: string) => void
  onCollaborationRemoved?: (projectId: string) => void
}

/**
 * Global WebSocket connection for user-level events
 * This stays connected regardless of which project is active
 */
export function useGlobalWebSocket({
  userId,
  userName,
  onCollaborationAdded,
  onCollaborationRemoved
}: UseGlobalWebSocketProps) {
  const wsRef = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5

  const connect = useCallback(() => {
    if (!userId) return

    // Use NEXT_PUBLIC_BACKEND_URL if available, otherwise fallback to localhost
    const backendHttpUrl = typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:3002`)
      : 'http://backend:3002'
    
    // Convert HTTP URL to WebSocket URL
    const backendUrl = backendHttpUrl.replace(/^http/, 'ws')

    // Global WebSocket - no projectId
    const wsUrl = `${backendUrl}/global?userId=${userId}&userName=${encodeURIComponent(userName)}`

    console.log('🌐 Connecting to global WebSocket:', wsUrl)

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('✅ Global WebSocket connected')
        setIsConnected(true)
        reconnectAttemptsRef.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const message: GlobalMessage = JSON.parse(event.data)
          console.log('📨 Global message:', message.type)

          switch (message.type) {
            case 'collaboration-added':
              // User was added to a project
              console.log('📥 Added to collaboration:', message.projectId, message.projectName)
              onCollaborationAdded?.(message.projectId, message.projectName)
              break

            case 'collaboration-removed':
              // User was removed from a project
              console.log('📥 Removed from collaboration:', message.projectId)
              onCollaborationRemoved?.(message.projectId)
              break

            default:
              console.log('Unknown global message type:', message.type)
          }
        } catch (error) {
          console.error('Failed to parse global WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('❌ Global WebSocket error:', error)
      }

      ws.onclose = () => {
        console.log('🔌 Global WebSocket disconnected')
        setIsConnected(false)
        wsRef.current = null

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000)
          console.log(`🔄 Reconnecting global WebSocket in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delay)
        } else {
          console.error('❌ Max global reconnection attempts reached')
        }
      }
    } catch (error) {
      console.error('Failed to create global WebSocket:', error)
    }
  }, [userId, userName, onCollaborationAdded, onCollaborationRemoved])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsConnected(false)
  }, [])

  const sendMessage = useCallback((message: GlobalMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    } else {
      console.warn('Global WebSocket not connected, cannot send message')
    }
  }, [])

  // Connect when userId changes
  useEffect(() => {
    if (userId) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  return {
    isConnected,
    sendMessage
  }
}
