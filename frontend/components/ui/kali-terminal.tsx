'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Terminal, Maximize2, Minimize2, RefreshCw } from 'lucide-react'

export const KaliTerminal: React.FC<{ isExpanded?: boolean }> = ({ isExpanded = true }) => {
  const [isExpandedState, setIsExpandedState] = useState(isExpanded)
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('connecting')
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [novncUrl, setNovncUrl] = useState<string>('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [command, setCommand] = useState<string>('')
  const [commandStatus, setCommandStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Determine the noVNC URL based on environment
  useEffect(() => {
    const hostname = window.location.hostname || 'localhost'
    const protocol = window.location.protocol

    // noVNC runs on port 7681 (from test-kali-bash working config)
    // Using vnc_lite.html (no UI controls) with resize=scale for perfect fit
    // Add timestamp to bust browser cache
    const timestamp = Date.now()
    const vncUrl = `${protocol}//${hostname}:7681/vnc_lite.html?autoconnect=true&resize=scale&reconnect=true&view_only=false&quality=9&compression=2&t=${timestamp}`

    console.log('🖥️ Connecting to Kali Linux GUI via noVNC:', vncUrl)
    setNovncUrl(vncUrl)

    // Set connection status based on iframe load
    const checkConnection = setTimeout(() => {
      setConnectionStatus('connected')
    }, 2000)

    return () => clearTimeout(checkConnection)
  }, [])

  const handleIframeLoad = () => {
    console.log('✅ noVNC iframe loaded successfully')
    setConnectionStatus('connected')
    
    // Inject CSS to hide the top bar and resize VNC to match iframe
    try {
      const iframe = iframeRef.current
      if (iframe?.contentWindow?.document) {
        const style = iframe.contentWindow.document.createElement('style')
        style.textContent = `
          /* Hide the top bar completely */
          #top_bar, #noVNC_control_bar, #noVNC_status, .noVNC_status, 
          #sendCtrlAltDelButton, #status {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            overflow: hidden !important;
          }
          
          /* Full viewport sizing */
          body, html {
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            width: 100% !important;
            height: 100% !important;
          }
          
          /* Container fills entire space */
          #noVNC_container, #screen {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* Canvas scales to fit iframe perfectly */
          canvas, #noVNC_canvas {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            object-fit: contain !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        `
        iframe.contentWindow.document.head.appendChild(style)
        console.log('✅ Injected CSS to hide top bar and resize VNC')
      }
    } catch (e) {
      console.warn('Could not inject CSS into iframe (CORS restriction):', e)
    }
  }

  const handleIframeError = () => {
    console.error('❌ Failed to load noVNC')
    setConnectionStatus('disconnected')
  }

  const handleRefresh = () => {
    if (iframeRef.current) {
      setConnectionStatus('connecting')
      // Add timestamp to force reload and bypass cache
      const timestamp = Date.now()
      const hostname = window.location.hostname || 'localhost'
      const protocol = window.location.protocol
      iframeRef.current.src = `${protocol}//${hostname}:7681/vnc_lite.html?autoconnect=true&resize=scale&reconnect=true&view_only=false&quality=9&compression=2&t=${timestamp}`
    }
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const executeCommand = async () => {
    if (!command.trim()) {
      setCommandStatus({ message: 'Please enter a command', type: 'error' })
      return
    }

    try {
      const hostname = window.location.hostname || 'localhost'
      const protocol = window.location.protocol
      const apiUrl = `${protocol}//${hostname}:9000/execute`

      console.log(`📤 Sending command to GoTTY API: ${command}`)

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `command=${encodeURIComponent(command)}`
      })

      const result = await response.json()

      if (result.status === 'success') {
        setCommandStatus({ message: `✅ Executed: ${command}`, type: 'success' })
        console.log('✅ Command executed successfully')
        setCommand('') // Clear input
      } else {
        setCommandStatus({ message: `❌ Error: ${result.message}`, type: 'error' })
        console.error('❌ Command failed:', result)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setCommandStatus({ message: `❌ Error: ${errorMessage}`, type: 'error' })
      console.error('❌ Error sending command:', error)
    }

    // Clear status after 3 seconds
    setTimeout(() => setCommandStatus(null), 3000)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeCommand()
    }
  }

  return (
    <div className={`flex flex-col bg-black rounded-lg border border-lime-700 overflow-hidden font-mono ${
      isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'h-full'
    }`}>
      {/* Header with Terminal Info */}
      <div className="bg-black border-b border-lime-700 px-4 py-2 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-lime-500" />
            <span className="text-sm text-lime-400">Kali Linux GUI (noVNC)</span>
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected'
                ? 'bg-lime-500'
                : connectionStatus === 'connecting'
                ? 'bg-yellow-500 animate-pulse'
                : 'bg-red-500'
            }`} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </span>
            <button
              onClick={handleRefresh}
              className="text-lime-400 hover:text-lime-300 transition-colors"
              title="Refresh connection"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="text-lime-400 hover:text-lime-300 transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {/* Terminal Session Info */}
        <div className="text-xs text-gray-400 space-y-0.5">
          <div>Container: <span className="text-lime-400">test-kali-bash</span> | Display: <span className="text-lime-400">:99 (1920x1080)</span></div>
          <div>Port: <span className="text-lime-400">7681</span> | Credentials: <span className="text-lime-400">kali / kali</span></div>
        </div>
        
        {/* Command Execution Panel */}
        <div className="mt-3 pt-3 border-t border-lime-700/30">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter bash command (e.g., whoami, ls -la)"
              className="flex-1 bg-gray-900 text-lime-400 px-3 py-1.5 rounded text-xs border border-lime-700/50 focus:border-lime-500 focus:outline-none placeholder-gray-600"
            />
            <button
              onClick={executeCommand}
              disabled={!command.trim()}
              className="bg-lime-600 hover:bg-lime-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded text-xs font-medium transition-colors"
            >
              Execute
            </button>
          </div>
          {commandStatus && (
            <div className={`mt-2 text-xs px-3 py-1.5 rounded ${
              commandStatus.type === 'success' ? 'bg-lime-900/30 text-lime-400' : 'bg-red-900/30 text-red-400'
            }`}>
              {commandStatus.message}
            </div>
          )}
        </div>
      </div>

      {/* noVNC Display Area */}
      {isExpandedState && (
        <div className="flex-1 bg-black relative" style={{ overflow: 'hidden', minHeight: 0, position: 'relative' }}>
          {connectionStatus === 'connecting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-500 mx-auto mb-4"></div>
                <p className="text-lime-400 text-sm">Connecting to Kali Linux GUI...</p>
                <p className="text-gray-500 text-xs mt-2">Please ensure Docker container is running</p>
              </div>
            </div>
          )}
          {connectionStatus === 'disconnected' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
              <div className="text-center max-w-md px-4">
                <div className="text-red-500 text-4xl mb-4">⚠️</div>
                <p className="text-red-400 text-sm mb-4">Failed to connect to Kali Linux GUI</p>
                <div className="text-left bg-gray-900 rounded p-4 mb-4">
                  <p className="text-gray-400 text-xs mb-2">Troubleshooting steps:</p>
                  <ol className="text-gray-400 text-xs space-y-1 list-decimal list-inside">
                    <li>Verify container is running: <code className="text-lime-400">docker ps</code></li>
                    <li>Check port 7681 is exposed: <code className="text-lime-400">docker port test-kali-bash</code></li>
                    <li>Ensure noVNC is running inside container</li>
                    <li>Try accessing directly: <a href={novncUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">{novncUrl}</a></li>
                  </ol>
                </div>
                <button
                  onClick={handleRefresh}
                  className="bg-lime-600 hover:bg-lime-700 text-white px-4 py-2 rounded text-sm transition-colors"
                >
                  Retry Connection
                </button>
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={novncUrl}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            className="border-0"
            title="Kali Linux GUI (noVNC)"
            allow="clipboard-read; clipboard-write; fullscreen"
            sandbox="allow-same-origin allow-scripts allow-forms allow-modals allow-popups allow-pointer-lock"
            style={{ 
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              border: 'none',
              overflow: 'hidden'
            }}
          />
        </div>
      )}
    </div>
  )
}

export default KaliTerminal
