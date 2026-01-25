# User-Provided API Keys Now Working ✅

## Problem
The backend was checking for API keys in environment variables instead of using the API keys that users configure in the frontend Settings > Models section.

## Solution
Updated all AI provider handlers in the backend to prioritize user-provided API keys from the request body, with environment variables as fallback.

---

## How It Works Now

### 1. User Adds Model in Frontend
Users go to **Settings > Models > Add Model** and:
1. Enter model name (e.g., `mistralai/devstral-2512:free`)
2. Enter their API key
3. Click "Add Model"

The model is stored locally in browser with the API key.

### 2. Frontend Sends API Key with Request
When user sends a chat message:
```typescript
const requestBody = {
  message: userMessage,
  history: historyToSend,
  model: selectedModel,
  apiKey: modelApiKey,  // ✅ User's API key from configured model
  mode: mode,
  projectId: activeProjectId,
  sessionId: sessionId,
  userId: user?.id
};

fetch(`${backendUrl}/api/chat`, {
  method: 'POST',
  body: JSON.stringify(requestBody)
});
```

### 3. Backend Uses User's API Key
```javascript
// OpenRouter Handler
async function handleOpenRouterChat(req, res, message, history, model) {
  // ✅ Use user's API key first, fallback to env var
  const openrouterApiKey = req.body.apiKey || process.env.OPENROUTER_API_KEY;
  
  if (!openrouterApiKey) {
    throw new Error('OpenRouter API key not configured. Please add your API key in Settings > Models.');
  }
  // ... use openrouterApiKey for API calls
}

// Gemini Handler
async function handleGeminiChat(req, res, message, history, requestedModel) {
  // ✅ Use user's API key first, fallback to env var
  const geminiApiKey = req.body.apiKey || process.env.GEMINI_API_KEY;
  
  if (!geminiApiKey) {
    throw new Error('Gemini API key not configured. Please add your API key in Settings > Models.');
  }
  
  // ✅ Create new instance with user's key
  const geminiAI = new GoogleGenerativeAI(geminiApiKey);
  // ... use geminiAI for API calls
}

// OpenAI and Anthropic handlers already supported this
```

---

## Changes Made

### Backend (`backend/server.js`)

#### 1. OpenRouter Handler
```javascript
// BEFORE
const openrouterApiKey = process.env.OPENROUTER_API_KEY;

// AFTER
const openrouterApiKey = req.body.apiKey || process.env.OPENROUTER_API_KEY;
```

#### 2. Gemini Handler
```javascript
// BEFORE
const model = genAI.getGenerativeModel(modelConfig);  // Uses global instance

// AFTER
const geminiApiKey = req.body.apiKey || process.env.GEMINI_API_KEY;
const geminiAI = new GoogleGenerativeAI(geminiApiKey);  // New instance per request
const model = geminiAI.getGenerativeModel(modelConfig);
```

#### 3. OpenAI & Anthropic
Already supported user-provided API keys via the `apiKey` parameter.

---

## User Workflow

### Step 1: Add Model with API Key
1. Open **Settings** (gear icon)
2. Go to **Models** tab
3. Click **Add Model**
4. Enter:
   - **Model Name**: `mistralai/devstral-2512:free` (or any model)
   - **API Key**: Your OpenRouter/Gemini/etc. API key
5. Click **Add**

### Step 2: Select Model
1. In chat interface, click model dropdown
2. Select your configured model
3. Model is now active with your API key

### Step 3: Chat
1. Send messages as normal
2. Backend uses YOUR API key for that model
3. No environment variables needed!

---

## Benefits

✅ **No Backend Configuration Needed**
- Users don't need access to Railway dashboard
- No need to set environment variables
- Each user can use their own API keys

✅ **Multi-User Support**
- Different users can use different API keys
- API keys stored locally per user
- No shared API key limits

✅ **Flexible**
- Users can add/remove models anytime
- Switch between models easily
- Test different providers

✅ **Secure**
- API keys stored in browser localStorage
- Sent over HTTPS to backend
- Never stored in database
- Each request includes the key

---

## Fallback to Environment Variables

If a user hasn't configured an API key for a model, the backend will try to use environment variables:

```javascript
const apiKey = req.body.apiKey || process.env.OPENROUTER_API_KEY;
```

This allows:
- **Development**: Use env vars for testing
- **Shared Models**: Admin can configure default keys
- **Backwards Compatibility**: Existing setups still work

---

## Testing

### Test User-Provided API Key
1. Add a model in Settings with your API key
2. Select that model
3. Send a chat message
4. ✅ Should work without any backend env vars

### Test Fallback to Env Var
1. Don't configure API key in frontend
2. Set `OPENROUTER_API_KEY` in Railway
3. Select an OpenRouter model
4. ✅ Should use the env var key

### Test Error Message
1. Don't configure API key anywhere
2. Try to use a model
3. ✅ Should see: "API key not configured. Please add your API key in Settings > Models."

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User Browser (Frontend)                                     │
│                                                             │
│  Settings > Models                                          │
│  ┌─────────────────────────────────────────┐              │
│  │ Model: mistralai/devstral-2512:free     │              │
│  │ API Key: sk-or-v1-abc123...             │ ◄─── Stored  │
│  │ [Add Model]                             │      locally │
│  └─────────────────────────────────────────┘              │
│                                                             │
│  Chat Interface                                             │
│  ┌─────────────────────────────────────────┐              │
│  │ Message: "Hello"                        │              │
│  │ Model: mistralai/devstral-2512:free     │              │
│  │ [Send] ──────────────────────────────┐  │              │
│  └──────────────────────────────────────│──┘              │
└───────────────────────────────────────────│─────────────────┘
                                            │
                                            │ HTTPS POST
                                            │ {
                                            │   message: "Hello",
                                            │   model: "mistralai/...",
                                            │   apiKey: "sk-or-v1-abc123..."
                                            │ }
                                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Railway Backend                                             │
│                                                             │
│  /api/chat endpoint                                         │
│  ┌─────────────────────────────────────────┐              │
│  │ const apiKey = req.body.apiKey ||       │              │
│  │                process.env.OPENROUTER   │              │
│  │                                         │              │
│  │ if (!apiKey) throw Error(...)          │              │
│  └─────────────────────────────────────────┘              │
│                                                             │
│                    │                                        │
│                    │ Use apiKey                             │
│                    ▼                                        │
│  ┌─────────────────────────────────────────┐              │
│  │ Call OpenRouter API                     │              │
│  │ Authorization: Bearer {apiKey}          │              │
│  └─────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
                                            │
                                            │ API Request
                                            ▼
                                    OpenRouter/Gemini/etc.
```

---

## Status

✅ **Frontend**: Stores models with API keys locally
✅ **Frontend**: Sends API key with each request
✅ **Backend**: Uses user-provided API key
✅ **Backend**: Falls back to env vars if needed
✅ **Deployed**: Changes live on Railway

---

**Date**: January 25, 2026
**Result**: Users can now add their own models with API keys in the frontend, and the backend will use those keys for API calls. No backend configuration needed!
