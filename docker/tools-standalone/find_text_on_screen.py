#!/usr/bin/env python3
"""
Find Text on Screen Tool
Uses OCR to search for specific text on the screen
"""

import json
import sys
import argparse
from PIL import ImageGrab
import pytesseract

def find_text_on_screen(search_text, partial_match=True, case_sensitive=False):
    """
    Find text on screen using OCR
    
    Args:
        search_text (str): Text to search for
        partial_match (bool): Allow partial matches
        case_sensitive (bool): Case-sensitive search
        
    Returns:
        dict: Result with found status, matches, and OCR text
    """
    try:
        # Capture screenshot
        screenshot = ImageGrab.grab()
        
        # Perform OCR with detailed data
        ocr_data = pytesseract.image_to_data(screenshot, output_type=pytesseract.Output.DICT)
        
        # Extract all text for context
        all_text = ' '.join([text for text in ocr_data['text'] if text.strip()])
        
        # Search for matches
        matches = []
        n_boxes = len(ocr_data['text'])
        
        # Prepare search text
        search_lower = search_text.lower() if not case_sensitive else search_text
        
        for i in range(n_boxes):
            text = ocr_data['text'][i]
            if not text.strip():
                continue
            
            # Prepare comparison text
            compare_text = text.lower() if not case_sensitive else text
            
            # Check for match
            found = False
            if partial_match:
                found = search_lower in compare_text
            else:
                found = search_lower == compare_text
            
            if found:
                # Get bounding box
                x = ocr_data['left'][i]
                y = ocr_data['top'][i]
                w = ocr_data['width'][i]
                h = ocr_data['height'][i]
                conf = float(ocr_data['conf'][i]) / 100.0  # Convert to 0-1 range
                
                matches.append({
                    'text': text,
                    'confidence': round(conf, 2),
                    'position': {
                        'x': x,
                        'y': y,
                        'width': w,
                        'height': h
                    }
                })
        
        return {
            'success': True,
            'found': len(matches) > 0,
            'text': search_text,
            'matches': matches,
            'match_count': len(matches),
            'ocr_text': all_text[:500] + ('...' if len(all_text) > 500 else ''),  # Truncate for readability
            'screen_size': {
                'width': screenshot.width,
                'height': screenshot.height
            }
        }
        
    except Exception as e:
        return {
            'success': False,
            'found': False,
            'text': search_text,
            'matches': [],
            'match_count': 0,
            'error': str(e)
        }

def main():
    parser = argparse.ArgumentParser(description='Find text on screen using OCR')
    parser.add_argument('--text', type=str, required=True, help='Text to search for')
    parser.add_argument('--partial_match', '--partial-match', action='store_true', default=True, help='Allow partial matches')
    parser.add_argument('--case_sensitive', '--case-sensitive', action='store_true', help='Case-sensitive search')
    parser.add_argument('--json', action='store_true', help='Output in JSON format')
    
    args = parser.parse_args()
    
    # Find text on screen
    result = find_text_on_screen(
        args.text,
        partial_match=args.partial_match,
        case_sensitive=args.case_sensitive
    )
    
    # Output result
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        if result['success']:
            if result['found']:
                print(f"Found {result['match_count']} match(es) for '{result['text']}':")
                for i, match in enumerate(result['matches'], 1):
                    pos = match['position']
                    print(f"  {i}. '{match['text']}' at ({pos['x']}, {pos['y']}) - confidence: {match['confidence']}")
            else:
                print(f"Text '{result['text']}' not found on screen")
        else:
            print(f"Error: {result.get('error', 'Unknown error')}", file=sys.stderr)
            sys.exit(1)

if __name__ == '__main__':
    main()
