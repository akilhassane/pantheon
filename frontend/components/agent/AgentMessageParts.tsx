'use client';

import React from 'react';
import { AgentVisionCard } from './AgentVisionCard';
import { AgentActionCard } from './AgentActionCard';
import { AgentThinkingCard } from './AgentThinkingCard';

interface AgentMessagePartsProps {
  parts: any[];
  startIndex?: number;
}

/**
 * Renders agent-specific message parts (vision, actions, thinking)
 * Integrates seamlessly with existing MessagePartRenderer
 */
export function AgentMessageParts({ parts, startIndex = 0 }: AgentMessagePartsProps) {
  return (
    <>
      {parts.map((part, index) => {
        const animationDelay = `${(startIndex + index) * 100}ms`;

        // Agent Vision Card
        if (part.type === 'agent-vision') {
          return (
            <AgentVisionCard
              key={`agent-vision-${index}`}
              screenshot={part.screenshot}
              analysis={part.analysis}
              timestamp={new Date(part.timestamp)}
              animationDelay={animationDelay}
            />
          );
        }

        // Agent Action Card
        if (part.type === 'agent-action') {
          return (
            <AgentActionCard
              key={`agent-action-${index}`}
              action={part.action}
              status={part.status}
              result={part.result}
              animationDelay={animationDelay}
            />
          );
        }

        // Agent Thinking Card
        if (part.type === 'agent-thinking') {
          return (
            <AgentThinkingCard
              key={`agent-thinking-${index}`}
              reasoning={part.reasoning}
              plan={part.plan}
              animationDelay={animationDelay}
            />
          );
        }

        return null;
      })}
    </>
  );
}

/**
 * Check if a part is an agent-specific part
 */
export function isAgentPart(part: any): boolean {
  return part.type && part.type.startsWith('agent-');
}
