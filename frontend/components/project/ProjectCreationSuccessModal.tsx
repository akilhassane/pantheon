'use client'

import { CheckCircle2, X } from 'lucide-react'

interface ProjectCreationSuccessModalProps {
  isOpen: boolean
  projectName: string
  onClose: () => void
  onOpenProject: () => void
}

export function ProjectCreationSuccessModal({
  isOpen,
  projectName,
  onClose,
  onOpenProject
}: ProjectCreationSuccessModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#0a0a0a] border border-zinc-800 rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-semibold text-center text-white mb-2">
          Project Created!
        </h2>

        {/* Project Name */}
        <p className="text-center text-gray-400 mb-8">
          {projectName}
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            Close
          </button>
          <button
            onClick={onOpenProject}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Open Project
          </button>
        </div>
      </div>
    </div>
  )
}
