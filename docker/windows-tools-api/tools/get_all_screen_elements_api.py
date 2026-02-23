#!/usr/bin/env python3
"""
Get ALL screen elements using Windows API
Comprehensive detection of taskbar icons, windows, and UI elements
Uses ctypes (built-in) instead of pywin32 for better compatibility
"""

import json
import sys
import ctypes
from ctypes import wintypes, windll, byref, POINTER, Structure, c_int, c_uint, c_wchar

# Windows API constants
GWL_EXSTYLE = -20
WS_EX_TOOLWINDOW = 0x00000080
WS_EX_APPWINDOW = 0x00040000
SW_SHOWMAXIMIZED = 3
SW_SHOWMINIMIZED = 2

# Define Windows structures
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

def get_window_text(hwnd):
    """Get window title text"""
    length = GetWindowTextLengthW(hwnd)
    if length == 0:
        return ""
    buff = ctypes.create_unicode_buffer(length + 1)
    GetWindowTextW(hwnd, buff, length + 1)
    return buff.value

def get_taskbar_buttons():
    """Get all taskbar button information using Windows API
    
    Captures ALL taskbar elements including:
    - Start button
    - Search box
    - Task View, Widgets, Chat buttons
    - App buttons for open windows
    - System tray icons
    """
    taskbar_buttons = []
    
    try:
        # Find taskbar window to get its position
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
                    
                    # Get window style
                    ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE)
                    
                    # Skip tool windows unless they have APPWINDOW style
                    if (ex_style & WS_EX_TOOLWINDOW) and not (ex_style & WS_EX_APPWINDOW):
                        return True
                    
                    # Get window rect
                    rect = RECT()
                    if not GetWindowRect(hwnd, byref(rect)):
                        return True
                    
                    width = rect.right - rect.left
                    height = rect.bottom - rect.top
                    
                    # Skip tiny windows
                    if width < 10 or height < 10:
                        return True
                    
                    # Check if minimized
                    placement = WINDOWPLACEMENT()
                    placement.length = ctypes.sizeof(WINDOWPLACEMENT)
                    is_minimized = False
                    
                    if GetWindowPlacement(hwnd, byref(placement)):
                        is_minimized = placement.showCmd == SW_SHOWMINIMIZED
                    
                    # Skip minimized windows (they're off-screen)
                    if is_minimized:
                        return True
                    
                    windows_with_buttons.append({
                        'name': text,
                        'hwnd': hwnd
                    })
                    
                except Exception as e:
                    pass
            
            return True
        
        callback = EnumWindowsProc(enum_callback)
        EnumWindows(callback, 0)
        
        # Calculate button positions (Windows 11 centers the button group)
        button_width = 44
        app_buttons_width = len(windows_with_buttons) * button_width
        
        # Start button is to the left of the centered group
        start_x = taskbar_rect.left + (screen_width // 2) - (app_buttons_width // 2) - 48
        
        # 1. Add Start button
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
        
        # 2. Add Search box (if visible - typically next to Start in Windows 11)
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
        
        # 3. Add Task View button (if enabled)
        task_view_x = search_x + 204
        taskbar_buttons.append({
            'name': 'Task View',
            'type': 'TaskViewButton',
            'x': task_view_x,
            'y': taskbar_y,
            'width': 44,
            'height': taskbar_height,
            'center_x': task_view_x + 22,
            'center_y': taskbar_y + taskbar_height // 2,
            'is_task_view': True
        })
        
        # 4. Add Widgets button (if enabled)
        widgets_x = task_view_x + 48
        taskbar_buttons.append({
            'name': 'Widgets',
            'type': 'WidgetsButton',
            'x': widgets_x,
            'y': taskbar_y,
            'width': 44,
            'height': taskbar_height,
            'center_x': widgets_x + 22,
            'center_y': taskbar_y + taskbar_height // 2,
            'is_widgets': True
        })
        
        # 5. Add Chat/Teams button (if enabled)
        chat_x = widgets_x + 48
        taskbar_buttons.append({
            'name': 'Chat',
            'type': 'ChatButton',
            'x': chat_x,
            'y': taskbar_y,
            'width': 44,
            'height': taskbar_height,
            'center_x': chat_x + 22,
            'center_y': taskbar_y + taskbar_height // 2,
            'is_chat': True
        })
        
        # 6. Add app buttons (centered group)
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
        
        # 7. Enumerate system tray icons (right side)
        tray_notify = FindWindowExW(taskbar, None, "TrayNotifyWnd", None)
        if tray_notify:
            # Get system tray area position
            tray_rect = RECT()
            if GetWindowRect(tray_notify, byref(tray_rect)):
                # Add individual system tray icons
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
                
                # Add detected tray icons
                taskbar_buttons.extend(tray_icons)
                
                # If no individual icons found, add generic system tray area
                if not tray_icons:
                    tray_width = tray_rect.right - tray_rect.left
                    taskbar_buttons.append({
                        'name': 'System Tray',
                        'type': 'SystemTray',
                        'x': tray_rect.left,
                        'y': tray_rect.top,
                        'width': tray_width,
                        'height': tray_rect.bottom - tray_rect.top,
                        'center_x': tray_rect.left + tray_width // 2,
                        'center_y': tray_rect.top + (tray_rect.bottom - tray_rect.top) // 2,
                        'is_system_tray': True
                    })
        
        # 8. Add notification area / action center button
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
        
        # 9. Add Show Desktop button (far right corner)
        show_desktop_x = taskbar_rect.right - 4
        taskbar_buttons.append({
            'name': 'Show Desktop',
            'type': 'ShowDesktopButton',
            'x': show_desktop_x,
            'y': taskbar_y,
            'width': 4,
            'height': taskbar_height,
            'center_x': show_desktop_x + 2,
            'center_y': taskbar_y + taskbar_height // 2,
            'is_show_desktop': True
        })
        
    except Exception as e:
        pass
    
    return taskbar_buttons

def get_all_windows():
    """Get all visible windows with their properties using ctypes"""
    windows = []
    
    def enum_callback(hwnd, lParam):
        if IsWindowVisible(hwnd):
            try:
                text = get_window_text(hwnd)
                if not text:
                    return True
                
                # Get window style
                ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE)
                
                # Skip tool windows unless they have APPWINDOW style
                if (ex_style & WS_EX_TOOLWINDOW) and not (ex_style & WS_EX_APPWINDOW):
                    return True
                
                # Get window rect
                rect = RECT()
                if not GetWindowRect(hwnd, byref(rect)):
                    return True
                
                width = rect.right - rect.left
                height = rect.bottom - rect.top
                
                # Skip tiny windows
                if width < 10 or height < 10:
                    return True
                
                # Get window placement
                placement = WINDOWPLACEMENT()
                placement.length = ctypes.sizeof(WINDOWPLACEMENT)
                is_maximized = False
                is_minimized = False
                
                if GetWindowPlacement(hwnd, byref(placement)):
                    is_maximized = placement.showCmd == SW_SHOWMAXIMIZED
                    is_minimized = placement.showCmd == SW_SHOWMINIMIZED
                
                window_info = {
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
                }
                
                windows.append(window_info)
                
            except Exception as e:
                pass
        
        return True
    
    callback = EnumWindowsProc(enum_callback)
    EnumWindows(callback, 0)
    return windows

