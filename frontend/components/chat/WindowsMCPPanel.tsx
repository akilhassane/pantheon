'use client'

import React, { useState, useEffect } from 'react'
import { useWindowsMCP } from '@/hooks/useWindowsMCP'
import { Monitor, Mouse, Keyboard, Camera, Terminal, FileText, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

interface WindowsMCPPanelProps {
  projectId: string
  mcpPort: number
  apiKey: string
  onToolExecute?: (toolName: string, result: any) => void
}

export function WindowsMCPPanel({ projectId, mcpPort, apiKey, onToolExecute }: WindowsMCPPanelProps) {
  const [activeTab, setActiveTab] = useState<'quick' | 'tools' | 'console'>('quick')
  const [consoleCommand, setConsoleCommand] = useState('')
  const [consoleOutput, setConsoleOutput] = useState<Array<{ type: 'command' | 'output' | 'error', text: string }>>([])
  const [mouseX, setMouseX] = useState('500')
  const [mouseY, setMouseY] = useState('300')
  const [textToType, setTextToType] = useState('')
  
  const mcp = useWindowsMCP({
    apiKey,
    baseUrl: `http://localhost:${mcpPort}`
  })

  // Test connection on mount
  useEffect(() => {
    mcp.testConnection().then(connected => {
      if (connected) {
        mcp.loadTools()
      }
    })
  }, [mcpPort])

  const handleQuickAction = async (action: string) => {
    let result
    
    switch (action) {
      case 'screenshot':
        result = await mcp.takeScreenshot()
        if (result.success && result.imageData) {
          // Convert base64 to blob and download
          const blob = base64ToBlob(result.imageData, 'image/png')
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `screenshot_${Date.now()}.png`
          a.click()
          URL.revokeObjectURL(url)
        }
        break
      
      case 'sysinfo':
        result = await mcp.getSystemInfo()
        if (result.success) {
          setConsoleOutput(prev => [
            ...prev,
            { type: 'command', text: 'get_system_info' },
            { type: 'output', text: result.output || '' }
          ])
          setActiveTab('console')
        }
        break
      
      case 'movemouse':
        result = await mcp.moveMouse(parseInt(mouseX), parseInt(mouseY))
        break
      
      case 'typetext':
        result = await mcp.typeText(textToType)
        break
    }
    
    if (result && onToolExecute) {
      onToolExecute(action, result)
    }
  }

  const handleConsoleCommand = async () => {
    if (!consoleCommand.trim()) return
    
    setConsoleOutput(prev => [...prev, { type: 'command', text: consoleCommand }])
    
    const result = await mcp.executePowerShell(consoleCommand)
    
    if (result.success) {
      setConsoleOutput(prev => [...prev, { type: 'output', text: result.output || '' }])
    } else {
      setConsoleOutput(prev => [...prev, { type: 'error', text: result.error || 'Command failed' }])
    }
    
    setConsoleCommand('')
    
    if (onToolExecute) {
      onToolExecute('execute_powershell', result)
    }
  }

  const base64ToBlob = (base64: string, mimeType: string) => {
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: mimeType })
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Monitor className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Windows MCP Control</h3>
        </div>
        <div className="flex items-center gap-2">
          {mcp.isConnected ? (
            <div className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle2 className="w-3 h-3" />
              <span>Connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-red-400">
              <XCircle className="w-3 h-3" />
              <span>Disconnected</span>
            </div>
          )}
          <span className="text-xs text-slate-400">Port {mcpPort}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 bg-slate-800/50">
        <button
          onClick={() => setActiveTab('quick')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'quick'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Quick Actions
        </button>
        <button
          onClick={() => setActiveTab('tools')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'tools'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Tools ({mcp.availableTools.length})
        </button>
        <button
          onClick={() => setActiveTab('console')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'console'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Console
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'quick' && (
          <div className="space-y-4">
            {/* Screenshot */}
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Camera className="w-4 h-4 text-blue-400" />
                <h4 className="text-sm font-medium text-white">Screenshot</h4>
              </div>
              <p className="text-xs text-slate-400 mb-3">Capture the Windows desktop</p>
              <button
                onClick={() => handleQuickAction('screenshot')}
                disabled={mcp.isExecuting || !mcp.isConnected}
                className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm rounded-md transition-colors flex items-center justify-center gap-2"
              >
                {mcp.isExecuting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Taking Screenshot...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    <span>Take Screenshot</span>
                  </>
                )}
              </button>
            </div>

            {/* System Info */}
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Monitor className="w-4 h-4 text-green-400" />
                <h4 className="text-sm font-medium text-white">System Info</h4>
              </div>
              <p className="text-xs text-slate-400 mb-3">Get Windows system information</p>
              <button
                onClick={() => handleQuickAction('sysinfo')}
                disabled={mcp.isExecuting || !mcp.isConnected}
                className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm rounded-md transition-colors flex items-center justify-center gap-2"
              >
                {mcp.isExecuting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Getting Info...</span>
                  </>
                ) : (
                  <>
                    <Monitor className="w-4 h-4" />
                    <span>Get System Info</span>
                  </>
                )}
              </button>
            </div>

            {/* Mouse Control */}
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Mouse className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-medium text-white">Mouse Control</h4>
              </div>
              <p className="text-xs text-slate-400 mb-3">Move mouse to coordinates</p>
              <div className="flex gap-2 mb-2">
                <input
                  type="number"
                  value={mouseX}
                  onChange={(e) => setMouseX(e.target.value)}
                  placeholder="X"
                  className="flex-1 px-3 py-2 bg-slate-700 text-white text-sm rounded-md border border-slate-600 focus:border-purple-400 focus:outline-none"
                />
                <input
                  type="number"
                  value={mouseY}
                  onChange={(e) => setMouseY(e.target.value)}
                  placeholder="Y"
                  className="flex-1 px-3 py-2 bg-slate-700 text-white text-sm rounded-md border border-slate-600 focus:border-purple-400 focus:outline-none"
                />
              </div>
              <button
                onClick={() => handleQuickAction('movemouse')}
                disabled={mcp.isExecuting || !mcp.isConnected}
                className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm rounded-md transition-colors flex items-center justify-center gap-2"
              >
                {mcp.isExecuting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Moving...</span>
                  </>
                ) : (
                  <>
                    <Mouse className="w-4 h-4" />
                    <span>Move Mouse</span>
                  </>
                )}
              </button>
            </div>

            {/* Type Text */}
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Keyboard className="w-4 h-4 text-yellow-400" />
                <h4 className="text-sm font-medium text-white">Type Text</h4>
              </div>
              <p className="text-xs text-slate-400 mb-3">Type text into Windows</p>
              <input
                type="text"
                value={textToType}
                onChange={(e) => setTextToType(e.target.value)}
                placeholder="Enter text to type..."
                className="w-full px-3 py-2 bg-slate-700 text-white text-sm rounded-md border border-slate-600 focus:border-yellow-400 focus:outline-none mb-2"
              />
              <button
                onClick={() => handleQuickAction('typetext')}
                disabled={mcp.isExecuting || !mcp.isConnected || !textToType}
                className="w-full px-3 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm rounded-md transition-colors flex items-center justify-center gap-2"
              >
                {mcp.isExecuting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Typing...</span>
                  </>
                ) : (
                  <>
                    <Keyboard className="w-4 h-4" />
                    <span>Type Text</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="space-y-2">
            {mcp.availableTools.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">No tools available</p>
                <p className="text-xs mt-1">Check MCP server connection</p>
              </div>
            ) : (
              mcp.availableTools.map((tool) => (
                <div key={tool.name} className="bg-slate-800 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-white mb-1">{tool.name}</h4>
                  <p className="text-xs text-slate-400">{tool.description}</p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'console' && (
          <div className="flex flex-col h-full">
            {/* Console Output */}
            <div className="flex-1 bg-slate-950 rounded-lg p-3 mb-3 overflow-y-auto font-mono text-xs">
              {consoleOutput.length === 0 ? (
                <div className="text-slate-500">PowerShell console ready...</div>
              ) : (
                consoleOutput.map((line, index) => (
                  <div
                    key={index}
                    className={`mb-1 ${
                      line.type === 'command'
                        ? 'text-blue-400'
                        : line.type === 'error'
                        ? 'text-red-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {line.type === 'command' && '> '}
                    {line.text}
                  </div>
                ))
              )}
            </div>

            {/* Console Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={consoleCommand}
                onChange={(e) => setConsoleCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleConsoleCommand()
                  }
                }}
                placeholder="Enter PowerShell command..."
                className="flex-1 px-3 py-2 bg-slate-800 text-white text-sm rounded-md border border-slate-600 focus:border-blue-400 focus:outline-none font-mono"
              />
              <button
                onClick={handleConsoleCommand}
                disabled={mcp.isExecuting || !mcp.isConnected || !consoleCommand.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm rounded-md transition-colors flex items-center gap-2"
              >
                {mcp.isExecuting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Terminal className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
