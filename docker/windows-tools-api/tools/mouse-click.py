#!/usr/bin/env python3
"""
Windows Mouse Click Tool
Provides precise mouse click functionality with human-like movement
"""

import sys
import time
import json
import argparse
import random
import math

try:
    import pyautogui
    PYAUTOGUI_AVAILABLE = True
except ImportError:
    PYAUTOGUI_AVAILABLE = False

def human_curve_path(start_x, start_y, end_x, end_y, num_points=20):
    """
    Generate a human-like curved path using Bezier curves with random control points
    
    Args:
        start_x, start_y: Starting coordinates
        end_x, end_y: Ending coordinates
        num_points: Number of points along the curve
    
    Returns:
        List of (x, y) tuples representing the path
    """
    # Calculate distance for curve intensity
    distance = math.sqrt((end_x - start_x)**2 + (end_y - start_y)**2)
    
    # Control point offset (5-15% of distance, randomized)
    offset_factor = random.uniform(0.05, 0.15)
    max_offset = distance * offset_factor
    
    # Generate 2 random control points for a cubic Bezier curve
    # Control points are offset perpendicular to the direct line
    mid_x = (start_x + end_x) / 2
    mid_y = (start_y + end_y) / 2
    
    # Calculate perpendicular direction
    dx = end_x - start_x
    dy = end_y - start_y
    
    # Perpendicular vector (rotated 90 degrees)
    perp_x = -dy
    perp_y = dx
    
    # Normalize
    length = math.sqrt(perp_x**2 + perp_y**2)
    if length > 0:
        perp_x /= length
        perp_y /= length
    
    # Random offsets for control points
    offset1 = random.uniform(-max_offset, max_offset)
    offset2 = random.uniform(-max_offset, max_offset)
    
    # Control points positioned along the path with perpendicular offset
    ctrl1_x = start_x + dx * 0.33 + perp_x * offset1
    ctrl1_y = start_y + dy * 0.33 + perp_y * offset1
    
    ctrl2_x = start_x + dx * 0.66 + perp_x * offset2
    ctrl2_y = start_y + dy * 0.66 + perp_y * offset2
    
    # Generate points along the cubic Bezier curve
    points = []
    for i in range(num_points + 1):
        t = i / num_points
        
        # Cubic Bezier formula
        x = (1-t)**3 * start_x + \
            3 * (1-t)**2 * t * ctrl1_x + \
            3 * (1-t) * t**2 * ctrl2_x + \
            t**3 * end_x
        
        y = (1-t)**3 * start_y + \
            3 * (1-t)**2 * t * ctrl1_y + \
            3 * (1-t) * t**2 * ctrl2_y + \
            t**3 * end_y
        
        points.append((int(x), int(y)))
    
    return points

def click_at(x, y, button='left', double=False):
    """
    Click at specific coordinates with human-like movement
    
    Args:
        x (int): X coordinate
        y (int): Y coordinate
        button (str): Mouse button ('left', 'right', 'middle')
        double (bool): Whether to perform double-click
    
    Returns:
        dict: Result with success status and details
    """
    if not PYAUTOGUI_AVAILABLE:
        return {
            'success': False,
            'error': 'pyautogui not installed',
            'message': 'Failed to click: pyautogui not installed'
        }
    
    try:
        # Get current mouse position
        start_x, start_y = pyautogui.position()
        
        # Generate human-like curved path
        path = human_curve_path(start_x, start_y, x, y)
        
        # Calculate total duration (0.3 seconds)
        total_duration = 0.3
        point_duration = total_duration / len(path)
        
        # Move along the curved path
        for point_x, point_y in path:
            pyautogui.moveTo(point_x, point_y, duration=point_duration)
        
        # Ensure we end exactly at the target
        pyautogui.moveTo(x, y, duration=0)
        time.sleep(0.05)
        
        # Perform click(s)
        if double:
            pyautogui.doubleClick(x, y, button=button)
        else:
            pyautogui.click(x, y, button=button)
        
        return {
            'success': True,
            'coordinates': {'x': x, 'y': y},
            'button': button,
            'double_click': double,
            'message': f'Successfully clicked {button} button at ({x}, {y}) with human-like movement'
        }
        
    except Exception as e:
        return {
            'success': False,
            'coordinates': {'x': x, 'y': y},
            'button': button,
            'error': str(e),
            'message': f'Failed to click: {str(e)}'
        }

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Click mouse at coordinates')
    parser.add_argument('--x', type=int, required=True, help='X coordinate')
    parser.add_argument('--y', type=int, required=True, help='Y coordinate')
    parser.add_argument('--button', default='left', choices=['left', 'right', 'middle'], help='Mouse button')
    parser.add_argument('--double', action='store_true', help='Perform double-click')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    
    args = parser.parse_args()
    result = click_at(args.x, args.y, args.button, args.double)
    
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(result['message'])
    
    sys.exit(0 if result['success'] else 1)
