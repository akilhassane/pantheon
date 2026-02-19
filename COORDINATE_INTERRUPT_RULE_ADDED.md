# Coordinate Interrupt Rule - COMPLETE

## Status: ✅ IMPLEMENTED

## User Request
"set a rule that explicitly says that if the coordinates of the click are the same just interrupt the flow and move on"

## Problem
AI was sometimes trying to click the same coordinates multiple times, causing repetitive behavior and wasting time. The system needed an explicit, automatic interrupt mechanism.

## Solution Implemented

Added **COORDINATE CHECK - MANDATORY BEFORE EVERY CLICK** rule to `backend/mode-system-prompts.js`.

### Key Features

1. **Automatic Interrupt Mechanism**
   - Before EVERY click, AI must check: "Are these the same coordinates as my last click?"
   - If YES → IMMEDIATELY INTERRUPT and MOVE ON
   - If NO → Proceed with click

2. **Explicit Coordinate Comparison**
   ```
   (170, 51) vs (170, 51) = SAME → FORBIDDEN! INTERRUPT!
   (170, 51) vs (651, 155) = DIFFERENT → OK, proceed
   (100, 200) vs (100, 201) = DIFFERENT → OK (even 1 pixel difference is OK)
   ```

3. **Clear Interrupt Workflow**
   ```
   1. Before EVERY click, check last click coordinates
   2. If coordinates match → STOP IMMEDIATELY
   3. Say "Moving on to next step"
   4. Skip this action
   5. Continue to next step
   ```

4. **No Exceptions**
   - This is AUTOMATIC - no thinking, no retrying
   - Just INTERRUPT and MOVE ON
   - Progress > Perfection

## Changes Made

### 1. Updated ABSOLUTE PROHIBITION Section
Added prominent "🔴 COORDINATE CHECK - MANDATORY BEFORE EVERY CLICK 🔴" section with:
- Step-by-step coordinate checking workflow
- Automatic interrupt rule
- Examples of forbidden vs allowed behavior
- Coordinate comparison rules

### 2. Updated MANDATORY RULES Section
Added as Rule #3: "NEVER CLICK SAME COORDINATES TWICE (AUTOMATIC INTERRUPT!)"
- Clear before/after check
- Interrupt mechanism
- Examples with actual coordinates

### 3. Renumbered Existing Rules
- Rule 3: Coordinate interrupt (NEW)
- Rule 4: Never interact with same element twice
- Rule 5: Progress forward only
- Rule 6: Say "Done" when complete
- Rule 7: Good enough = move on

## Examples

### FORBIDDEN (Will Interrupt)
```
❌ Last click: (170, 51) → Next click: (170, 51)
   → INTERRUPT! MOVE ON!

❌ Last click: (651, 155) → Next click: (651, 155)
   → INTERRUPT! MOVE ON!
```

### ALLOWED
```
✅ Last click: (170, 51) → Next click: (651, 155)
   → Different coordinates, proceed

✅ Last click: (170, 51) → Type text
   → Different action type, proceed

✅ Last click: (100, 200) → Next click: (100, 201)
   → Different coordinates (even 1 pixel), proceed
```

## Expected Behavior

When AI tries to click same coordinates:
1. AI checks: "Last click was (170, 51), I want to click (170, 51)"
2. AI detects: "These are THE SAME coordinates!"
3. AI responds: "Moving on to next step" (or similar)
4. AI skips the click action
5. AI continues to next step in workflow

## Files Modified

- `backend/mode-system-prompts.js`
  - Lines ~270-310: Added COORDINATE CHECK section
  - Lines ~315-380: Updated MANDATORY RULES with coordinate interrupt as Rule #3

## Testing

To test the coordinate interrupt rule:

1. Give AI a task that might cause repetition
2. Watch for AI attempting to click same coordinates
3. AI should automatically detect and say "Moving on" or similar
4. AI should skip the duplicate click and continue

Example test:
```
"click the search bar and search for something"
```

If AI tries to click search bar twice, it should:
- Detect same coordinates
- Interrupt automatically
- Move on to typing instead

## Integration with Existing Rules

This rule works together with:
- Rule #4: Never interact with same element twice
- Rule #7: Good enough = move on
- Backend repetition detection (server.js)
- Workflow loop detection

The coordinate check is the FIRST line of defense - it catches repetition at the AI level before it even attempts the action.

## Summary

✅ Added explicit coordinate checking rule
✅ Automatic interrupt mechanism
✅ Clear examples with actual coordinates
✅ Integrated as Rule #3 in mandatory rules
✅ Backend restarted with new prompt

The AI now has an explicit, automatic interrupt rule: if coordinates match the last click, immediately stop and move on. No exceptions, no retries, just progress forward.
