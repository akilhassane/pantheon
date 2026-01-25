'use client';

import React from 'react';
import { AgentVisionCard } from './AgentVisionCard';
import { AgentActionCard } from './AgentActionCard';
import { AgentThinkingCard } from './AgentThinkingCard';

/**
 * Demo component showing how agent cards appear in chat
 * This demonstrates the visual integration with the message stream
 */
export function AgentCardsDemo() {
  // Mock screenshot (1x1 pixel for demo)
  const mockScreenshot = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  return (
    <div className="space-y-4 p-6 bg-gray-900 rounded-lg max-w-3xl">
      <h2 className="text-xl font-bold text-white mb-4">
        AI Desktop Agent Cards Demo
      </h2>
      <p className="text-gray-400 text-sm mb-6">
        These cards appear in the chat stream as the AI interacts with your desktop
      </p>

      {/* Vision Card */}
      <AgentVisionCard
        screenshot={mockScreenshot}
        analysis="I can see the desktop with Firefox open. The browser is displaying the Kali Linux homepage with several navigation links visible."
        timestamp={new Date()}
      />

      {/* Thinking Card */}
      <AgentThinkingCard
        reasoning="To move the mouse to the center of the screen, I'll use the click action with coordinates (960, 540). This will position the cursor at the center of a standard 1920x1080 display."
        plan={{
          steps: 2,
          estimatedDuration: 3,
        }}
      />

      {/* Action Cards - Different States */}
      <AgentActionCard
        action={{
          type: 'click',
          description: 'Move mouse to center of screen',
          params: { x: 960, y: 540, button: 'left' },
        }}
        status="executing"
      />

      <AgentActionCard
        action={{
          type: 'type',
          description: 'Type search query',
          params: { text: 'AI desktop automation' },
        }}
        status="completed"
        result={{ success: true, duration: 245 }}
      />

      <AgentActionCard
        action={{
          type: 'hotkey',
          description: 'Press Enter to search',
          params: { modifiers: [], key: 'Return' },
        }}
        status="completed"
        result={{ success: true, duration: 120 }}
      />

      <AgentActionCard
        action={{
          type: 'scroll',
          description: 'Scroll down to view results',
          params: { direction: 'down', amount: 3 },
        }}
        status="pending"
      />

      <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
        <p className="text-blue-300 text-sm">
          💡 <strong>Integration:</strong> These cards automatically appear in your chat
          when the AI Desktop Agent is active. They show in real-time what the AI sees
          and does on your desktop.
        </p>
      </div>
    </div>
  );
}
