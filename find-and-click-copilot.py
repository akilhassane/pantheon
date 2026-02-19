#!/usr/bin/env python3
"""
Script to take a screenshot and move mouse to Copilot icon in taskbar
"""

import subprocess
import json
import sys

def take_screenshot():
    """Take a screenshot and return the data"""
    print("📸 Taking screenshot...")
    result = subprocess.run(
        ['python', 'test-screenshot.py', '--json'],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(f"❌ Screenshot failed: {result.stderr}")
        return None
    
    try:
        data = json.loads(result.stdout)
        print(f"✅ Screenshot captured successfully")
        return data
    except json.JSONDecodeError as e:
        print(f"❌ Failed to parse screenshot data: {e}")
        return None

def find_copilot_icon(data):
    """Find Copilot icon in the screenshot data"""
    print("\n🔍 Searching for Copilot icon...")
    
    # Search in taskbar icons
    if 'windowsAPI' in data and 'taskbar_icons' in data['windowsAPI']:
        for icon in data['windowsAPI']['taskbar_icons']:
            name = icon.get('name', '').lower()
            if 'copilot' in name:
                print(f"✅ Found Copilot in taskbar: {icon['name']}")
                return icon
    
    # Search in UI elements (taskbar area, y > 850)
    if 'uiElements' in data and 'elements' in data['uiElements']:
        for element in data['uiElements']['elements']:
            name = element.get('name', '').lower()
            y = element.get('y', 0)
            if 'copilot' in name and y > 850:
                print(f"✅ Found Copilot in UI elements: {element['name']}")
                return element
    
    print("❌ Copilot icon not found in taskbar")
    return None

def move_mouse_to_icon(icon):
    """Move mouse to the icon's center position"""
    x = icon.get('center_x')
    y = icon.get('center_y')
    
    if x is None or y is None:
        print("❌ Icon coordinates not available")
        return False
    
    print(f"\n🖱️  Moving mouse to ({x}, {y})...")
    result = subprocess.run(
        ['python', 'test-mouse-move.py', '--x', str(x), '--y', str(y)],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print(f"✅ {result.stdout.strip()}")
        return True
    else:
        print(f"❌ Mouse move failed: {result.stderr}")
        return False

def main():
    """Main function"""
    print("=" * 60)
    print("Find and Point to Copilot Icon")
    print("=" * 60)
    
    # Step 1: Take screenshot
    data = take_screenshot()
    if not data:
        sys.exit(1)
    
    # Step 2: Find Copilot icon
    copilot = find_copilot_icon(data)
    if not copilot:
        print("\n💡 Tip: Make sure Copilot is pinned to your taskbar")
        sys.exit(1)
    
    # Step 3: Move mouse to icon
    success = move_mouse_to_icon(copilot)
    
    if success:
        print("\n" + "=" * 60)
        print("✅ SUCCESS: Mouse is now pointing at Copilot icon!")
        print("=" * 60)
    else:
        sys.exit(1)

if __name__ == '__main__':
    main()
