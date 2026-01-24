'use client'

import React from 'react'
import { KaliTerminal } from './kali-terminal'

interface TerminalProps {
  isOpen?: boolean
  onClose?: () => void
  serverUrl?: string
}

export const Terminal: React.FC<TerminalProps> = ({ isOpen = false, onClose, serverUrl }) => {
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="w-full h-full max-w-5xl max-h-[90vh] bg-black border border-green-500 rounded-lg overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-black border-b border-green-500 px-4 py-2">
          <h2 className="text-green-400 font-mono">$ Kali Linux Terminal</h2>
          <button onClick={onClose} className="text-green-400 hover:text-green-300 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <KaliTerminal isExpanded={true} />
        </div>
      </div>
    </div>
  )
}
