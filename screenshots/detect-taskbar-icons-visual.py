#!/usr/bin/env python3
"""
Detect taskbar icons using visual analysis of the screenshot
This works by analyzing the taskbar image to find icon positions
"""

from PIL import Image, ImageFilter
import json
import sys

def detect_taskbar_icons_visual(screenshot_path):
    """Detect taskbar icons by analyzing the screenshot image"""
    try:
        img = Image.open(screenshot_path)
        width, height = img.size
        
        # Taskbar is at bottom (48px high)
        taskbar_height = 48
        taskbar_y = height - taskbar_height
        
        # Crop taskbar area
        taskbar = img.crop((0, taskbar_y, width, height))
        
        # Convert to grayscale for analysis
        gray = taskbar.convert('L')
        
        # Apply edge detection to find icon boundaries
        edges = gray.filter(ImageFilter.FIND_EDGES)
        
        # Analyze center region where app icons are
        # Skip left side (Start, Search, etc.) and right side (System Tray)
        center_start = 200
        center_end = width - 300
        
        # Scan horizontally to find icon positions
        # Icons are typically 44px wide with distinct edges
        icon_width = 44
        icons = []
        
        # Sample vertical line through middle of taskbar
        mid_y = taskbar_height // 2
        
        # Detect changes in brightness/edges that indicate icon boundaries
        x = center_start
        while x < center_end:
            # Check if there's visual content at this position
            # Sample a small region around this x position
            sample_region = edges.crop((x, 0, min(x + icon_width, edges.width), taskbar_height))
            
            # Calculate average edge intensity in this region
            pixels = list(sample_region.getdata())
            avg_intensity = sum(pixels) / len(pixels) if pixels else 0
            
            # If there's significant edge content, likely an icon
            if avg_intensity > 10:  # Threshold for detecting an icon
                icons.append({
                    'type': 'TaskbarIcon',
                    'x': x,
                    'y': taskbar_y,
                    'width': icon_width,
                    'height': taskbar_height,
                    'center_x': x + icon_width // 2,
                    'center_y': taskbar_y + taskbar_height // 2,
                    'detected_by': 'visual_analysis',
                    'edge_intensity': round(avg_intensity, 2)
                })
                x += icon_width  # Move to next icon position
            else:
                x += 10  # Small step to find next icon
        
        return icons
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return []

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python detect-taskbar-icons-visual.py <screenshot.png>")
        sys.exit(1)
    
    icons = detect_taskbar_icons_visual(sys.argv[1])
    
    result = {
        'success': len(icons) > 0,
        'count': len(icons),
        'icons': icons
    }
    
    print(json.dumps(result, indent=2))
