'use client'

import React, { useEffect, useRef, useState } from 'react'

interface TerminalProps {
  isOpen: boolean
  onClose: () => void
  serverUrl: string
}

export const Terminal = ({ isOpen, onClose, serverUrl }: TerminalProps) => {
  const [connected, setConnected] = useState(false)
  const [output, setOutput] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const wsRef = useRef<WebSocket | null>(null)
  const outputEndRef = useRef<HTMLDivElement>(null)
  const outputRef = useRef<string>('')

  // Auto-scroll to bottom
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [output])

  // WebSocket connection setup
  useEffect(() => {
    if (!isOpen) return

    const connectWebSocket = () => {
      try {
        const wsUrl = serverUrl.replace('http', 'ws') + '/ws/terminal'
        console.log('[Terminal] Connecting to:', wsUrl)

        const ws = new WebSocket(wsUrl)

        ws.onopen = () => {
          console.log('[Terminal] Connected')
          setConnected(true)
          setLoading(false)
          // Send initial terminal size
          if (outputRef.current === '') {
            setOutput(['$ '])
          }
        }

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)

            if (msg.type === 'output') {
              outputRef.current += msg.data
              // Update state less frequently for performance
              setOutput((prev) => [...prev, msg.data])
            } else if (msg.type === 'error') {
              console.error('[Terminal] Error:', msg.message)
              setOutput((prev) => [...prev, `\n❌ Error: ${msg.message}\n`])
            } else if (msg.type === 'close') {
              console.log('[Terminal] Connection closed by server')
              setConnected(false)
            }
          } catch (err) {
            console.error('[Terminal] Error parsing message:', err)
          }
        }

        ws.onerror = (error) => {
          console.error('[Terminal] WebSocket error:', error)
          setConnected(false)
          setLoading(false)
        }

        ws.onclose = () => {
          console.log('[Terminal] Disconnected')
          setConnected(false)
          setLoading(false)
        }

        wsRef.current = ws
      } catch (err) {
        console.error('[Terminal] Connection failed:', err)
        setLoading(false)
      }
    }

    connectWebSocket()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [isOpen, serverUrl])

  const handleSendCommand = (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return
    }

    // Send command to WebSocket
    wsRef.current.send(JSON.stringify({
      type: 'input',
      data: input + '\n'
    }))

    // Add to local output
    setOutput((prev) => [...prev, input + '\n'])
    outputRef.current += input + '\n'
    setInput('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
      <div className="w-full h-full max-w-6xl max-h-[90vh] flex flex-col rounded-lg bg-slate-950 border border-slate-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="ml-2 text-white font-mono text-sm">Kali Linux Terminal</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Terminal Output */}
        <div className="flex-1 overflow-auto bg-black p-6 font-mono text-sm text-green-400 space-y-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-400"></div>
                </div>
                <p className="mt-4 text-green-400">Connecting to Kali container...</p>
              </div>
            </div>
          ) : (
            <>
              {output.map((line, idx) => (
                <div key={idx} className="whitespace-pre-wrap break-words">
                  {line}
                </div>
              ))}
              <div ref={outputEndRef} />
            </>
          )}
        </div>

        {/* Status Bar */}
        <div className="px-6 py-2 border-t border-slate-700 bg-slate-900 text-xs text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>{connected ? 'Connected to Kali' : 'Disconnected'}</span>
          </div>
          <span>Type commands below</span>
        </div>

        {/* Input */}
        <form onSubmit={handleSendCommand} className="border-t border-slate-700 p-4 bg-slate-900">
          <div className="flex items-center gap-2 bg-black rounded p-3">
            <span className="text-green-400 font-mono">$</span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!connected}
              placeholder={connected ? 'Enter command...' : 'Connecting...'}
              className="flex-1 bg-transparent text-green-400 font-mono outline-none placeholder-slate-600"
              autoFocus
            />
            <button
              type="submit"
              disabled={!connected || !input.trim()}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded font-mono text-sm transition-colors"
            >
              Execute
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
