#!/usr/bin/env python3
"""
Windows Screenshot Tool - Consolidated Version
Takes screenshots with ALL functionality embedded (no subprocess calls)
Includes: mouse position, OCR, UI elements, Windows API detection
"""

import sys
import json
import argparse
import os
from pathlib import Path
from datetime import datetime

# ============================================================================
# PIL/Pillow for screenshots
# ============================================================================
try:
    from PIL import ImageGrab
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

# ============================================================================
# PyAutoGUI for mouse position
# ============================================================================
try:
    import pyautogui
    PYAUTOGUI_AVAILABLE = True
except ImportError:
    PYAUTOGUI_AVAILABLE = False

# ============================================================================
# Windows API imports (ctypes - built-in)
# ============================================================================
import ctypes
from ctypes import wintypes, windll, byref, POINTER, Structure, c_int, c_uint, c_wchar

# ============================================================================
# UI Automation imports
# ============================================================================
try:
    import comtypes
    import comtypes.client
    COMTYPES_AVAILABLE = True
except ImportError:
    COMTYPES_AVAILABLE = False

# ============================================================================
# OCR imports
# ============================================================================
try:
    import pytesseract
    from PIL import Image
    import cv2
    TESSERACT_AVAILABLE = True
    # Set Tesseract path for Windows
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
except ImportError:
    TESSERACT_AVAILABLE = False

# Default screenshot directory
SCREENSHOT_DIR = r'C:\Users\Docker\Pictures\MCP Screenshots'

# ============================================================================
# Windows API Constants and Structures
# ============================================================================
GWL_EXSTYLE = -20
WS_EX_TOOLWINDOW = 0x00000080
WS_EX_APPWINDOW = 0x00040000
SW_SHOWMAXIMIZED = 3
SW_SHOWMINIMIZED = 2

class RECT(Structure):
    _fields_ = [
        ('left', c_int),
        ('top', c_int),
        ('right', c_int),
        ('bottom', c_int)
    ]

class WINDOWPLACEMENT(Structure):
    _fields_ = [
        ('length', c_uint),
        ('flags', c_uint),
        ('showCmd', c_uint),
        ('ptMinPosition', wintypes.POINT),
        ('ptMaxPosition', wintypes.POINT),
        ('rcNormalPosition', RECT)
    ]

# Windows API functions
user32 = windll.user32
EnumWindows = user32.EnumWindows
EnumChildWindows = user32.EnumChildWindows
GetWindowTextW = user32.GetWindowTextW
GetWindowTextLengthW = user32.GetWindowTextLengthW
IsWindowVisible = user32.IsWindowVisible
GetWindowRect = user32.GetWindowRect
GetWindowLongW = user32.GetWindowLongW
GetWindowPlacement = user32.GetWindowPlacement
FindWindowW = user32.FindWindowW
FindWindowExW = user32.FindWindowExW
GetForegroundWindow = user32.GetForegroundWindow
GetClassNameW = user32.GetClassNameW

# Callback type
EnumWindowsProc = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

# ============================================================================
# MOUSE POSITION (embedded from mouse-position.py)
# ============================================================================
def get_mouse_position():
    """Get current mouse position using pyautogui"""
    if not PYAUTOGUI_AVAILABLE:
        return None
    
    try:
        x, y = pyautogui.position()
        return {'x': x, 'y': y}
    except Exception:
        return None

# ============================================================================
# WINDOWS API FUNCTIONS (embedded from get_all_screen_elements_api.py)
# ============================================================================
def get_window_text(hwnd):
    """Get window title text"""
    try:
        length = GetWindowTextLengthW(hwnd)
        if length == 0:
            return ""
        buff = ctypes.create_unicode_buffer(length + 1)
        GetWindowTextW(hwnd, buff, length + 1)
        return buff.value
    except:
        return ""

