'use client';

import React from 'react';
import { useDesktopAgent } from '@/hooks/useDesktopAgent';
import { AgentModeToggle } from './AgentModeToggle';
import { AgentStatusBadge } from './AgentStatusBadge';
import { ScreenshotMessage } from './ScreenshotMessage';
import { ActionPreviewCard } from './ActionPreviewCard';
import { AgentControlPanel } from './AgentControlPanel';
import { Card } from '@/components/ui/card';

interface AgentChatIntegrationProps {
  sessionId: string;
  userId: string;
  onSendMessage?: (message: string) => void;
}

/**
 * Complete Agent Integration Component
 * Drop this into your chat interface to enable desktop agent features
 */
export function AgentChatIntegration({ 
  sessionId, 
  userId,
  onSendMessage 
}: AgentChatIntegrationProps) {
  const agent = useDesktopAgent(sessionId, userId);

  const handleToggle = (enabled: boolean) => {
    if (enabled) {
      agent.enableAgent();
    } else {
      agent.disableAgent();
    }
  };

  return (
    <div className="space-y-4">
      {/* Agent Mode Toggle & Status */}
      <div className="flex items-center justify-between">
        <AgentModeToggle
          enabled={agent.enabled}
          onToggle={handleToggle}
        />
        
        {agent.enabled && (
          <AgentStatusBadge status={agent.status} />
        )}
      </div>

      {/* Control Panel (shown when executing) */}
      {agent.enabled && (agent.status === 'acting' || agent.status === 'paused') && (
        <AgentControlPanel
          onPause={agent.pauseExecution}
          onResume={agent.resumeExecution}
          onCancel={agent.cancelTask}
          isPaused={agent.status === 'paused'}
          isExecuting={agent.status === 'acting'}
        />
      )}

      {/* Task Progress */}
      {agent.taskProgress && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="text-sm text-blue-900">
            <div className="font-medium mb-1">
              Step {agent.taskProgress.step} of {agent.taskProgress.total}
            </div>
            <div className="text-blue-700">
              {agent.taskProgress.action.description}
            </div>
          </div>
        </Card>
      )}

      {/* Pending Action Approval */}
      {agent.pendingAction && (
        <ActionPreviewCard
          action={agent.pendingAction}
          onApprove={agent.approveAction}
          onReject={agent.rejectAction}
          requiresApproval={true}
        />
      )}

      {/* Last Screenshot */}
      {agent.lastScreenshot && (
        <ScreenshotMessage
          imageData={agent.lastScreenshot.base64}
          timestamp={agent.lastScreenshot.timestamp}
        />
      )}

      {/* Error Display */}
      {agent.error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="text-sm text-red-900">
            <div className="font-medium mb-1">Error</div>
            <div className="text-red-700">{agent.error}</div>
          </div>
        </Card>
      )}
    </div>
  );
}
