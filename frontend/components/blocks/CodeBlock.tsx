'use client'

import React from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import BlockContainer from './BlockContainer'

interface CodeBlockProps {
  code: string
  language: string
  filename?: string
  startLine?: number
  showLineNumbers?: boolean
  focused?: boolean
  onClick?: () => void
}

export default function CodeBlock({
  code,
  language,
  filename,
  startLine = 1,
  showLineNumbers = true,
  focused,
  onClick
}: CodeBlockProps) {
  const header = (
    <div className="flex items-center gap-3 w-full">
      <span className="text-[11px] text-gray-400 uppercase">{language}</span>
      {filename && (
        <>
          <span className="text-gray-600">•</span>
          <code className="text-[11px] text-gray-300 font-mono flex-1 truncate">
            {filename}
          </code>
        </>
      )}
    </div>
  )

  // Custom dark theme matching existing colors
  const customStyle = {
    ...vscDarkPlus,
    'pre[class*="language-"]': {
      ...vscDarkPlus['pre[class*="language-"]'],
      background: 'transparent',
      margin: 0,
      padding: 0,
    },
    'code[class*="language-"]': {
      ...vscDarkPlus['code[class*="language-"]'],
      background: 'transparent',
      fontSize: '11px',
      lineHeight: '1.5',
    }
  }

  return (
    <BlockContainer
      type="code"
      header={header}
      copyContent={code}
      focused={focused}
      onClick={onClick}
    >
      <div className="overflow-x-auto" role="region" aria-label={`Code block in ${language}${filename ? ` from ${filename}` : ''}`}>
        <SyntaxHighlighter
          language={language}
          style={customStyle}
          showLineNumbers={showLineNumbers}
          startingLineNumber={startLine}
          customStyle={{
            margin: 0,
            padding: '12px',
            background: 'transparent',
            fontSize: '11px'
          }}
          lineNumberStyle={{
            minWidth: '2.5em',
            paddingRight: '1em',
            color: '#4b5563',
            userSelect: 'none',
            fontSize: '10px'
          }}
          wrapperProps={{ role: 'code' }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </BlockContainer>
  )
}
