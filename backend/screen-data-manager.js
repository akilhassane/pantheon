/**
 * Screen Data Manager
 * Manages screenshot data and provides query capabilities for AI
 */

class ScreenDataManager {
  constructor() {
    // Store screen data per session
    this.screenDataBySession = new Map();
  }

  /**
   * Store screen data from a screenshot
   */
  storeScreenData(sessionId, screenData) {
    if (!sessionId || !screenData) {
      console.warn('[ScreenDataManager] Invalid sessionId or screenData');
      return;
    }

    this.screenDataBySession.set(sessionId, {
      ...screenData,
      storedAt: new Date().toISOString()
    });

    console.log(`[ScreenDataManager] Stored screen data for session: ${sessionId}`);
  }

  /**
   * Query screen data
   */
  queryScreenData(sessionId, query, type = 'all') {
    const screenData = this.screenDataBySession.get(sessionId);
    
    if (!screenData) {
      return {
        success: false,
        error: 'No screenshot data available. Please take a screenshot first using windows_take_screenshot.'
      };
    }

    const queryLower = query.toLowerCase();
    const results = {
      success: true,
      query,
      type,
      matches: []
    };

    try {
      // Query taskbar icons
      if (type === 'taskbar' || type === 'all') {
        const taskbarIcons = (screenData.windowsAPI?.elements || []).filter(el => el.type === 'TaskbarButton');
        const matches = taskbarIcons.filter(icon => 
          icon.name.toLowerCase().includes(queryLower)
        );
        
        if (matches.length > 0) {
          results.matches.push({
            type: 'taskbar',
            count: matches.length,
            items: matches.map(icon => ({
              name: icon.name,
              position: { x: icon.center_x, y: icon.center_y },
              bounds: { x: icon.x, y: icon.y, width: icon.width, height: icon.height }
            }))
          });
        }
      }

      // Query UI elements
      if (type === 'element' || type === 'all') {
        const uiElements = screenData.windowsAPI?.elements || [];
        const matches = uiElements.filter(el => 
          el.name?.toLowerCase().includes(queryLower)
        );
        
        if (matches.length > 0) {
          results.matches.push({
            type: 'ui_element',
            count: matches.length,
            items: matches.slice(0, 10).map(el => ({ // Limit to 10 results
              name: el.name,
              type: el.type,
              position: { x: el.center_x, y: el.center_y },
              bounds: { x: el.x, y: el.y, width: el.width, height: el.height }
            }))
          });
        }
      }

      // Query windows
      if (type === 'window' || type === 'all') {
        // Note: The current screenshot.py doesn't return separate windows array
        // All elements are in windowsAPI.elements with type field
        // For now, we'll skip this or you can enhance screenshot.py to track windows separately
      }

      // Query OCR text
      if (type === 'text' || type === 'all') {
        const ocrElements = screenData.ocr?.elements || [];
        const matches = ocrElements.filter(el => 
          el.text?.toLowerCase().includes(queryLower)
        );
        
        if (matches.length > 0) {
          results.matches.push({
            type: 'ocr_text',
            count: matches.length,
            items: matches.slice(0, 10).map(el => ({ // Limit to 10 results
              text: el.text,
              confidence: el.confidence,
              position: el.position
            }))
          });
        }
      }

      // Query by position
      if (type === 'position') {
        const coords = query.match(/(\d+)[,\s]+(\d+)/);
        if (coords) {
          const x = parseInt(coords[1]);
          const y = parseInt(coords[2]);
          
          // Find elements at or near this position (within 50px)
          const uiElements = screenData.windowsAPI?.elements || [];
          const nearbyElements = uiElements.filter(el => {
            const dx = Math.abs(el.center_x - x);
            const dy = Math.abs(el.center_y - y);
            return dx <= 50 && dy <= 50;
          });
          
          if (nearbyElements.length > 0) {
            results.matches.push({
              type: 'position',
              count: nearbyElements.length,
              items: nearbyElements.slice(0, 5).map(el => ({
                name: el.name,
                type: el.type,
                position: { x: el.center_x, y: el.center_y },
                distance: Math.sqrt(Math.pow(el.center_x - x, 2) + Math.pow(el.center_y - y, 2))
              }))
            });
          }
        }
      }

      // Format output
      if (results.matches.length === 0) {
        return {
          success: true,
          output: `No matches found for "${query}". Try:\n- Taking a new screenshot if the screen has changed\n- Using different search terms\n- Checking if the element is visible on screen`
        };
      }

      let output = `Found ${results.matches.reduce((sum, m) => sum + m.count, 0)} matches for "${query}":\n\n`;
      
      for (const match of results.matches) {
        output += `${match.type.toUpperCase()} (${match.count} matches):\n`;
        for (const item of match.items) {
          if (match.type === 'taskbar' || match.type === 'ui_element') {
            output += `  - ${item.name} at (${item.position.x}, ${item.position.y})\n`;
          } else if (match.type === 'window') {
            output += `  - ${item.title} [${item.process}] at (${item.position.x}, ${item.position.y})\n`;
          } else if (match.type === 'ocr_text') {
            output += `  - "${item.text}" (confidence: ${item.confidence.toFixed(2)})\n`;
          } else if (match.type === 'position') {
            output += `  - ${item.name} at (${item.position.x}, ${item.position.y}) - ${item.distance.toFixed(0)}px away\n`;
          }
        }
        output += '\n';
      }

      return {
        success: true,
        output: output.trim(),
        data: results
      };

    } catch (error) {
      console.error('[ScreenDataManager] Query error:', error);
      return {
        success: false,
        error: `Query failed: ${error.message}`
      };
    }
  }

  /**
   * Get summary of available screen data
   */
  getScreenSummary(sessionId) {
    const screenData = this.screenDataBySession.get(sessionId);
    
    if (!screenData) {
      return {
        success: false,
        error: 'No screenshot data available'
      };
    }

    const summary = {
      success: true,
      timestamp: screenData.timestamp,
      storedAt: screenData.storedAt,
      resolution: screenData.size,
      mousePosition: screenData.mousePosition,
      counts: {
        taskbarButtons: (screenData.windowsAPI?.elements || []).filter(el => el.type === 'TaskbarButton').length,
        windowElements: (screenData.windowsAPI?.elements || []).filter(el => el.type !== 'TaskbarButton').length,
        totalElements: screenData.windowsAPI?.elements?.length || 0,
        ocrElements: screenData.ocr?.elements?.length || 0
      }
    };

    return summary;
  }

  /**
   * Clear screen data for a session
   */
  clearScreenData(sessionId) {
    this.screenDataBySession.delete(sessionId);
    console.log(`[ScreenDataManager] Cleared screen data for session: ${sessionId}`);
  }
}

// Singleton instance
const screenDataManager = new ScreenDataManager();

module.exports = screenDataManager;
