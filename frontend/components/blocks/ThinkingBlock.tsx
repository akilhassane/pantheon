'use client'

import React, { useState } from 'react'
import { Brain, ChevronDown, ChevronUp } from 'lucide-react'
import { ThinkingStep } from '@/types/chat'

interface ThinkingBlockProps {
  steps: ThinkingStep[]
  collapsed?: boolean
  onToggle?: () => void
  focused?: boolean
  onClick?: () => void
}

export default function ThinkingBlock({
  steps,
  collapsed = false,
  onToggle,
  focused,
  onClick
}: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(!collapsed)

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
        <Brain className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className="text-xs text-gray-300 flex-1">
          Thinking ({steps.length})
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setIsExpanded(!isExpanded)
            onToggle?.()
          }}
          className="p-0.5 hover:bg-gray-700 rounded transition-colors"
          title={isExpanded ? 'Collapse' : 'Expand steps'}
        >
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          )}
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-2 pb-2 space-y-1 border-t border-gray-700/50 pt-2 max-h-60 overflow-y-auto">
          {steps.map((step, idx) => (
            <div key={idx} className="text-xs text-gray-400">
              <span className="text-gray-500">{idx + 1}.</span> {step.description}
              {step.toolCalls && step.toolCalls.length > 0 && (
                <span className="text-gray-600 ml-1">
                  [{step.toolCalls.join(', ')}]
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
