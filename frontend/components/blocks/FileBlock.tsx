'use client'

import React, { useState } from 'react'
import { File, ExternalLink, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface FileBlockProps {
  path: string
  content: string
  language?: string
  operation?: 'read' | 'write' | 'create' | 'delete'
  modified?: boolean
  focused?: boolean
  onClick?: () => void
}

export default function FileBlock({
  path,
  content,
  language,
  operation = 'read',
  modified,
  focused,
  onClick
}: FileBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const isSuccess = operation !== 'delete'

  const customStyle = {
    ...vscDarkPlus,
    'pre[class*="language-"]': {
      ...vscDarkPlus['pre[class*="language-"]'],
      background: 'transparent',
      margin: 0,
      padding: 0,
    }
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
        {isSuccess ? (
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
        )}
        <File className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <code className="text-xs font-mono text-gray-300 flex-1 truncate">
          {path}
        </code>
        {modified && (
          <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" title="Modified" />
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            setIsExpanded(!isExpanded)
          }}
          className="p-0.5 hover:bg-gray-700 rounded transition-colors"
          title={isExpanded ? 'Collapse' : 'Expand content'}
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
        <div className="border-t border-gray-700/50 max-h-80 overflow-y-auto">
          {language ? (
            <SyntaxHighlighter
              language={language}
              style={customStyle}
              customStyle={{
                margin: 0,
                padding: '8px',
                background: 'transparent',
                fontSize: '11px'
              }}
            >
              {content}
            </SyntaxHighlighter>
          ) : (
            <pre className="px-2 py-2 text-xs font-mono text-gray-400 whitespace-pre-wrap">
              {content}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
