'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Network, Code, ZoomIn, ZoomOut, Download, Maximize2 } from 'lucide-react'
import BlockContainer from './BlockContainer'
import mermaid from 'mermaid'

interface MermaidBlockProps {
  code: string
  diagramType?: string
  renderError?: string
  focused?: boolean
  onClick?: () => void
}

export default function MermaidBlock({
  code,
  diagramType,
  renderError: initialRenderError,
  focused,
  onClick
}: MermaidBlockProps) {
  const [showCode, setShowCode] = useState(false)
  const [renderError, setRenderError] = useState(initialRenderError)
  const [isRendering, setIsRendering] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const diagramRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [diagramId] = useState(`mermaid-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`)

  useEffect(() => {
    // Initialize Mermaid with dark theme
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#1e40af',
        primaryTextColor: '#e5e7eb',
        primaryBorderColor: '#1e40af',
        lineColor: '#4b5563',
        secondaryColor: '#101218',
        tertiaryColor: '#252529',
        background: '#17181F',
        mainBkg: '#17181F',
        secondBkg: '#101218',
        tertiaryBkg: '#252529',
        textColor: '#e5e7eb',
        fontSize: '12px'
      }
    })
  }, [])

  useEffect(() => {
    const renderDiagram = async () => {
      if (!diagramRef.current || showCode) {
        setIsRendering(false)
        return
      }

      console.log('🎨 MermaidBlock rendering with code:', code.substring(0, 50) + '...');
      
      if (!code || code.trim() === '') {
        console.error('❌ MermaidBlock: Empty code provided!');
        setRenderError('No diagram code provided');
        setIsRendering(false);
        return;
      }

      try {
        setIsRendering(true)
        setRenderError(undefined)
        
        // Small delay to ensure Mermaid is fully initialized
        await new Promise(resolve => setTimeout(resolve, 50))
        
        // Clear previous content
        if (diagramRef.current) {
          diagramRef.current.innerHTML = ''
        }
        
        console.log('🔄 Calling mermaid.render with diagramId:', diagramId);
        
        // Render the diagram
        const { svg } = await mermaid.render(diagramId, code)
        
        console.log('✅ Mermaid render successful, SVG length:', svg.length);
        
        if (diagramRef.current) {
          diagramRef.current.innerHTML = svg
          
          // Force SVG visibility with explicit styles
          const svgElement = diagramRef.current.querySelector('svg')
          if (svgElement) {
            svgElement.style.display = 'block'
            svgElement.style.maxWidth = '100%'
            svgElement.style.height = 'auto'
            svgElement.style.margin = '0 auto'
            console.log('✅ SVG styled, dimensions:', svgElement.getAttribute('width'), 'x', svgElement.getAttribute('height'));
          }
          
          console.log('✅ SVG inserted into DOM');
        }
      } catch (error) {
        console.error('❌ Mermaid render error:', error)
        setRenderError(error instanceof Error ? error.message : 'Failed to render diagram')
      } finally {
        setIsRendering(false)
      }
    }

    renderDiagram()
  }, [code, diagramId, showCode])

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.2, 3))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.2, 0.5))
  }

  const handleResetZoom = () => {
    setZoom(1)
  }

  const handleExportSVG = () => {
    if (!diagramRef.current) return
    
    const svgElement = diagramRef.current.querySelector('svg')
    if (!svgElement) return

    const svgData = new XMLSerializer().serializeToString(svgElement)
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `mermaid-diagram-${Date.now()}.svg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleExportPNG = async () => {
    if (!diagramRef.current) return
    
    const svgElement = diagramRef.current.querySelector('svg')
    if (!svgElement) return

    const svgData = new XMLSerializer().serializeToString(svgElement)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.fillStyle = '#17181F'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      
      canvas.toBlob((blob) => {
        if (!blob) return
        const pngUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = pngUrl
        link.download = `mermaid-diagram-${Date.now()}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(pngUrl)
      })
      
      URL.revokeObjectURL(url)
    }

    img.src = url
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const header = (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2 flex-1">
        <Network className="w-4 h-4 text-[#1e40af]" />
        <span className="text-[11px] text-gray-400 uppercase">
          Mermaid Diagram
        </span>
        {diagramType && (
          <span className="text-[10px] text-gray-500">
            ({diagramType})
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-1">
        {!showCode && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleZoomOut()
              }}
              className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#101218]/30 rounded transition-colors"
              title="Zoom out"
              aria-label="Zoom out diagram"
              disabled={zoom <= 0.5}
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleResetZoom()
              }}
              className="px-2 py-1 text-[10px] text-gray-400 hover:text-gray-200 hover:bg-[#101218]/30 rounded transition-colors"
              title="Reset zoom"
              aria-label="Reset zoom to 100%"
            >
              {Math.round(zoom * 100)}%
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleZoomIn()
              }}
              className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#101218]/30 rounded transition-colors"
              title="Zoom in"
              aria-label="Zoom in diagram"
              disabled={zoom >= 3}
            >
              <ZoomIn className="w-3 h-3" />
            </button>

            <div className="w-px h-4 bg-gray-700 mx-1" />

            <div className="relative group">
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#101218]/30 rounded transition-colors"
                title="Export diagram"
                aria-label="Export diagram as SVG or PNG"
                aria-haspopup="true"
              >
                <Download className="w-3 h-3" />
              </button>
              <div className="absolute right-0 top-full mt-1 bg-[#101218] border border-gray-700 rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleExportSVG()
                  }}
                  className="block w-full px-3 py-1.5 text-[10px] text-left text-gray-300 hover:bg-[#252529] whitespace-nowrap"
                  aria-label="Export diagram as SVG file"
                >
                  Export as SVG
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleExportPNG()
                  }}
                  className="block w-full px-3 py-1.5 text-[10px] text-left text-gray-300 hover:bg-[#252529] whitespace-nowrap"
                  aria-label="Export diagram as PNG file"
                >
                  Export as PNG
                </button>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleFullscreen()
              }}
              className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#101218]/30 rounded transition-colors"
              title="Toggle fullscreen"
              aria-label="View diagram in fullscreen mode"
            >
              <Maximize2 className="w-3 h-3" />
            </button>

            <div className="w-px h-4 bg-gray-700 mx-1" />
          </>
        )}
        
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowCode(!showCode)
          }}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-gray-200 hover:bg-[#101218]/30 rounded transition-colors"
          title={showCode ? 'Show diagram' : 'Show code'}
          aria-label={showCode ? 'Switch to diagram view' : 'Switch to code view'}
        >
          <Code className="w-3 h-3" />
          <span>{showCode ? 'Diagram' : 'Code'}</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      <BlockContainer
        type="mermaid"
        header={header}
        copyContent={code}
        focused={focused}
        onClick={onClick}
      >
        <div className="p-3">
          {showCode ? (
            /* Code View */
            <pre className="text-[11px] font-mono text-gray-400 whitespace-pre-wrap leading-snug">
              {code}
            </pre>
          ) : renderError ? (
            /* Error View */
            <div className="space-y-2">
              <div className="flex items-center justify-center h-32 bg-[#101218]/30 rounded">
                <div className="text-center">
                  <Network className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <p className="text-[11px] text-red-400">Failed to render diagram</p>
                  <p className="text-[10px] text-gray-500 mt-1">{renderError}</p>
                </div>
              </div>
              <div className="text-[10px] text-gray-500">
                Click "Code" to view the raw Mermaid code
              </div>
            </div>
          ) : (
            /* Diagram View */
            <div 
              ref={containerRef}
              className="relative overflow-auto"
              style={{ maxHeight: '500px' }}
            >
              {isRendering && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#101218]/30 rounded z-10">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-600 border-t-[#1e40af]"></div>
                </div>
              )}
              <div
                ref={diagramRef}
                className="mermaid-diagram flex items-center justify-center transition-transform duration-200"
                role="img"
                aria-label={`${diagramType || 'Mermaid'} diagram`}
                style={{ 
                  minHeight: '200px',
                  minWidth: '100%',
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center center',
                  padding: '20px'
                }}
              />
            </div>
          )}
        </div>
      </BlockContainer>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={toggleFullscreen}
        >
          <div 
            className="relative w-full h-full flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fullscreen Header */}
            <div className="flex items-center justify-between mb-4 px-4 py-2 bg-[#101218] rounded-t">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-[#1e40af]" />
                <span className="text-[11px] text-gray-400 uppercase">
                  Mermaid Diagram
                </span>
                {diagramType && (
                  <span className="text-[10px] text-gray-500">
                    ({diagramType})
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#252529] rounded transition-colors"
                  title="Zoom out"
                  aria-label="Zoom out diagram"
                  disabled={zoom <= 0.5}
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                
                <button
                  onClick={handleResetZoom}
                  className="px-3 py-1.5 text-[11px] text-gray-400 hover:text-gray-200 hover:bg-[#252529] rounded transition-colors"
                  title="Reset zoom"
                  aria-label="Reset zoom to 100%"
                >
                  {Math.round(zoom * 100)}%
                </button>
                
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#252529] rounded transition-colors"
                  title="Zoom in"
                  aria-label="Zoom in diagram"
                  disabled={zoom >= 3}
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                <div className="w-px h-6 bg-gray-700 mx-2" />

                <button
                  onClick={toggleFullscreen}
                  className="px-3 py-1.5 text-[11px] text-gray-400 hover:text-gray-200 hover:bg-[#252529] rounded transition-colors"
                  aria-label="Close fullscreen mode"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Fullscreen Content */}
            <div className="flex-1 overflow-auto bg-[#17181F] rounded-b flex items-center justify-center">
              <div
                className="mermaid-diagram-fullscreen transition-transform duration-200"
                style={{ 
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center center'
                }}
                dangerouslySetInnerHTML={{ 
                  __html: diagramRef.current?.innerHTML || '' 
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
