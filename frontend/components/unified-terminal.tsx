'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Terminal, Send, Loader2, RefreshCw, ExternalLink } from 'lucide-react'
import { createTerminalConnection, type ConnectionStatus } from '@/lib/terminal-connection'
import { checkTerminalHealth } from '@/lib/terminal-health-check'
import ContextPanel from './terminal/ContextPanel'
import { DesktopContext } from '@/types/context'

/**
 * Kali Pentest Terminal Component
 * 
 * Connects to the kali-pentest container that runs:
 * - ttyd terminal (visible bash session on port 8081)
 * - VNC Desktop (XFCE4 GUI on port 7681)
 * - Full Kali Linux pentest tools
 * 
 * This terminal connects to the SAME Kali Linux OS as the desktop GUI!
 * Files created in terminal appear in desktop, and vice versa.
 * 
 * AI commands appear directly in the terminal!
 */

interface ContainerInfo {
  name: string;
  externalPort: number;
  internalPort: number;
  vncPort: number;
}

export const UnifiedTerminal: React.FC = () => {
  const [message, setMessage] = useState('')
  const [chatHistory, setChatHistory] = useState<Array<{role: string, content: string}>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [terminalStatus, setTerminalStatus] = useState<ConnectionStatus>('connecting')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [lastConnected, setLastConnected] = useState<Date | null>(null)
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  const [desktopContext, setDesktopContext] = useState<DesktopContext | null>(null)
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const connectionRef = useRef<ReturnType<typeof createTerminalConnection> | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  
  // Container information
  const containerInfo: ContainerInfo = {
    name: 'kali-pentest',
    externalPort: 8081,
    internalPort: 8080,
    vncPort: 7681,
  }
  
  // URLs for the kali-pentest container
  // Terminal connects to port 8081 (ttyd) - same OS as desktop GUI
  const terminalUrl = typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_TERMINAL_URL || 'http://localhost:8081')
    : 'http://localhost:8081'
  const backendUrl = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:3002`)
    : 'http://backend:3002'

  useEffect(() => {
    // Initialize terminal connection manager
    const connection = createTerminalConnection({
      url: terminalUrl,
      reconnectAttempts: 3,
      reconnectDelay: 2000,
      connectionTimeout: 5000,
      onConnect: () => {
        console.log('✅ Terminal connected');
        setLastConnected(new Date());
        setErrorMessage('');
      },
      onDisconnect: () => {
        console.log('🔌 Terminal disconnected');
      },
      onError: (error) => {
        console.error('❌ Terminal error:', error.message);
        setErrorMessage(error.message);
      },
      onStatusChange: (status) => {
        setTerminalStatus(status);
        const state = connection.getState();
        setReconnectAttempt(state.reconnectAttempt);
      },
    });

    connectionRef.current = connection;

    // Start connection
    connection.connect().catch((error) => {
      console.error('Failed to connect:', error);
    });

    // Cleanup on unmount
    return () => {
      connection.disconnect();
    };
  }, [terminalUrl])

  // WebSocket connection for desktop context updates
  useEffect(() => {
    // Use NEXT_PUBLIC_BACKEND_URL if available, otherwise fallback to localhost
    const backendHttpUrl = typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:3002`)
      : 'http://backend:3002'
    
    // Convert HTTP URL to WebSocket URL
    const wsUrl = backendHttpUrl.replace(/^http/, 'ws')
    
    const ws = new WebSocket(wsUrl)
    
    ws.onopen = () => {
      console.log('✅ WebSocket connected for desktop context')
    }
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'context_update' && data.context) {
          setDesktopContext(data.context)
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    
    ws.onclose = () => {
      console.log('WebSocket closed')
    }
    
    wsRef.current = ws
    
    return () => {
      ws.close()
    }
  }, [])

  const sendMessage = async () => {
    if (!message.trim() || isLoading) return

    const userMessage = message.trim()
    setMessage('')
    setIsLoading(true)

    // Add to command history
    setCommandHistory(prev => [...prev, userMessage])
    setHistoryIndex(-1)

    // Add user message to chat
    const newHistory = [...chatHistory, { role: 'user', content: userMessage }]
    setChatHistory(newHistory)

    try {
      const response = await fetch(`${backendUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: chatHistory,
          model: 'gemini-2.0-flash-exp'
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Add AI response to chat
      setChatHistory([...newHistory, { 
        role: 'assistant', 
        content: data.response 
      }])

      // Commands are automatically executed and visible in terminal!
      if (data.commandOutputs && data.commandOutputs.length > 0) {
        console.log('✅ Commands executed:', data.commandOutputs)
      }

    } catch (error) {
      console.error('Chat error:', error)
      setChatHistory([...newHistory, { 
        role: 'assistant', 
        content: `Error: ${error instanceof Error ? error.message : 'Failed to send message'}` 
      }])
    } finally {
      setIsLoading(false)
    }
  }

  // Manual reconnect handler
  const handleReconnect = async () => {
    if (connectionRef.current) {
      try {
        await connectionRef.current.reconnect();
      } catch (error) {
        console.error('Manual reconnect failed:', error);
      }
    }
  };

  // Open terminal in new tab
  const openInNewTab = () => {
    window.open(terminalUrl, '_blank');
  };

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Terminal Panel - Left Side */}
      <div className="flex-1 flex flex-col border-r border-gray-700">
        <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-green-400" />
            <span className="text-white font-semibold">Kali Pentest Terminal</span>
            <div className={`ml-auto w-2 h-2 rounded-full ${
              terminalStatus === 'connected' ? 'bg-green-500' :
              terminalStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
              terminalStatus === 'error' ? 'bg-red-500' :
              'bg-gray-500'
            }`} />
            <span className="text-sm text-gray-400">
              {terminalStatus === 'connected' ? 'Connected' :
               terminalStatus === 'connecting' ? `Connecting${reconnectAttempt > 0 ? ` (${reconnectAttempt}/3)` : ''}...` :
               terminalStatus === 'error' ? 'Error' :
               'Disconnected'}
            </span>
            {terminalStatus === 'error' && (
              <button
                onClick={handleReconnect}
                className="ml-2 p-1 hover:bg-gray-700 rounded transition-colors"
                title="Retry connection"
              >
                <RefreshCw className="w-4 h-4 text-gray-400 hover:text-white" />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-gray-500">
              Container: <span className="text-green-400">{containerInfo.name}</span> • 
              Port: <span className="text-green-400">{containerInfo.externalPort}</span> (internal {containerInfo.internalPort}) • 
              VNC: <span className="text-green-400">{containerInfo.vncPort}</span>
            </p>
            {lastConnected && (
              <p className="text-xs text-gray-600">
                Last connected: {lastConnected.toLocaleTimeString()}
              </p>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Same OS as VNC desktop • Files sync between terminal & GUI
          </p>
        </div>
        
        <div className="flex-1 bg-black relative flex flex-col" style={{ overflow: 'hidden' }}>
          {/* Terminal iframe */}
          <div className="flex-1 relative" style={{ overflow: 'hidden' }}>
            <iframe
              ref={iframeRef}
              src={terminalUrl}
              className="absolute inset-0 w-full h-full border-0"
              title="Kali Linux Terminal"
              allow="clipboard-read; clipboard-write"
              scrolling="auto"
              style={{ 
                overflow: 'auto',
                WebkitOverflowScrolling: 'touch'
              }}
            />
          
            {terminalStatus === 'connecting' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 pointer-events-none">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-green-400 animate-spin mx-auto mb-4" />
                  <p className="text-green-400">Connecting to terminal...</p>
                </div>
              </div>
            )}
          </div>
          
          {terminalStatus === 'error' && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-2xl px-4">
                <div className="text-red-500 text-4xl mb-4">⚠️</div>
                <p className="text-red-400 mb-2 font-semibold">Failed to connect to Kali Pentest terminal</p>
                {errorMessage && (
                  <p className="text-gray-400 text-sm mb-4">
                    Error: {errorMessage}
                  </p>
                )}
                
                <div className="bg-gray-800 rounded-lg p-4 mb-4 text-left">
                  <p className="text-white text-sm font-semibold mb-2">🔧 Troubleshooting Steps:</p>
                  <ol className="text-gray-300 text-sm space-y-2 list-decimal list-inside">
                    <li>
                      Check if the <span className="text-green-400">{containerInfo.name}</span> container is running:
                      <code className="block bg-gray-900 text-green-400 p-2 rounded mt-1 text-xs">
                        docker ps | grep {containerInfo.name}
                      </code>
                    </li>
                    <li>
                      Start the container if not running:
                      <code className="block bg-gray-900 text-green-400 p-2 rounded mt-1 text-xs">
                        docker-compose up {containerInfo.name}
                      </code>
                    </li>
                    <li>
                      Verify port mapping (should show {containerInfo.externalPort}:{containerInfo.internalPort}):
                      <code className="block bg-gray-900 text-green-400 p-2 rounded mt-1 text-xs">
                        docker port {containerInfo.name}
                      </code>
                    </li>
                    <li>
                      Check container logs for errors:
                      <code className="block bg-gray-900 text-green-400 p-2 rounded mt-1 text-xs">
                        docker logs {containerInfo.name}
                      </code>
                    </li>
                  </ol>
                </div>

                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleReconnect}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry Connection
                  </button>
                  <button
                    onClick={openInNewTab}
                    className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in New Tab
                  </button>
                </div>

                <p className="text-gray-500 text-xs mt-4">
                  This terminal connects to the same Kali Linux OS as the VNC desktop (port {containerInfo.vncPort})
                </p>
              </div>
            </div>
          )}
          
          {/* Desktop Context Panel */}
          <ContextPanel context={desktopContext} />
        </div>
      </div>

      {/* Chat Panel - Right Side */}
      <div className="w-96 flex flex-col bg-gray-800">
        <div className="bg-gray-900 px-4 py-3 border-b border-gray-700">
          <h2 className="text-white font-semibold">AI Assistant</h2>
          <p className="text-xs text-gray-400 mt-1">
            Commands appear in terminal →
          </p>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatHistory.length === 0 && (
            <div className="text-center text-gray-500 mt-8">
              <p className="mb-2">👋 Ask me to run commands!</p>
              <p className="text-sm">Try: "run whoami" or "list files"</p>
            </div>
          )}
          
          {chatHistory.map((msg, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white ml-8'
                  : 'bg-gray-700 text-gray-100 mr-8'
              }`}
            >
              <div className="text-xs opacity-75 mb-1">
                {msg.role === 'user' ? 'You' : 'AI'}
              </div>
              <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
            </div>
          ))}
          
          {isLoading && (
            <div className="bg-gray-700 text-gray-100 mr-8 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">AI is thinking...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  sendMessage()
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  if (commandHistory.length > 0) {
                    const newIndex = historyIndex === -1 
                      ? commandHistory.length - 1 
                      : Math.max(0, historyIndex - 1)
                    setHistoryIndex(newIndex)
                    setMessage(commandHistory[newIndex])
                  }
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  if (historyIndex !== -1) {
                    const newIndex = historyIndex + 1
                    if (newIndex >= commandHistory.length) {
                      setHistoryIndex(-1)
                      setMessage('')
                    } else {
                      setHistoryIndex(newIndex)
                      setMessage(commandHistory[newIndex])
                    }
                  }
                }
              }}
              placeholder="Ask AI to run commands..."
              disabled={isLoading}
              className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !message.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white p-2 rounded-lg transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UnifiedTerminal
