'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageOff, ZoomIn } from 'lucide-react';
import type { ImageBlockData } from '@/types/media';

interface ImageBlockProps {
  data: ImageBlockData;
}

export default function ImageBlock({ data }: ImageBlockProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <Card className="overflow-hidden my-4 border border-gray-200 dark:border-gray-700">
      <div ref={imgRef} className="relative">
        {/* Loading skeleton */}
        {isLoading && !hasError && (
          <Skeleton className="w-full h-64" />
        )}

        {/* Error state */}
        {hasError && (
          <div className="flex flex-col items-center justify-center h-64 bg-gray-100 dark:bg-gray-800">
            <ImageOff className="w-12 h-12 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Failed to load image
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {data.alt || 'Image'}
            </p>
          </div>
        )}

        {/* Image with click-to-expand */}
        {!hasError && (
          <Dialog>
            <DialogTrigger asChild>
              <div className="relative cursor-pointer group">
                {isVisible && (
                  <img
                    src={data.url}
                    alt={data.alt}
                    onLoad={handleLoad}
                    onError={handleError}
                    className={`w-full h-auto object-contain max-h-96 transition-opacity duration-300 ${
                      isLoading ? 'opacity-0' : 'opacity-100'
                    }`}
                    style={{
                      display: isLoading ? 'none' : 'block'
                    }}
                  />
                )}
                
                {/* Hover overlay with zoom icon */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                  <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </div>
              </div>
            </DialogTrigger>

            {/* Expanded view modal */}
            <DialogContent className="max-w-4xl w-full p-0">
              <div className="relative">
                <img
                  src={data.url}
                  alt={data.alt}
                  className="w-full h-auto max-h-[80vh] object-contain"
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Caption */}
      {data.caption && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            {data.caption}
          </p>
        </div>
      )}
    </Card>
  );
}
