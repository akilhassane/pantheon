'use client'

import React, { useState, useEffect } from 'react'
import { X, Copy, Check, Users, Shield } from 'lucide-react'

interface Collaborator {
  userId: string
  userName: string
  permissions: 'read' | 'write'
  joinedAt: string
}

interface ShareProjectModalProps {
  isOpen: boolean
  projectId: string | null
  projectName: string
  onClose: () => void
  onShare: (projectId: string) => Promise<{ shareToken: string }>
  onUpdatePermissions: (projectId: string, userId: string, permissions: 'read' | 'write') => Promise<void>
  onRevokeAccess: (projectId: string, userId: string) => Promise<void>
  collaborators: Collaborator[]
}

export function ShareProjectModal({
  isOpen,
  projectId,
  projectName,
  onClose,
  onShare,
  onUpdatePermissions,
  onRevokeAccess,
  collaborators
}: ShareProjectModalProps) {
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && projectId) {
      loadShareToken()
    }
  }, [isOpen, projectId])

  const loadShareToken = async () => {
    if (!projectId) return
    
    setLoading(true)
    try {
      const result = await onShare(projectId)
      setShareToken(result.shareToken)
    } catch (error) {
      console.error('Failed to get share token:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (shareToken) {
      navigator.clipboard.writeText(shareToken)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClose = () => {
    setShareToken(null)
    setCopied(false)
    onClose()
  }

  if (!isOpen || !projectId) return null

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
      onClick={(e) => {
        // Close modal when clicking backdrop (but not when clicking the modal itself)
        if (e.target === e.currentTarget) {
          handleClose()
        }
      }}
    >
      <div className="rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto relative z-[10000]" style={{ backgroundColor: '#0A0A0A', borderColor: '#27272A', borderWidth: '1px' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Share Project</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Project Info */}
          <div>
            <p className="text-sm text-gray-400 mb-2">Project: <span className="text-white font-medium">{projectName}</span></p>
          </div>

          {/* Share Token */}
          <div>
            <label className="block text-sm font-medium mb-2">Project ID</label>
            <p className="text-xs text-gray-400 mb-2">Share this ID with others to give them access</p>
            
            {loading ? (
              <div className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-md">
                <span className="text-gray-400">Loading...</span>
              </div>
            ) : shareToken ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareToken}
                  readOnly
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md font-mono text-sm"
                />
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 bg-white hover:bg-gray-200 text-black rounded-md flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            ) : (
              <p className="text-red-500 text-sm">Failed to load share token</p>
            )}
          </div>

          {/* Collaborators List */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4" />
              <h3 className="text-sm font-medium">Collaborators ({collaborators.length})</h3>
            </div>

            {collaborators.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No collaborators yet</p>
            ) : (
              <div className="space-y-2">
                {collaborators.map((collab) => (
                  <div
                    key={collab.userId}
                    className="flex items-center justify-between p-3 bg-gray-800 rounded-md"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{collab.userName}</p>
                      <p className="text-xs text-gray-400">
                        Joined {new Date(collab.joinedAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={collab.permissions}
                        onChange={(e) => onUpdatePermissions(projectId, collab.userId, e.target.value as 'read' | 'write')}
                        className="px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded"
                      >
                        <option value="read">Read Only</option>
                        <option value="write">Read & Write</option>
                      </select>

                      <button
                        onClick={() => {
                          onRevokeAccess(projectId, collab.userId)
                        }}
                        className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 rounded text-white"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Access Info */}
          <div className="p-3 bg-gray-800 border border-gray-700 rounded-md">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-gray-400 mt-0.5" />
              <div className="text-xs text-gray-400">
                <p className="font-medium mb-1 text-white">Security Note</p>
                <p>Anyone with the Project ID can join this project. You can revoke access at any time.</p>
              </div>
            </div>
          </div>

          {/* Close Button */}
          <div className="flex justify-end">
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-md"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
