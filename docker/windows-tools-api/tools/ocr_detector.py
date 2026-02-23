#!/usr/bin/env python3
"""
Simple Comprehensive OCR Text Detection
Gets ALL text from screen with coordinates using basic tesseract
"""

import pytesseract
from PIL import Image
import cv2
import sys
import json

# Set Tesseract path for Windows
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def get_all_text_from_image(image_path):
    """
    Get all text from image using OCR (optimized for speed)
    
    Args:
        image_path: Path to the screenshot image
        
    Returns:
        List of text elements with positions
    """
    try:
        # Load image
        image = cv2.imread(image_path)
        if image is None:
            print(f"Error: Could not load image from {image_path}", file=sys.stderr)
            return []
        
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Use only PSM 3 (fully automatic) for speed - it's the most reliable
        custom_config = '--oem 3 --psm 3'
        
        # Get detailed data with timeout protection
        data = pytesseract.image_to_data(
            gray,
            config=custom_config,
            output_type=pytesseract.Output.DICT,
            timeout=15  # 15 second timeout
        )
        
        # Parse results
        elements = []
        n_boxes = len(data['text'])
        for i in range(n_boxes):
            try:
                conf = float(data['conf'][i])
                text = data['text'][i].strip()
                
                # Skip low confidence or empty text
                if conf < 30 or not text or len(text) < 1:
                    continue
                
                x = data['left'][i]
                y = data['top'][i]
                w = data['width'][i]
                h = data['height'][i]
                
                # Skip very small boxes
                if w < 3 or h < 3:
                    continue
                
                element = {
                    'text': text,
                    'confidence': conf / 100.0,
                    'x': x,
                    'y': y,
                    'width': w,
                    'height': h,
                    'center_x': x + w // 2,
                    'center_y': y + h // 2
                }
                
                elements.append(element)
            except (ValueError, KeyError) as e:
                # Skip malformed entries
                continue
        
        # Sort by position (top to bottom, left to right)
        elements.sort(key=lambda e: (e['y'], e['x']))
        
        return elements
        
    except Exception as e:
        print(f"Error in OCR processing: {str(e)}", file=sys.stderr)
        return []

def find_text_in_elements(elements, search_text, partial_match=True):
    """
    Find specific text in the detected elements
    
    Args:
        elements: List of text elements
        search_text: Text to search for
        partial_match: Whether to allow partial matches
        
    Returns:
        List of matching elements
    """
    matches = []
    search_lower = search_text.lower()
    
    for element in elements:
        text_lower = element['text'].lower()
        
        if partial_match:
            if search_lower in text_lower:
                matches.append(element)
        else:
            if search_lower == text_lower:
                matches.append(element)
    
    return matches

def main():
    if len(sys.argv) < 2:
        print("Usage: python ocr_detector.py <image_path> [search_text]")
        sys.exit(1)
    
    image_path = sys.argv[1]
    search_text = sys.argv[2] if len(sys.argv) > 2 else None
    
    # Get all text elements
    elements = get_all_text_from_image(image_path)
    
    if search_text:
        # Search for specific text
        matches = find_text_in_elements(elements, search_text, partial_match=True)
        
        if matches:
            print(f"Found {len(matches)} text elements:")
            for i, match in enumerate(matches, 1):
                print(f"\n{i}. '{match['text']}'")
                print(f"   Confidence: {match['confidence']:.2f}")
                print(f"   Position: ({match['x']}, {match['y']})")
                print(f"   Size: {match['width']}x{match['height']}")
                print(f"   Center: ({match['center_x']}, {match['center_y']})")
        else:
            print(f"Found 0 text elements:")
    else:
        # Show all detected text in MCP server compatible format
        print(f"Found {len(elements)} text elements:")
        for i, element in enumerate(elements, 1):
            print(f"\n{i}. '{element['text']}'")
            print(f"   Confidence: {element['confidence']:.2f}")
            print(f"   Position: ({element['x']}, {element['y']})")
            print(f"   Size: {element['width']}x{element['height']}")
            print(f"   Center: ({element['center_x']}, {element['center_y']})")

if __name__ == "__main__":
    main()