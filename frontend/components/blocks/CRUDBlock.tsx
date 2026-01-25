'use client'

import React, { useState } from 'react'
import { PlusCircle, Eye, Edit3, Trash2, ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react'
import { ChangeDetail } from '@/types/chat'

interface CRUDBlockProps {
  operation: 'create' | 'read' | 'update' | 'delete'
  resource: string
  data?: any
  beforeData?: any
  afterData?: any
  status: 'success' | 'error'
  timestamp?: Date
  sessionStateId?: string
  changes?: ChangeDetail[]
  onRestore?: () => void
  onViewChanges?: () => void
  focused?: boolean
  onClick?: () => void
}

export default function CRUDBlock({
  operation,
  resource,
  data,
  beforeData,
  afterData,
  status,
  timestamp,
  sessionStateId,
  changes,
  onRestore,
  onViewChanges,
  focused,
  onClick
}: CRUDBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const operationConfig = {
    create: { icon: PlusCircle, label: 'Create', color: 'text-gray-400' },
    read: { icon: Eye, label: 'Read', color: 'text-gray-400' },
    update: { icon: Edit3, label: 'Update', color: 'text-gray-400' },
    delete: { icon: Trash2, label: 'Delete', color: 'text-gray-400' }
  }

  const config = operationConfig[operation]
  const OperationIcon = config.icon
  const isSuccess = status === 'success'

  const formatData = (obj: any) => {
    if (!obj) return null
    try {
      return JSON.stringify(obj, null, 2)
    } catch {
      return String(obj)
    }
  }

  const displayData = operation === 'update' && afterData 
    ? formatData(afterData)
    : formatData(data)

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
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
        )}
        <OperationIcon className={`w-3.5 h-3.5 ${config.color} flex-shrink-0`} />
        <span className="text-xs text-gray-300 flex-1 truncate">
          {config.label} {resource}
        </span>
        {displayData && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
            className="p-0.5 hover:bg-gray-700 rounded transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand data'}
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
      {isExpanded && displayData && (
        <div className="px-2 pb-2 border-t border-gray-700/50 pt-2">
          <pre className="text-xs font-mono text-gray-400 whitespace-pre-wrap max-h-40 overflow-y-auto">
            {displayData}
          </pre>
        </div>
      )}
    </div>
  )
}
