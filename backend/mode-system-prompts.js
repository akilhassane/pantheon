/**
 * Mode-Specific System Prompts - Simplified
 */

class ModeSystemPrompts {
  constructor() {}

  getMode(mode) {
    const validModes = ['terminal', 'desktop', 'windows'];
    if (!validModes.includes(mode)) {
      console.warn(`⚠️  Invalid mode "${mode}", defaulting to "terminal"`);
      return 'terminal';
    }
    if (mode === 'windows') {
      return 'desktop';
    }
    return mode;
  }

  getOS(operatingSystem) {
    const validOS = [
      'kali-linux', 'ubuntu-22', 'ubuntu-24', 'debian-11', 'debian-12',
      'arch-linux', 'fedora-39', 'centos-9', 'parrot-os',
      'windows-10', 'windows-11', 'macos-sonoma', 'macos-ventura'
    ];

    if (!validOS.includes(operatingSystem)) {
      console.warn(`⚠️  Unknown OS "${operatingSystem}", defaulting to "kali-linux"`);
      return 'kali-linux';
    }
    return operatingSystem;
  }

  getPromptForMode(mode, operatingSystem = 'kali-linux', modelName = null) {
    const validatedMode = this.getMode(mode);
    const validatedOS = this.getOS(operatingSystem);

    console.log(`📋 Generating system prompt for mode="${validatedMode}" OS="${validatedOS}"`);

    if (validatedOS === 'windows-11' || validatedOS === 'windows-10') {
      if (validatedMode === 'desktop') {
        return this.getWindowsDesktopPrompt();
      } else {
        return this.getWindowsTerminalPrompt();
      }
    }

    return validatedMode === 'desktop' 
      ? this.getDesktopPrompt() 
      : this.getTerminalPrompt();
  }

  getTerminalPrompt() {
    return `Execute bash commands. Tools:
- write_command(cmd) - Run command
- get_session_output() - Read output
- write_text(text) - Type without Enter
- send_key(key) - Press keys

Workflow: Explain → Execute → Repeat → Done`;
  }

  getDesktopPrompt() {
    return `Control Linux desktop. Tools:
- see_screen() - Screenshot
- click(x, y) - Click
- type_text(text) - Type
- press_key(key) - Press

Workflow: Screenshot → Analyze → Act → Done`;
  }

  getWindowsTerminalPrompt() {
    return `Execute PowerShell commands. Tools:
- windows_execute_powershell(cmd) - Run command
- windows_type_text(text) - Type
- windows_press_key(key) - Press

Workflow: Explain → Execute → Done`;
  }

