'use client'

import React, { useState } from 'react'
import { Search, ChevronDown, ChevronUp, Camera, Target, Square } from 'lucide-react'

interface ScreenshotBlockProps {
  screenData: any
  imageData?: string
  timestamp: string
  focused?: boolean
}

export function ScreenshotBlock({ screenData, imageData, timestamp, focused }: ScreenshotBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any>(null)

  const handleSearch = () => {
    if (!searchQuery.trim() || !screenData) return

    const query = searchQuery.toLowerCase()
    const results: any = {
      taskbarIcons: [],
      uiElements: [],
      windows: [],
      ocrText: []
    }

    // Search taskbar icons
    if (screenData.windowsAPI?.taskbar_icons) {
      results.taskbarIcons = screenData.windowsAPI.taskbar_icons.filter((icon: any) =>
        icon.name.toLowerCase().includes(query)
      )
    }

    // Search UI elements
    if (screenData.windowsAPI?.ui_elements) {
      results.uiElements = screenData.windowsAPI.ui_elements
        .filter((el: any) => el.name?.toLowerCase().includes(query))
        .slice(0, 10)
    }

    // Search windows
    if (screenData.windowsAPI?.windows) {
      results.windows = screenData.windowsAPI.windows.filter(
        (win: any) => win.title?.toLowerCase().includes(query) && win.visible === 1
      )
    }

    // Search OCR text
    if (screenData.ocr?.elements) {
      results.ocrText = screenData.ocr.elements
        .filter((el: any) => el.text?.toLowerCase().includes(query))
        .slice(0, 10)
    }

    setSearchResults(results)
  }

  const summary = screenData.windowsAPI?.summary || {}

  return (
    <div
      className={`
        rounded-md border transition-all
        ${focused ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-700'}
        bg-gray-800/30
      `}
    >
      {/* Compact Header */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        {/* Screenshot Icon */}
        <Camera className="w-4 h-4 text-gray-400 flex-shrink-0" />
        
        {/* Info */}
        <div className="flex items-center gap-2 flex-1 text-xs text-gray-300">
          <span>Screenshot</span>
          <span className="text-gray-500">
            {new Date(timestamp).toLocaleTimeString()}
          </span>
        </div>
        
        {/* Quick Stats */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="flex items-center gap-1" title="UI Elements">
            <Target className="w-3 h-3" />
            {summary.ui_elements_count || 0}
          </span>
          <span className="flex items-center gap-1" title="Windows">
            <Square className="w-3 h-3" />
            {summary.windows_count || 0}
          </span>
        </div>
        
        {/* Expand Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-0.5 hover:bg-gray-700 rounded transition-colors"
          title={isExpanded ? 'Collapse' : 'Expand details'}
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
        <div className="p-3 space-y-3 border-t border-gray-700 max-h-[600px] overflow-y-auto">
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search for UI elements, text, windows..."
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
            >
              Search
            </button>
          </div>

          {/* ALL DATA - Show everything by default */}
          {!searchResults && (
            <div className="space-y-2">
              {/* ALL Taskbar Icons */}
              {screenData.windowsAPI?.taskbar_icons && screenData.windowsAPI.taskbar_icons.length > 0 && (
                <div className="bg-gray-900/50 rounded p-2">
                  <div className="text-xs font-semibold text-blue-400 mb-1">
                    ALL Taskbar Icons ({screenData.windowsAPI.taskbar_icons.length})
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {screenData.windowsAPI.taskbar_icons.map((icon: any, i: number) => (
                      <div key={i} className="text-xs text-gray-300 py-1 font-mono">
                        {icon.name} at ({icon.center_x}, {icon.center_y})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ALL UI Elements */}
              {screenData.windowsAPI?.ui_elements && screenData.windowsAPI.ui_elements.length > 0 && (
                <div className="bg-gray-900/50 rounded p-2">
                  <div className="text-xs font-semibold text-green-400 mb-1">
                    ALL UI Elements ({screenData.windowsAPI.ui_elements.length})
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {screenData.windowsAPI.ui_elements.map((el: any, i: number) => (
                      <div key={i} className="text-xs text-gray-300 py-1 font-mono">
                        {el.name} [{el.type}] at ({el.center_x}, {el.center_y})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ALL Windows */}
              {screenData.windowsAPI?.windows && screenData.windowsAPI.windows.length > 0 && (
                <div className="bg-gray-900/50 rounded p-2">
                  <div className="text-xs font-semibold text-purple-400 mb-1">
                    ALL Windows ({screenData.windowsAPI.windows.filter((w: any) => w.visible === 1).length})
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {screenData.windowsAPI.windows
                      .filter((win: any) => win.visible === 1)
                      .map((win: any, i: number) => (
                        <div key={i} className="text-xs text-gray-300 py-1 font-mono">
                          {win.title} [{win.process}] at ({win.center_x}, {win.center_y})
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* ALL OCR Text */}
              {screenData.ocr?.elements && screenData.ocr.elements.length > 0 && (
                <div className="bg-gray-900/50 rounded p-2">
                  <div className="text-xs font-semibold text-yellow-400 mb-1">
                    ALL OCR Text ({screenData.ocr.elements.length})
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {screenData.ocr.elements.map((el: any, i: number) => (
                      <div key={i} className="text-xs text-gray-300 py-1 font-mono">
                        "{el.text}" at ({el.center_x}, {el.center_y}) - confidence: {el.confidence?.toFixed(2)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search Results */}
          {searchResults && (
            <div className="space-y-2">
              {searchResults.taskbarIcons.length > 0 && (
                <div className="bg-gray-900/50 rounded p-2">
                  <div className="text-xs font-semibold text-blue-400 mb-1">
                    Taskbar Icons ({searchResults.taskbarIcons.length})
                  </div>
                  {searchResults.taskbarIcons.map((icon: any, i: number) => (
                    <div key={i} className="text-xs text-gray-300 py-1">
                      {icon.name} at ({icon.center_x}, {icon.center_y})
                    </div>
                  ))}
                </div>
              )}

              {searchResults.uiElements.length > 0 && (
                <div className="bg-gray-900/50 rounded p-2">
                  <div className="text-xs font-semibold text-green-400 mb-1">
                    UI Elements ({searchResults.uiElements.length})
                  </div>
                  {searchResults.uiElements.map((el: any, i: number) => (
                    <div key={i} className="text-xs text-gray-300 py-1">
                      {el.name} [{el.type}] at ({el.center_x}, {el.center_y})
                    </div>
                  ))}
                </div>
              )}

              {searchResults.windows.length > 0 && (
                <div className="bg-gray-900/50 rounded p-2">
                  <div className="text-xs font-semibold text-purple-400 mb-1">
                    Windows ({searchResults.windows.length})
                  </div>
                  {searchResults.windows.map((win: any, i: number) => (
                    <div key={i} className="text-xs text-gray-300 py-1">
                      {win.title} [{win.process}]
                    </div>
                  ))}
                </div>
              )}

              {searchResults.ocrText.length > 0 && (
                <div className="bg-gray-900/50 rounded p-2">
                  <div className="text-xs font-semibold text-yellow-400 mb-1">
                    OCR Text ({searchResults.ocrText.length})
                  </div>
                  {searchResults.ocrText.map((el: any, i: number) => (
                    <div key={i} className="text-xs text-gray-300 py-1">
                      "{el.text}" (confidence: {el.confidence.toFixed(2)})
                    </div>
                  ))}
                </div>
              )}

              {searchResults.taskbarIcons.length === 0 &&
                searchResults.uiElements.length === 0 &&
                searchResults.windows.length === 0 &&
                searchResults.ocrText.length === 0 && (
                  <div className="text-xs text-gray-400 text-center py-2">
                    No results found for "{searchQuery}"
                  </div>
                )}
            </div>
          )}

          {/* Image Preview */}
          {imageData && (
            <div className="bg-gray-900/50 rounded p-2">
              <div className="text-xs font-semibold text-gray-400 mb-2">Screenshot Preview</div>
              <img
                src={`data:image/png;base64,${imageData}`}
                alt="Screenshot"
                className="w-full rounded border border-gray-700"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ScreenshotBlock
