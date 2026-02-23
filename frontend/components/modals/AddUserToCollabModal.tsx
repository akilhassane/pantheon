'use client'

import React, { useState } from 'react'
import { X, Loader2, AlertCircle, CheckCircle, Mail, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AddUserToCollabModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  projectName: string
  onAddUser: (usernameOrEmail: string) => Promise<void>
}

export function AddUserToCollabModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  onAddUser
}: AddUserToCollabModalProps) {
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const isEmail = (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  }

  const handleAdd = async () => {
    const trimmedValue = usernameOrEmail.trim()

    if (!trimmedValue) {
      setError('Username or email is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onAddUser(trimmedValue)
      setSuccess(true)

      // Auto-close after success
      setTimeout(() => {
        handleClose()
      }, 1500)
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('not found')) {
          setError('User not found. Please check the username or email.')
        } else if (err.message.includes('already')) {
          setError('User is already a collaborator.')
        } else {
          setError(err.message)
        }
      } else {
        setError('Failed to add user. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setUsernameOrEmail('')
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
        if (e.target === e.currentTarget) {
          handleClose()
        }
      }}
    >
      <div className="rounded-lg p-6 w-full max-w-md shadow-2xl relative z-[10000]" style={{ backgroundColor: '#0A0A0A', borderColor: '#27272A', borderWidth: '1px' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Add Collaborator</h2>
            <p className="text-sm text-gray-400 mt-1">{projectName}</p>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!success ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="usernameOrEmail" className="text-sm font-medium text-white mb-2 block">
                Username or Email
              </Label>
              <p className="text-xs text-gray-400 mb-3">
                Enter the username or email address of the person you want to add
              </p>

              <div className="relative">
                {isEmail(usernameOrEmail) ? (
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                ) : (
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                )}
                <Input
                  id="usernameOrEmail"
                  type="text"
                  value={usernameOrEmail}
                  onChange={(e) => {
                    setUsernameOrEmail(e.target.value)
                    setError(null)
                  }}
                  placeholder="username or email@example.com"
                  className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-white focus:ring-2 focus:ring-white"
                  disabled={loading}
                  autoFocus
                  onKeyPress={(e) => e.key === 'Enter' && !loading && handleAdd()}
                />
              </div>

              {error && (
                <div className="mt-2 flex items-start gap-2 text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {usernameOrEmail && !error && (
                <div className="mt-2 flex items-center gap-2 text-gray-400 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  <span>
                    {isEmail(usernameOrEmail) ? 'Valid email format' : 'Username entered'}
                  </span>
                </div>
              )}
            </div>

            <div className="p-3 bg-gray-800 border border-gray-700 rounded-md">
              <p className="text-xs text-gray-400">
                <strong className="text-white">Note:</strong> The user will be notified and can accept or decline the invitation.
                They will have read-only access by default.
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                onClick={handleClose}
                disabled={loading}
                variant="ghost"
                className="bg-gray-800 hover:bg-gray-700 text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAdd}
                disabled={loading || !usernameOrEmail.trim()}
                className="bg-white hover:bg-gray-200 text-black"
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {loading ? 'Adding...' : 'Add User'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium text-green-400">User added successfully!</p>
            <p className="text-sm text-gray-400 mt-2">
              They will appear in the collaborators list.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