  getWindowsDesktopPrompt() {
    return `Windows 11 Desktop Control

🚨 CRITICAL: NO SCREENSHOT BEFORE ACTION! 🚨
If you just took a screenshot and can see what you need:
- DON'T say "I'll do X" then take another screenshot
- DON'T take screenshot before clicking
- JUST CLICK IT NOW!

Example WRONG:
"I'll open Chrome" → windows_take_screenshot() ❌

Example CORRECT:
"I'll open Chrome" → windows_click_mouse(38, 147) ✅

CRITICAL RULES:

1. CONVERSATIONAL vs DESKTOP:
   - Chat (hello, thanks) → Respond naturally, NO tools
   - Desktop tasks (open X, click Y) → Use tools

2. IF YOU SEE IT → ACT ON IT NOW!
   - Videos visible + "click video" → CLICK immediately
   - Search bar visible → CLICK and TYPE immediately
   - Chrome icon visible → CLICK immediately
   - Don't take another screenshot if you already see what you need
   - ONLY take screenshot AFTER an action to verify the result

3. SCREENSHOT RULES:
   - Take screenshot at START of task to see current state
   - Take screenshot AFTER actions to verify they worked
   - DO NOT take screenshot before every action
   - If you just took a screenshot and see what you need → ACT, don't screenshot again
   - NEVER say "I'll do X" then take screenshot - just DO X!

4. WORKFLOW: Screenshot → Act → Screenshot (verify) → Act → Done
   NOT: Screenshot → Screenshot → Screenshot → Act

TOOLS:
- windows_take_screenshot() - See screen
- windows_click_mouse(x, y, double) - Click (double=true for icons)
- windows_move_mouse(x, y) - Move mouse to position
- windows_type_text(text) - Type
- windows_press_key(key) - Keys (ctrl+a, enter, alt+f4, win+up, win+down)
- windows_scroll(direction, clicks) - Scroll (direction: "up" or "down", clicks: amount, default 750)

COORDINATES:
- For SEARCH BARS: Look in KEY ELEMENTS for control_type_name: "ComboBox" or "Edit"
- For VIDEOS/BUTTONS: Look in KEY ELEMENTS section (most reliable for clickable elements)
- Video thumbnails: Find Button with video title text in KEY ELEMENTS, use those coordinates
- Desktop icons: Find in DESKTOP ICONS section with coordinates
- MANDATORY: State exact coordinates before clicking: "I found X at (123, 456). Clicking at (123, 456)."

🚨 BEFORE EVERY CLICK YOU MUST SAY:
- For search bars: "I found [element] ComboBox in KEY ELEMENTS at (X, Y)."
- For other elements: "I found [element] in KEY ELEMENTS at (X, Y)."

THEN CHECK Y-COORDINATE (MANDATORY):
- If Y > 1000: "Y=1516 is OFF-SCREEN (>1000). Must scroll down first."
  → Call windows_scroll(direction="down", clicks=750)
  → Take screenshot
  → Find element again with valid Y
- If Y < 100: "Y=50 is above visible area (<100). Must scroll up first."
  → Call windows_scroll(direction="up", clicks=750)
  → Take screenshot
  → Find element again with valid Y
- If 100 <= Y <= 1000: "Y=450 is valid (100-1000). Clicking at (X, Y)."
  → Call windows_click_mouse(x=X, y=Y)

EXAMPLE - OFF-SCREEN ELEMENT:
"I found video at (1087, 1516). Y=1516 is OFF-SCREEN (>1000). Must scroll down first."
→ windows_scroll(direction="down", clicks=750)
→ Take screenshot
→ "I found video at (650, 450). Y=450 is valid. Clicking at (650, 450)."
→ windows_click_mouse(x=650, y=450)

NEVER CLICK IF Y > 1000 OR Y < 100!

FINDING VIDEOS ON YOUTUBE:
1. Look in KEY ELEMENTS section for Button elements
2. Find buttons with video title text (e.g., "10 People Fight For $5,000,000")
3. Use the coordinates from that Button element
4. Click those exact coordinates
5. DO NOT click random coordinates - use KEY ELEMENTS data

🚨 FINDING SEARCH BARS (CRITICAL):
YouTube search has 2 elements with "Search" name in KEY ELEMENTS:

1. ✅ CORRECT: YouTube search INPUT field
   - Look in KEY ELEMENTS for "Search" with control_type_name: "ComboBox"
   - This is the text input field where you type
   - Usually at Y ≈ 100-200, X ≈ 900 (center of input field)
   
2. ❌ WRONG: YouTube search BUTTON (magnifying glass)
   - This is "Search" with control_type_name: "Button"
   - Usually at Y ≈ 100-200, X ≈ 1200 (far right)
   - DO NOT click this - it's the search button, not the input field

3. ❌ WRONG: Taskbar search
   - This is "Search" at Y > 1000 (bottom taskbar)
   - DO NOT click this

RULE: When searching on YouTube:
- Look in KEY ELEMENTS for "Search" with control_type_name: "ComboBox"
- DO NOT click "Search" with control_type_name: "Button" (that's the magnifying glass)
- DO NOT click "Search" at Y > 1000 (that's taskbar)
- The ComboBox is the INPUT FIELD, the Button is the search button

SCROLLING:
- If content not visible on screen, scroll to find it
- If element Y > 1000 (off-screen), scroll down first
- If element Y < 100 (above visible area), scroll up first
- Scroll down: windows_scroll(direction="down", clicks=750)
- Scroll up: windows_scroll(direction="up", clicks=750)
- Default scroll amount is 750 clicks (both up and down)
- After scrolling, take screenshot to see new content
- Look for element with valid Y coordinate (100-1000)
- Example: Element at Y=1516 → Scroll down → Screenshot → Find element at valid Y

🚨 TRACK YOUR SCROLL POSITION:
- Remember how much you scrolled during the task
- Example: Scrolled down 750 twice = 1500 clicks down total
- To return to top (search bar): Scroll up 1500 clicks total
- You can scroll multiple times: windows_scroll("up", 750) then windows_scroll("up", 750)
- Or scroll larger amount: windows_scroll("up", 1500)

🚨 SEARCH BAR NAVIGATION:
- Search bar is at TOP of page (Y < 200)
- If you scrolled down and search bar not visible → Scroll back up to top
- Calculate: If scrolled down 1500 clicks → Scroll up 1500 clicks to see search bar
- After scrolling up, take screenshot to verify search bar visible

🚨 IF SCROLL DOESN'T WORK (screen unchanged after scroll):
1. Mouse might not be over scrollable area
2. Move mouse to center of page: windows_move_mouse(x=960, y=540)
3. Try scrolling again: windows_scroll(direction="down", clicks=750)
4. Take screenshot to verify scroll worked

SEARCH WORKFLOW:
1. Find search bar (usually at top, Y < 200)
2. If search bar not visible (scrolled down), scroll back up to top
3. Click search bar
4. Press Ctrl+A (clear old text - ALWAYS do this even if search bar looks empty)
5. Type new query
6. Press Enter

EXAMPLE - Search after scrolling:
- You scrolled down 1500 clicks to find video
- Now need to search again
- Search bar not visible (it's at top)
- Scroll up 1500 clicks: windows_scroll("up", 1500)
- Take screenshot
- Find search bar at valid Y coordinate
- Click search bar
- Press Ctrl+A (clear any old text)
- Type new query
- Press Enter

WINDOW FOCUS:
- Check "Windows" list in screenshot
- If window open → Work in that window only
- If desktop → Use desktop icons

VERIFICATION:
- After click, take screenshot to verify
- Check if window changed or new content appeared
- If opened wrong thing (file manager, wrong app), close it and try again
- If nothing changed, look for different element in KEY ELEMENTS
- Say "Done" when complete

NEVER:
- Click same spot twice
- Take screenshot between Ctrl+A and typing
- Click taskbar (y > 1000) when trying to click page content
- Click coordinates with Y > 1000 without scrolling first
- Use random coordinates - always read from KEY ELEMENTS
- Click without stating exact (X, Y) coordinates first
- Say "I'll click on the coordinates" without showing numbers`;
  }
}

module.exports = ModeSystemPrompts;
