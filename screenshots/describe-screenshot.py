#!/usr/bin/env python3
"""
Analyze screenshot and describe what's visible
"""

from PIL import Image
import pytesseract
import json

# Load the screenshot
img = Image.open('current-screenshot.png')

# Get basic info
width, height = img.size
print(f"📊 Screen Resolution: {width}x{height}")
print(f"📐 Image Mode: {img.mode}")
print()

# Perform OCR to extract text
print("🔍 Extracting text from screenshot...")
try:
    text = pytesseract.image_to_string(img)
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    print(f"\n📝 Found {len(lines)} lines of text:")
    print("=" * 60)
    for i, line in enumerate(lines[:30], 1):  # Show first 30 lines
        print(f"{i:2d}. {line}")
    
    if len(lines) > 30:
        print(f"\n... and {len(lines) - 30} more lines")
    
except Exception as e:
    print(f"❌ OCR Error: {e}")
    print("Note: Install tesseract-ocr to enable text extraction")

print("\n" + "=" * 60)
print("✅ Screenshot analysis complete!")
