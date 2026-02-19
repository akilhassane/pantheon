#!/usr/bin/env python3
"""
Simple screenshot tool for local machine
Takes screenshot and returns JSON with base64 image and basic info
"""

import sys
import json
import base64
from io import BytesIO

try:
    from PIL import ImageGrab
    import pyautogui
    
    # Take screenshot
    screenshot = ImageGrab.grab()
    
    # Get mouse position
    mouse_x, mouse_y = pyautogui.position()
    
    # Convert to base64
    buffer = BytesIO()
    screenshot.save(buffer, format='PNG')
    screenshot_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    
    # Get screen size
    width, height = screenshot.size
    
    # Return JSON
    result = {
        "success": True,
        "screenshot": screenshot_base64,
        "size": {"width": width, "height": height},
        "mousePosition": {"x": mouse_x, "y": mouse_y}
    }
    
    print(json.dumps(result))
    sys.exit(0)
    
except Exception as e:
    error_result = {
        "success": False,
        "error": str(e)
    }
    print(json.dumps(error_result))
    sys.exit(1)
