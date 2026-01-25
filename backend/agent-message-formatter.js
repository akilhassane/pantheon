/**
 * Agent Message Formatter
 * Converts agent events into chat message parts that can be streamed
 */

/**
 * Format agent events as message parts for chat streaming
 */
class AgentMessageFormatter {
  /**
   * Format screenshot event as vision card
   */
  static formatVisionCard(screenshot, analysis) {
    return {
      type: 'agent-vision',
      screenshot: screenshot.base64,
      analysis: analysis?.description || null,
      timestamp: screenshot.timestamp || new Date(),
    };
  }

  /**
   * Format action as action card
   */
  static formatActionCard(action, status = 'pending', result = null) {
    return {
      type: 'agent-action',
      action: {
        type: action.type,
        description: action.description,
        params: action.params,
      },
      status, // 'pending' | 'executing' | 'completed' | 'failed'
      result,
    };
  }

  /**
   * Format AI reasoning as thinking card
   */
  static formatThinkingCard(reasoning, plan = null) {
    return {
      type: 'agent-thinking',
      reasoning,
      plan: plan ? {
        steps: plan.steps?.length || 0,
        estimatedDuration: plan.estimatedDuration,
      } : null,
    };
  }

  /**
   * Format complete agent response with all cards
   */
  static formatAgentResponse(events) {
    const parts = [];

    events.forEach(event => {
      switch (event.type) {
        case 'screenshot':
          parts.push(this.formatVisionCard(event.screenshot, event.analysis));
          break;

        case 'thinking':
          parts.push(this.formatThinkingCard(event.reasoning, event.plan));
          break;

        case 'action':
          parts.push(this.formatActionCard(event.action, event.status, event.result));
          break;
      }
    });

    return {
      role: 'assistant',
      parts,
    };
  }

  /**
   * Create a streaming message part
   */
  static createStreamPart(type, data) {
    return `data: ${JSON.stringify({ type, ...data })}\n\n`;
  }
}

module.exports = AgentMessageFormatter;
