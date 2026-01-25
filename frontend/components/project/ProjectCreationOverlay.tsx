'use client'

import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface ProjectCreationOverlayProps {
  projectId: string
  projectName: string
  progress: {
    step: string
    message: string
    progress: number
    status: 'creating' | 'complete' | 'error'
    error?: string
  }
  onOpenProject: () => void
}

export function ProjectCreationOverlay({ projectId, projectName, progress, onOpenProject }: ProjectCreationOverlayProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (progress.status === 'complete') {
      // Auto-hide after 3 seconds on completion
      const timer = setTimeout(() => {
        setIsVisible(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [progress.status])

  if (!isVisible) return null

  return (
    <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center">
      <div className="max-w-md w-full mx-4 bg-[#0a0a0a] border border-zinc-800 rounded-lg p-8 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-semibold text-white mb-2">Creating Project</h2>
          <p className="text-gray-400">{projectName}</p>
        </div>

        {/* Status Icon */}
        <div className="flex justify-center mb-6">
          {progress.status === 'creating' && (
            <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
          )}
          {progress.status === 'complete' && (
            <CheckCircle2 className="w-16 h-16 text-green-500" />
          )}
          {progress.status === 'error' && (
            <AlertCircle className="w-16 h-16 text-red-500" />
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>{progress.message}</span>
            <span>{progress.progress}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                progress.status === 'error' ? 'bg-red-500' :
                progress.status === 'complete' ? 'bg-green-500' :
                'bg-blue-500'
              }`}
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        </div>

        {/* Current Step */}
        <div className="bg-gray-900/50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-300 text-center">
            {progress.step}
          </p>
        </div>

        {/* Error Message */}
        {progress.status === 'error' && progress.error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-400">{progress.error}</p>
          </div>
        )}

        {/* Actions */}
        {progress.status === 'complete' && (
          <button
            onClick={onOpenProject}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Open Project
          </button>
        )}

        {progress.status === 'error' && (
          <button
            onClick={() => setIsVisible(false)}
            className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        )}
      </div>
    </div>
  )
}
