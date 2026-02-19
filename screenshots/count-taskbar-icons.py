#!/usr/bin/env python3
"""
Count and detect all taskbar icons by analyzing the taskbar image
"""

from PIL import Image
import sys

def analyze_taskbar_icons(image_path):
    """Analyze taskbar to count icons"""
    img = Image.open(image_path)
    width, height = img.size
    
    # Taskbar is at bottom
    taskbar_height = 48
    taskbar_y = height - taskbar_height
    
    # Crop taskbar
    taskbar = img.crop((0, taskbar_y, width, height))
    
    # Convert to grayscale for analysis
    gray = taskbar.convert('L')
    
    # Analyze center region where app icons are (roughly 200px to 1200px)
    center_start = 200
    center_end = 1200
    
    print(f"Analyzing taskbar center region: {center_start}px to {center_end}px")
    print(f"Region width: {center_end - center_start}px")
    
    # Sample vertical line through middle of taskbar
    mid_y = taskbar_height // 2
    
    # Detect icon boundaries by looking for brightness changes
    # Icons typically have distinct edges
    
    icon_positions = []
    in_icon = False
    icon_start = None
    threshold = 30  # Brightness difference threshold
    
    prev_brightness = gray.getpixel((center_start, mid_y))
    
    for x in range(center_start, center_end):
        brightness = gray.getpixel((x, mid_y))
        diff = abs(brightness - prev_brightness)
        
        # Detect edge
        if diff > threshold:
            if not in_icon:
                icon_start = x
                in_icon = True
            else:
                # End of icon
                if icon_start and (x - icon_start) > 20:  # Minimum icon width
                    icon_positions.append({
                        'start': icon_start,
                        'end': x,
                        'width': x - icon_start,
                        'center': (icon_start + x) // 2
                    })
                in_icon = False
                icon_start = None
        
        prev_brightness = brightness
    
    print(f"\nDetected {len(icon_positions)} potential icon positions:")
    for i, pos in enumerate(icon_positions, 1):
        print(f"  {i}. x={pos['start']}-{pos['end']} (width={pos['width']}px, center={pos['center']})")
    
    # Alternative: Use fixed spacing
    # Windows 11 uses 44px wide icons
    icon_width = 44
    estimated_count = (center_end - center_start) // icon_width
    
    print(f"\nEstimated icon count (44px spacing): {estimated_count}")
    
    # Generate positions for all icons
    print(f"\nGenerating positions for {estimated_count} icons:")
    
    icons = []
    for i in range(estimated_count):
        x = center_start + (i * icon_width)
        center_x = x + icon_width // 2
        
        # Sample pixel at this position to see if there's likely an icon
        sample_brightness = gray.getpixel((center_x, mid_y))
        
        icons.append({
            'index': i + 1,
            'x': x,
            'center_x': center_x,
            'width': icon_width,
            'brightness': sample_brightness
        })
        
        print(f"  Icon {i+1}: x={x}, center={center_x}, brightness={sample_brightness}")
    
    return icons

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python count-taskbar-icons.py <screenshot.png>")
        sys.exit(1)
    
    icons = analyze_taskbar_icons(sys.argv[1])
    print(f"\n=== SUMMARY ===")
    print(f"Total icons detected: {len(icons)}")