def get_taskbar_buttons():
    """Get all taskbar button information using Windows API"""
    taskbar_buttons = []
    
    try:
        # Find taskbar window
        taskbar = FindWindowW("Shell_TrayWnd", None)
        if not taskbar:
            return []
        
        # Get taskbar dimensions
        taskbar_rect = RECT()
        if not GetWindowRect(taskbar, byref(taskbar_rect)):
            return []
        
        taskbar_height = taskbar_rect.bottom - taskbar_rect.top
        taskbar_y = taskbar_rect.top
        screen_width = taskbar_rect.right - taskbar_rect.left
        
        # Get all windows that would have taskbar buttons
        windows_with_buttons = []
        
        def enum_callback(hwnd, lParam):
            if IsWindowVisible(hwnd):
                try:
                    text = get_window_text(hwnd)
                    if not text:
                        return True
                    
                    ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE)
                    if (ex_style & WS_EX_TOOLWINDOW) and not (ex_style & WS_EX_APPWINDOW):
                        return True
                    
                    rect = RECT()
                    if not GetWindowRect(hwnd, byref(rect)):
                        return True
                    
                    width = rect.right - rect.left
                    height = rect.bottom - rect.top
                    
                    if width < 10 or height < 10:
                        return True
                    
                    placement = WINDOWPLACEMENT()
                    placement.length = ctypes.sizeof(WINDOWPLACEMENT)
                    is_minimized = False
                    
                    if GetWindowPlacement(hwnd, byref(placement)):
                        is_minimized = placement.showCmd == SW_SHOWMINIMIZED
                    
                    if is_minimized:
                        return True
                    
                    windows_with_buttons.append({'name': text, 'hwnd': hwnd})
                except:
                    pass
            return True
        
        callback = EnumWindowsProc(enum_callback)
        EnumWindows(callback, 0)
        
        # Calculate button positions
        button_width = 44
        app_buttons_width = len(windows_with_buttons) * button_width
        start_x = taskbar_rect.left + (screen_width // 2) - (app_buttons_width // 2) - 48
        
        # Add Start button
        taskbar_buttons.append({
            'name': 'Start',
            'type': 'StartButton',
            'x': start_x,
            'y': taskbar_y,
            'width': 44,
            'height': taskbar_height,
            'center_x': start_x + 22,
            'center_y': taskbar_y + taskbar_height // 2,
            'is_start_button': True
        })
        
        # Add Search box
        search_x = start_x + 48
        taskbar_buttons.append({
            'name': 'Search',
            'type': 'SearchBox',
            'x': search_x,
            'y': taskbar_y + 4,
            'width': 200,
            'height': taskbar_height - 8,
            'center_x': search_x + 100,
            'center_y': taskbar_y + taskbar_height // 2,
            'is_search': True
        })
        
        # Add app buttons
        app_start_x = taskbar_rect.left + (screen_width - app_buttons_width) // 2
        for i, window in enumerate(windows_with_buttons):
            button_x = app_start_x + (i * button_width)
            taskbar_buttons.append({
                'name': window['name'],
                'type': 'AppButton',
                'x': button_x,
                'y': taskbar_y,
                'width': button_width,
                'height': taskbar_height,
                'center_x': button_x + button_width // 2,
                'center_y': taskbar_y + taskbar_height // 2,
                'window_title': window['name'],
                'is_app_button': True
            })
        
        # Add system tray
        tray_notify = FindWindowExW(taskbar, None, "TrayNotifyWnd", None)
        if tray_notify:
            tray_rect = RECT()
            if GetWindowRect(tray_notify, byref(tray_rect)):
                tray_icons = []
                
                def enum_tray(hwnd, lParam):
                    try:
                        class_name = ctypes.create_unicode_buffer(256)
                        GetClassNameW(hwnd, class_name, 256)
                        text = get_window_text(hwnd)
                        
                        if IsWindowVisible(hwnd):
                            rect = RECT()
                            if GetWindowRect(hwnd, byref(rect)):
                                width = rect.right - rect.left
                                height = rect.bottom - rect.top
                                
                                if width > 5 and height > 5 and text:
                                    tray_icons.append({
                                        'name': text,
                                        'type': 'SystemTrayIcon',
                                        'class': class_name.value,
                                        'x': rect.left,
                                        'y': rect.top,
                                        'width': width,
                                        'height': height,
                                        'center_x': (rect.left + rect.right) // 2,
                                        'center_y': (rect.top + rect.bottom) // 2,
                                        'is_system_tray': True
                                    })
                    except:
                        pass
                    return True
                
                tray_callback = EnumWindowsProc(enum_tray)
                EnumChildWindows(tray_notify, tray_callback, 0)
                taskbar_buttons.extend(tray_icons)
        
        # Add notification button
        notification_x = taskbar_rect.right - 48
        taskbar_buttons.append({
            'name': 'Notification Center',
            'type': 'NotificationButton',
            'x': notification_x,
            'y': taskbar_y,
            'width': 44,
            'height': taskbar_height,
            'center_x': notification_x + 22,
            'center_y': taskbar_y + taskbar_height // 2,
            'is_notification': True
        })
        
    except:
        pass
    
    return taskbar_buttons

def get_all_windows():
    """Get all visible windows"""
    windows = []
    
    def enum_callback(hwnd, lParam):
        if IsWindowVisible(hwnd):
            try:
                text = get_window_text(hwnd)
                if not text:
                    return True
                
                ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE)
                if (ex_style & WS_EX_TOOLWINDOW) and not (ex_style & WS_EX_APPWINDOW):
                    return True
                
                rect = RECT()
                if not GetWindowRect(hwnd, byref(rect)):
                    return True
                
                width = rect.right - rect.left
                height = rect.bottom - rect.top
                
                if width < 10 or height < 10:
                    return True
                
                placement = WINDOWPLACEMENT()
                placement.length = ctypes.sizeof(WINDOWPLACEMENT)
                is_maximized = False
                is_minimized = False
                
                if GetWindowPlacement(hwnd, byref(placement)):
                    is_maximized = placement.showCmd == SW_SHOWMAXIMIZED
                    is_minimized = placement.showCmd == SW_SHOWMINIMIZED
                
                windows.append({
                    'name': text,
                    'type': 'Window',
                    'x': rect.left,
                    'y': rect.top,
                    'width': width,
                    'height': height,
                    'center_x': (rect.left + rect.right) // 2,
                    'center_y': (rect.top + rect.bottom) // 2,
                    'is_maximized': is_maximized,
                    'is_minimized': is_minimized
                })
            except:
                pass
        return True
    
    callback = EnumWindowsProc(enum_callback)
    EnumWindows(callback, 0)
    return windows

