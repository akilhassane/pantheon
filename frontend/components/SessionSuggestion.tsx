/**
 * Session Suggestion Component
 * 
 * Ultra-minimalistic block suggesting a new session when conversation grows too long.
 */

import React from 'react'
import { X } from 'lucide-react'
import BlockContainer from './blocks/BlockContainer'

export interface SessionSuggestionProps {
  messageCount: number
  onCreateNewSession: () => void
  onDismiss: () => void
}

export default function SessionSuggestion({
  messageCount,
  onCreateNewSession,
  onDismiss
}: SessionSuggestionProps) {
  const header = (
    <div className="flex items-center justify-between w-full">
      <span className="text-[11px] text-amber-400 font-medium">
        Long Conversation Detected
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDismiss()
        }}
        className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )

  return (
    <BlockContainer
      type="session-suggestion"
      header={header}
      className="border-amber-400/20"
    >
      <div className="px-3 py-2.5">
        <p className="text-[12px] text-gray-400 leading-relaxed mb-2.5">
          Your chat has <span className="text-amber-400">{messageCount}</span> messages. Starting a new session can improve performance and prevent errors.
        </p>

        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onCreateNewSession()
            }}
            className="px-2.5 py-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 border border-amber-400/40 hover:border-amber-400/60 rounded transition-colors"
          >
            Create New Session
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDismiss()
            }}
            className="px-2.5 py-1 text-[11px] font-medium text-gray-400 hover:text-gray-300 transition-colors"
          >
            Continue This Session
          </button>
        </div>
      </div>
    </BlockContainer>
  )
}
