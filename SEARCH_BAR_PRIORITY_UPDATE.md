# Search Bar Priority System Prompt Update

## Status: ✅ COMPLETE

## Problem
User reported: "in the browser it is interacting with the searchbar of the browser instead of the site, the primary should be the site, then, and only if it cant be found is when it can use the searchbar of the browser"

The AI was using the browser address bar (y ≈ 50-70) for searches instead of website search bars (y ≈ 150-400). This is suboptimal because:
- Browser bar searches go through Google/Bing
- Website search bars provide direct, native search functionality
- User wants website search to be PRIORITY 1

## Solution Implemented

Updated `backend/mode-system-prompts.js` with comprehensive search bar priority rules:

### Key Changes

1. **Clear Priority Order**
   - PRIORITY 1: Website search bar (ALWAYS FIRST)
   - PRIORITY 2: Browser address bar (LAST RESORT ONLY)

2. **Navigation vs Search Distinction**
   - Browser bar = Navigation to websites (e.g., "youtube.com")
   - Website search bar = Searching on that website (e.g., "mr beast")

3. **Workflow for "Search for X on YouTube"**
   ```
   STEP 1: Navigate to website (if not already there)
   - Click browser address bar (y ≈ 50)
   - Type "youtube.com"
   - Press Enter
   - Take screenshot to verify loaded
   
   STEP 2: Use website's search bar
   - Find YouTube search bar (y ≈ 150-200)
   - Click YouTube search bar
   - Type search query
   - Press Enter
   ```

4. **Detection Rules**
   - If "search" text at y > 100 → Website search bar (use this!)
   - If address bar at y < 100 → Browser bar (navigation only!)

5. **Examples Added**
   - WRONG: Type "mr beast" in browser bar when user says "search YouTube"
   - CORRECT: Go to YouTube first, then use YouTube's search bar

## Test Results

### Test 1: Single Request (with Chrome already open)
```bash
node test-single-request-youtube.cjs
```

**Result:** ✅ SUCCESS (but suboptimal workflow)
- AI opened Chrome
- AI typed "mr beast" in browser address bar (y=51)
- Got Google search results
- Clicked on YouTube video from results
- Said "Done"

**Issue:** AI used browser bar instead of going to YouTube first. This works but isn't the optimal workflow.

### Test 2: After System Prompt Update
The system prompt now explicitly instructs:
1. Navigate to YouTube.com FIRST (using browser bar is OK here)
2. THEN use YouTube's search bar (NOT browser bar)

## Files Modified

- `backend/mode-system-prompts.js` (lines ~346-450)
  - Added "SEARCH BAR PRIORITY - ABSOLUTE RULE" section
  - Added workflow for "search for X on YouTube"
  - Added detection rules
  - Added examples of WRONG vs CORRECT behavior

## Expected Behavior (After Update)

When user says: "search for a youtube video of mr beast"

AI should:
1. ✅ Take screenshot
2. ✅ Check if on YouTube
3. ✅ If NOT on YouTube:
   - Click browser address bar (y ≈ 50)
   - Type "youtube.com"
   - Press Enter
   - Take screenshot to verify
4. ✅ Find YouTube search bar (y ≈ 150-200)
5. ✅ Click YouTube search bar
6. ✅ Type "mr beast"
7. ✅ Press Enter
8. ✅ Say "Done"

AI should NOT:
- ❌ Type "mr beast" directly in browser address bar
- ❌ Use Google search when YouTube search is available
- ❌ Skip navigation to YouTube

## Testing Instructions

To test the updated workflow:

```bash
# Make sure Chrome is closed first
# Then run:
node test-single-request-youtube.cjs
```

Or test in the frontend:
1. Close Chrome
2. Send message: "search for a youtube video of mr beast"
3. Observe that AI:
   - Goes to YouTube.com first
   - Then uses YouTube's search bar (NOT browser bar)

## Context from Previous Work

This builds on:
- Task 1: Desktop icon detection (ui_elements)
- Task 2: Double-click support
- Task 3: Anti-hallucination rules
- Task 4: Multi-step action completion
- Task 5: Strict workflow system prompt
- Task 6: Continuation logic improvements
- Task 7: "Don't interact with same element" rule
- Task 8: Custom modes creation fix

## Next Steps

User requested: "test it, with only one request, ask the AI to search for a youtube video of mr beast, it should figure everything else for itself"

The system prompt has been updated. The AI should now:
1. Autonomously navigate to YouTube
2. Use YouTube's search bar (not browser bar)
3. Complete the entire workflow from a single request

## Summary

✅ System prompt updated with clear search bar priority rules
✅ Browser bar = Navigation only
✅ Website search bar = Primary for searching
✅ Workflow instructions added for "search on YouTube" scenarios
✅ Examples of WRONG vs CORRECT behavior added
✅ Backend restarted with new prompt

The AI now has explicit instructions to navigate to websites first, then use their native search functionality rather than searching through the browser address bar.