def get_focused_window():
    """Get currently focused window"""
    try:
        hwnd = GetForegroundWindow()
        if hwnd:
            text = get_window_text(hwnd)
            rect = RECT()
            if GetWindowRect(hwnd, byref(rect)):
                return {
                    'name': text,
                    'x': rect.left,
                    'y': rect.top,
                    'width': rect.right - rect.left,
                    'height': rect.bottom - rect.top
                }
    except:
        pass
    return None

def get_all_screen_elements():
    """Get ALL screen elements using Windows API"""
    try:
        import time
        start_time = time.time()
        
        taskbar_buttons = get_taskbar_buttons()
        
        if time.time() - start_time > 5:
            raise TimeoutError("Execution taking too long")
        
        windows = get_all_windows()
        
        if time.time() - start_time > 7:
            raise TimeoutError("Execution taking too long")
        
        focused_window = get_focused_window()
        
        all_elements = taskbar_buttons + windows
        
        summary = {
            'total_elements': len(all_elements),
            'taskbar_icons_count': len(taskbar_buttons),
            'ui_elements_count': len(taskbar_buttons),
            'windows_count': len(windows),
            'taskbar_buttons': len(taskbar_buttons)
        }
        
        return {
            'success': True,
            'summary': summary,
            'elements': all_elements,
            'taskbar_icons': taskbar_buttons,
            'windows': windows,
            'focused_window': focused_window
        }
    except:
        return None

# ============================================================================
# UI AUTOMATION (embedded from get_ui_elements.py)
# ============================================================================
def init_ui_automation():
    """Initialize UI Automation"""
    if not COMTYPES_AVAILABLE:
        return None, None
    
    try:
        try:
            from comtypes.gen import UIAutomationClient
        except ImportError:
            comtypes.client.GetModule("UIAutomationCore.dll")
            from comtypes.gen import UIAutomationClient
        
        uia = comtypes.client.CreateObject(
            "{ff48dba4-60ef-4201-aa87-54103eef594e}",
            interface=UIAutomationClient.IUIAutomation
        )
        
        return uia, UIAutomationClient
    except:
        return None, None

