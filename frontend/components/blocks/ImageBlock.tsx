'use client'

import React, { useState } from 'react'
import { Image as ImageIcon, X, ChevronDown, ChevronUp } from 'lucide-react'

interface ImageBlockProps {
  url: string
  alt?: string
  width?: number
  height?: number
  focused?: boolean
  onClick?: () => void
}

export default function ImageBlock({
  url,
  alt,
  width,
  height,
  focused,
  onClick
}: ImageBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showFullSize, setShowFullSize] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  return (
    <>
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
          <ImageIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-300 flex-1 truncate">
            {alt || 'Image'}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
            className="p-0.5 hover:bg-gray-700 rounded transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand image'}
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
          <div className="p-2 border-t border-gray-700/50">
            {imageError ? (
              <div className="flex items-center justify-center h-32 bg-gray-900/50 rounded">
                <div className="text-center">
                  <ImageIcon className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">Failed to load image</p>
                </div>
              </div>
            ) : (
              <div className="relative">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 rounded">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-600 border-t-gray-400"></div>
                  </div>
                )}
                <img
                  src={url}
                  alt={alt || 'Image'}
                  width={width}
                  height={height}
                  onLoad={() => setIsLoading(false)}
                  onError={() => {
                    setIsLoading(false)
                    setImageError(true)
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowFullSize(true)
                  }}
                  className="max-w-full h-auto rounded cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ maxHeight: '400px' }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full-size Modal */}
      {showFullSize && !imageError && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowFullSize(false)}
        >
          <button
            onClick={() => setShowFullSize(false)}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={url}
            alt={alt || 'Image'}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
