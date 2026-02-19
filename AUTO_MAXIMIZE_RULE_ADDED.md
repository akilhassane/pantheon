# Auto-Maximize Rule - Enhanced ✅

## Issue
When opening applications, windows were not being automatically maximized. The AI would open the application but leave it in a non-maximized state.

## Solution
Enhanced the system prompt with explicit auto-maximize instructions integrated into the iteration workflow.

## Changes Made

### 1. Added AUTO-MAXIMIZE RULE Section
Added a dedicated section in the iteration workflow (`backend/mode-system-prompts.js`):

```
🪟 AUTO-MAXIMIZE RULE - CRITICAL:

When you open ANY application for the FIRST TIME:
1. Double-click desktop icon or click taskbar button
2. Take verification screenshot
3. Check window state: Look for "isMaximized": false or window not at full screen
4. If window is NOT maximized → IMMEDIATELY click maximize button at (1850, 15)
5. Take final verification screenshot
6. Confirm window is now maximized

Example workflow for "open Chrome":
1. Take screenshot → See Chrome icon on desktop at (38, 147)
2. Double-click at (38, 147) with double=true
3. Take verification screenshot → Chrome window appeared
4. Check: "isMaximized": false → Window is NOT maximized
5. Click maximize at (1850, 15) → "click at (1850, 15)"
6. Take verification screenshot → Confirm maximized
7. "Done. Chrome is now open and maximized."

NEVER leave a newly opened window un-maximized!
ALWAYS check isMaximized field in window data!
ALWAYS maximize if isMaximized is false!
```

### 2. Updated Example Workflow
The example workflow now includes the maximize step:
- Open application (double-click)
- Verify it opened
- **Check if maximized**
- **If not maximized → Click maximize button**
- Verify maximized
- Done

### 3. Key Instructions
- **NEVER leave a newly opened window un-maximized**
- **ALWAYS check isMaximized field** in window data
- **ALWAYS maximize if isMaximized is false**
- Maximize button is at **(1850, 15)** - middle button

## How It Works

### Window State Detection
The screenshot data includes window information with `isMaximized` field:

```json
{
  "name": "Google Chrome",
  "x": 100,
  "y": 100,
  "width": 800,
  "height": 600,
  "isMaximized": false  ← AI checks this
}
```

### AI Workflow
1. **Open application** - Double-click desktop icon or click taskbar
2. **Take screenshot** - Get current window state
3. **Check isMaximized** - Look at window data
4. **If false** - Click maximize button at (1850, 15)
5. **Verify** - Take screenshot to confirm maximized
6. **Done** - Only after confirming maximized

## Benefits

1. **Consistent UX** - All opened applications are maximized
2. **Better visibility** - Full screen makes content easier to see
3. **Automatic** - AI handles it without user asking
4. **Verified** - AI confirms window is maximized before finishing
5. **Human-like** - Mimics how users typically maximize new windows

## Integration with Existing Features

Works seamlessly with:
- ✅ **Double-click support** - Opens desktop icons correctly
- ✅ **Iteration logic** - Retries if maximize fails
- ✅ **Verification** - Screenshots confirm each step
- ✅ **Window controls** - Uses correct coordinates (1850, 15)

## Example Execution

```
User: "open chrome"

AI Actions:
1. Take screenshot
2. See Chrome icon at (38, 147)
3. Double-click at (38, 147) with double=true
4. Take verification screenshot
5. Check window: "isMaximized": false
6. Click at (1850, 15) to maximize
7. Take verification screenshot
8. Confirm: "isMaximized": true
9. "Done. Chrome is now open and maximized."
```

## Files Modified
- `backend/mode-system-prompts.js` - Added AUTO-MAXIMIZE RULE section

## Testing
The rule is now active and will be applied whenever the AI opens any application for the first time.

## Notes
- The rule only applies when opening applications **for the first time**
- If a window is already open, the AI won't maximize it unless asked
- The AI checks the `isMaximized` field in the screenshot data
- Maximize button coordinates: **(1850, 15)** - middle of 3 buttons