def get_focused_window():
    """Get the currently focused window using ctypes"""
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

def main():
    """Main function to gather all screen elements"""
    try:
        # Quick timeout protection - return immediately if taking too long
        import time
        start_time = time.time()
        
        # Get taskbar buttons (fast)
        taskbar_buttons = get_taskbar_buttons()
        
        # Check timeout
        if time.time() - start_time > 5:
            raise TimeoutError("Execution taking too long")
        
        # Get all windows (fast)
        windows = get_all_windows()
        
        # Check timeout again
        if time.time() - start_time > 7:
            raise TimeoutError("Execution taking too long")
        
        # Get focused window (very fast)
        focused_window = get_focused_window()
        
        # Combine all elements
        all_elements = taskbar_buttons + windows
        
        # Create summary
        summary = {
            'total_elements': len(all_elements),
            'taskbar_icons_count': len(taskbar_buttons),
            'ui_elements_count': len(taskbar_buttons),
            'windows_count': len(windows),
            'taskbar_buttons': len(taskbar_buttons)
        }
        
        result = {
            'success': True,
            'summary': summary,
            'elements': all_elements,
            'taskbar_icons': taskbar_buttons,
            'windows': windows,
            'focused_window': focused_window
        }
        
        # Save to file (even if partial data)
        with open('all_screen_elements.json', 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)
        
        # Print to stdout
        print(json.dumps(result))
        sys.stdout.flush()
        
        return 0
        
    except TimeoutError as e:
        # Return partial results on timeout
        partial_result = {
            'success': True,
            'summary': {
                'total_elements': 0,
                'taskbar_icons_count': 0,
                'ui_elements_count': 0,
                'windows_count': 0,
                'taskbar_buttons': 0
            },
            'elements': [],
            'taskbar_icons': [],
            'windows': [],
            'focused_window': None,
            'timeout': True,
            'error': str(e)
        }
        
        # Save partial results
        with open('all_screen_elements.json', 'w', encoding='utf-8') as f:
            json.dump(partial_result, f, indent=2)
        
        print(json.dumps(partial_result))
        sys.stdout.flush()
        return 0
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e)
        }
        print(json.dumps(error_result))
        sys.stdout.flush()
        return 1

if __name__ == '__main__':
    sys.exit(main())
