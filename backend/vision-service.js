/**
 * Vision Service
 * Analyzes screenshots using AI vision models
 */

class VisionService {
  constructor(openRouterApiKey) {
    this.apiKey = openRouterApiKey;
    this.apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
  }
  
  async _fetch(...args) {
    const fetch = (await import('node-fetch')).default;
    return fetch(...args);
  }

  /**
   * Analyze screenshot with vision model
   * @param {string} imageData - Base64-encoded image data
   * @param {string} model - Model to use (default: nvidia/nemotron-nano-12b-2-vl:free)
   * @param {string} prompt - Custom prompt (optional)
   * @returns {Promise<Object>} - Vision analysis result
   */
  async analyzeScreenshot(imageData, model = 'nvidia/nemotron-nano-12b-2-vl:free', prompt = null) {
    try {
      console.log(`🔍 Analyzing screenshot with model: ${model}`);
      
      const defaultPrompt = `Analyze this screenshot and describe:
1. What application or window is visible
2. What the user is currently doing
3. Any text or important UI elements you can see
4. The overall state of the desktop/application

Be specific and detailed in your description.`;

      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt || defaultPrompt
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${imageData}`
              }
            }
          ]
        }
      ];

      console.log(`📤 Sending request to OpenRouter API...`);
      const startTime = Date.now();

      const response = await this._fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/yourusername/mcp-server',
          'X-Title': 'MCP Server Vision Analysis'
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          max_tokens: 1000,
          temperature: 0.7
        })
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ OpenRouter API error (${response.status}):`, errorText);
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`✅ Vision analysis completed in ${duration}ms`);

      const description = result.choices?.[0]?.message?.content || 'No description generated';
      
      return {
        success: true,
        description,
        model,
        duration,
        usage: result.usage
      };
    } catch (error) {
      console.error('❌ Vision analysis failed:', error.message);
      return {
        success: false,
        error: error.message,
        model
      };
    }
  }

  /**
   * Analyze image with vision model (alias for analyzeScreenshot)
   * @param {string} imageData - Base64-encoded image data
   * @param {string} prompt - Custom prompt (optional)
   * @param {string} model - Model to use (default: nvidia/nemotron-nano-12b-2-vl:free)
   * @returns {Promise<string>} - Vision analysis description
   */
  async analyzeImage(imageData, prompt = null, model = 'nvidia/nemotron-nano-12b-2-vl:free') {
    const result = await this.analyzeScreenshot(imageData, model, prompt);
    return result.description || result.error || 'No description available';
  }

  /**
   * Compare multiple vision models with the same screenshot
   * @param {string} imageData - Base64-encoded image data
   * @param {Array<string>} models - Array of model names to compare
   * @returns {Promise<Array>} - Array of results from each model
   */
  async compareModels(imageData, models = [
    'nvidia/nemotron-nano-12b-2-vl:free',
    'google/gemini-2.0-flash-exp:free',
    'openai/gpt-4o-mini',
    'anthropic/claude-3.5-sonnet'
  ]) {
    console.log(`🔬 Comparing ${models.length} vision models...`);
    
    const results = [];
    
    for (const model of models) {
      console.log(`\n📊 Analyzing with model: ${model}`);
      const result = await this.analyzeScreenshot(imageData, model);
      results.push({
        model,
        ...result
      });
      
      // Add delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n✅ Completed comparison of ${models.length} models`);
    return results;
  }

  /**
   * Get recommended vision models
   * @returns {Array<Object>} - Array of recommended models with descriptions
   */
  getRecommendedModels() {
    return [
      {
        id: 'nvidia/nemotron-nano-12b-2-vl:free',
        name: 'NVIDIA Nemotron Nano 12B 2 VL',
        description: 'Free multimodal model optimized for OCR, charts, and document understanding',
        free: true,
        recommended: true
      },
      {
        id: 'google/gemini-2.0-flash-exp:free',
        name: 'Google Gemini 2.0 Flash',
        description: 'Fast multimodal model with excellent vision capabilities',
        free: true,
        recommended: true
      },
      {
        id: 'openai/gpt-4o-mini',
        name: 'OpenAI GPT-4o Mini',
        description: 'Cost-effective vision model from OpenAI',
        free: false,
        recommended: true
      },
      {
        id: 'openai/gpt-4o',
        name: 'OpenAI GPT-4o',
        description: 'Advanced vision model with excellent accuracy',
        free: false,
        recommended: false
      },
      {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Anthropic Claude 3.5 Sonnet',
        description: 'High-quality vision analysis with detailed descriptions',
        free: false,
        recommended: false
      }
    ];
  }
}

module.exports = VisionService;
