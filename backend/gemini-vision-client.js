const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Gemini API Client for AI Desktop Agent
 * Handles vision-based screen analysis, action planning, and verification
 */
class GeminiVisionClient {
    constructor(apiKey, config = {}) {
        if (!apiKey) {
            throw new Error('Gemini API key is required');
        }

        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = config.model || 'gemini-2.0-flash-exp';
        this.timeout = config.timeout || 30000;
        this.maxRetries = config.maxRetries || 3;
        this.conversationHistory = [];
    }

    /**
     * Analyze screenshot with user intent
     * @param {Object} screenshot - Screenshot object with base64 data
     * @param {string} userIntent - User's natural language request
     * @param {Object} context - Additional conversation context
     * @returns {Promise<Object>} Screen analysis result
     */
    async analyzeScreen(screenshot, userIntent, context = {}) {
        const prompt = this._buildScreenAnalysisPrompt(userIntent, context);

        try {
            const result = await this._callGeminiWithRetry(async () => {
                const model = this.genAI.getGenerativeModel({ model: this.model });

                const imagePart = {
                    inlineData: {
                        data: screenshot.base64.replace(/^data:image\/\w+;base64,/, ''),
                        mimeType: 'image/png'
                    }
                };

                const response = await model.generateContent([prompt, imagePart]);
                return response.response.text();
            });

            return this._parseScreenAnalysis(result);
        } catch (error) {
            console.error('Screen analysis failed:', error);
            throw new Error(`Failed to analyze screen: ${error.message}`);
        }
    }

    /**
     * Generate action plan based on screen analysis
  
     * @param {Object} analysis - Screen analysis result
     * @param {string} userIntent - User's request
     * @returns {Promise<Object>} Action plan with steps
     */
    async planActions(analysis, userIntent) {
        const prompt = this._buildActionPlanningPrompt(analysis, userIntent);

        try {
            const result = await this._callGeminiWithRetry(async () => {
                const model = this.genAI.getGenerativeModel({ model: this.model });
                const response = await model.generateContent(prompt);
                return response.response.text();
            });

            return this._parseActionPlan(result);
        } catch (error) {
            console.error('Action planning failed:', error);
            throw new Error(`Failed to plan actions: ${error.message}`);
        }
    }

    /**
     * Verify action result by comparing before/after screenshots
     * @param {Object} beforeScreenshot - Screenshot before action
     * @param {Object} afterScreenshot - Screenshot after action
     * @param {string} expectedOutcome - What should have changed
     * @returns {Promise<Object>} Verification result
     */
    async verifyResult(beforeScreenshot, afterScreenshot, expectedOutcome) {
        const prompt = this._buildVerificationPrompt(expectedOutcome);

        try {
            const result = await this._callGeminiWithRetry(async () => {
                const model = this.genAI.getGenerativeModel({ model: this.model });

                const beforeImage = {
                    inlineData: {
                        data: beforeScreenshot.base64.replace(/^data:image\/\w+;base64,/, ''),
                        mimeType: 'image/png'
                    }
                };

                const afterImage = {
                    inlineData: {
                        data: afterScreenshot.base64.replace(/^data:image\/\w+;base64,/, ''),
                        mimeType: 'image/png'
                    }
                };

                const response = await model.generateContent([
                    'Before screenshot:', beforeImage,
                    'After screenshot:', afterImage,
                    prompt
                ]);
                return response.response.text();
            });

            return this._parseVerificationResult(result);
        } catch (error) {
            console.error('Result verification failed:', error);
            throw new Error(`Failed to verify result: ${error.message}`);
        }
    }

    /**
     * Generate clarifying question for ambiguous requests
     * @param {string} userIntent - User's request
     * @param {string} ambiguity - What's unclear
     * @returns {Promise<string>} Clarifying question
     */
    async generateClarification(userIntent, ambiguity) {
        const prompt = `The user requested: "${userIntent}"

However, there is ambiguity: ${ambiguity}

Generate a clear, concise question to ask the user to clarify their intent. Be specific and helpful.`;

        try {
            const result = await this._callGeminiWithRetry(async () => {
                const model = this.genAI.getGenerativeModel({ model: this.model });
                const response = await model.generateContent(prompt);
                return response.response.text();
            });

            return result.trim();
        } catch (error) {
            console.error('Clarification generation failed:', error);
            return `Could you clarify: ${ambiguity}?`;
        }
    }

    /**
     * Build screen analysis prompt
     * @private
     */
    _buildScreenAnalysisPrompt(userIntent, context) {
        return `You are an AI assistant helping a user interact with their desktop computer.

User request: "${userIntent}"

Analyze the screen and identify:
1. All interactive UI elements (buttons, links, inputs, menus, icons)
2. Their approximate locations (describe position like "top-left", "center", "bottom-right")
3. Relevant text content visible on screen
4. Which elements are relevant to the user's request
5. Current state of the application/desktop

Respond in JSON format with this structure:
{
  "description": "Brief description of what's on screen",
  "detectedElements": [
    {
      "type": "button|link|input|icon|menu|text",
      "location": "description of position",
      "text": "visible text if any",
      "purpose": "what this element does",
      "relevantToIntent": true/false
    }
  ],
  "relevantToIntent": true/false,
  "suggestedActions": ["list of suggested actions"],
  "currentState": "description of current application state"
}`;
    }

