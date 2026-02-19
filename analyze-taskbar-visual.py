#!/usr/bin/env python3
"""
Analyze taskbar screenshot to identify missing elements
"""

from PIL import Image
import sys

def analyze_taskbar(image_path):
    """Analyze taskbar area of screenshot"""
    img = Image.open(image_path)
    width, height = img.size
    
    print(f"Screenshot size: {width}x{height}")
    
    # Taskbar is typically at bottom
    taskbar_height = 48
    taskbar_y = height - taskbar_height
    
    print(f"\nTaskbar area: y={taskbar_y} to y={height}")
    print(f"Taskbar width: {width}px")
    
    # Crop taskbar area
    taskbar = img.crop((0, taskbar_y, width, height))
    taskbar.save('taskbar-only.png')
    print(f"\nSaved taskbar crop to: taskbar-only.png")
    
    # Analyze taskbar regions
    print("\n=== TASKBAR REGIONS ===")
    
    # Left side (0-400px) - Start, Search, Task View, etc.
    print("\nLEFT SIDE (0-400px):")
    print("  Expected: Start button, Search box, Task View, Widgets, Chat")
    
    # Center (400-1200px) - App buttons
    print("\nCENTER (400-1200px):")
    print("  Expected: Pinned apps + Open windows")
    
    # Right side (1200-1600px) - System tray, clock, etc.
    print("\nRIGHT SIDE (1200-1600px):")
    print("  Expected: System tray icons, Language, Network, Volume, Battery, Clock, Notifications")
    
    # Sample colors at key positions to identify elements
    print("\n=== COLOR SAMPLING ===")
    
    positions = [
        (50, taskbar_y + 24, "Start button area"),
        (150, taskbar_y + 24, "Search box area"),
        (300, taskbar_y + 24, "Task View area"),
        (700, taskbar_y + 24, "Center app buttons"),
        (1300, taskbar_y + 24, "System tray left"),
        (1450, taskbar_y + 24, "System tray center"),
        (1550, taskbar_y + 24, "System tray right"),
    ]
    
    for x, y, label in positions:
        if x < width and y < height:
            pixel = img.getpixel((x, y))
            print(f"  {label:25s} ({x:4d}, {y:3d}): RGB{pixel}")
    
    print("\n=== INSTRUCTIONS ===")
    print("Please look at 'taskbar-only.png' and tell me:")
    print("1. What icons/buttons do you see on the LEFT side?")
    print("2. What icons/buttons do you see in the CENTER?")
    print("3. What icons/buttons do you see on the RIGHT side (system tray)?")
    print("\nThis will help identify what elements we're missing.")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python analyze-taskbar-visual.py <screenshot.png>")
        sys.exit(1)
    
    analyze_taskbar(sys.argv[1])
