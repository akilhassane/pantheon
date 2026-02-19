#!/usr/bin/env python3
"""
Get ALL taskbar icons using pywinauto (including pinned apps)
"""

import sys
import json
from pywinauto import Desktop
from pywinauto.findwindows import ElementNotFoundError

def get_all_taskbar_icons():
    """Get all taskbar icons using pywinauto"""
    try:
        # Get desktop
        desktop = Desktop(backend="uia")
        
        # Find taskbar
        taskbar = desktop.window(class_name="Shell_TrayWnd")
        print(f"Found taskbar", file=sys.stderr)
        
        # Get all descendants
        all_elements = taskbar.descendants()
        print(f"Found {len(all_elements)} total elements in taskbar", file=sys.stderr)
        
        # Filter for buttons
        icons = []
        for elem in all_elements:
            try:
                # Check if it's a button
                control_type = elem.element_info.control_type
                if control_type != "Button":
                    continue
                
                # Get properties
                name = elem.element_info.name
                rect = elem.rectangle()
                class_name = elem.element_info.class_name
                
                width = rect.width()
                height = rect.height()
                
                # Skip invalid or too small elements
                if width <= 0 or height <= 0 or width < 20 or height < 20:
                    continue
                
                icon_info = {
                    'name': name or 'Unknown',
                    'type': 'TaskbarIcon',
                    'x': rect.left,
                    'y': rect.top,
                    'width': width,
                    'height': height,
                    'center_x': rect.left + width // 2,
                    'center_y': rect.top + height // 2,
                    'class_name': class_name
                }
                
                icons.append(icon_info)
                print(f"  {len(icons)}. {name} ({width}x{height}) at ({rect.left}, {rect.top})", file=sys.stderr)
                
            except Exception as e:
                continue
        
        return icons
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return []

if __name__ == '__main__':
    icons = get_all_taskbar_icons()
    
    result = {
        'success': len(icons) > 0,
        'count': len(icons),
        'icons': icons
    }
    
    print(json.dumps(result, indent=2))
