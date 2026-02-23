'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Pause, Play, X, Loader2 } from 'lucide-react';

interface AgentControlPanelProps {
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  isPaused: boolean;
  isExecuting: boolean;
  className?: string;
}

export function AgentControlPanel({ 
  onPause, 
  onResume, 
  onCancel, 
  isPaused,
  isExecuting,
  className = '' 
}: AgentControlPanelProps) {
  if (!isExecuting && !isPaused) {
    return null;
  }

  return (
    <Card className={`p-3 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isPaused && (
            <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
          )}
          <span className="text-sm font-medium text-gray-700">
            {isPaused ? 'Task Paused' : 'Task Executing'}
          </span>
        </div>
        
        <div className="flex gap-2">
          {isPaused ? (
            <Button
              onClick={onResume}
              size="sm"
              variant="outline"
              className="gap-2 border-green-300 text-green-700 hover:bg-green-50"
            >
              <Play className="w-3.5 h-3.5" />
              Resume
            </Button>
          ) : (
            <Button
              onClick={onPause}
              size="sm"
              variant="outline"
              className="gap-2 border-yellow-300 text-yellow-700 hover:bg-yellow-50"
            >
              <Pause className="w-3.5 h-3.5" />
              Pause
            </Button>
          )}
          
          <Button
            onClick={onCancel}
            size="sm"
            variant="outline"
            className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}
