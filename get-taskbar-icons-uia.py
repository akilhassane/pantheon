#!/usr/bin/env python3
"""
Get ALL taskbar icons using UI Automation (including pinned apps)
"""

import sys
import json

def init_uia():
    """Initialize UI Automation"""
    try:
        import comtypes.client
        
        # Generate UIAutomationClient type library if not exists
        try:
            from comtypes.gen import UIAutomationClient
        except ImportError:
            # Generate the type library
            print("Generating UI Automation type library...", file=sys.stderr)
            tlb = comtypes.client.GetModule("UIAutomationCore.dll")
            from comtypes.gen import UIAutomationClient
        
        # Create UI Automation object
        uia = comtypes.client.CreateObject(
            "{ff48dba4-60ef-4201-aa87-54103eef594e}",
            interface=UIAutomationClient.IUIAutomation
        )
        return uia
    except Exception as e:
        print(f"Failed to initialize UI Automation: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return None

def get_all_taskbar_icons():
    """Get all taskbar icons using UI Automation"""
    uia = init_uia()
    if not uia:
        return []
    
    try:
        # Get root element
        root = uia.GetRootElement()
        
        # Find taskbar by class name
        condition = uia.CreatePropertyCondition(30003, "Shell_TrayWnd")  # UIA_ClassNamePropertyId = 30003
        taskbar = root.FindFirst(1, condition)  # TreeScope_Children = 1
        
        if not taskbar:
            print("Taskbar not found", file=sys.stderr)
            return []
        
        print(f"Found taskbar: {taskbar.CurrentName}", file=sys.stderr)
        
        # Find all buttons in taskbar (this includes pinned apps and open windows)
        # Use TreeScope_Descendants to search deeply
        button_condition = uia.CreatePropertyCondition(30005, 50000)  # UIA_ControlTypePropertyId = 30005, UIA_ButtonControlTypeId = 50000
        buttons = taskbar.FindAll(4, button_condition)  # TreeScope_Descendants = 4
        
        print(f"Found {buttons.Length} buttons", file=sys.stderr)
        
        icons = []
        for i in range(buttons.Length):
            try:
                button = buttons.GetElement(i)
                name = button.CurrentName
                rect = button.CurrentBoundingRectangle
                class_name = button.CurrentClassName
                automation_id = button.CurrentAutomationId
                
                # Filter out non-taskbar buttons
                # Taskbar app buttons typically have specific characteristics
                width = rect.right - rect.left
                height = rect.bottom - rect.top
                
                # Skip if dimensions are invalid
                if width <= 0 or height <= 0:
                    continue
                
                # Skip if too small (likely not an app icon)
                if width < 20 or height < 20:
                    continue
                
                icon_info = {
                    'name': name or 'Unknown',
                    'type': 'TaskbarIcon',
                    'x': int(rect.left),
                    'y': int(rect.top),
                    'width': int(width),
                    'height': int(height),
                    'center_x': int((rect.left + rect.right) // 2),
                    'center_y': int((rect.top + rect.bottom) // 2),
                    'class_name': class_name,
                    'automation_id': automation_id
                }
                
                icons.append(icon_info)
                print(f"  {i+1}. {name} ({width}x{height}) at ({rect.left}, {rect.top})", file=sys.stderr)
                
            except Exception as e:
                print(f"  Error processing button {i}: {e}", file=sys.stderr)
                continue
        
        return icons
        
    except Exception as e:
        print(f"Error getting taskbar icons: {e}", file=sys.stderr)
        return []

if __name__ == '__main__':
    icons = get_all_taskbar_icons()
    
    result = {
        'success': len(icons) > 0,
        'count': len(icons),
        'icons': icons
    }
    
    print(json.dumps(result, indent=2))
