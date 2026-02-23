#!/usr/bin/env python3
"""
Windows Keyboard Press Tool
Presses keyboard keys and key combinations using pyautogui
"""

import sys
import json
import argparse

try:
    import pyautogui
    PYAUTOGUI_AVAILABLE = True
except ImportError:
    PYAUTOGUI_AVAILABLE = False

def press_key(key):
    """
    Press a keyboard key or key combination
    
    Args:
        key (str): Key to press (e.g., 'enter', 'ctrl+c', 'alt+tab')
    
    Returns:
        dict: Result with success status
    """
    if not PYAUTOGUI_AVAILABLE:
        return {
            'success': False,
            'error': 'pyautogui not installed',
            'message': 'Failed to press key: pyautogui not installed'
        }
    
    try:
        # Handle key combinations (e.g., 'ctrl+c')
        if '+' in key:
            keys = key.split('+')
            pyautogui.hotkey(*keys)
        else:
            pyautogui.press(key)
        
        return {
            'success': True,
            'key': key,
            'message': f'Successfully pressed key: {key}'
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'message': f'Failed to press key: {str(e)}'
        }

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Press keyboard key or combination')
    parser.add_argument('key', help='Key to press (e.g., enter, ctrl+c, alt+tab)')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    
    args = parser.parse_args()
    result = press_key(args.key)
    
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(result['message'])
    
    sys.exit(0 if result['success'] else 1)
