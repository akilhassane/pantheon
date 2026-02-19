# YouTube Search Bar Detection Issue

## Problem
The AI is not clicking the correct YouTube search bar. Instead, it's clicking a nearby element.

## Root Cause Analysis

### Current Screenshot Data
When taking a screenshot of YouTube:
- **UI Elements with "search"**: Only 1 found - "Search" TaskbarButton at (994, 1056) - this is Windows taskbar search, NOT YouTube
- **Edit Controls**: 0 found - YouTube search bar is NOT detected as an Edit control
- **OCR Text with "search"**: 0 found - OCR is not detecting the "Search" placeholder text

### What's Missing
The YouTube search bar itself is not being detected by the Windows UI Automation API as an Edit control. This could be because:
1. YouTube uses a custom web component that doesn't expose proper accessibility properties
2. The element is inside an iframe or shadow DOM
3. The browser's accessibility tree doesn't properly expose it

## Current Fallback Logic Issues

The fallback mechanism in `backend/text-tool-call-parser.js`:
1. Looks for elements with "search" in the name
2. Finds only the Windows taskbar "Search" button
3. Tries to prioritize Edit controls, but there are none
4. Falls back to clicking whatever element it found

## Solution: OCR-to-Element Correlation

As suggested, we need to:

1. **Use OCR text as anchor points**: Look for visible text like "Search" in the OCR data
2. **Find clickable elements near OCR text**: Search for UI elements within a radius of the OCR text position
3. **Prioritize by proximity**: Click the element closest to the OCR text, not just by name matching

### Implementation Steps

1. When AI says "click the YouTube search bar":
   - Extract "search" as the target keyword
   - Look for OCR text containing "search"
   - Find all UI elements within 50-100px of that OCR text
   - Prioritize Edit controls, then clickable elements (Button, etc.)
   - Use the coordinates of the closest matching element

2. Add logging to show:
   - OCR text found and its position
   - Nearby elements and their distances
   - Which element was selected and why

### Alternative Approach

If OCR doesn't detect the "Search" text, we could:
1. Look for elements in the expected header area (y between 50-150)
2. Filter by element type (Edit, Button, etc.)
3. Use heuristics like "leftmost Edit control in header" or "element near center-top"

## Test Data

From current screenshot:
- Screen size: 1920x1080
- Mouse position: (651, 155)
- Only "Search" element: TaskbarButton at (994, 1056) - clearly wrong, this is taskbar
- No Edit controls detected
- No OCR text with "search"

## Recommendation

Implement OCR-to-element correlation in the fallback mechanism to make it more robust when UI Automation doesn't properly detect web elements.
