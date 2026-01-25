'use client';

import React from 'react';
import { Brain, Lightbulb } from 'lucide-react';

interface AgentThinkingCardProps {
  reasoning: string;
  plan?: {
    steps: number;
    estimatedDuration?: number;
  };
  animationDelay?: string;
}

/**
 * Card block showing AI's reasoning and planning
 * Integrates with chat message stream
 */
export function AgentThinkingCard({ 
  reasoning, 
  plan,
  animationDelay = '0ms'
}: AgentThinkingCardProps) {
  return (
    <div
      className="p-3 rounded-lg transition-all duration-300 hover:bg-opacity-90 animate-fadeIn"
      style={{
        backgroundColor: '#1a1b26',
        borderLeft: '3px solid #f59e0b',
        boxShadow: '0 1px 3px rgba(245, 158, 11, 0.1)',
        animationDelay,
        animationFillMode: 'both'
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Brain className="w-4 h-4 text-amber-400" />
        <div>
          <div className="text-amber-400 text-sm font-bold">
            AI Planning
          </div>
          {plan && (
            <div className="text-amber-300 text-xs opacity-75">
              {plan.steps} steps
              {plan.estimatedDuration && ` • ~${plan.estimatedDuration}s`}
            </div>
          )}
        </div>
      </div>

      {/* Reasoning */}
      <div 
        className="p-2 rounded text-xs leading-relaxed"
        style={{ 
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          color: '#fbbf24'
        }}
      >
        <div className="flex items-start gap-2">
          <Lightbulb className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <div className="whitespace-pre-wrap">{reasoning}</div>
        </div>
      </div>

      {/* Plan Summary */}
      {plan && plan.steps > 0 && (
        <div className="mt-2 flex items-center gap-2 text-xs text-amber-300 opacity-75">
          <div className="flex-1 h-px bg-amber-400/20" />
          <span>Ready to execute</span>
          <div className="flex-1 h-px bg-amber-400/20" />
        </div>
      )}
    </div>
  );
}
