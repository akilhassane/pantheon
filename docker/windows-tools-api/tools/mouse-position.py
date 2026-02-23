#!/usr/bin/env python3
"""
Windows Mouse Position Tool
Gets current mouse cursor position
"""

import sys
import json
import argparse

try:
    import pyautogui
    PYAUTOGUI_AVAILABLE = True
except ImportError:
    PYAUTOGUI_AVAILABLE = False

def get_mouse_position():
    """
    Get current mouse position
    
    Returns:
        dict: Result with coordinates
    """
    if not PYAUTOGUI_AVAILABLE:
        return {
            'success': False,
            'error': 'pyautogui not installed',
            'message': 'Failed to get mouse position: pyautogui not installed'
        }
    
    try:
        x, y = pyautogui.position()
        
        return {
            'success': True,
            'coordinates': {'x': x, 'y': y},
            'message': f'Mouse position: ({x}, {y})'
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'message': f'Failed to get mouse position: {str(e)}'
        }

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Get current mouse position')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    
    args = parser.parse_args()
    result = get_mouse_position()
    
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(result['message'])
    
    sys.exit(0 if result['success'] else 1)
