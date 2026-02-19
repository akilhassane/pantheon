#!/usr/bin/env python3
"""
Detect ALL taskbar icons including pinned apps using UI Automation
"""

import ctypes
from ctypes import wintypes, windll, byref, Structure, c_int, c_uint
import comtypes.client

# Windows API constants
GWL_EXSTYLE = -20
WS_EX_TOOLWINDOW = 0x00000080
WS_EX_APPWINDOW = 0x00040000

class RECT(Structure):
    _fields_ = [
        ('left', c_int),
        ('top', c_int),
        ('right', c_int),
        ('bottom', c_int)
    ]

# Windows API functions
user32 = windll.user32
FindWindowW = user32.FindWindowW
GetWindowRect = user32.GetWindowRect

def get_taskbar_rect():
    """Get taskbar position and size"""
    taskbar = FindWindowW("Shell_TrayWnd", None)
    if not taskbar:
        return None
    
    rect = RECT()
    if not GetWindowRect(taskbar, byref(rect)):
        return None
    
    return {
        'left': rect.left,
        'top': rect.top,
        'right': rect.right,
        'bottom': rect.bottom,
        'width': rect.right - rect.left,
        'height': rect.bottom - rect.top
    }

def detect_taskbar_icons_uia():
    """Use UI Automation to detect all taskbar icons"""
    try:
        # Initialize UI Automation
        uia = comtypes.client.CreateObject("{ff48dba4-60ef-4201-aa87-54103eef594e}", interface=comtypes.gen.UIAutomationClient.IUIAutomation)
        
        # Get taskbar element
        condition = uia.CreatePropertyCondition(30003, "Shell_TrayWnd")  # UIA_ClassNamePropertyId
        taskbar = uia.GetRootElement().FindFirst(1, condition)  # TreeScope_Children
        
        if not taskbar:
            print("Could not find taskbar element")
            return []
        
        print("Found taskbar element")
        
        # Find all buttons in taskbar
        button_condition = uia.CreatePropertyCondition(30003, "Button")  # UIA_ClassNamePropertyId
        buttons = taskbar.FindAll(4, button_condition)  # TreeScope_Descendants
        
        print(f"Found {buttons.Length} buttons in taskbar")
        
        icons = []
        for i in range(buttons.Length):
            button = buttons.GetElement(i)
            name = button.CurrentName
            rect = button.CurrentBoundingRectangle
            
            if rect.right > rect.left and rect.bottom > rect.top:
                icons.append({
                    'name': name,
                    'x': rect.left,
                    'y': rect.top,
                    'width': rect.right - rect.left,
                    'height': rect.bottom - rect.top,
                    'center_x': (rect.left + rect.right) // 2,
                    'center_y': (rect.top + rect.bottom) // 2
                })
                print(f"  {i+1}. {name} at ({rect.left}, {rect.top}) size {rect.right - rect.left}x{rect.bottom - rect.top}")
        
        return icons
        
    except Exception as e:
        print(f"UI Automation error: {e}")
        return []

def detect_taskbar_icons_visual():
    """Detect taskbar icons by analyzing visual layout"""
    taskbar_rect = get_taskbar_rect()
    if not taskbar_rect:
        print("Could not get taskbar rect")
        return []
    
    print(f"\nTaskbar: {taskbar_rect['width']}x{taskbar_rect['height']} at y={taskbar_rect['top']}")
    
    # In Windows 11, taskbar icons are centered
    # We need to estimate based on typical icon spacing
    
    # Typical Windows 11 taskbar layout:
    # - Icons are 44px wide
    # - Icons are centered on screen
    # - Start button is separate on the left
    
    # For now, let's estimate we have 15-20 icons in the center
    # This is a fallback if UI Automation doesn't work
    
    icon_width = 44
    estimated_icon_count = 15  # Adjust based on what you see
    
    total_icons_width = estimated_icon_count * icon_width
    start_x = taskbar_rect['left'] + (taskbar_rect['width'] - total_icons_width) // 2
    
    icons = []
    for i in range(estimated_icon_count):
        x = start_x + (i * icon_width)
        icons.append({
            'name': f'App Icon {i+1}',
            'x': x,
            'y': taskbar_rect['top'],
            'width': icon_width,
            'height': taskbar_rect['height'],
            'center_x': x + icon_width // 2,
            'center_y': taskbar_rect['top'] + taskbar_rect['height'] // 2,
            'estimated': True
        })
    
    return icons

if __name__ == '__main__':
    print("=== Detecting Taskbar Icons ===\n")
    
    print("Method 1: UI Automation")
    print("-" * 50)
    uia_icons = detect_taskbar_icons_uia()
    
    if not uia_icons:
        print("\nMethod 2: Visual Estimation")
        print("-" * 50)
        visual_icons = detect_taskbar_icons_visual()
        print(f"\nEstimated {len(visual_icons)} icons")
    else:
        print(f"\nDetected {len(uia_icons)} icons via UI Automation")
