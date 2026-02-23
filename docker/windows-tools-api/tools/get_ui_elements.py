#!/usr/bin/env python3
"""
Get UI elements using Windows UI Automation API
This detects ALL interactive elements including taskbar icons (pinned and open)
"""

import sys
import json
import ctypes
from ctypes import wintypes, windll, byref, POINTER, c_void_p
import comtypes
import comtypes.client

def init_ui_automation():
    """Initialize UI Automation"""
    try:
        # Generate type library if needed
        try:
            from comtypes.gen import UIAutomationClient
        except ImportError:
            comtypes.client.GetModule("UIAutomationCore.dll")
            from comtypes.gen import UIAutomationClient
        
        # Create UI Automation instance
        uia = comtypes.client.CreateObject(
            "{ff48dba4-60ef-4201-aa87-54103eef594e}",
            interface=UIAutomationClient.IUIAutomation
        )
        
        return uia, UIAutomationClient
    except Exception as e:
        print(f"Failed to initialize UI Automation: {e}", file=sys.stderr)
        return None, None

def get_all_ui_elements(uia, UIAutomationClient):
    """Get all UI elements from the desktop using UI Automation"""
    try:
        # Get root element (desktop)
        root = uia.GetRootElement()
        
        # Control types to search for (interactive elements)
        control_types = [
            (UIAutomationClient.UIA_ButtonControlTypeId, 'Button'),
            (UIAutomationClient.UIA_EditControlTypeId, 'Edit'),
            (UIAutomationClient.UIA_TextControlTypeId, 'Text'),
            (UIAutomationClient.UIA_MenuItemControlTypeId, 'MenuItem'),
            (UIAutomationClient.UIA_MenuBarControlTypeId, 'MenuBar'),
            (UIAutomationClient.UIA_ListItemControlTypeId, 'ListItem'),
            (UIAutomationClient.UIA_ComboBoxControlTypeId, 'ComboBox'),
            (UIAutomationClient.UIA_CheckBoxControlTypeId, 'CheckBox'),
            (UIAutomationClient.UIA_RadioButtonControlTypeId, 'RadioButton'),
            (UIAutomationClient.UIA_TabItemControlTypeId, 'TabItem'),
            (UIAutomationClient.UIA_HyperlinkControlTypeId, 'Hyperlink'),
            (UIAutomationClient.UIA_ImageControlTypeId, 'Image'),
        ]
        
        elements = []
        
        # Search for each control type
        for control_type_id, control_type_name in control_types:
            try:
                condition = uia.CreatePropertyCondition(
                    UIAutomationClient.UIA_ControlTypePropertyId,
                    control_type_id
                )
                
                # Find all elements of this type
                found_elements = root.FindAll(UIAutomationClient.TreeScope_Descendants, condition)
                
                if found_elements:
                    for i in range(found_elements.Length):
                        try:
                            element = found_elements.GetElement(i)
                            name = element.CurrentName
                            rect = element.CurrentBoundingRectangle
                            class_name = element.CurrentClassName
                            automation_id = element.CurrentAutomationId
                            
                            width = rect.right - rect.left
                            height = rect.bottom - rect.top
                            
                            # Skip invalid elements (too small or off-screen)
                            if width <= 0 or height <= 0 or width < 5 or height < 5:
                                continue
                            
                            # Skip elements far off screen
                            if rect.left < -10000 or rect.top < -10000:
                                continue
                            
                            elements.append({
                                'name': name or '',
                                'control_type': control_type_id,
                                'control_type_name': control_type_name,
                                'class_name': class_name or '',
                                'automation_id': automation_id or '',
                                'x': int(rect.left),
                                'y': int(rect.top),
                                'width': int(width),
                                'height': int(height),
                                'center_x': int((rect.left + rect.right) // 2),
                                'center_y': int((rect.top + rect.bottom) // 2)
                            })
                            
                        except Exception as e:
                            continue
                            
            except Exception as e:
                continue
        
        return elements
        
    except Exception as e:
        print(f"Error getting UI elements: {e}", file=sys.stderr)
        return []

def main():
    """Main function"""
    try:
        # Initialize UI Automation
        uia, UIAutomationClient = init_ui_automation()
        
        if not uia:
            result = {
                'success': False,
                'error': 'Failed to initialize UI Automation'
            }
            print(json.dumps(result))
            return 1
        
        # Get all UI elements
        elements = get_all_ui_elements(uia, UIAutomationClient)
        
        # Save to file
        output_path = 'ui_elements.json'
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(elements, f, indent=2)
        
        # Print to stdout
        print(json.dumps(elements))
        
        return 0
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return 1

if __name__ == '__main__':
    sys.exit(main())
