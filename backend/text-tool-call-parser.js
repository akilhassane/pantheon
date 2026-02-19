/**
 * Text-based Tool Call Parser
 * Detects and extracts tool calls from model text output
 */

/**
 * Parse tool calls from text output
 * Supports multiple formats:
 * - [Calls: function_name(args)]
 * - [Call: function_name(args)]
 * - Tool: function_name(args)
 * - Function: function_name(args)
 * - function_name(args)
 * - Intent-based: "Taking screenshot", "I'll take a screenshot", etc.
 * 
 * @param {string} text - Text to parse
 * @returns {Object|null} - Parsed tool call or null
 */
function parseToolCallFromText(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  // Pattern 1: [Calls: function_name(args)] or [Call: function_name(args)]
  // Handle both simple args and JSON objects: function() or function({key: value})
  const bracketPattern = /\[Calls?:\s*([a-zA-Z_][a-zA-Z0-9_]*)\((\{[^}]*\}|[^)]*)\)\]/i;
  let match = text.match(bracketPattern);
  
  if (match) {
    return {
      functionName: match[1],
      argsString: match[2],
      fullMatch: match[0],
      matchIndex: match.index
    };
  }

  // Pattern 2: Tool: function_name(args) or Function: function_name(args)
  const labelPattern = /(?:Tool|Function):\s*([a-zA-Z_][a-zA-Z0-9_]*)\((.*?)\)/i;
  match = text.match(labelPattern);
  
  if (match) {
    return {
      functionName: match[1],
      argsString: match[2],
      fullMatch: match[0],
      matchIndex: match.index
    };
  }

  // Pattern 3: function_name() at end of line or sentence
  const functionPattern = /([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]*)\)(?:\s*$|[.!?\n])/;
  match = text.match(functionPattern);
  
  if (match) {
    const functionName = match[1];
    // Only match if it looks like a tool name (contains underscore or starts with windows_)
    if (functionName.includes('_') || functionName.startsWith('windows')) {
      return {
        functionName: match[1],
        argsString: match[2],
        fullMatch: match[0].replace(/[.!?\n]$/, ''), // Remove trailing punctuation
        matchIndex: match.index
      };
    }
  }

  // Pattern 4: Intent-based detection
  const intentMatch = detectToolIntent(text);
  if (intentMatch) {
    return intentMatch;
  }

  return null;
}

/**
 * Detect tool calling intent from natural language
 * @param {string} text - Text to analyze
 * @returns {Object|null} - Detected tool call or null
 */
