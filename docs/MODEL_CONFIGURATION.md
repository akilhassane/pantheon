# Model Configuration Guide

Complete guide for configuring and managing AI models in Pantheon.

![Add Models Demo](../media/add-models.gif)

## Table of Contents

- [Overview](#overview)
- [Available Providers](#available-providers)
- [Model Selection](#model-selection)
- [Adding Custom Models](#adding-custom-models)
- [Model Parameters](#model-parameters)
- [Usage Tracking](#usage-tracking)
- [Best Practices](#best-practices)

## Overview

Pantheon supports multiple AI providers through a unified interface. This guide covers:

- Configuring AI providers
- Selecting and managing models
- Adding custom models
- Optimizing model parameters
- Tracking usage and costs

## Available Providers

### OpenRouter (Primary)

OpenRouter provides access to 100+ AI models through a single API.

**Supported Models:**
- OpenAI: GPT-4, GPT-4 Turbo, GPT-3.5
- Anthropic: Claude 3 Opus, Sonnet, Haiku
- Google: Gemini Pro, Gemini Pro Vision
- Meta: Llama 2, Llama 3
- Mistral: Mistral 7B, Mixtral 8x7B
- And many more

**Setup:**
1. Sign up at [OpenRouter](https://openrouter.ai)
2. Navigate to API Keys
3. Create new key
4. Add to `.env`:
   ```env
   OPENROUTER_API_KEY=sk-or-v1-your-key-here
   ```

**Documentation:** [OpenRouter Docs](https://openrouter.ai/docs)

### Google Gemini

Direct access to Google's Gemini models.

**Supported Models:**
- Gemini Pro
- Gemini Pro Vision
- Gemini Ultra (when available)

**Setup:**
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create API key
3. Add to `.env`:
   ```env
   GEMINI_API_KEY=AIzaSy-your-key-here
   ```

**Documentation:** [Gemini API Docs](https://ai.google.dev/docs)

### OpenAI (Optional)

Direct access to OpenAI models.

**Supported Models:**
- GPT-4 Turbo
- GPT-4
- GPT-3.5 Turbo

**Setup:**
1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create API key
3. Add to `.env`:
   ```env
   OPENAI_API_KEY=sk-your-key-here
   ```

**Documentation:** [OpenAI API Docs](https://platform.openai.com/docs)

### Anthropic (Optional)

Direct access to Claude models.

**Supported Models:**
- Claude 3 Opus
- Claude 3 Sonnet
- Claude 3 Haiku

**Setup:**
1. Visit [Anthropic Console](https://console.anthropic.com)
2. Create API key
3. Add to `.env`:
   ```env
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```

**Documentation:** [Anthropic API Docs](https://docs.anthropic.com)

## Model Selection

### Via Frontend UI

1. Login to Pantheon at [http://localhost:3000](http://localhost:3000)
2. Navigate to "Settings" → "Models"
3. Browse available models
4. Click "Select" on preferred model
5. Configure parameters (optional)
6. Click "Save"

### Via API

```bash
POST /api/user/settings
Content-Type: application/json
Authorization: Bearer <token>

{
  "preferred_model": "openai/gpt-4",
  "model_parameters": {
    "temperature": 0.7,
    "max_tokens": 2000,
    "top_p": 1.0
  }
}
```

### Default Models

Recommended models by use case:

| Use Case | Model | Provider | Reason |
|----------|-------|----------|--------|
| General Chat | GPT-4 Turbo | OpenRouter | Best balance of quality and speed |
| Code Generation | Claude 3 Opus | OpenRouter | Superior code understanding |
| Fast Responses | GPT-3.5 Turbo | OpenRouter | Low latency, cost-effective |
| Vision Tasks | Gemini Pro Vision | Google | Excellent image understanding |
| Long Context | Claude 3 Opus | OpenRouter | 200K token context window |

## Adding Custom Models

### Step 1: Navigate to Custom Models

1. Login to Pantheon
2. Navigate to "Settings" → "Custom Models"
3. Click "Add Model"

### Step 2: Configure Model

Fill in model details:

```json
{
  "name": "My Custom Model",
  "model_id": "custom/my-model",
  "provider": "openrouter",
  "api_endpoint": "https://openrouter.ai/api/v1/chat/completions",
  "parameters": {
    "temperature": 0.7,
    "max_tokens": 4000,
    "top_p": 0.9,
    "frequency_penalty": 0.0,
    "presence_penalty": 0.0
  },
  "context_window": 8192,
  "cost_per_1k_tokens": {
    "input": 0.01,
    "output": 0.03
  }
}
```

### Step 3: Test Model

1. Click "Test Model"
2. Enter test prompt
3. Verify response
4. Check latency and quality
5. Click "Save" if satisfied

### Step 4: Set as Default (Optional)

1. In model list, find your custom model
2. Click "Set as Default"
3. Confirm selection

## Model Parameters

### Temperature

Controls randomness in responses.

- **Range:** 0.0 to 2.0
- **Default:** 0.7
- **Low (0.0-0.3):** Deterministic, focused responses
- **Medium (0.4-0.9):** Balanced creativity and consistency
- **High (1.0-2.0):** Creative, varied responses

**Use Cases:**
- Code generation: 0.2
- General chat: 0.7
- Creative writing: 1.2

### Max Tokens

Maximum length of generated response.

- **Range:** 1 to model's max (typically 4096-32768)
- **Default:** 2000
- **Considerations:**
  - Higher values = longer responses
  - Higher values = higher cost
  - Must fit within context window

### Top P (Nucleus Sampling)

Controls diversity via nucleus sampling.

- **Range:** 0.0 to 1.0
- **Default:** 1.0
- **Lower values:** More focused, deterministic
- **Higher values:** More diverse outputs

### Frequency Penalty

Reduces repetition of tokens.

- **Range:** -2.0 to 2.0
- **Default:** 0.0
- **Positive values:** Discourage repetition
- **Negative values:** Encourage repetition

### Presence Penalty

Encourages new topics.

- **Range:** -2.0 to 2.0
- **Default:** 0.0
- **Positive values:** Encourage new topics
- **Negative values:** Stay on topic

## Usage Tracking

### View Usage Statistics

1. Navigate to "Settings" → "Usage"
2. View metrics:
   - Total tokens used
   - Cost per model
   - Requests per day
   - Average response time

### API Usage Endpoint

```bash
GET /api/user/usage
Authorization: Bearer <token>

Response:
{
  "total_tokens": 1500000,
  "total_cost": 45.50,
  "by_model": {
    "gpt-4": {
      "tokens": 500000,
      "cost": 30.00,
      "requests": 250
    },
    "gpt-3.5-turbo": {
      "tokens": 1000000,
      "cost": 15.50,
      "requests": 1000
    }
  },
  "period": "last_30_days"
}
```

### Cost Optimization

**Strategies:**
1. Use GPT-3.5 for simple tasks
2. Reduce max_tokens when possible
3. Cache frequent responses
4. Use streaming for long responses
5. Monitor usage regularly

## Best Practices

### Model Selection

1. **Start with GPT-4 Turbo**
   - Good balance of quality and cost
   - Suitable for most use cases

2. **Use GPT-3.5 for Simple Tasks**
   - Quick responses
   - Lower cost
   - Good for straightforward queries

3. **Use Claude for Code**
   - Superior code understanding
   - Better at following instructions
   - Excellent for refactoring

4. **Use Gemini for Vision**
   - Best image understanding
   - Good for multimodal tasks

### Parameter Tuning

1. **Start with Defaults**
   - Temperature: 0.7
   - Max tokens: 2000
   - Top P: 1.0

2. **Adjust Based on Use Case**
   - Code: Lower temperature (0.2)
   - Chat: Medium temperature (0.7)
   - Creative: Higher temperature (1.2)

3. **Monitor Quality**
   - Test with sample prompts
   - Compare responses
   - Adjust incrementally

### Cost Management

1. **Set Budget Alerts**
   - Configure in provider dashboard
   - Monitor daily/monthly spend
   - Set hard limits

2. **Use Appropriate Models**
   - Don't use GPT-4 for simple tasks
   - Consider cost per 1K tokens
   - Balance quality vs cost

3. **Optimize Prompts**
   - Be concise
   - Avoid unnecessary context
   - Use system messages effectively

## Troubleshooting

### Model Not Available

**Issue:** Selected model returns error

**Solution:**
1. Check API key is valid
2. Verify model ID is correct
3. Check provider status page
4. Try alternative model

### High Latency

**Issue:** Responses take too long

**Solution:**
1. Use faster model (GPT-3.5)
2. Reduce max_tokens
3. Check network connection
4. Try different provider

### Rate Limit Exceeded

**Issue:** "Rate limit exceeded" error

**Solution:**
1. Check provider rate limits
2. Implement request queuing
3. Upgrade provider plan
4. Use multiple API keys

### Unexpected Responses

**Issue:** Model produces poor quality responses

**Solution:**
1. Adjust temperature (lower for consistency)
2. Improve prompt engineering
3. Try different model
4. Check model parameters

## Next Steps

- [Usage Guide](USAGE.md)
- [API Documentation](API.md)
- [Troubleshooting](TROUBLESHOOTING.md)

## Support

- [OpenRouter Discord](https://discord.gg/openrouter)
- [GitHub Issues](https://github.com/akilhassane/pantheon/issues)
- [Discussions](https://github.com/akilhassane/pantheon/discussions)
