'use client'

import React from 'react'
import { DesktopContext } from '@/types/context'
import { ChevronDown, ChevronUp, Monitor, Folder, FileText, Clock, Settings } from 'lucide-react'

interface ContextPanelProps {
  context: DesktopContext | null
  onOpenSettings?: () => void
}

export default function ContextPanel({ context, onOpenSettings }: ContextPanelProps) {
  const [isExpanded, setIsExpanded] = React.useState(true)

  const formatTimestamp = (date: Date | null) => {
    if (!date) return 'Never'
    const now = new Date()
    const diff = Math.floor((now.getTime() - new Date(date).getTime()) / 1000)
    if (diff < 5) return 'Just now'
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return `${Math.floor(diff / 3600)}h ago`
  }

  if (!context) {
    return (
      <div className="border-t border-gray-700 bg-gray-900 p-3">
        <div className="text-sm text-gray-500">
          Desktop context not available
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-gray-700 bg-gray-900">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-800 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-gray-200">Desktop Context</span>
        </div>
        <div className="flex items-center gap-2">
          {onOpenSettings && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onOpenSettings()
              }}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4 text-gray-400" />
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Focused Window */}
          {context.focusedWindow ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Monitor className="w-3 h-3" />
                <span>Focused Window</span>
              </div>
              <div className="pl-5 text-sm">
                <div className="text-blue-400 font-medium">
                  {context.focusedWindow.application}
                </div>
                <div className="text-gray-300 text-xs">
                  {context.focusedWindow.title}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-500">No window focused</div>
          )}

          {/* Current Directory */}
          {context.currentDirectory && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Folder className="w-3 h-3" />
                <span>Current Directory</span>
              </div>
              <div className="pl-5 text-sm text-green-400 font-mono">
                {context.currentDirectory}
              </div>
            </div>
          )}

          {/* Screen Content (OCR) */}
          {context.ocrEnabled && context.screenContent && context.screenContent.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <FileText className="w-3 h-3" />
                <span>Screen Content (OCR)</span>
              </div>
              <div className="pl-5 text-xs text-gray-300 max-h-32 overflow-y-auto bg-gray-800 p-2 rounded font-mono">
                {context.screenContent.substring(0, 500)}
                {context.screenContent.length > 500 && '...'}
              </div>
            </div>
          )}

          {/* Last Update */}
          <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 border-t border-gray-800">
            <Clock className="w-3 h-3" />
            <span>Updated {formatTimestamp(context.lastUpdate)}</span>
          </div>

          {/* Status Indicators */}
          <div className="flex gap-2 text-xs">
            <span className={`px-2 py-1 rounded ${context.captureEnabled ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-500'}`}>
              {context.captureEnabled ? '● Capture' : '○ Capture'}
            </span>
            <span className={`px-2 py-1 rounded ${context.ocrEnabled ? 'bg-blue-900 text-blue-300' : 'bg-gray-800 text-gray-500'}`}>
              {context.ocrEnabled ? '● OCR' : '○ OCR'}
            </span>
            <span className={`px-2 py-1 rounded ${context.directorySyncEnabled ? 'bg-purple-900 text-purple-300' : 'bg-gray-800 text-gray-500'}`}>
              {context.directorySyncEnabled ? '● Dir Sync' : '○ Dir Sync'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