function detectToolIntent(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const lowerText = text.toLowerCase().trim();
  
  // Screenshot intent patterns
  // CRITICAL: Only match action commands, not explanations
  // Match: "Take screenshot", "I'll take a screenshot", "Let me take a screenshot"
  // Don't match: "to take a screenshot", "was to take a screenshot", "just to take a screenshot"
  const screenshotPatterns = [
    /^(?:taking|take|capture|capturing|grab|grabbing|get|getting)\s+(?:a\s+)?screenshot/i,  // Start of text
    /(?:i'?ll|i\s+will|let me|i'm going to|i am going to)\s+(?:take|capture|grab|get)\s+(?:a\s+)?screenshot/i,  // Explicit intent
    /^screenshot\s+(?:taken|captured|time)/i  // Start of text
  ];
  
  for (const pattern of screenshotPatterns) {
    if (pattern.test(text)) {
      // Additional check: Don't match if preceded by "to" or "just to" (explanations)
      const match = text.match(pattern);
      const beforeMatch = text.substring(0, match.index).toLowerCase().trim();
      
      // Skip if this is part of an explanation (preceded by "to", "just to", "was to", etc.)
      if (beforeMatch.endsWith('to') || beforeMatch.endsWith('just to') || 
          beforeMatch.endsWith('was to') || beforeMatch.endsWith('was just to')) {
        continue;
      }
      
      return {
        functionName: 'windows_take_screenshot',
        argsString: '',
        fullMatch: match[0],
        matchIndex: match.index,
        _fromIntent: true
      };
    }
  }
  
  // Click intent patterns with coordinates
  // Pattern 1: Direct "click at (x, y)" or "double-click at (x, y)" or "clicking at (x, y)"
  // Note: Handle various hyphen characters (-, ‑, –, —) and present/continuous tense
  const clickPattern = /(?:double[\s\-‑–—]?click(?:ing)?|click(?:ing)?)\s+(?:at|on)?\s*(?:\()?(\d+)\s*,\s*(\d+)(?:\))?/i;
  let match = text.match(clickPattern);
  if (match) {
    const isDouble = /double[\s\-‑–—]?click/i.test(match[0]);
    return {
      functionName: 'windows_click_mouse',
      argsString: JSON.stringify({ x: parseInt(match[1]), y: parseInt(match[2]), double: isDouble }),
      fullMatch: match[0],
      matchIndex: match.index,
      _fromIntent: true
    };
  }
  
  // Pattern 2: "I'll double-click that spot" after mentioning coordinates
  // Look for coordinates (x, y) followed by double-click/click mention within 200 chars
  // 🚨 CRITICAL: VALIDATE COORDINATES AGAINST OCR DATA
  const coordsPattern = /\((\d+),\s*(\d+)\)/g;
  const clickMentionPattern = /(?:i'?ll\s+(?:now\s+)?(?:double[\s\-‑–—]?click|click)|i\s+will\s+(?:double[\s\-‑–—]?click|click)|i\s+want\s+to\s+.*?(?:double[\s\-‑–—]?click|click)|perform\s+(?:a\s+)?(?:double[\s\-‑–—]?click|click)|proceed\s+to\s+(?:double[\s\-‑–—]?click|click)|going\s+to\s+(?:double[\s\-‑–—]?click|click))/i;
  
  let coordsMatch;
  const coordsMatches = [];
  while ((coordsMatch = coordsPattern.exec(text)) !== null) {
    coordsMatches.push({
      x: coordsMatch[1],
      y: coordsMatch[2],
      index: coordsMatch.index,
      match: coordsMatch[0]
    });
  }
  
  // Check if there's a click mention after any coordinates
  for (const coords of coordsMatches.reverse()) { // Check from last to first
    const textAfter = text.substring(coords.index);
    const clickMatch = textAfter.match(clickMentionPattern);
    if (clickMatch && clickMatch.index < 200) { // Within 200 chars
      const isDouble = /double[\s\-‑–—]?click/i.test(clickMatch[0]);
      const aiX = parseInt(coords.x);
      const aiY = parseInt(coords.y);
      
      // 🚨 VALIDATE: Check if there's OCR text near these coordinates that better matches
      // Extract element name from text before coordinates
      const textBefore = text.substring(0, coords.index).toLowerCase();
      const elementNameMatch = textBefore.match(/(?:click|double-click)\s+(?:the\s+)?(?:edit\s+field\s+)?(?:button\s+)?["']?([^"']+?)["']?\s*$/i);
      
      if (elementNameMatch && global.lastScreenshotOCR && global.lastScreenshotOCR.length > 0) {
        const elementName = elementNameMatch[1].trim().toLowerCase();
        console.log(`\n🔍 COORDINATE VALIDATION: AI provided (${aiX}, ${aiY}) for "${elementName}"`);
        console.log(`   Checking OCR data for better match...`);
        
        // 🚨 CRITICAL: Detect browser address bar vs website search bar
        // Browser address bar is at top of browser (y < 100) and contains "address"
        // Website search bar is within website content (y > 100) and contains "search"
        const isBrowserAddressBar = aiY < 100 && elementName.includes('address');
        const isSearchIntent = elementName.includes('search') || text.toLowerCase().includes('search for');
        
        if (isBrowserAddressBar && isSearchIntent) {
          console.log(`   🚨 BLOCKED: AI trying to use browser address bar (y=${aiY}) for website search!`);
          console.log(`   Looking for website search bar instead (y > 100)...`);
          
          // Find website search bar in OCR (y > 100)
          const websiteSearchOCR = global.lastScreenshotOCR.find(ocr => 
            ocr.text && 
            ocr.text.toLowerCase().includes('search') &&
            ocr.center && 
            ocr.center.y > 100
          );
          
          if (websiteSearchOCR && websiteSearchOCR.center) {
            console.log(`   ✅ Found website search bar in OCR: "${websiteSearchOCR.text}" at (${websiteSearchOCR.center.x}, ${websiteSearchOCR.center.y})`);
            console.log(`   Using website search bar instead of browser address bar`);
            
            return {
              functionName: 'windows_click_mouse',
              argsString: JSON.stringify({ x: websiteSearchOCR.center.x, y: websiteSearchOCR.center.y, double: isDouble }),
              fullMatch: coords.match + ' ... ' + clickMatch[0],
              matchIndex: coords.index,
              _fromIntent: true,
              _ocrCorrected: true,
              _browserBarBlocked: true
            };
          } else {
            console.log(`   ❌ Website search bar not found in OCR, blocking browser address bar click`);
            return null; // Block the click entirely
          }
        }
        
        // Search for OCR text matching the element name
        // Extract key search term (e.g., "search" from "address and search bar")
        const searchTerms = elementName.split(/\s+and\s+|\s+/);
        let foundOCR = null;
        
        // Try to find OCR text matching any of the search terms
        for (const term of searchTerms) {
          if (term.length < 3) continue; // Skip short words like "and", "bar"
          
          foundOCR = global.lastScreenshotOCR.find(ocr => 
            ocr.text && ocr.text.toLowerCase().includes(term)
          );
          
          if (foundOCR) {
            console.log(`   ✅ Found OCR match for term "${term}": "${foundOCR.text}"`);
            break;
          }
        }
        
        if (!foundOCR) {
          // Try exact match
          foundOCR = global.lastScreenshotOCR.find(ocr => 
            ocr.text && ocr.text.toLowerCase() === elementName
          );
        }
        
        if (!foundOCR) {
          // Try partial match
          foundOCR = global.lastScreenshotOCR.find(ocr => 
            ocr.text && ocr.text.toLowerCase().includes(elementName)
          );
        }
        
        if (!foundOCR) {
          // Try reverse partial match
          foundOCR = global.lastScreenshotOCR.find(ocr => 
            ocr.text && elementName.includes(ocr.text.toLowerCase())
          );
        }
        
        if (foundOCR && foundOCR.center) {
          const ocrX = foundOCR.center.x;
          const ocrY = foundOCR.center.y;
          const distance = Math.sqrt(Math.pow(ocrX - aiX, 2) + Math.pow(ocrY - aiY, 2));
          
          console.log(`   ✅ Found OCR text: "${foundOCR.text}" at (${ocrX}, ${ocrY})`);
          console.log(`   Distance from AI coordinates: ${Math.round(distance)}px`);
          
          // If OCR is within 100px of AI coordinates, use OCR instead (more accurate)
          if (distance < 100) {
            console.log(`   ✅ USING OCR COORDINATES: (${ocrX}, ${ocrY}) instead of AI's (${aiX}, ${aiY})`);
            console.log(`   Reason: OCR text matches element name and is nearby`);
            
            return {
              functionName: 'windows_click_mouse',
              argsString: JSON.stringify({ x: ocrX, y: ocrY, double: isDouble }),
              fullMatch: coords.match + ' ... ' + clickMatch[0],
              matchIndex: coords.index,
              _fromIntent: true,
              _ocrCorrected: true
            };
          } else {
            console.log(`   ⚠️  OCR too far (${Math.round(distance)}px), using AI coordinates`);
          }
        } else {
          console.log(`   ❌ No matching OCR text found for "${elementName}"`);
        }
      }
      
      // No OCR correction needed or available, use AI coordinates
      return {
        functionName: 'windows_click_mouse',
        argsString: JSON.stringify({ x: aiX, y: aiY, double: isDouble }),
        fullMatch: coords.match + ' ... ' + clickMatch[0],
        matchIndex: coords.index,
        _fromIntent: true
      };
    }
  }
  
  // Pattern 3: FALLBACK - "I will click the [element name]" without coordinates
  // 🚨 CRITICAL: OCR-FIRST APPROACH
  // Order of precedence:
  // 1. Look for OCR text matching the target keyword
  // 2. If OCR found, look for UI elements within 50-100px of that OCR position
  // 3. If UI elements found nearby, use closest one (prioritize Edit > Button)
  // 4. If no UI elements nearby, use OCR text center position directly
  // 5. If no OCR match, fall back to UI element name matching
  const clickElementPattern = /(?:i'?ll|i\s+will|i'm going to|i am going to|i want to)\s+(?:now\s+)?(?:double[\s\-‑–—]?click|click)\s+(?:the\s+)?(?:on\s+)?["']?([^"'.!?\n]+?)["']?(?:\s+(?:button|icon|element|field|bar|box|search))?(?:\s+to\s+|\.|!|\?|$)/i;
  match = text.match(clickElementPattern);
  if (match) {
    const elementName = match[1].trim().toLowerCase();
    const isDouble = /double[\s\-‑–—]?click/i.test(match[0]);
    
    console.log(`\n🔍 FALLBACK: AI mentioned clicking "${elementName}" without coordinates`);
    
    // STEP 1: Check OCR text FIRST
    if (global.lastScreenshotOCR && global.lastScreenshotOCR.length > 0) {
      console.log(`   📝 Checking OCR text first (${global.lastScreenshotOCR.length} OCR elements available)...`);
      
      // Search for OCR text matching the element name
      // Try exact match first, then partial match
      let foundOCR = global.lastScreenshotOCR.find(ocr => 
        ocr.text && ocr.text.toLowerCase() === elementName
      );
      
      if (!foundOCR) {
        // Try partial match (OCR text contains the search term)
        foundOCR = global.lastScreenshotOCR.find(ocr => 
          ocr.text && ocr.text.toLowerCase().includes(elementName)
        );
      }
      
      if (!foundOCR) {
        // Try reverse partial match (search term contains OCR text)
        foundOCR = global.lastScreenshotOCR.find(ocr => 
          ocr.text && elementName.includes(ocr.text.toLowerCase())
        );
      }
      
      if (foundOCR && foundOCR.center) {
        console.log(`   ✅ Found OCR text: "${foundOCR.text}" at (${foundOCR.center.x}, ${foundOCR.center.y})`);
        console.log(`   Confidence: ${foundOCR.confidence}`);
        
        // STEP 2: Look for UI elements near this OCR position
        if (global.lastScreenshotElements && global.lastScreenshotElements.length > 0) {
          console.log(`   🔍 Looking for UI elements within 100px of OCR position...`);
          
          const PROXIMITY_RADIUS = 100; // pixels
          const nearbyElements = global.lastScreenshotElements.filter(el => {
            if (!el.center_x || !el.center_y) return false;
            
            const distance = Math.sqrt(
              Math.pow(el.center_x - foundOCR.center.x, 2) + 
              Math.pow(el.center_y - foundOCR.center.y, 2)
            );
            
            return distance <= PROXIMITY_RADIUS;
          });
          
          console.log(`   Found ${nearbyElements.length} UI elements within ${PROXIMITY_RADIUS}px`);
          
          if (nearbyElements.length > 0) {
            // STEP 3: Prioritize Edit controls over Buttons
            let bestElement = nearbyElements.find(el => 
              (el.type === 'Edit' || el.control_type_name === 'Edit')
            );
            
            if (!bestElement) {
              // No Edit control, try Button
              bestElement = nearbyElements.find(el => 
                (el.type === 'Button' || el.control_type_name === 'Button')
              );
            }
            
            if (!bestElement) {
              // Use closest element
              bestElement = nearbyElements.reduce((closest, el) => {
                const distEl = Math.sqrt(
                  Math.pow(el.center_x - foundOCR.center.x, 2) + 
                  Math.pow(el.center_y - foundOCR.center.y, 2)
                );
                const distClosest = Math.sqrt(
                  Math.pow(closest.center_x - foundOCR.center.x, 2) + 
                  Math.pow(closest.center_y - foundOCR.center.y, 2)
                );
                return distEl < distClosest ? el : closest;
              });
            }
            
            const distance = Math.sqrt(
              Math.pow(bestElement.center_x - foundOCR.center.x, 2) + 
              Math.pow(bestElement.center_y - foundOCR.center.y, 2)
            );
            
            console.log(`   ✅ Using nearby UI element: "${bestElement.name}" at (${bestElement.center_x}, ${bestElement.center_y})`);
            console.log(`   Type: ${bestElement.type || bestElement.control_type_name}`);
            console.log(`   Distance from OCR: ${Math.round(distance)}px`);
            
            return {
              functionName: 'windows_click_mouse',
              argsString: JSON.stringify({ x: bestElement.center_x, y: bestElement.center_y, double: isDouble }),
              fullMatch: match[0],
              matchIndex: match.index,
              _fromIntent: true,
              _fromFallback: true,
              _fromOCR: true,
              _ocrCorrelated: true
            };
          } else {
            // STEP 4: No UI elements nearby, use OCR position directly
            console.log(`   ⚠️  No UI elements found within ${PROXIMITY_RADIUS}px of OCR text`);
            console.log(`   ✅ Using OCR text center position directly: (${foundOCR.center.x}, ${foundOCR.center.y})`);
            
            return {
              functionName: 'windows_click_mouse',
              argsString: JSON.stringify({ x: foundOCR.center.x, y: foundOCR.center.y, double: isDouble }),
              fullMatch: match[0],
              matchIndex: match.index,
              _fromIntent: true,
              _fromFallback: true,
              _fromOCR: true,
              _ocrDirect: true
            };
          }
        } else {
          // No UI elements available, use OCR position directly
          console.log(`   ⚠️  No UI elements data available`);
          console.log(`   ✅ Using OCR text center position directly: (${foundOCR.center.x}, ${foundOCR.center.y})`);
          
          return {
            functionName: 'windows_click_mouse',
            argsString: JSON.stringify({ x: foundOCR.center.x, y: foundOCR.center.y, double: isDouble }),
            fullMatch: match[0],
            matchIndex: match.index,
            _fromIntent: true,
            _fromFallback: true,
            _fromOCR: true,
            _ocrDirect: true
          };
        }
      } else {
        console.log(`   ❌ OCR text "${elementName}" not found in screenshot data`);
        console.log(`   Available OCR texts: ${global.lastScreenshotOCR.filter(ocr => ocr.text).map(ocr => ocr.text).slice(0, 10).join(', ')}`);
      }
    }
    
    // STEP 5: Fall back to UI element name matching (original logic)
    console.log(`   📋 Falling back to UI element name matching...`);
    if (global.lastScreenshotElements) {
    console.log(`   Total elements available: ${global.lastScreenshotElements.length}`);
    
    // 🚨 CRITICAL: For "search bar", prioritize Edit controls (text inputs) over Buttons
    // This prevents clicking the search button when the intent is to type in the search field
    const isSearchBar = elementName.includes('search') && (elementName.includes('bar') || elementName.includes('field') || elementName.includes('box'));
    
    // Search for the element in the last screenshot data
    // Try exact match first, then partial match
    let foundElement = global.lastScreenshotElements.find(el => 
      el.name && el.name.toLowerCase() === elementName
    );
    
    if (!foundElement) {
      // Try partial match (element name contains the search term)
      foundElement = global.lastScreenshotElements.find(el => 
        el.name && el.name.toLowerCase().includes(elementName)
      );
    }
    
    if (!foundElement) {
      // Try reverse partial match (search term contains element name)
      foundElement = global.lastScreenshotElements.find(el => 
        el.name && elementName.includes(el.name.toLowerCase())
      );
    }
    
    // Special handling for "address bar" - try multiple variations
    if (!foundElement && elementName.includes('address')) {
      console.log(`   Trying address bar variations...`);
      foundElement = global.lastScreenshotElements.find(el => 
        el.name && (
          el.name.toLowerCase().includes('address') ||
          el.name.toLowerCase().includes('search bar') ||
          (el.name.toLowerCase().includes('search') && el.name.toLowerCase().includes('url'))
        )
      );
    }
    
    // 🚨 CRITICAL: If looking for "search bar" and found a Button, look for Edit control instead
    if (isSearchBar && foundElement) {
      const elementType = foundElement.type || foundElement.control_type_name;
      if (elementType === 'Button') {
        console.log(`   ⚠️  Found "${foundElement.name}" but it's a Button (${foundElement.center_x}, ${foundElement.center_y})`);
        console.log(`   Looking for Edit control (text input) instead...`);
        
        // Find Edit control with "search" in name
        const searchInput = global.lastScreenshotElements.find(el => 
          el.name && 
          el.name.toLowerCase().includes('search') &&
          (el.type === 'Edit' || el.control_type_name === 'Edit')
        );
        
        if (searchInput) {
          console.log(`   ✅ Found search input field: "${searchInput.name}" at (${searchInput.center_x}, ${searchInput.center_y})`);
          foundElement = searchInput;
        } else {
          console.log(`   ❌ No Edit control found with "search", will use Button as fallback`);
        }
      }
    }
    
    if (foundElement && foundElement.center_x && foundElement.center_y) {
      console.log(`   ✅ Found element: "${foundElement.name}" at (${foundElement.center_x}, ${foundElement.center_y})`);
      console.log(`   Type: ${foundElement.type || foundElement.control_type_name}`);
      
      // 🚨 CRITICAL: Prevent clicking browser address bar when searching on YouTube
      // If element name contains "address" and y < 100, it's the browser address bar
      // This should NEVER be used for searching on a website
      const isBrowserAddressBar = foundElement.name.toLowerCase().includes('address') && foundElement.center_y < 100;
      const isSearchQuery = elementName.includes('search') || text.toLowerCase().includes('search for');
      
      if (isBrowserAddressBar && isSearchQuery) {
        console.log(`   ⚠️  BLOCKED: This is the browser address bar (y=${foundElement.center_y})`);
        console.log(`   AI is trying to search in the address bar instead of the website search bar`);
        console.log(`   Looking for website search bar instead (y > 100)...`);
        
        // Look for the actual website search bar (y > 100)
        // Try multiple strategies to find it
        let websiteSearchBar = global.lastScreenshotElements.find(el => 
          el.name && 
          el.name.toLowerCase().includes('search') && 
          !el.name.toLowerCase().includes('address') &&
          el.center_y > 100 &&
          (el.type === 'Edit' || el.control_type_name === 'Edit')
        );
        
        // If not found, look for ANY Edit control in the header area (y between 100-200)
        if (!websiteSearchBar) {
          console.log(`   No Edit control with "search" found, looking for any Edit in header area...`);
          websiteSearchBar = global.lastScreenshotElements.find(el => 
            (el.type === 'Edit' || el.control_type_name === 'Edit') &&
            el.center_y > 100 && 
            el.center_y < 200
          );
        }
        
        // If still not found, look for any clickable element with "search" near the top
        if (!websiteSearchBar) {
          console.log(`   No Edit control in header, looking for any element with "search" near top...`);
          websiteSearchBar = global.lastScreenshotElements.find(el => 
            el.name && 
            el.name.toLowerCase().includes('search') && 
            !el.name.toLowerCase().includes('address') &&
            el.center_y > 100 && 
            el.center_y < 300
          );
        }
        
        if (websiteSearchBar) {
          console.log(`   ✅ Found website search element: "${websiteSearchBar.name}" at (${websiteSearchBar.center_x}, ${websiteSearchBar.center_y})`);
          console.log(`   Type: ${websiteSearchBar.type || websiteSearchBar.control_type_name}`);
          console.log(`   Using this instead of browser address bar`);
          
          return {
            functionName: 'windows_click_mouse',
            argsString: JSON.stringify({ x: websiteSearchBar.center_x, y: websiteSearchBar.center_y, double: isDouble }),
            fullMatch: match[0],
            matchIndex: match.index,
            _fromIntent: true,
            _fromFallback: true,
            _corrected: true
          };
        } else {
          console.log(`   ❌ Website search bar not found, blocking address bar click`);
          return null;
        }
      }
      
      console.log(`   Automatically extracting coordinates for click`);
      
      return {
        functionName: 'windows_click_mouse',
        argsString: JSON.stringify({ x: foundElement.center_x, y: foundElement.center_y, double: isDouble }),
        fullMatch: match[0],
        matchIndex: match.index,
        _fromIntent: true,
        _fromFallback: true
      };
    } else {
      console.log(`   ❌ Element "${elementName}" not found in screenshot data`);
      console.log(`   Available elements: ${global.lastScreenshotElements.filter(el => el.name).map(el => el.name).slice(0, 10).join(', ')}`);
    }
    } // Close if (global.lastScreenshotElements)
  } // Close if (match)
  
  // Move mouse intent patterns with coordinates
  const movePattern = /(?:moving|move|i'?ll move)\s+(?:mouse|cursor)?\s*(?:to)?\s*(?:\()?(\d+)\s*,\s*(\d+)(?:\))?/i;
  match = text.match(movePattern);
  if (match) {
    return {
      functionName: 'windows_move_mouse',
      argsString: JSON.stringify({ x: parseInt(match[1]), y: parseInt(match[2]) }),
      fullMatch: match[0],
      matchIndex: match.index,
      _fromIntent: true
    };
  }
  
  // Type text intent patterns
  const typePattern = /(?:typing|type|i'?ll type)\s+["']([^"']+)["']/i;
  match = text.match(typePattern);
  if (match) {
    return {
      functionName: 'windows_type_text',
      argsString: JSON.stringify({ text: match[1] }),
      fullMatch: match[0],
      matchIndex: match.index,
      _fromIntent: true
    };
  }
  
  // Press key intent patterns
  // Pattern: "press enter", "press escape", "pressing tab", etc.
  const pressKeyPattern = /(?:press(?:ing)?|hit(?:ting)?|tap(?:ping)?)\s+(enter|escape|tab|space|backspace|delete|home|end|pageup|pagedown|up|down|left|right|f\d+)/i;
  match = text.match(pressKeyPattern);
  if (match) {
    return {
      functionName: 'windows_press_key',
      argsString: JSON.stringify({ key: match[1].toLowerCase() }),
      fullMatch: match[0],
      matchIndex: match.index,
      _fromIntent: true
    };
  }
  
  // PowerShell command intent patterns
  // Pattern 1: Explicit [Calls: windows_execute_powershell({command: "..."})]
  const psExplicitPattern = /\[Calls?:\s*windows_execute_powershell\s*\(\s*\{?\s*command:\s*["']([^"']+)["']/i;
  match = text.match(psExplicitPattern);
  if (match) {
    return {
      functionName: 'windows_execute_powershell',
      argsString: `command: "${match[1]}"`,
      fullMatch: match[0],
      matchIndex: match.index,
      _fromIntent: true
    };
  }
  
  // Pattern 2: Natural language "executing powershell command" or "run powershell"
  const psNaturalPattern = /(?:executing|execute|running|run)\s+(?:powershell\s+)?command\s+["']([^"']+)["']/i;
  match = text.match(psNaturalPattern);
  if (match) {
    return {
      functionName: 'windows_execute_powershell',
      argsString: `command: "${match[1]}"`,
      fullMatch: match[0],
      matchIndex: match.index,
      _fromIntent: true
    };
  }
  
  return null;
}

/**
 * Parse arguments string into object
 * Supports:
 * - Empty: () -> {}
 * - JSON object: ({x: 100, y: 200}) -> {x: 100, y: 200}
 * - Key-value pairs: (x: 100, y: 200) -> {x: 100, y: 200}
 * - Single string: ("text") -> {text: "text"}
 * - Single number: (123) -> {value: 123}
 * 
 * @param {string} argsString - Arguments string
 * @returns {Object} - Parsed arguments
 */
function parseArguments(argsString) {
  if (!argsString || argsString.trim() === '') {
    return {};
  }

  const trimmed = argsString.trim();

  // Try parsing as JSON first
  try {
    // If it starts with {, try JSON parse
    if (trimmed.startsWith('{')) {
      return JSON.parse(trimmed);
    }
    
    // Try wrapping in braces and parsing
    const wrapped = `{${trimmed}}`;
    return JSON.parse(wrapped);
  } catch (e) {
    // Not valid JSON, continue with other parsing methods
  }

  // Try parsing key-value pairs
  const kvPattern = /(\w+)\s*:\s*([^,}]+)/g;
  const matches = [...trimmed.matchAll(kvPattern)];
  
  if (matches.length > 0) {
    const result = {};
    for (const match of matches) {
      const key = match[1];
      let value = match[2].trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      // Try parsing as number
      if (!isNaN(value) && value !== '') {
        value = Number(value);
      }
      
      result[key] = value;
    }
    return result;
  }

  // Single quoted string
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || 
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return { text: trimmed.slice(1, -1) };
  }

  // Single number
  if (!isNaN(trimmed) && trimmed !== '') {
    return { value: Number(trimmed) };
  }

  // Return as text if nothing else works
  return { text: trimmed };
}

/**
 * Extract tool call from text and parse it
 * @param {string} text - Text to parse
 * @returns {Object|null} - {functionName, args, textBefore, textAfter} or null
 */
function extractToolCall(text) {
  const parsed = parseToolCallFromText(text);
  
  if (!parsed) {
    return null;
  }

  const args = parseArguments(parsed.argsString);
  const textBefore = text.substring(0, parsed.matchIndex).trim();
  const textAfter = text.substring(parsed.matchIndex + parsed.fullMatch.length).trim();

  return {
    functionName: parsed.functionName,
    args,
    textBefore,
    textAfter,
    fullMatch: parsed.fullMatch
  };
}

/**
 * Check if text contains a tool call
 * @param {string} text - Text to check
 * @returns {boolean}
 */
function containsToolCall(text) {
  return parseToolCallFromText(text) !== null;
}

/**
 * Map common function name variations to actual tool names
 * @param {string} functionName - Function name from text
 * @returns {string} - Actual tool name
 */
function normalizeToolName(functionName) {
  const mapping = {
    'take_screenshot': 'windows_take_screenshot',
    'screenshot': 'windows_take_screenshot',
    'click': 'windows_click_mouse',
    'click_mouse': 'windows_click_mouse',
    'type': 'windows_type_text',
    'type_text': 'windows_type_text',
    'press_key': 'windows_press_key',
    'press': 'windows_press_key',
    'move_mouse': 'windows_move_mouse',
    'move': 'windows_move_mouse',
    'scroll': 'windows_scroll_mouse',
    'execute_powershell': 'windows_execute_powershell',
    'powershell': 'windows_execute_powershell'
  };

  return mapping[functionName.toLowerCase()] || functionName;
}

module.exports = {
  parseToolCallFromText,
  parseArguments,
  extractToolCall,
  containsToolCall,
  normalizeToolName,
  detectToolIntent
};
