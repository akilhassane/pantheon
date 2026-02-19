# Multi-Step Action Completion Issue

## Problem
AI is unable to complete multi-step actions like "click search box, type 'mr beast', press enter". 

The AI gets stuck in a loop:
1. Click search box at (157, 51)
2. Take screenshot to verify
3. Click search box again at (157, 51)
4. Take screenshot to verify
5. Click search box again at (157, 51)
6. Safety mechanism stops it: "Action completed. Stopped to prevent repeating the same click mouse."

The AI NEVER progresses to typing the text or pressing enter.

## Root Cause
The AI is taking a verification screenshot after EVERY action, which causes it to lose track of the multi-step sequence. It sees the search box is still there and clicks it again instead of moving to the next step (typing).

## Attempted Fixes

### 1. Added Multi-Step Instructions to System Prompt
Added section in `backend/mode-system-prompts.js`:
```
⚠️ MULTI-STEP ACTIONS - COMPLETE THE FULL SEQUENCE:

When user asks for multi-step actions, you MUST complete ALL steps in order:

Example: "click search box, type 'mr beast' and press enter"
Step 1: Click search box at (x, y)
Step 2: IMMEDIATELY type 'mr beast' (don't click again!)
Step 3: IMMEDIATELY press enter (don't click again!)
Step 4: Take screenshot to verify
Step 5: Say "Done"

CRITICAL RULES FOR MULTI-STEP:
- After clicking an input field, IMMEDIATELY type the text
- DO NOT click the same element multiple times
- DO NOT take screenshot between click and type - just type immediately
- After typing, IMMEDIATELY press the key (enter, tab, etc.)
- ONLY take verification screenshot AFTER completing all steps
```

### 2. Result
AI still takes screenshot after clicking and gets stuck in loop.

## Possible Solutions

### Option 1: Backend-Side Multi-Step Detection
Detect when user request contains multiple steps and modify AI behavior:
- Parse user message for multi-step patterns: "click X, type Y, press Z"
- Inject system message: "Complete all steps before taking verification screenshot"
- Track action sequence and prevent repeated clicks on same element

### Option 2: Disable Verification Screenshots for Input Actions
When AI clicks an input field (Edit control), automatically:
- Skip verification screenshot
- Inject system message: "Input field focused, type immediately"
- Force next action to be type_text

### Option 3: Use Different Model
The current model (arcee-ai/trinity-large-preview:free) may not follow multi-step instructions well.
Try:
- google/gemini-2.0-flash-exp:free
- anthropic/claude-3.5-sonnet (paid)
- openai/gpt-4o (paid)

### Option 4: Change Prompt Strategy
Instead of asking AI to do multiple steps, break into separate requests:
1. Request 1: "click on the search box"
2. Wait for completion
3. Request 2: "type 'mr beast'"
4. Wait for completion  
5. Request 3: "press enter"

This is less efficient but more reliable.

## Test Case
```javascript
// test-youtube-search-simple.cjs
await sendMessage('click on the youtube search box, type "mr beast" and press enter to search');
```

Expected: AI clicks search box → types "mr beast" → presses enter
Actual: AI clicks search box → screenshot → clicks again → screenshot → clicks again → stops

## Files Modified
- `backend/mode-system-prompts.js` (added multi-step instructions)
- `test-youtube-search-simple.cjs` (test script)

## Status
❌ **UNRESOLVED** - AI cannot complete multi-step actions
✅ Anti-hallucination rules working (AI calls screenshot tool before describing)
✅ Desktop icon detection working
✅ Double-click support working
✅ Auto-maximize working

## Next Steps
1. Try Option 2: Disable verification screenshots for input field clicks
2. If that fails, try Option 3: Test with different model (Gemini 2.0 Flash)
3. If that fails, implement Option 4: Break into separate requests
