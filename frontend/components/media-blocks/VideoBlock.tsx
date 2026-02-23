'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize,
  AlertCircle 
} from 'lucide-react';
import type { VideoBlockData } from '@/types/media';

interface VideoBlockProps {
  data: VideoBlockData;
}

// Helper function to detect and extract video IDs from URLs
function getVideoEmbedInfo(url: string): { type: 'youtube' | 'vimeo' | 'direct'; embedUrl?: string; videoId?: string } {
  // YouTube patterns
  const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch) {
    return {
      type: 'youtube',
      videoId: youtubeMatch[1],
      embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}`
    };
  }

  // Vimeo patterns
  const vimeoRegex = /vimeo\.com\/(?:video\/)?(\d+)/;
  const vimeoMatch = url.match(vimeoRegex);
  if (vimeoMatch) {
    return {
      type: 'vimeo',
      videoId: vimeoMatch[1],
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`
    };
  }

  return { type: 'direct' };
}

export default function VideoBlock({ data }: VideoBlockProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Detect if this is an embed video
  const embedInfo = getVideoEmbedInfo(data.url);
  const isEmbed = embedInfo.type !== 'direct';

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handleEnded = () => setIsPlaying(false);
    const handleError = () => setHasError(true);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleProgressChange = (value: number[]) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = value[0];
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (value: number[]) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = value[0];
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      video.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      video.volume = 0;
      setIsMuted(true);
    }
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target !== document.body) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPlaying, isMuted]);

  // Render embed video
  if (isEmbed && embedInfo.embedUrl) {
    return (
      <Card 
        ref={containerRef}
        className="overflow-hidden my-4 border border-gray-200 dark:border-gray-700"
      >
        {/* Title */}
        {data.title && (
          <div className="px-4 pt-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {data.title}
            </p>
          </div>
        )}

        {/* Embed iframe */}
        <div className="relative bg-black" style={{ paddingBottom: '56.25%' }}>
          <iframe
            src={embedInfo.embedUrl}
            className="absolute top-0 left-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={data.title || 'Video'}
          />
        </div>
      </Card>
    );
  }

  // Render direct video
  return (
    <Card 
      ref={containerRef}
      className="overflow-hidden my-4 border border-gray-200 dark:border-gray-700"
    >
      {/* Title */}
      {data.title && (
        <div className="px-4 pt-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {data.title}
          </p>
        </div>
      )}

      {/* Video container */}
      <div 
        className="relative bg-black group"
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(isPlaying ? false : true)}
      >
        {/* Video element */}
        <video
          ref={videoRef}
          src={data.url}
          poster={data.thumbnail}
          className="w-full h-auto max-h-[500px] object-contain"
          onClick={togglePlay}
        />

        {/* Error state */}
        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
            <AlertCircle className="w-12 h-12 text-red-500 mb-2" />
            <p className="text-sm text-red-400">Failed to load video</p>
          </div>
        )}

        {/* Controls overlay */}
        <div 
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Progress bar */}
          <div className="mb-3">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleProgressChange}
              disabled={hasError}
              className="cursor-pointer"
            />
            <div className="flex items-center justify-between text-xs text-white mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Play/Pause */}
              <Button
                variant="ghost"
                size="sm"
                onClick={togglePlay}
                disabled={hasError}
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </Button>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleMute}
                  disabled={hasError}
                  className="h-8 w-8 p-0 text-white hover:bg-white/20"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </Button>

                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.01}
                  onValueChange={handleVolumeChange}
                  disabled={hasError}
                  className="w-20 cursor-pointer"
                />
              </div>
            </div>

            {/* Fullscreen */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              disabled={hasError}
              className="h-8 w-8 p-0 text-white hover:bg-white/20"
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
