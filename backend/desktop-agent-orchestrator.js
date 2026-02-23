const GeminiVisionClient = require('./gemini-vision-client');
const VisionSystem = require('./vision-system');
const ActionExecutor = require('./action-executor');
const SafetyGuard = require('./safety-guard');
const { EventEmitter } = require('events');

/**
 * Desktop Agent Orchestrator
 * Central coordinator managing agent lifecycle and component interactions
 */
class DesktopAgentOrchestrator extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Initialize components
    this.geminiClient = new GeminiVisionClient(config.gemini.apiKey, config.gemini);
    this.visionSystem = new VisionSystem(config.vision);
    this.actionExecutor = new ActionExecutor(config.execution);
    this.safetyGuard = new SafetyGuard(config.safety);
    
    // Configuration
    this.config = config.orchestrator || {};
    this.maxRetryAttempts = this.config.maxRetryAttempts || 3;
    this.taskTimeout = this.config.taskTimeout || 300000; // 5 minutes
    
    // State
    this.sessions = new Map(); // sessionId -> AgentSession
    this.pendingApprovals = new Map(); // actionId -> approval promise
  }

  /**
   * Enable agent for a session
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   */
  async enableAgent(userId, sessionId) {
    console.log(`[Orchestrator] Enabling agent for session ${sessionId}`);
    
    const session = {
      id: sessionId,
      userId,
      status: 'idle',
      currentTask: null,
      conversationHistory: [],
      actionHistory: [],
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };
    
    this.sessions.set(sessionId, session);
    this._emitSessionEvent(sessionId, 'agent:status_changed', { status: 'idle' });
    
    return session;
  }

  /**
   * Disable agent for a session
   * @param {string} sessionId - Session ID
   */
  async disableAgent(sessionId) {
    console.log(`[Orchestrator] Disabling agent for session ${sessionId}`);
    
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    // Stop any ongoing tasks
    if (session.currentTask) {
      await this.cancelTask(sessionId);
    }
    
    // Stop vision capture if running
    await this.visionSystem.stopCapture();
    
    // Clean up
    this.sessions.delete(sessionId);
    this.safetyGuard.clearSession(sessionId);
    
    this._emitSessionEvent(sessionId, 'agent:status_changed', { status: 'disabled' });
  }

  /**
   * Process user request
   * @param {string} request - User's natural language request
   * @param {string} sessionId - Session ID
   */
  async processUserRequest(request, sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    console.log(`[Orchestrator] Processing request: "${request}"`);
    
    try {
      // Update session status
      this._updateSessionStatus(sessionId, 'observing');
      
      // Capture current screen
      const screenshot = await this.visionSystem.captureScreen();
      this._emitSessionEvent(sessionId, 'agent:screenshot', { screenshot });
      
      // Analyze screen with Gemini
      this._updateSessionStatus(sessionId, 'planning');
      const analysis = await this.geminiClient.analyzeScreen(screenshot, request);
      
      // Check if relevant to intent
      if (!analysis.relevantToIntent) {
        const clarification = await this.geminiClient.generateClarification(
          request,
          'The current screen does not seem relevant to your request'
        );
        this._emitSessionEvent(sessionId, 'agent:clarification', { question: clarification });
        this._updateSessionStatus(sessionId, 'idle');
        return;
      }
      
      // Generate action plan
      const actionPlan = await this.geminiClient.planActions(analysis, request);
      
      // Create task
      const task = {
        id: `task_${Date.now()}`,
        userIntent: request,
        status: 'pending',
        actionPlan,
        currentStepIndex: 0,
        screenshots: [screenshot],
        startedAt: new Date(),
        retryCount: 0,
      };
      
      session.currentTask = task;
      
      // Emit action plan for user review
      this._emitSessionEvent(sessionId, 'agent:action_planned', { task, actionPlan });
      
      // If requires approval, wait for it
      if (actionPlan.requiresApproval) {
        this._updateSessionStatus(sessionId, 'awaiting_approval');
        // Approval will be handled by approveAction method
      } else {
        // Execute immediately
        await this._executeTask(sessionId);
      }
      
    } catch (error) {
      console.error('[Orchestrator] Request processing failed:', error);
      this._updateSessionStatus(sessionId, 'error');
      this._emitSessionEvent(sessionId, 'agent:error', { error: error.message });
    }
  }

  /**
   * Approve pending action
   * @param {string} actionId - Action ID
   * @param {string} sessionId - Session ID
   */
  async approveAction(actionId, sessionId) {
    console.log(`[Orchestrator] Action approved: ${actionId}`);
    
    const session = this.sessions.get(sessionId);
    if (!session || !session.currentTask) {
      throw new Error('No pending task');
    }
    
    // Execute the task
    await this._executeTask(sessionId);
  }

  /**
   * Reject pending action
   * @param {string} actionId - Action ID
   * @param {string} sessionId - Session ID
   */
  async rejectAction(actionId, sessionId) {
    console.log(`[Orchestrator] Action rejected: ${actionId}`);
    
    const session = this.sessions.get(sessionId);
    if (!session || !session.currentTask) {
      return;
    }
    
    session.currentTask.status = 'cancelled';
    session.currentTask = null;
    
    this._updateSessionStatus(sessionId, 'idle');
    this._emitSessionEvent(sessionId, 'agent:task_cancelled', {});
  }

  /**
   * Pause execution
   * @param {string} sessionId - Session ID
   */
  async pauseExecution(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    this._updateSessionStatus(sessionId, 'paused');
    console.log(`[Orchestrator] Execution paused for session ${sessionId}`);
  }

  /**
   * Resume execution
   * @param {string} sessionId - Session ID
   */
  async resumeExecution(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'paused') return;
    
    this._updateSessionStatus(sessionId, 'acting');
    console.log(`[Orchestrator] Execution resumed for session ${sessionId}`);
    
    // Continue executing current task
    if (session.currentTask) {
      await this._executeTask(sessionId);
    }
  }

  /**
   * Cancel current task
   * @param {string} sessionId - Session ID
   */
  async cancelTask(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.currentTask) return;
    
    console.log(`[Orchestrator] Cancelling task for session ${sessionId}`);
    
    session.currentTask.status = 'cancelled';
    session.currentTask = null;
    
    this._updateSessionStatus(sessionId, 'idle');
    this._emitSessionEvent(sessionId, 'agent:task_cancelled', {});
  }

  /**
   * Get agent status
   * @param {string} sessionId - Session ID
   * @returns {string} Agent status
   */
  getAgentStatus(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? session.status : 'unknown';
  }

  /**
   * Get current task
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Current task or null
   */
  getCurrentTask(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? session.currentTask : null;
  }

  /**
   * Execute task (internal)
   * @private
   */
  async _executeTask(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.currentTask) return;
    
    const task = session.currentTask;
    task.status = 'in_progress';
    
    this._updateSessionStatus(sessionId, 'acting');
    
    try {
      const steps = task.actionPlan.steps;
      
      for (let i = task.currentStepIndex; i < steps.length; i++) {
        // Check if paused
        if (session.status === 'paused') {
          console.log('[Orchestrator] Execution paused');
          return;
        }
        
        const step = steps[i];
        task.currentStepIndex = i;
        
        console.log(`[Orchestrator] Executing step ${i + 1}/${steps.length}: ${step.description}`);
        
        // Emit progress
        this._emitSessionEvent(sessionId, 'agent:task_progress', {
          step: i + 1,
          total: steps.length,
          action: step,
        });
        
        // Validate action with safety guard
        const validation = await this.safetyGuard.validateAction(step, sessionId);
        
        if (!validation.allowed) {
          console.error(`[Orchestrator] Action blocked: ${validation.reason}`);
          this._emitSessionEvent(sessionId, 'agent:action_blocked', {
            action: step,
            reason: validation.reason,
          });
          continue;
        }
        
        // If requires approval, wait for it
        if (validation.requiresApproval) {
          this._updateSessionStatus(sessionId, 'awaiting_approval');
          this._emitSessionEvent(sessionId, 'agent:action_requires_approval', {
            action: step,
            reason: validation.reason,
          });
          // Wait for approval (would be handled by approveAction)
          return;
        }
        
        // Capture before screenshot
        const beforeScreenshot = await this.visionSystem.captureScreen();
        
        // Execute action
        this._emitSessionEvent(sessionId, 'agent:action_executing', { action: step });
        const result = await this.actionExecutor.executeAction(step);
        
        // Log action
        this.safetyGuard.logAction(step, result, sessionId);
        session.actionHistory.push({ action: step, result, timestamp: new Date() });
        
        // Wait a bit for UI to update
        await this.actionExecutor.wait(500);
        
        // Capture after screenshot
        const afterScreenshot = await this.visionSystem.captureScreen();
        task.screenshots.push(afterScreenshot);
        
        // Verify result
        this._updateSessionStatus(sessionId, 'verifying');
        const verification = await this.geminiClient.verifyResult(
          beforeScreenshot,
          afterScreenshot,
          step.description
        );
        
        this._emitSessionEvent(sessionId, 'agent:action_completed', {
          action: step,
          result,
          verification,
        });
        
        // Handle verification result
        if (!verification.success && verification.confidence > 0.7) {
          console.warn(`[Orchestrator] Action may have failed: ${verification.observation}`);
          
          // Retry if possible
          if (task.retryCount < this.maxRetryAttempts) {
            task.retryCount++;
            console.log(`[Orchestrator] Retrying (attempt ${task.retryCount}/${this.maxRetryAttempts})`);
            i--; // Retry same step
            continue;
          } else {
            console.error('[Orchestrator] Max retries reached');
            throw new Error(`Action failed after ${this.maxRetryAttempts} attempts`);
          }
        }
        
        this._updateSessionStatus(sessionId, 'acting');
      }
      
      // Task completed successfully
      task.status = 'completed';
      task.completedAt = new Date();
      
      const taskResult = {
        success: true,
        message: 'Task completed successfully',
        finalScreenshot: task.screenshots[task.screenshots.length - 1],
        stepsCompleted: steps.length,
        totalSteps: steps.length,
      };
      
      task.result = taskResult;
      
      this._updateSessionStatus(sessionId, 'idle');
      this._emitSessionEvent(sessionId, 'agent:task_completed', { task, result: taskResult });
      
      session.currentTask = null;
      
    } catch (error) {
      console.error('[Orchestrator] Task execution failed:', error);
      
      task.status = 'failed';
      task.completedAt = new Date();
      task.result = {
        success: false,
        message: error.message,
        stepsCompleted: task.currentStepIndex,
        totalSteps: task.actionPlan.steps.length,
      };
      
      this._updateSessionStatus(sessionId, 'error');
      this._emitSessionEvent(sessionId, 'agent:error', { error: error.message, task });
      
      session.currentTask = null;
    }
  }

  /**
   * Update session status
   * @private
   */
  _updateSessionStatus(sessionId, status) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    session.status = status;
    session.lastActivityAt = new Date();
    
    this._emitSessionEvent(sessionId, 'agent:status_changed', { status });
  }

  /**
   * Emit session event
   * @private
   */
  _emitSessionEvent(sessionId, event, data) {
    this.emit(event, { sessionId, ...data });
  }
}

module.exports = DesktopAgentOrchestrator;
