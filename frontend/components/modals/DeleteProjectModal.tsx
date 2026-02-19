'use client'

import React, { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'

interface DeleteProjectModalProps {
  isOpen: boolean
  projectName: string
  onClose: () => void
  onConfirm: () => Promise<void>
}

export function DeleteProjectModal({ isOpen, projectName, onClose, onConfirm }: DeleteProjectModalProps) {
  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    if (confirmText !== 'delete') {
      setError('Please type "delete" to confirm')
      return
    }

    setIsDeleting(true)
    setError(null)

    try {
      await onConfirm()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project')
      setIsDeleting(false)
    }
  }

  const handleClose = () => {
    setConfirmText('')
    setError(null)
    setIsDeleting(false)
    onClose()
  }

  if (!isOpen) return null

  const isValid = confirmText === 'delete'

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
      onClick={(e) => {
        // Close modal when clicking backdrop (but not when clicking the modal itself)
        if (e.target === e.currentTarget && !isDeleting) {
          handleClose()
        }
      }}
    >
      <div className="rounded-lg p-6 w-full max-w-md relative z-[10000]" style={{ backgroundColor: '#0A0A0A', borderColor: '#27272A', borderWidth: '1px' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h2 className="text-xl font-semibold">Delete Project</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="text-gray-400 hover:text-white disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-md p-3">
            <p className="text-sm text-red-400">
              This will permanently delete the project <span className="font-semibold">"{projectName}"</span> and its Docker container.
              This action cannot be undone.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Type <span className="font-mono bg-gray-800 px-1 rounded">delete</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="delete"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              autoFocus
              disabled={isDeleting}
              onKeyPress={(e) => e.key === 'Enter' && isValid && handleConfirm()}
            />
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={handleClose}
              disabled={isDeleting}
              className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-md disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isValid || isDeleting}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? 'Deleting...' : 'Delete Project'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
