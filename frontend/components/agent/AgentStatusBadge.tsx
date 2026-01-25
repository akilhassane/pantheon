'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  Eye, 
  Brain, 
  Zap, 
  CheckCircle, 
  Pause, 
  AlertCircle,
  Loader2 
} from 'lucide-react';

export type AgentStatus = 
  | 'idle' 
  | 'observing' 
  | 'thinking' 
  | 'acting' 
  | 'paused' 
  | 'error';

interface AgentStatusBadgeProps {
  status: AgentStatus;
  className?: string;
}

const statusConfig = {
  idle: {
    label: 'Idle',
    icon: CheckCircle,
    color: 'bg-gray-100 text-gray-700 border-gray-300',
  },
  observing: {
    label: 'Observing',
    icon: Eye,
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    animate: true,
  },
  thinking: {
    label: 'Planning',
    icon: Brain,
    color: 'bg-purple-100 text-purple-700 border-purple-300',
    animate: true,
  },
  acting: {
    label: 'Acting',
    icon: Zap,
    color: 'bg-green-100 text-green-700 border-green-300',
    animate: true,
  },
  paused: {
    label: 'Paused',
    icon: Pause,
    color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  },
  error: {
    label: 'Error',
    icon: AlertCircle,
    color: 'bg-red-100 text-red-700 border-red-300',
  },
};

export function AgentStatusBadge({ status, className = '' }: AgentStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={`${config.color} ${className} gap-1.5 px-3 py-1`}
    >
      <Icon 
        className={`w-3.5 h-3.5 ${config.animate ? 'animate-pulse' : ''}`} 
      />
      <span className="font-medium">{config.label}</span>
    </Badge>
  );
}
