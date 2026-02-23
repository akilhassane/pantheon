'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Camera, Maximize2, X } from 'lucide-react';

interface Annotation {
  x: number;
  y: number;
  label: string;
}

interface ScreenshotMessageProps {
  imageData: string; // base64
  annotations?: Annotation[];
  timestamp: Date;
  className?: string;
}

export function ScreenshotMessage({ 
  imageData, 
  annotations = [], 
  timestamp,
  className = '' 
}: ScreenshotMessageProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const formattedTime = new Date(timestamp).toLocaleTimeString();

  if (imageError) {
    return (
      <Card className={`p-4 bg-gray-50 border-gray-200 ${className}`}>
        <div className="flex items-center gap-2 text-gray-500">
          <Camera className="w-4 h-4" />
          <span className="text-sm">Screenshot unavailable</span>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className={`overflow-hidden bg-white border-gray-200 ${className}`}>
        <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Screenshot</span>
            <Badge variant="outline" className="text-xs">
              {formattedTime}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(true)}
            className="h-7 px-2"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </Button>
        </div>
        
        <div className="relative">
          <img
            src={imageData}
            alt="Desktop screenshot"
            className="w-full h-auto"
            onError={() => setImageError(true)}
          />
          
          {/* Annotations */}
          {annotations.map((annotation, index) => (
            <div
              key={index}
              className="absolute"
              style={{
                left: `${annotation.x}%`,
                top: `${annotation.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="relative">
                <div className="w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-lg" />
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 whitespace-nowrap">
                  <Badge className="bg-red-500 text-white text-xs">
                    {annotation.label}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Expanded view modal */}
      {isExpanded && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setIsExpanded(false)}
        >
          <div className="relative max-w-6xl max-h-[90vh] w-full">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
            >
              <X className="w-4 h-4" />
            </Button>
            <img
              src={imageData}
              alt="Desktop screenshot (expanded)"
              className="w-full h-auto max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
