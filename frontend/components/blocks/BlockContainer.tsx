'use client'

import React, { useState } from 'react'
import { Check, Copy, ChevronDown, ChevronRight } from 'lucide-react'
import { MediaBlockType } from '@/types/chat'

interface BlockContainerProps {
  type: MediaBlockType
  header?: React.ReactNode
  children: React.ReactNode
  copyContent?: string
  collapsible?: boolean
  collapsed?: boolean
  onToggle?: () => void
  className?: string
  focused?: boolean
  onClick?: () => void
}

export default function BlockContainer({
  type,
  header,
  children,
  copyContent,
  collapsible = false,
  collapsed = false,
  onToggle,
  className = '',
  focused = false,
  onClick
}: BlockContainerProps) {
  const [copied, setCopied] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(collapsed)

  const handleCopy = async () => {
    if (!copyContent) return
    
    try {
      await navigator.clipboard.writeText(copyContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleToggle = () => {
    if (collapsible) {
      setIsCollapsed(!isCollapsed)
      onToggle?.()
    }
  }

  const handleClick = () => {
    onClick?.()
  }

  return (
    <div
      className={`
        block-container rounded-lg overflow-hidden transition-all duration-200
        ${focused ? 'ring-2 ring-[#1e40af]' : 'ring-1 ring-[#101218]/30'}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      style={{ backgroundColor: '#22252F' }}
      onClick={handleClick}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {/* Header */}
      {header && (
        <div 
          className="flex items-center justify-between px-3 py-2 border-b border-[#101218]/30"
          style={{ backgroundColor: '#1a1d26' }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {collapsible && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggle()
                }}
                className="text-gray-400 hover:text-gray-200 transition-colors"
                aria-label={isCollapsed ? 'Expand' : 'Collapse'}
              >
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            )}
            <div className="flex-1 min-w-0">{header}</div>
          </div>
          
          {/* Copy Button */}
          {copyContent && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleCopy()
              }}
              className="ml-2 p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#101218]/30 rounded transition-all duration-200"
              aria-label="Copy to clipboard"
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {!isCollapsed && (
        <div className="block-content">
          {children}
        </div>
      )}

      {/* Collapsed Preview */}
      {isCollapsed && (
        <div className="px-3 py-2 text-xs text-gray-500 italic">
          Click to expand...
        </div>
      )}
    </div>
  )
}
