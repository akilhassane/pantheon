#!/usr/bin/env python3
"""
Detect pinned taskbar apps from Windows registry and filesystem
"""

import winreg
import os
import json
from pathlib import Path

def get_pinned_apps_from_registry():
    """Try to get pinned apps from registry"""
    pinned_apps = []
    
    try:
        # Windows 11 stores taskbar pins differently than Windows 10
        # Try various registry locations
        
        locations = [
            (winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Explorer\Taskband"),
            (winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Explorer\Taskbar"),
        ]
        
        for hkey, path in locations:
            try:
                key = winreg.OpenKey(hkey, path)
                print(f"Opened registry key: {path}")
                
                # Enumerate values
                i = 0
                while True:
                    try:
                        name, value, type_ = winreg.EnumValue(key, i)
                        print(f"  {name}: {type_}")
                        i += 1
                    except OSError:
                        break
                
                winreg.CloseKey(key)
            except FileNotFoundError:
                print(f"Registry key not found: {path}")
            except Exception as e:
                print(f"Error reading {path}: {e}")
    
    except Exception as e:
        print(f"Registry error: {e}")
    
    return pinned_apps

def get_pinned_apps_from_filesystem():
    """Try to get pinned apps from filesystem"""
    pinned_apps = []
    
    # Windows 11 stores taskbar layout in AppData
    appdata = os.environ.get('LOCALAPPDATA', '')
    
    # Possible locations
    locations = [
        os.path.join(appdata, r"Packages\Microsoft.Windows.StartMenuExperienceHost_cw5n1h2txyewy\LocalState\start.bin"),
        os.path.join(appdata, r"Packages\Microsoft.Windows.StartMenuExperienceHost_cw5n1h2txyewy\LocalState\start2.bin"),
        os.path.join(appdata, r"Microsoft\Windows\Shell\LayoutModification.xml"),
    ]
    
    for location in locations:
        if os.path.exists(location):
            print(f"Found file: {location}")
            print(f"  Size: {os.path.getsize(location)} bytes")
        else:
            print(f"Not found: {location}")
    
    return pinned_apps

def check_uiautomation_available():
    """Check if UI Automation libraries are available"""
    print("\n=== Checking UI Automation Libraries ===")
    
    try:
        import comtypes
        print("✓ comtypes is available")
        return True
    except ImportError:
        print("✗ comtypes not available (pip install comtypes)")
    
    try:
        import pywinauto
        print("✓ pywinauto is available")
        return True
    except ImportError:
        print("✗ pywinauto not available (pip install pywinauto)")
    
    return False

if __name__ == '__main__':
    print("=== Detecting Pinned Taskbar Apps ===\n")
    
    print("Method 1: Registry")
    print("-" * 50)
    get_pinned_apps_from_registry()
    
    print("\nMethod 2: Filesystem")
    print("-" * 50)
    get_pinned_apps_from_filesystem()
    
    print("\nMethod 3: UI Automation")
    print("-" * 50)
    has_uia = check_uiautomation_available()
    
    if not has_uia:
        print("\n=== RECOMMENDATION ===")
        print("To detect pinned taskbar apps, install UI Automation:")
        print("  pip install comtypes")
        print("or")
        print("  pip install pywinauto")
