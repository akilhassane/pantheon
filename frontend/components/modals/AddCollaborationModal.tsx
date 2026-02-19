'use client'

import React, { useState } from 'react'
import { X, Loader2, AlertCircle, CheckCircle } from 'lucide-react'

interface AddCollaborationModalProps {
  isOpen: boolean
  onClose: () => void
  onJoinProject: (shareToken: string) => Promise<void>
}

export function AddCollaborationModal({ isOpen, onClose, onJoinProject }: AddCollaborationModalProps) {
  const [shareToken, setShareToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const validateUUID = (token: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(token)
  }

  const handleJoin = async () => {
    const trimmedToken = shareToken.trim()
    
    if (!trimmedToken) {
      setError('Project ID is required')
      return
    }

    if (!validateUUID(trimmedToken)) {
      setError('Invalid Project ID format. Please check and try again.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onJoinProject(trimmedToken)
      setSuccess(true)
      
      // Auto-close after success
      setTimeout(() => {
        handleClose()
      }, 1500)
      
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('not found')) {
          setError('Project not found. Please check the Project ID.')
        } else if (err.message.includes('access denied')) {
          setError('Access denied. You do not have permission to join this project.')
        } else {
          setError(err.message)
        }
      } else {
        setError('Failed to join project. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setShareToken(text.trim())
      setError(null)
    } catch (err) {
      console.error('Failed to paste:', err)
    }
  }

  const handleClose = () => {
    setShareToken('')
    setError(null)
    setSuccess(false)
    setLoading(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
      onClick={(e) => {
        // Close modal when clicking backdrop (but not when clicking the modal itself)
        if (e.target === e.currentTarget && !loading) {
          handleClose()
        }
      }}
    >
      <div className="rounded-lg p-6 w-full max-w-md relative z-[10000]" style={{ backgroundColor: '#0A0A0A', borderColor: '#27272A', borderWidth: '1px' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Join Collaboration</h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-white disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!success ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Project ID</label>
              <p className="text-xs text-gray-400 mb-2">
                Enter the Project ID shared with you
              </p>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareToken}
                  onChange={(e) => {
                    setShareToken(e.target.value)
                    setError(null)
                  }}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-white"
                  disabled={loading}
                  autoFocus
                  onKeyPress={(e) => e.key === 'Enter' && !loading && handleJoin()}
                />
                <button
                  onClick={handlePaste}
                  disabled={loading}
                  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-md text-sm disabled:opacity-50"
                >
                  Paste
                </button>
              </div>

              {error && (
                <div className="mt-2 flex items-start gap-2 text-red-500 text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {shareToken && validateUUID(shareToken.trim()) && !error && (
                <div className="mt-2 flex items-center gap-2 text-green-500 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  <span>Valid Project ID format</span>
                </div>
              )}
            </div>

            <div className="p-3 bg-gray-800 border border-gray-700 rounded-md">
              <p className="text-xs text-gray-400">
                <strong className="text-white">Tip:</strong> Ask the project owner to share their Project ID with you. 
                You can find it in the Share Project dialog.
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-md disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleJoin}
                disabled={loading || !shareToken.trim()}
                className="px-4 py-2 text-sm bg-white hover:bg-gray-200 text-black rounded-md disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Joining...' : 'Join Project'}
              </button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium text-green-500">Successfully joined!</p>
            <p className="text-sm text-gray-400 mt-2">The project has been added to your collaborations.</p>
          </div>
        )}
      </div>
    </div>
  )
}
