'use client';

import React, { useState } from 'react';
import { 
  MousePointer2, 
  Keyboard, 
  ArrowDown, 
  Move, 
  Command,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface AgentActionCardProps {
  action: {
    type: 'click' | 'type' | 'scroll' | 'drag' | 'hotkey' | 'wait';
    description: string;
    params: any;
  };
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: {
    success: boolean;
    duration?: number;
  };
  animationDelay?: string;
}

const actionIcons = {
  click: MousePointer2,
  type: Keyboard,
  scroll: ArrowDown,
  drag: Move,
  hotkey: Command,
  wait: Clock,
};

/**
 * Card block showing desktop actions being executed in a compact format
 */
export function AgentActionCard({ 
  action, 
  status, 
  result,
  animationDelay = '0ms'
}: AgentActionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = actionIcons[action.type] || Clock;
  const isSuccess = status === 'completed' && result?.success !== false;
  const isError = status === 'failed' || (status === 'completed' && result?.success === false);

  const formatParams = (type: string, params: any) => {
    if (!params) return '';
    
    switch (type) {
      case 'click':
        return `${params.x},${params.y}`;
      case 'type':
        const text = params.text || '';
        return text;
      case 'scroll':
        const arrow = params.direction === 'up' ? '↑' : params.direction === 'down' ? '↓' : params.direction;
        return `${arrow} ${params.amount}`;
      case 'drag':
        return `${params.startX},${params.startY} → ${params.endX},${params.endY}`;
      case 'hotkey':
        return `${params.modifiers?.join('+') || ''}${params.modifiers?.length ? '+' : ''}${params.key}`;
      case 'wait':
        return `${params.duration}ms`;
      default:
        return '';
    }
  };

  const params = formatParams(action.type, action.params);
  const hasParams = params && params.length > 0;

  return (
    <div
      className="rounded-md border transition-all bg-gray-800/30 border-gray-700"
      style={{
        animationDelay,
        animationFillMode: 'both'
      }}
      role="status"
    >
      {/* Compact Header */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        {/* Status Icon */}
        {status === 'executing' ? (
          <Clock className="w-4 h-4 text-gray-400 animate-pulse flex-shrink-0" />
        ) : isSuccess ? (
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
        ) : isError ? (
          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
        ) : (
          <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
        
        {/* Action Icon */}
        <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        
        {/* Action Type */}
        <span className="text-xs text-gray-300 capitalize flex-shrink-0">
          {action.type}
        </span>
        
        {/* Short Preview */}
        {hasParams && !isExpanded && (
          <span className="text-xs text-gray-500 truncate flex-1 min-w-0">
            {params.length > 20 ? params.substring(0, 20) + '...' : params}
          </span>
        )}
        
        {/* Duration */}
        {result?.duration && (
          <span className="text-xs text-gray-500 flex-shrink-0">
            {result.duration}ms
          </span>
        )}
        
        {/* Expand Button */}
        {hasParams && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-gray-700 rounded transition-colors flex-shrink-0"
            title={isExpanded ? 'Collapse' : 'Expand parameters'}
          >
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            )}
          </button>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && hasParams && (
        <div className="px-2 pb-2 border-t border-gray-700/50 pt-2">
          <pre className="text-xs font-mono text-gray-400 whitespace-pre-wrap max-h-40 overflow-y-auto">
            {params}
          </pre>
        </div>
      )}
    </div>
  );
}
