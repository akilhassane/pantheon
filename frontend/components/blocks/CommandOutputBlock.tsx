'use client'

import React, { useState } from 'react'
import { Check, X, ChevronDown, ChevronUp, Terminal } from 'lucide-react'

interface CommandOutputBlockProps {
  command: string
  output: string
  status: 'success' | 'error' | 'timeout'
  exitCode?: number
  duration?: number
  focused?: boolean
  onClick?: () => void
}

export default function CommandOutputBlock({
  command,
  output,
  status,
  exitCode,
  duration,
  focused,
  onClick
}: CommandOutputBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isSuccess = status === 'success'

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
        {isSuccess ? (
          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
        ) : (
          <X className="w-4 h-4 text-red-500 flex-shrink-0" />
        )}
        <Terminal className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <code className="text-xs font-mono text-gray-300 flex-1 truncate">
          {command}
        </code>
        {duration && (
          <span className="text-xs text-gray-500">{duration}ms</span>
        )}
        {output && output.trim() && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
            className="p-0.5 hover:bg-gray-700 rounded transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand output'}
          >
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            )}
          </button>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && output && output.trim() && (
        <div className="px-2 pb-2 border-t border-gray-700/50 pt-2">
          <pre className="text-xs font-mono text-gray-400 whitespace-pre-wrap max-h-60 overflow-y-auto">
            {output}
          </pre>
        </div>
      )}
    </div>
  )
}
