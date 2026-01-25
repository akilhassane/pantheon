'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Bot, BotOff } from 'lucide-react';

interface AgentModeToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
}

export function AgentModeToggle({ enabled, onToggle, disabled = false }: AgentModeToggleProps) {
  return (
    <Button
      variant={enabled ? 'default' : 'outline'}
      size="sm"
      onClick={() => onToggle(!enabled)}
      disabled={disabled}
      className={`gap-2 transition-all ${
        enabled 
          ? 'bg-purple-600 hover:bg-purple-700 text-white' 
          : 'hover:bg-gray-100'
      }`}
    >
      {enabled ? (
        <>
          <Bot className="w-4 h-4" />
          <span>Agent Mode</span>
        </>
      ) : (
        <>
          <BotOff className="w-4 h-4" />
          <span>Enable Agent</span>
        </>
      )}
    </Button>
  );
}
