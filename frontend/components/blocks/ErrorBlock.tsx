'use client'

import React, { useState } from 'react'
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'

interface ErrorBlockProps {
  message: string
  type?: string
  stack?: string
  code?: string
  focused?: boolean
  onClick?: () => void
}

export default function ErrorBlock({
  message,
  type,
  stack,
  code,
  focused,
  onClick
}: ErrorBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div
      className={`
        rounded-md border transition-all
        ${focused ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-700'}
        bg-gray-800/30
      `}
      onClick={onClick}
      role="alert"
    >
      {/* Compact Header */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
        <span className="text-xs text-gray-300 flex-1 truncate">
          {type || 'Error'}: {message}
        </span>
        {stack && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
            className="p-0.5 hover:bg-gray-700 rounded transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand stack trace'}
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
      {isExpanded && stack && (
        <div className="px-2 pb-2 border-t border-gray-700/50 pt-2">
          <pre className="text-xs font-mono text-gray-400 whitespace-pre-wrap max-h-40 overflow-y-auto">
            {stack}
          </pre>
        </div>
      )}
    </div>
  )
}