def get_all_ui_elements(uia, UIAutomationClient):
    """Get ALL UI elements from desktop - using both UI Automation AND Win32 API"""
    try:
        root = uia.GetRootElement()
        
        # Control type names mapping
        control_type_names = {
            50000: "Button", 50001: "Calendar", 50002: "CheckBox", 50003: "ComboBox",
            50004: "Edit", 50005: "Hyperlink", 50006: "Image", 50007: "ListItem",
            50008: "List", 50009: "Menu", 50010: "MenuBar", 50011: "MenuItem",
            50012: "ProgressBar", 50013: "RadioButton", 50014: "ScrollBar", 50015: "Slider",
            50016: "Spinner", 50017: "StatusBar", 50018: "Tab", 50019: "TabItem",
            50020: "Text", 50021: "ToolBar", 50022: "ToolTip", 50023: "Tree",
            50024: "TreeItem", 50025: "Custom", 50026: "Group", 50027: "Thumb",
            50028: "DataGrid", 50029: "DataItem", 50030: "Document", 50031: "SplitButton",
            50032: "Window", 50033: "Pane", 50034: "Header", 50035: "HeaderItem",
            50036: "Table", 50037: "TitleBar", 50038: "Separator"
        }
        
        elements = []
        processed = set()
        text_elements_map = {}  # Map positions to text content
        
        # Get ALL elements using a TrueCondition
        try:
            true_condition = uia.CreateTrueCondition()
            all_elements = root.FindAll(UIAutomationClient.TreeScope_Descendants, true_condition)
            
            # First pass: collect all Text elements
            if all_elements:
                for i in range(all_elements.Length):
                    try:
                        element = all_elements.GetElement(i)
                        try:
                            control_type = element.CurrentControlType
                            if control_type == 50020:  # Text
                                rect = element.CurrentBoundingRectangle
                                name = element.CurrentName or ''
                                if name:
                                    key = f"{int(rect.left)}_{int(rect.top)}"
                                    text_elements_map[key] = name
                        except:
                            pass
                    except:
                        pass
            
            # Second pass: process all elements with AGGRESSIVE name extraction
            if all_elements:
                for i in range(all_elements.Length):
                    try:
                        element = all_elements.GetElement(i)
                        
                        # Get bounding rectangle
                        rect = element.CurrentBoundingRectangle
                        width = rect.right - rect.left
                        height = rect.bottom - rect.top
                        
                        # Skip invalid elements
                        if width <= 0 or height <= 0 or width < 3 or height < 3:
                            continue
                        
                        if rect.left < -10000 or rect.top < -10000:
                            continue
                        
                        # Avoid duplicates
                        element_id = f"{rect.left}_{rect.top}_{width}_{height}"
                        if element_id in processed:
                            continue
                        processed.add(element_id)
                        
                        # Get control type
                        control_type = 0
                        try:
                            control_type = element.CurrentControlType
                        except:
                            pass
                        
                        control_type_name = control_type_names.get(control_type, f"Type_{control_type}")
                        
                        # AGGRESSIVE NAME EXTRACTION
                        name = ''
                        
                        # Method 1: CurrentName
                        try:
                            name = element.CurrentName or ''
                        except:
                            pass
                        
                        # Method 2: LegacyIAccessible pattern (often has names when CurrentName doesn't)
                        if not name:
                            try:
                                legacy_pattern = element.GetCurrentPattern(UIAutomationClient.UIA_LegacyIAccessiblePatternId)
                                if legacy_pattern:
                                    legacy_name = legacy_pattern.CurrentName or ''
                                    if legacy_name:
                                        name = legacy_name
                            except:
                                pass
                        
                        # Method 3: Try Win32 API GetWindowText (only works for Window elements with handles)
                        if not name:
                            try:
                                # Get native window handle
                                hwnd = element.CurrentNativeWindowHandle
                                if hwnd:
                                    # Use Win32 API to get window text
                                    length = GetWindowTextLengthW(hwnd)
                                    if length > 0:
                                        buff = ctypes.create_unicode_buffer(length + 1)
                                        GetWindowTextW(hwnd, buff, length + 1)
                                        name = buff.value or ''
                            except:
                                pass
                        
                        # Method 4: Value pattern
                        if not name:
                            try:
                                value_pattern = element.GetCurrentPattern(UIAutomationClient.UIA_ValuePatternId)
                                if value_pattern:
                                    name = value_pattern.CurrentValue or ''
                            except:
                                pass
                        
                        # Method 5: Text pattern
                        if not name:
                            try:
                                text_pattern = element.GetCurrentPattern(UIAutomationClient.UIA_TextPatternId)
                                if text_pattern:
                                    doc_range = text_pattern.DocumentRange
                                    if doc_range:
                                        name = doc_range.GetText(-1) or ''
                            except:
                                pass
                        
                        # Method 6: Child Text elements
                        if not name:
                            try:
                                text_condition = uia.CreatePropertyCondition(
                                    UIAutomationClient.UIA_ControlTypePropertyId,
                                    UIAutomationClient.UIA_TextControlTypeId
                                )
                                child_texts = element.FindAll(UIAutomationClient.TreeScope_Children, text_condition)
                                if child_texts and child_texts.Length > 0:
                                    child_names = []
                                    for j in range(min(child_texts.Length, 3)):
                                        try:
                                            child = child_texts.GetElement(j)
                                            child_name = child.CurrentName or ''
                                            if child_name:
                                                child_names.append(child_name)
                                        except:
                                            pass
                                    if child_names:
                                        name = ' '.join(child_names)
                            except:
                                pass
                        
                        # Method 7: Nearby Text elements
                        if not name:
                            try:
                                for dx in [0, 10, 20, 30, 40, 50, 60, 70]:
                                    for dy in [0, -5, 5, -10, 10, -15, 15]:
                                        key = f"{int(rect.left + dx)}_{int(rect.top + dy)}"
                                        if key in text_elements_map:
                                            name = text_elements_map[key]
                                            break
                                    if name:
                                        break
                            except:
                                pass
                        
                        # Method 8: Parent element name (for elements inside named containers)
                        if not name:
                            try:
                                walker = uia.ControlViewWalker
                                parent = walker.GetParentElement(element)
                                if parent:
                                    parent_name = parent.CurrentName or ''
                                    if parent_name and len(parent_name) < 100:  # Avoid huge parent names
                                        # Only use parent name if this element has a specific type
                                        if control_type in [50011, 50000, 50007]:  # MenuItem, Button, ListItem
                                            name = f"{parent_name} item"
                            except:
                                pass
                        
                        # Method 9: Check for ToolTip pattern
                        if not name:
                            try:
                                # Some elements have tooltips that contain their names
                                tooltip = element.CurrentHelpText or ''
                                if tooltip and len(tooltip) < 50:
                                    name = tooltip
                            except:
                                pass
                        
                        # Method 10: Check sibling Image elements (icons often have names)
                        if not name and control_type == 50011:  # MenuItem
                            try:
                                walker = uia.ControlViewWalker
                                parent = walker.GetParentElement(element)
                                if parent:
                                    # Look for Image children with names
                                    image_condition = uia.CreatePropertyCondition(
                                        UIAutomationClient.UIA_ControlTypePropertyId,
                                        UIAutomationClient.UIA_ImageControlTypeId
                                    )
                                    images = parent.FindAll(UIAutomationClient.TreeScope_Children, image_condition)
                                    if images and images.Length > 0:
                                        for k in range(images.Length):
                                            try:
                                                img = images.GetElement(k)
                                                img_name = img.CurrentName or ''
                                                if img_name:
                                                    # Check if image is near this element
                                                    img_rect = img.CurrentBoundingRectangle
                                                    if abs(img_rect.top - rect.top) < 50:
                                                        name = img_name
                                                        break
                                            except:
                                                pass
                            except:
                                pass
                        
                        # Get other properties
                        class_name = ''
                        try:
                            class_name = element.CurrentClassName or ''
                        except:
                            pass
                        
                        automation_id = ''
                        try:
                            automation_id = element.CurrentAutomationId or ''
                        except:
                            pass
                        
                        help_text = ''
                        try:
                            help_text = element.CurrentHelpText or ''
                        except:
                            pass
                        
                        full_description = ''
                        try:
                            full_description = element.CurrentFullDescription or ''
                        except:
                            pass
                        
                        accelerator_key = ''
                        try:
                            accelerator_key = element.CurrentAcceleratorKey or ''
                        except:
                            pass
                        
                        access_key = ''
                        try:
                            access_key = element.CurrentAccessKey or ''
                        except:
                            pass
                        
                        item_type = ''
                        try:
                            item_type = element.CurrentItemType or ''
                        except:
                            pass
                        
                        # Build comprehensive name
                        display_name = name or help_text or full_description or item_type or ''
                        
                        # Add element
                        elements.append({
                            'name': display_name,
                            'original_name': name,
                            'help_text': help_text,
                            'full_description': full_description,
                            'accelerator_key': accelerator_key,
                            'access_key': access_key,
                            'item_type': item_type,
                            'control_type': control_type,
                            'control_type_name': control_type_name,
                            'class_name': class_name,
                            'automation_id': automation_id,
                            'x': int(rect.left),
                            'y': int(rect.top),
                            'width': int(width),
                            'height': int(height),
                            'center_x': int((rect.left + rect.right) // 2),
                            'center_y': int((rect.top + rect.bottom) // 2)
                        })
                    except:
                        continue
        except:
            pass
        
        return elements
    except:
        return []

def get_ui_elements():
    """Get UI elements using Windows UI Automation API"""
    try:
        uia, UIAutomationClient = init_ui_automation()
        
        if not uia:
            return None
        
        elements = get_all_ui_elements(uia, UIAutomationClient)
        
        # Group by control type
        by_type = {}
        for elem in elements:
            control_type = elem.get('control_type', 'unknown')
            if control_type not in by_type:
                by_type[control_type] = []
            by_type[control_type].append(elem)
        
        # Control type names mapping
        control_type_names = {
            50000: "Button", 50001: "Calendar", 50002: "CheckBox", 50003: "ComboBox",
            50004: "Edit", 50005: "Hyperlink", 50006: "Image", 50007: "ListItem",
            50008: "List", 50009: "Menu", 50010: "MenuBar", 50011: "MenuItem",
            50012: "ProgressBar", 50013: "RadioButton", 50014: "ScrollBar", 50015: "Slider",
            50016: "Spinner", 50017: "StatusBar", 50018: "Tab", 50019: "TabItem",
            50020: "Text", 50021: "ToolBar", 50022: "ToolTip", 50023: "Tree",
            50024: "TreeItem", 50025: "Custom", 50026: "Group", 50027: "Thumb",
            50028: "DataGrid", 50029: "DataItem", 50030: "Document", 50031: "SplitButton",
            50032: "Window", 50033: "Pane", 50034: "Header", 50035: "HeaderItem",
            50036: "Table", 50037: "TitleBar", 50038: "Separator"
        }
        
        summary = {}
        for control_type, items in by_type.items():
            type_name = control_type_names.get(control_type, f"Type_{control_type}")
            summary[type_name] = len(items)
        
        return {
            'success': True,
            'totalElements': len(elements),
            'elements': elements,
            'summary': summary
        }
    except:
        return None

# ============================================================================
# OCR (embedded from ocr_detector.py)
# ============================================================================
def run_ocr(image_path):
    """Run OCR on the screenshot"""
    if not TESSERACT_AVAILABLE:
        return None
    
    try:
        image = cv2.imread(image_path)
        if image is None:
            return None
        
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        custom_config = '--oem 3 --psm 3'
        
        data = pytesseract.image_to_data(
            gray,
            config=custom_config,
            output_type=pytesseract.Output.DICT,
            timeout=15
        )
        
        elements = []
        n_boxes = len(data['text'])
        for i in range(n_boxes):
            try:
                conf = float(data['conf'][i])
                text = data['text'][i].strip()
                
                if conf < 30 or not text or len(text) < 1:
                    continue
                
                x = data['left'][i]
                y = data['top'][i]
                w = data['width'][i]
                h = data['height'][i]
                
                if w < 3 or h < 3:
                    continue
                
                elements.append({
                    'text': text,
                    'confidence': conf / 100.0,
                    'position': {'x': x, 'y': y},
                    'size': {'width': w, 'height': h},
                    'center': {'x': x + w // 2, 'y': y + h // 2}
                })
            except:
                continue
        
        elements.sort(key=lambda e: (e['position']['y'], e['position']['x']))
        
        return {
            'totalElements': len(elements),
            'detectedElements': len(elements),
            'textElements': elements,
            'truncated': False
        }
    except:
        return None

# ============================================================================
# MAIN SCREENSHOT FUNCTION
# ============================================================================
def take_screenshot(output_path=None, include_mouse=True, include_ocr=True, include_ui_elements=True):
    """
    Take a screenshot with comprehensive analysis
    
    Args:
        output_path: Path where screenshot will be saved
        include_mouse: Whether to include mouse position
        include_ocr: Whether to include OCR text analysis
        include_ui_elements: Whether to include UI Automation elements
    
    Returns:
        dict: Result with all data
    """
    if not PIL_AVAILABLE:
        return {
            'success': False,
            'error': 'PIL/Pillow not installed',
            'message': 'Failed to take screenshot: PIL/Pillow not installed'
        }
    
    try:
        # Generate output path if not specified
        if output_path is None:
            os.makedirs(SCREENSHOT_DIR, exist_ok=True)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_path = os.path.join(SCREENSHOT_DIR, f'screenshot_{timestamp}.png')
        else:
            parent_dir = os.path.dirname(output_path)
            if parent_dir:
                os.makedirs(parent_dir, exist_ok=True)
        
        # Take screenshot
        screenshot = ImageGrab.grab()
        screenshot.save(output_path, 'PNG')
        abs_path = str(Path(output_path).resolve())
        
        result = {
            'success': True,
            'path': abs_path,
            'size': {'width': screenshot.width, 'height': screenshot.height},
            'screen_size': {'width': screenshot.width, 'height': screenshot.height},  # Backend expects this
            'message': f'Screenshot saved to {abs_path}'
        }
        
        # Get mouse position
        if include_mouse:
            mouse_pos = get_mouse_position()
            result['mousePosition'] = mouse_pos
            result['mouse_position'] = mouse_pos  # Backend expects this
        
        # Run OCR
        if include_ocr:
            ocr_data = run_ocr(abs_path)
            result['ocr'] = ocr_data
            # Backend expects ocr_text as array
            if ocr_data:
                result['ocr_text'] = ocr_data.get('textElements', [])
        
        # Get UI elements
        if include_ui_elements:
            ui_elements_data = get_ui_elements()
            result['uiElements'] = ui_elements_data
            # Backend expects ui_elements as array
            if ui_elements_data and ui_elements_data.get('success'):
                result['ui_elements'] = ui_elements_data.get('elements', [])
        
        # Get Windows API elements
        all_elements_data = get_all_screen_elements()
        if all_elements_data:
            result['windowsAPI'] = all_elements_data
            # Backend expects windowsAPI.elements array
            if all_elements_data.get('success'):
                # Combine taskbar_icons and windows into elements array
                elements = []
                if all_elements_data.get('taskbar_icons'):
                    for icon in all_elements_data['taskbar_icons']:
                        icon['type'] = 'TaskbarButton'
                        elements.append(icon)
                if all_elements_data.get('windows'):
                    elements.extend(all_elements_data['windows'])
                result['windowsAPI']['elements'] = elements
        
        return result
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'message': f'Failed to take screenshot: {str(e)}'
        }

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Take a screenshot with comprehensive analysis')
    parser.add_argument('--output', default=None, help='Output file path')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    parser.add_argument('--no-mouse', action='store_true', help='Skip mouse position')
    parser.add_argument('--no-ocr', action='store_true', help='Skip OCR')
    parser.add_argument('--no-ui', action='store_true', help='Skip UI elements')
    
    args = parser.parse_args()
    result = take_screenshot(
        args.output,
        include_mouse=not args.no_mouse,
        include_ocr=not args.no_ocr,
        include_ui_elements=not args.no_ui
    )
    
    if args.json:
        json_output = json.dumps(result, indent=2)
        print(json_output)
        sys.stdout.flush()
    else:
        print(result['message'])
        if result.get('mousePosition'):
            print(f"Mouse: ({result['mousePosition']['x']}, {result['mousePosition']['y']})")
        if result.get('ocr'):
            print(f"OCR: {result['ocr']['detectedElements']} text elements")
        if result.get('uiElements', {}).get('success'):
            print(f"UI Elements: {result['uiElements']['totalElements']} interactive elements")
        if result.get('windowsAPI', {}).get('success'):
            api_data = result['windowsAPI']
            print(f"Windows API: {api_data['summary']['total_elements']} total elements")
            print(f"  Taskbar: {api_data['summary']['taskbar_icons_count']} icons")
            print(f"  Windows: {api_data['summary']['windows_count']}")
    
    sys.stdout.flush()
    sys.stderr.flush()
    os._exit(0 if result['success'] else 1)