    /**
     * Build action planning prompt
     * @private
     */
    _buildActionPlanningPrompt(analysis, userIntent) {
        return `Based on the screen analysis, create a step-by-step action plan to accomplish:
"${userIntent}"

Screen analysis:
${JSON.stringify(analysis, null, 2)}

Available actions:
- click: Click at coordinates (x, y)
- type: Type text into focused input
- scroll: Scroll in a direction
- drag: Drag from one point to another
- hotkey: Press keyboard shortcut
- wait: Wait for specified duration

For each step, specify:
- Action type
- Parameters (coordinates, text, direction, etc.)
- Human-readable description
- Whether it requires user approval (for destructive actions like delete, close, etc.)

Respond in JSON format:
{
  "steps": [
    {
      "id": "step_1",
      "type": "click|type|scroll|drag|hotkey|wait",
      "params": {
        // action-specific parameters
      },
      "description": "What this step does",
      "requiresApproval": false
    }
  ],
  "reasoning": "Why this plan will accomplish the goal",
  "estimatedDuration": 5,
  "requiresApproval": false
}

IMPORTANT: 
- For click actions, estimate coordinates based on element positions (screen is typically 1920x1080)
- Mark destructive actions (delete, close, shutdown) as requiresApproval: true
- Keep steps simple and atomic
- Add wait steps between actions if needed for UI to update`;
    }

    /**
     * Build verification prompt
     * @private
     */
    _buildVerificationPrompt(expectedOutcome) {
        return `Compare the before and after screenshots.

Expected outcome: "${expectedOutcome}"

Did the action succeed? Analyze:
1. What changed between the screenshots?
2. Does the change match the expected outcome?
3. Are there any error messages or unexpected states?
4. What should be done next?

Respond in JSON format:
{
  "success": true/false,
  "confidence": 0.0-1.0,
  "observation": "description of what changed",
  "matchesExpected": true/false,
  "nextAction": "what to do next (if failed or needs continuation)",
  "errorDetected": "any error message or issue found"
}`;
    }

    /**
     * Parse screen analysis response
     * @private
     */
    _parseScreenAnalysis(response) {
        try {
            // Extract JSON from response (handle markdown code blocks)
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) ||
                response.match(/```\n([\s\S]*?)\n```/) ||
                [null, response];
            const jsonStr = jsonMatch[1] || response;
            return JSON.parse(jsonStr.trim());
        } catch (error) {
            console.error('Failed to parse screen analysis:', error);
            // Return fallback structure
            return {
                description: response,
                detectedElements: [],
                relevantToIntent: false,
                suggestedActions: [],
                currentState: 'unknown'
            };
        }
    }

    /**
     * Parse action plan response
     * @private
     */
    _parseActionPlan(response) {
        try {
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) ||
                response.match(/```\n([\s\S]*?)\n```/) ||
                [null, response];
            const jsonStr = jsonMatch[1] || response;
            return JSON.parse(jsonStr.trim());
        } catch (error) {
            console.error('Failed to parse action plan:', error);
            return {
                steps: [],
                reasoning: 'Failed to generate plan',
                estimatedDuration: 0,
                requiresApproval: true
            };
        }
    }

    /**
     * Parse verification result
     * @private
     */
    _parseVerificationResult(response) {
        try {
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) ||
                response.match(/```\n([\s\S]*?)\n```/) ||
                [null, response];
            const jsonStr = jsonMatch[1] || response;
            return JSON.parse(jsonStr.trim());
        } catch (error) {
            console.error('Failed to parse verification result:', error);
            return {
                success: false,
                confidence: 0,
                observation: response,
                matchesExpected: false,
                nextAction: 'manual_review',
                errorDetected: null
            };
        }
    }

    /**
     * Call Gemini API with retry logic
     * @private
     */
    async _callGeminiWithRetry(apiCall, retryCount = 0) {
        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('API call timeout')), this.timeout);
            });

            const result = await Promise.race([apiCall(), timeoutPromise]);
            return result;
        } catch (error) {
            if (retryCount < this.maxRetries) {
                console.log(`Retry ${retryCount + 1}/${this.maxRetries} after error:`, error.message);
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
                return this._callGeminiWithRetry(apiCall, retryCount + 1);
            }
            throw error;
        }
    }

    /**
     * Add message to conversation history
     */
    addToHistory(role, content) {
        this.conversationHistory.push({ role, content, timestamp: new Date() });
        // Keep last 20 messages
        if (this.conversationHistory.length > 20) {
            this.conversationHistory = this.conversationHistory.slice(-20);
        }
    }

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationHistory = [];
    }

    /**
     * Get conversation history
     */
    getHistory() {
        return this.conversationHistory;
    }
}

module.exports = GeminiVisionClient;
