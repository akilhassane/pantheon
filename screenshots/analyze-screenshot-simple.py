#!/usr/bin/env python3
"""
Simple screenshot analysis without OCR
"""

from PIL import Image
import json

# Load the screenshot
img = Image.open('current-screenshot.png')

# Get basic info
width, height = img.size
mode = img.mode

print(f"📊 SCREENSHOT ANALYSIS")
print("=" * 60)
print(f"Resolution: {width}x{height} pixels")
print(f"Color Mode: {mode}")
print(f"File Size: 104KB")
print()

# Sample colors from different regions
print("🎨 SCREEN REGIONS:")
print("-" * 60)

# Top-left (usually desktop/window)
top_left = img.crop((0, 0, 100, 100))
tl_colors = top_left.getcolors(maxcolors=10000)
if tl_colors:
    tl_dominant = max(tl_colors, key=lambda x: x[0])[1]
    print(f"Top-Left Corner: RGB{tl_dominant}")

# Bottom (taskbar area)
taskbar = img.crop((0, height-100, width, height))
tb_colors = taskbar.getcolors(maxcolors=10000)
if tb_colors:
    tb_dominant = max(tb_colors, key=lambda x: x[0])[1]
    print(f"Bottom (Taskbar): RGB{tb_dominant}")

# Center (main content area)
center = img.crop((width//4, height//4, 3*width//4, 3*height//4))
c_colors = center.getcolors(maxcolors=10000)
if c_colors:
    c_dominant = max(c_colors, key=lambda x: x[0])[1]
    print(f"Center Area: RGB{c_dominant}")

print()
print("💡 OBSERVATIONS:")
print("-" * 60)

# Analyze taskbar color
if tb_colors:
    tb_r, tb_g, tb_b = tb_dominant[:3]
    if tb_r < 50 and tb_g < 50 and tb_b < 50:
        print("• Dark taskbar detected (likely Windows dark mode)")
    elif tb_r > 200 and tb_g > 200 and tb_b > 200:
        print("• Light taskbar detected (likely Windows light mode)")
    else:
        print(f"• Taskbar color: RGB({tb_r}, {tb_g}, {tb_b})")

# Check if there's a lot of white (text/windows)
white_pixels = sum(count for count, color in img.getcolors(maxcolors=width*height) 
                   if len(color) >= 3 and all(c > 240 for c in color[:3]))
white_percentage = (white_pixels / (width * height)) * 100

if white_percentage > 30:
    print(f"• High white content ({white_percentage:.1f}%) - likely text editor or browser")
elif white_percentage > 10:
    print(f"• Moderate white content ({white_percentage:.1f}%) - mixed content")
else:
    print(f"• Low white content ({white_percentage:.1f}%) - dark theme or media")

print()
print("=" * 60)
print("✅ Analysis complete!")
print()
print("Note: For detailed text extraction, install pytesseract and tesseract-ocr")
