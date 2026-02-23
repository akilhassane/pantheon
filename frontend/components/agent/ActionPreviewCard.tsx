'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MousePointer2, 
  Keyboard, 
  ArrowDown, 
  Move, 
  Command,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';

interface DesktopAction {
  id: string;
  type: 'click' | 'type' | 'scroll' | 'drag' | 'hotkey' | 'wait';
  params: any;
  description: string;
  requiresApproval: boolean;
}

interface ActionPreviewCardProps {
  action: DesktopAction;
  onApprove: () => void;
  onReject: () => void;
  requiresApproval: boolean;
  className?: string;
}

const actionIcons = {
  click: MousePointer2,
  type: Keyboard,
  scroll: ArrowDown,
  drag: Move,
  hotkey: Command,
  wait: Clock,
};

const actionColors = {
  click: 'bg-blue-50 text-blue-700 border-blue-200',
  type: 'bg-green-50 text-green-700 border-green-200',
  scroll: 'bg-purple-50 text-purple-700 border-purple-200',
  drag: 'bg-orange-50 text-orange-700 border-orange-200',
  hotkey: 'bg-pink-50 text-pink-700 border-pink-200',
  wait: 'bg-gray-50 text-gray-700 border-gray-200',
};

export function ActionPreviewCard({ 
  action, 
  onApprove, 
  onReject, 
  requiresApproval,
  className = '' 
}: ActionPreviewCardProps) {
  const Icon = actionIcons[action.type];
  const colorClass = actionColors[action.type];

  const formatParams = (type: string, params: any) => {
    switch (type) {
      case 'click':
        return `at (${params.x}, ${params.y})`;
      case 'type':
        return `"${params.text.substring(0, 50)}${params.text.length > 50 ? '...' : ''}"`;
      case 'scroll':
        return `${params.direction} ${params.amount}x`;
      case 'drag':
        return `from (${params.startX}, ${params.startY}) to (${params.endX}, ${params.endY})`;
      case 'hotkey':
        return `${params.modifiers?.join('+') || ''}${params.modifiers?.length ? '+' : ''}${params.key}`;
      case 'wait':
        return `${params.duration}ms`;
      default:
        return JSON.stringify(params);
    }
  };

  return (
    <Card className={`overflow-hidden border-2 ${requiresApproval ? 'border-yellow-300' : 'border-gray-200'} ${className}`}>
      {requiresApproval && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-600" />
          <span className="text-sm font-medium text-yellow-800">
            Approval Required
          </span>
        </div>
      )}
      
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${colorClass}`}>
            <Icon className="w-5 h-5" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs capitalize">
                {action.type}
              </Badge>
              <span className="text-xs text-gray-500">
                {formatParams(action.type, action.params)}
              </span>
            </div>
            
            <p className="text-sm text-gray-700 font-medium">
              {action.description}
            </p>
          </div>
        </div>

        {requiresApproval && (
          <div className="mt-4 flex gap-2">
            <Button
              onClick={onApprove}
              size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Approve
            </Button>
            <Button
              onClick={onReject}
              size="sm"
              variant="outline"
              className="flex-1 border-red-300 text-red-600 hover:bg-red-50 gap-2"
            >
              <XCircle className="w-4 h-4" />
              Reject
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
