#!/usr/bin/env python3
"""
Windows Keyboard Type Tool
Types text using pyautogui
"""

import sys
import json
import argparse

try:
    import pyautogui
    PYAUTOGUI_AVAILABLE = True
except ImportError:
    PYAUTOGUI_AVAILABLE = False

def type_text(text, interval=0.05):
    """
    Type text using keyboard
    
    Args:
        text (str): Text to type
        interval (float): Interval between keystrokes in seconds
    
    Returns:
        dict: Result with success status
    """
    if not PYAUTOGUI_AVAILABLE:
        return {
            'success': False,
            'error': 'pyautogui not installed',
            'message': 'Failed to type text: pyautogui not installed'
        }
    
    try:
        pyautogui.write(text, interval=interval)
        
        return {
            'success': True,
            'text': text,
            'length': len(text),
            'message': f'Successfully typed {len(text)} characters'
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'message': f'Failed to type text: {str(e)}'
        }

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Type text using keyboard')
    parser.add_argument('text', help='Text to type')
    parser.add_argument('--interval', type=float, default=0.05, help='Interval between keystrokes')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    
    args = parser.parse_args()
    result = type_text(args.text, args.interval)
    
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(result['message'])
    
    sys.exit(0 if result['success'] else 1)
