'use client'

import React, { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'

interface LeaveCollaborationModalProps {
  isOpen: boolean
  projectName: string
  onClose: () => void
  onConfirm: () => void
}

export function LeaveCollaborationModal({
  isOpen,
  projectName,
  onClose,
  onConfirm
}: LeaveCollaborationModalProps) {
  const [inputValue, setInputValue] = useState('')
  const isValid = inputValue.toLowerCase() === 'leave'

  const handleConfirm = () => {
    if (isValid) {
      onConfirm()
      setInputValue('')
      onClose()
    }
  }

  const handleClose = () => {
    setInputValue('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="rounded-lg p-6 w-full max-w-md shadow-2xl" style={{ backgroundColor: '#0A0A0A', borderColor: '#27272A', borderWidth: '1px' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <h2 className="text-xl font-semibold text-white">Leave Collaboration</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-gray-300">
            Are you sure you want to leave the collaboration for{' '}
            <span className="font-semibold text-white">"{projectName}"</span>?
          </p>

          <div className="p-3 bg-gray-800 border border-gray-700 rounded-md">
            <p className="text-xs text-gray-400">
              <strong className="text-white">Warning:</strong> You will lose access to this project and all its sessions.
              You'll need to be re-invited to access it again.
            </p>
          </div>

          <div>
            <label htmlFor="leave-input" className="block text-sm font-medium text-white mb-2">
              Type <span className="font-mono bg-gray-800 px-1.5 py-0.5 rounded">leave</span> to confirm
            </label>
            <input
              id="leave-input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && isValid && handleConfirm()}
              placeholder="leave"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
              autoFocus
              autoComplete="off"
              spellCheck="false"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isValid}
              className="px-4 py-2 text-sm bg-orange-600 hover:bg-orange-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Leave Collaboration
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
