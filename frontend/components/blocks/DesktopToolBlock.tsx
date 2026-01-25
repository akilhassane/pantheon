'use client'

import React, { useState } from 'react'
import { 
  ChevronDown, 
  ChevronUp,
  Circle,
  MousePointer2,
  Type,
  Command,
  Move,
  ArrowDown,
  ArrowUp,
  FileText,
  Eye,
  AppWindow
} from 'lucide-react'

interface DesktopToolBlockProps {
  toolName: string
  args: Record<string, any>
  output: string
  status: 'success' | 'error' | 'pending'
  duration?: number
  focused?: boolean
  onClick?: () => void
  imageData?: string // Add imageData prop
}

export default function DesktopToolBlock({
  toolName,
  args,
  output,
  status,
  duration = 0,
  focused = false,
  onClick,
  imageData
}: DesktopToolBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isSuccess = status === 'success'
  const isPending = status === 'pending'
  
  // Reduced logging - only log on status changes, not every render
  // console.log('🎨 DesktopToolBlock rendering:', {
  //   toolName,
  //   hasArgs: !!args,
  //   hasOutput: !!output,
  //   outputLength: output?.length,
  //   status,
  //   duration,
  //   hasImageData: !!imageData
  // });
  
  // Get minimalistic icon based on tool name - returns green for success, red for error, teal hollow circle for pending
  const getToolIcon = () => {
    // For pending state, always show a hollow circle in teal
    if (isPending) {
      return (
        <Circle 
          className="w-4 h-4 flex-shrink-0 text-teal-500 animate-pulse" 
          fill="none"
          strokeWidth={2}
        />
      );
    }
    
    // For completed states, show specific icons
    const iconClass = `w-4 h-4 flex-shrink-0 ${isSuccess ? 'text-green-500' : 'text-red-500'}`
    
    if (toolName.includes('see_screen') || toolName.includes('capture') || toolName.includes('screenshot')) 
      return <Eye className={iconClass} />
    if (toolName.includes('click')) 
      return <MousePointer2 className={iconClass} />
    if (toolName.includes('type')) 
      return <Type className={iconClass} />
    if (toolName.includes('press_key')) 
      return <Command className={iconClass} />
    if (toolName.includes('get_windows')) 
      return <AppWindow className={iconClass} />
    if (toolName.includes('focus')) 
      return <Circle className={iconClass} />
    if (toolName.includes('move_mouse')) 
      return <Move className={iconClass} />
    if (toolName.includes('scroll')) {
      // Check if scrolling up or down
      if (toolName.includes('up')) 
        return <ArrowUp className={iconClass} />
      return <ArrowDown className={iconClass} />
    }
    if (toolName.includes('read_text')) 
      return <FileText className={iconClass} />
    
    return <Circle className={iconClass} />
  }
  
  // Get friendly tool name
  const getFriendlyName = () => {
    const name = toolName
      .replace('desktop-vision_', '')
      .replace('windows_', '')
      .replace(/_/g, ' ')
    return name.charAt(0).toUpperCase() + name.slice(1)
  }

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
        {/* Tool Icon - Yellow/pulsing for pending, Green for success, Red for error */}
        {getToolIcon()}
        
        {/* Tool Name or Loading Message */}
        <span className="text-xs text-gray-300 capitalize flex-1 truncate">
          {isPending && output ? output : getFriendlyName()}
        </span>
        
        {/* Duration */}
        {duration > 0 && (
          <span className="text-xs text-gray-500 flex-shrink-0">
            {duration}ms
          </span>
        )}
        
        {/* Expand Button - only show if not pending or has args */}
        {(!isPending || (args && Object.keys(args).length > 0)) && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
            className="p-0.5 hover:bg-gray-700 rounded transition-colors flex-shrink-0"
            title={isExpanded ? 'Collapse' : 'Expand details'}
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
      {isExpanded && (
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

          {/* Output - Show as image if it's base64 PNG data, otherwise show as text */}
          {output && !isPending && (
            <div>
              <div className="text-xs font-semibold text-gray-400 mb-1">Output:</div>
              {output.startsWith('iVBORw0KGgo') ? (
                // It's base64 PNG data - display as image (no padding, fills container)
                <div className="bg-[#101218] rounded overflow-hidden">
                  <img 
                    src={`data:image/png;base64,${output}`}
                    alt="Screenshot"
                    className="w-full h-auto block"
                  />
                </div>
              ) : (
                // Regular text output
                <div className="text-xs text-gray-300 whitespace-pre-wrap bg-[#101218] rounded p-2 max-h-40 overflow-y-auto">
                  {output}
                </div>
              )}
            </div>
          )}


        </div>
      )}
    </div>
  )
}
