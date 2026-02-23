'use client'

import React, { useEffect, useState } from 'react'
import { Loader2, Terminal, CheckCircle, XCircle } from 'lucide-react'
import CommandOutputBlock from './CommandOutputBlock'

interface CommandExecutionBlockProps {
  command: string
  status: 'pending' | 'executing' | 'completed' | 'error'
  output?: string
  exitCode?: number
  duration?: number
  focused?: boolean
  onClick?: () => void
}

const TIMEOUT_MS = 30000 // 30 seconds

export default function CommandExecutionBlock({
  command,
  status,
  output,
  exitCode,
  duration,
  focused,
  onClick
}: CommandExecutionBlockProps) {
  const [hasTimedOut, setHasTimedOut] = useState(false)

  useEffect(() => {
    if (status === 'executing' || status === 'pending') {
      const timeoutId = setTimeout(() => {
        setHasTimedOut(true)
      }, TIMEOUT_MS)
      return () => clearTimeout(timeoutId)
    } else {
      setHasTimedOut(false)
    }
  }, [status])

  if (!command || command.trim() === '') {
    return null
  }

  // If completed, render the full CommandOutputBlock
  if (status === 'completed' && output !== undefined) {
    return (
      <CommandOutputBlock
        command={command}
        output={output}
        status={exitCode === 0 ? 'success' : 'error'}
        exitCode={exitCode}
        duration={duration}
        focused={focused}
        onClick={onClick}
      />
    )
  }

  // Render loading/executing state
  const isExecuting = status === 'executing' || status === 'pending'
  const isError = status === 'error'

  return (
    <div
      className={`
        rounded-md border transition-all
        ${focused ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-700'}
        bg-gray-800/30
      `}
      onClick={onClick}
    >
      {/* Compact Header */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        {isExecuting ? (
          <Loader2 className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" />
        ) : isError ? (
          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
        ) : (
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
        )}
        <Terminal className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <code className="text-xs font-mono text-gray-300 flex-1 truncate">
          {command}
        </code>
        <span className="text-xs text-gray-500 italic">
          {hasTimedOut ? 'timeout' : isExecuting ? 'running...' : 'error'}
        </span>
      </div>
    </div>
  )
}
