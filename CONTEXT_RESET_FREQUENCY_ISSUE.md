# Context Reset Frequency Issue

## Problem

Context is resetting after every tool call instead of based on context length. The "┃ Context reset (X/10)" message appears after every action.

## Root Causes

### 1. Context Window Too Small
- Model: `arcee-ai/trinity-large-preview:free`
- Configured context window: 8192 tokens → 80% = 6553 tokens max
- Actual context usage: ~8000-9000 tokens (exceeds limit)
- **Fix Applied**: Increased trinity model context window from 8K to 32K tokens

### 2. Screenshot-Only Detection Not Working
- Added detection regex: `/^(take|get|show|capture)\s+(a\s+)?screenshot$/i`
- Should add instruction: "Just take ONE screenshot, describe what you see, then say 'Done'. Do NOT perform any other actions."
- **Issue**: Detection code added to `handleOpenRouterChat` but not being triggered
- **Result**: AI performs full workflows instead of just taking screenshot

### 3. Text-Based Tool Call Parser Too Aggressive
- Parser detects "take a screenshot" in explanatory text
- Example: "The user's request was just to take a screenshot" → triggers screenshot tool call
- **Fix Applied**: Updated parser to skip explanations (check for "to", "just to", "was to" before match)

## Changes Made

### backend/server.js

1. **Line 1636**: Increased trinity model context window
```javascript
'trinity': 32768, // arcee-ai/trinity models - increased from 8K to 32K
```

2. **Lines 1355-1370**: Added screenshot-only detection to handleOpenRouterChat
```javascript
const isScreenshotOnly = /^(take|get|show|capture)\s+(a\s+)?screenshot$/i.test(message.trim());

const messages = [
  ...
  {
    role: 'user',
    content: isScreenshotOnly ? `${message}\n\nIMPORTANT: Just take ONE screenshot, describe what you see, then say "Done". Do NOT perform any other actions.` : message
  }
];
```

3. **Lines 2790-2820**: Added "Done" detection to skip repetition check
```javascript
const aiSaidDone = (initialText || '').trim().toLowerCase().includes('done');

if (aiSaidDone) {
  console.log(`✅ AI explicitly said "Done" - task is complete, skipping repetition check`);
} else {
  // Check for repetition...
}
```

### backend/text-tool-call-parser.js

**Lines 88-110**: Made screenshot intent detection more specific
```javascript
const screenshotPatterns = [
  /^(?:taking|take|capture|capturing|grab|grabbing|get|getting)\s+(?:a\s+)?screenshot/i,  // Start of text
  /(?:i'?ll|i\s+will|let me|i'm going to|i am going to)\s+(?:take|capture|grab|get)\s+(?:a\s+)?screenshot/i,  // Explicit intent
  /^screenshot\s+(?:taken|captured|time)/i  // Start of text
];

// Additional check: Don't match if preceded by "to" or "just to" (explanations)
const beforeMatch = text.substring(0, match.index).toLowerCase().trim();

if (beforeMatch.endsWith('to') || beforeMatch.endsWith('just to') || 
    beforeMatch.endsWith('was to') || beforeMatch.endsWith('was just to')) {
  continue;
}
```

## Current Status

- Context window increased but resets still happening frequently
- Screenshot-only detection added but not being triggered (logs show no "📸 Detected screenshot-only request" message)
- AI still performs full workflows when asked to "Take a screenshot"

## Next Steps

1. **Debug screenshot-only detection**: Check why the detection isn't being triggered
   - Verify the message reaches handleOpenRouterChat unchanged
   - Add more logging to trace the flow
   
2. **Verify context window change**: Check if the 32K context window is being used
   - Look for "Context window: 32768 tokens" in logs
   - Verify resets only happen when context exceeds ~26K tokens (80% of 32K)

3. **Alternative approach**: If detection continues to fail, consider:
   - Post-processing to detect screenshot-only requests and stop execution
   - Different model that follows instructions better
   - Modify system prompt to be more explicit about screenshot-only behavior

## Test Command

```bash
node test-ai-analyze-ocr-text.cjs
```

Expected behavior:
- AI takes ONE screenshot
- AI describes what it sees
- AI says "Done"
- NO additional actions performed
- NO context resets (unless context truly exceeds limit)

Actual behavior:
- AI takes screenshot
- AI performs full workflow (clicks, types, etc.)
- Context resets after every action
- Multiple screenshots taken
