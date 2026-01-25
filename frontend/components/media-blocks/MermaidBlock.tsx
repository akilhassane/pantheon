'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import mermaid from 'mermaid';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2, AlertCircle } from 'lucide-react';
import type { MermaidBlockData } from '@/types/media';

interface MermaidBlockProps {
  data: MermaidBlockData;
}

// Initialize mermaid once
if (typeof window !== 'undefined') {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  });
}

export default function MermaidBlock({ data }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [zoom, setZoom] = useState(1);
  const [svgContent, setSvgContent] = useState('');

  // Generate unique ID for this diagram
  const diagramId = useMemo(
    () => `mermaid-${Math.random().toString(36).substr(2, 9)}`,
    []
  );

  useEffect(() => {
    const renderDiagram = async () => {
      if (!containerRef.current) return;

      try {
        setIsRendering(true);
        setHasError(false);

        // Render the diagram
        const { svg } = await mermaid.render(diagramId, data.code);
        setSvgContent(svg);
        setIsRendering(false);
      } catch (error) {
        console.error('Mermaid rendering error:', error);
        setHasError(true);
        setErrorMessage(error instanceof Error ? error.message : 'Failed to render diagram');
        setIsRendering(false);
      }
    };

    renderDiagram();
  }, [data.code, diagramId]);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.2, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  return (
    <Card className="overflow-hidden my-4 border border-gray-200 dark:border-gray-700">
      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium">Mermaid Diagram</span>
          {data.diagramType && (
            <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
              {data.diagramType}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            className="h-8 w-8 p-0"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetZoom}
            className="h-8 w-8 p-0"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            disabled={zoom >= 3}
            className="h-8 w-8 p-0"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Diagram content */}
      <div className="relative bg-white dark:bg-gray-900">
        {isRendering && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
          </div>
        )}

        {hasError && (
          <div className="flex flex-col items-center justify-center h-64 p-4">
            <AlertCircle className="w-12 h-12 text-red-500 mb-2" />
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">
              Failed to render diagram
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {errorMessage}
            </p>
            <details className="w-full max-w-2xl">
              <summary className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer mb-2">
                Show raw syntax
              </summary>
              <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-x-auto">
                <code>{data.code}</code>
              </pre>
            </details>
          </div>
        )}

        {!isRendering && !hasError && svgContent && (
          <div
            ref={containerRef}
            className="flex items-center justify-center p-4 overflow-auto"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center',
              transition: 'transform 0.2s ease-in-out',
            }}
          >
            <div dangerouslySetInnerHTML={{ __html: svgContent }} />
          </div>
        )}
      </div>
    </Card>
  );
}
