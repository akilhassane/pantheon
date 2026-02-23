'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface DesktopToolBlockProps {
  toolName: string
  args: any
  output: string
  status: 'success' | 'error' | 'pending'
  duration?: number | null
  focused?: boolean
  imageData?: string
  onClick?: () => void
}

export function DesktopToolBlock({
  toolName,
  args,
  output,
  status,
  duration,
  focused,
  imageData,
  onClick
}: DesktopToolBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isPending = status === 'pending'
  const isSuccess = status === 'success'
  const isError = status === 'error'
  const displayName = toolName.replace('windows_', '').replace(/_/g, ' ')

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
        {/* Status Icon */}
        {isPending ? (
          <Loader2 className="w-4 h-4 text-blue-400 flex-shrink-0 animate-spin" />
        ) : isSuccess ? (
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
        )}
        
        {/* Tool Name */}
        <span className="text-xs text-gray-300 capitalize flex-1">
          {displayName}
        </span>
        
        {/* Duration */}
        {duration !== null && duration !== undefined && (
          <span className="text-xs text-gray-500">
            {duration}ms
          </span>
        )}
        
        {/* Expand Button - only show if not pending */}
        {!isPending && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
            className="p-0.5 hover:bg-gray-700 rounded transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand arguments'}
          >
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            )}
          </button>
        )}
      </div>

      {/* Pending State - Show output message */}
      {isPending && output && (
        <div className="px-2 pb-2 border-t border-gray-700/50 pt-2">
          <div className="text-xs text-gray-400 italic">
            {output}
          </div>
        </div>
      )}

      {/* Expanded Content - Only for completed tools */}
      {!isPending && isExpanded && (
        <div className="px-2 pb-2 space-y-2 border-t border-gray-700/50 pt-2">
          {/* Arguments */}
          {args && Object.keys(args).length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 mb-1">Arguments:</div>
              <div className="text-xs text-gray-300 font-mono bg-[#101218] rounded p-2 max-h-40 overflow-y-auto">
                {JSON.stringify(args, null, 2)}
              </div>
            </div>
          )}

          {/* Output */}
          {output && (
            <div>
              <div className="text-xs font-semibold text-gray-400 mb-1">Output:</div>
              <div className="text-xs text-gray-300 whitespace-pre-wrap bg-[#101218] rounded p-2 max-h-40 overflow-y-auto">
                {output}
              </div>
            </div>
          )}

          {/* Image Data - Show screenshot if available */}
          {imageData && (
            <div>
              <div className="text-xs font-semibold text-gray-400 mb-1">Screenshot:</div>
              <img 
                src={`data:image/png;base64,${imageData}`} 
                alt="Screenshot"
                className="rounded border border-gray-700 max-w-full"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
