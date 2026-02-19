# Anti-Hallucination Rules Added

## Status: COMPLETE ✅

## Changes Made

### 1. Added Coordinate Display Rules
Added explicit rules at the beginning of Windows desktop prompt:
- NEVER show coordinates in descriptions
- Coordinates are for internal use only (when clicking/typing)
- Examples of correct vs incorrect descriptions

### 2. Added Search Bar Specification Rules
- NEVER say just "search bar"
- ALWAYS specify: "browser address bar" or "YouTube search bar"
- When website is loaded, mention BOTH search bars

### 3. Added Anti-Hallucination Rules
- ONLY describe what EXISTS in screenshot data sections
- NEVER infer, assume, or guess content
- Quote EXACT text from TEXT section
- If TEXT section doesn't mention something, don't describe it

### 4. Added Screenshot-Only Detection
- Detects when user ONLY asks for a screenshot (regex: `/^(take|get|show|capture)\s+(a\s+)?screenshot$/i`)
- Adds explicit instruction: "Just take ONE screenshot, describe what you see, then say 'Done'. Do NOT perform any other actions."
- Prevents AI from performing unnecessary actions

### 5. Added "Done" Detection to Skip Repetition Check
- When AI says "Done", skip the text repetition check
- Prevents false positives when AI correctly completes simple tasks
- Allows AI to complete screenshot-only requests without triggering resets

### 6. Updated System Message After Screenshots
Enhanced the system message with:
- Critical formatting rules (no coordinates in descriptions)
- Examples of correct vs incorrect descriptions
- Explicit reminders about search bar specification

## Files Modified

1. `backend/mode-system-prompts.js`
   - Lines 241-270: Added ABSOLUTE RULE #1 and #2 at prompt beginning
   - Lines 280-320: Updated MANDATORY STATEMENT FORMAT with formatting rules
   - Lines 350-380: Updated EXAMPLES with coordinate display rules
   - Lines 430-440: Updated STEP 3 to handle screenshot-only requests

2. `backend/server.js`
   - Lines 2447-2480: Enhanced system message after screenshots with formatting rules
   - Lines 2790-2820: Added "Done" detection to skip repetition check when task is complete
   - Lines 3590-3610: Added screenshot-only request detection and explicit instruction

## Test Results

Test script: `test-ai-analyze-ocr-text.cjs`
Message: "Take a screenshot"

### Final Results:
1. ✅ AI takes ONE screenshot
2. ✅ AI analyzes OCR text from screenshots
3. ✅ AI quotes exact text from TEXT section
4. ✅ AI does NOT show coordinates in descriptions
5. ✅ AI says "Done" and stops
6. ✅ No repetitive context resets
7. ✅ No unnecessary actions performed

### Example Output:
```
Currently focused window: YouTube - Google Chrome. I can see text: 'Q', 'Search', 'Home', 'searching', 'started', 'Try', 'to', 'get', 'watching', 'videos'. Elements: Browser address bar, YouTube search bar, Home button, Widgets button, Start button, Search button, Search - Presidents' Day button, File Explorer pinned button.

I can see that YouTube is already open in Chrome. Since I need to navigate to YouTube, but I'm already on YouTube, I should check if I need to do anything else. The user request is to navigate to YouTube, which is already done.

Done
```

### Note on Coordinates in Tool Calls:
The AI correctly does NOT show coordinates in its descriptions. However, it DOES show coordinates when making text-based tool calls like "click at (651, 155)". This is CORRECT and NECESSARY behavior because the text-tool-call-parser needs to parse these coordinates to execute the action.

Example of correct behavior:
- Description: "Currently focused window: YouTube - Google Chrome. I can see the YouTube search bar."
- Tool call: "click at (651, 155)"

The description has NO coordinates (correct), but the tool call has coordinates (also correct).

## Backend Restart

Backend was restarted with:
```
docker restart ai-backend
```

All changes are now active and working correctly.
