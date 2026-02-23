'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Maximize2, Minimize2, X, Terminal as TerminalIcon } from 'lucide-react';

interface ResizableTerminalProps {
  terminalUrl: string;
  isVisible: boolean;
  onToggleVisibility: () => void;
  initialWidth?: number;
}

export default function ResizableTerminal({
  terminalUrl,
  isVisible,
  onToggleVisibility,
  initialWidth = 400
}: ResizableTerminalProps) {
  const [width, setWidth] = useState(initialWidth);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'error'>('connecting');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // Load saved width from localStorage
  useEffect(() => {
    const savedWidth = localStorage.getItem('terminal-width');
    if (savedWidth) {
      setWidth(parseInt(savedWidth));
    }
  }, []);

  // Save width to localStorage
  useEffect(() => {
    localStorage.setItem('terminal-width', width.toString());
  }, [width]);

  // Handle iframe load
  const handleIframeLoad = () => {
    setConnectionStatus('connected');
  };

  const handleIframeError = () => {
    setConnectionStatus('error');
  };

  // Start resize
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = width;
  };

  // Handle resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = resizeStartX.current - e.clientX;
      const newWidth = Math.max(300, Math.min(800, resizeStartWidth.current + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (!isVisible) {
    return (
      <button
        onClick={onToggleVisibility}
        className="fixed bottom-4 right-4 p-3 bg-gray-900 text-white rounded-lg shadow-lg hover:bg-gray-800 transition-colors z-40"
        title="Show terminal"
      >
        <TerminalIcon className="w-5 h-5" />
      </button>
    );
  }

  return (
    <>
      {/* Fullscreen Overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={toggleFullscreen} />
      )}

      {/* Terminal Container */}
      <div
        ref={containerRef}
        className={`fixed right-0 top-0 bottom-0 bg-gray-900 shadow-2xl z-50 flex flex-col ${
          isFullscreen ? 'left-0' : ''
        }`}
        style={{
          width: isFullscreen ? '100%' : `${width}px`
        }}
      >
        {/* Resize Handle */}
        {!isFullscreen && (
          <div
            className={`absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500 transition-colors ${
              isResizing ? 'bg-blue-500' : 'bg-gray-700'
            }`}
            onMouseDown={handleResizeStart}
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-12 bg-gray-600 rounded-full" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <TerminalIcon className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-gray-200">Kali Terminal</span>
            
            {/* Connection Status */}
            <div className="flex items-center gap-1.5 ml-2">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' :
                connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                'bg-red-500'
              }`} />
              <span className="text-xs text-gray-400">
                {connectionStatus === 'connected' ? 'Connected' :
                 connectionStatus === 'connecting' ? 'Connecting...' :
                 'Connection Error'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={onToggleVisibility}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title="Hide terminal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Terminal Content */}
        <div className="flex-1 relative bg-black">
          {connectionStatus === 'error' ? (
            <div className="absolute inset-0 flex items-center justify-center text-center p-8">
              <div>
                <div className="text-red-500 mb-2">
                  <X className="w-12 h-12 mx-auto" />
                </div>
                <h3 className="text-white font-medium mb-2">Connection Failed</h3>
                <p className="text-gray-400 text-sm mb-4">
                  Unable to connect to terminal at {terminalUrl}
                </p>
                <button
                  onClick={() => {
                    setConnectionStatus('connecting');
                    if (iframeRef.current) {
                      iframeRef.current.src = terminalUrl;
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Retry Connection
                </button>
              </div>
            </div>
          ) : (
            <>
              {connectionStatus === 'connecting' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
                  <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">Connecting to terminal...</p>
                  </div>
                </div>
              )}
              
              <iframe
                ref={iframeRef}
                src={terminalUrl}
                className="w-full h-full border-0"
                title="Kali Terminal"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                allow="clipboard-read; clipboard-write"
              />
            </>
          )}
        </div>

        {/* Footer Info */}
        <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-400">
          <div className="flex items-center justify-between">
            <span>Commands executed by AI will appear here</span>
            {!isFullscreen && (
              <span className="text-gray-500">Drag left edge to resize</span>
            )}
          </div>
        </div>
      </div>

      {/* Resize Cursor Overlay */}
      {isResizing && (
        <div className="fixed inset-0 cursor-ew-resize z-40" />
      )}
    </>
  );
}
