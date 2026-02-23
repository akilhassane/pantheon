'use client';

import React, { useState } from 'react';
import { Eye, Maximize2, X } from 'lucide-react';

interface AgentVisionCardProps {
  screenshot: string; // base64
  analysis?: string;
  timestamp: Date;
  animationDelay?: string;
}

/**
 * Card block showing what the AI sees on the desktop in a compact format
 * Screenshot-focused layout with minimal text overlay
 * Integrates with chat message stream
 */
export function AgentVisionCard({ 
  screenshot, 
  analysis, 
  timestamp = new Date(),
  animationDelay = '0ms'
}: AgentVisionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Format timestamp in compact format (e.g., "12:34")
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  if (imageError) {
    return (
      <div
        className="p-2 rounded-lg transition-all duration-300 animate-fadeIn"
        style={{
          backgroundColor: '#1a1b26',
          borderLeft: '3px solid #8b5cf6',
          animationDelay,
          animationFillMode: 'both'
        }}
      >
        <div className="flex items-center gap-2 text-purple-400">
          <Eye className="w-3.5 h-3.5" />
          <span className="text-xs">Unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="p-2 rounded-lg transition-all duration-300 hover:bg-opacity-90 animate-fadeIn"
        style={{
          backgroundColor: '#1e1b2e',
          borderLeft: '3px solid #8b5cf6',
          boxShadow: '0 1px 3px rgba(139, 92, 246, 0.1)',
          animationDelay,
          animationFillMode: 'both'
        }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Screenshot with overlay badge */}
        <div className="relative rounded overflow-hidden bg-black/30">
          <img
            src={screenshot}
            alt="Desktop screenshot"
            className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setIsExpanded(true)}
            onError={() => setImageError(true)}
            style={{ maxHeight: '150px', objectFit: 'contain' }}
          />
          
          {/* Compact badge overlay */}
          <div 
            className="absolute top-1 right-1 flex items-center gap-1 px-1.5 py-0.5 rounded"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
          >
            <Eye className="w-2.5 h-2.5 text-purple-400" aria-hidden="true" />
            <span className="text-[10px] text-purple-300 font-medium">
              {formatTime(timestamp)}
            </span>
          </div>

          {/* Expand button overlay */}
          <button
            onClick={() => setIsExpanded(true)}
            className="absolute top-1 left-1 text-purple-300 hover:text-purple-200 transition-colors p-1 rounded opacity-0 hover:opacity-100"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
            aria-label="Expand screenshot"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>

        {/* Collapsible Analysis Section */}
        {analysis && (
          <div className="mt-2">
            {/* Show Analysis button (appears on hover) */}
            {!showAnalysis && isHovering && (
              <button
                onClick={() => setShowAnalysis(true)}
                className="w-full text-xs text-purple-300 hover:text-purple-200 transition-all duration-200 py-1 px-2 rounded"
                style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)' }}
              >
                Show Analysis
              </button>
            )}

            {/* Expanded Analysis */}
            {showAnalysis && (
              <div 
                className="transition-all duration-200 ease-in-out overflow-hidden"
                style={{ 
                  animation: 'slideDown 200ms ease-out',
                }}
              >
                <div 
                  className="p-2 rounded text-xs text-purple-200 leading-relaxed"
                  style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)' }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-purple-300">Analysis</span>
                    <button
                      onClick={() => setShowAnalysis(false)}
                      className="text-purple-400 hover:text-purple-300 transition-colors"
                      aria-label="Hide analysis"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-purple-200 opacity-90">
                    {analysis}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expanded Modal */}
      {isExpanded && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
          onClick={() => setIsExpanded(false)}
        >
          <button
            onClick={() => setIsExpanded(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors p-2 rounded-lg bg-black/50 hover:bg-black/70"
            aria-label="Close expanded view"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={screenshot}
            alt="Desktop screenshot (expanded)"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
