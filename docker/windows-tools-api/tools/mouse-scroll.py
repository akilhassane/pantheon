import pyautogui
import argparse
import json
import sys
import random
import math

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

def scroll(direction, clicks=3, x=None, y=None):
    """
    Scroll the mouse wheel with human-like movement to position.
    
    Args:
        direction: 'up' or 'down'
        clicks: Number of scroll clicks (default: 3)
        x, y: Optional position to move mouse to before scrolling
    """
    try:
        # Move mouse to position if specified with human-like curve
        if x is not None and y is not None:
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
        
        # Scroll up (positive) or down (negative)
        scroll_amount = clicks if direction == 'up' else -clicks
        pyautogui.scroll(scroll_amount)
        
        return {
            "success": True,
            "direction": direction,
            "clicks": clicks,
            "position": {"x": x, "y": y} if x is not None and y is not None else None,
            "message": f"Scrolled {direction} {clicks} clicks" + (f" at ({x}, {y}) with human-like movement" if x is not None and y is not None else "")
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Scroll mouse wheel up or down')
    parser.add_argument('direction', choices=['up', 'down'], help='Scroll direction')
    parser.add_argument('--clicks', type=int, default=3, help='Number of scroll clicks (default: 3)')
    parser.add_argument('--x', type=int, help='X coordinate to move mouse to before scrolling')
    parser.add_argument('--y', type=int, help='Y coordinate to move mouse to before scrolling')
    parser.add_argument('--json', action='store_true', help='Output result as JSON')
    
    args = parser.parse_args()
    
    result = scroll(args.direction, args.clicks, args.x, args.y)
    
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        if result["success"]:
            print(result["message"])
            if result["position"]:
                print(f"At position: ({result['position']['x']}, {result['position']['y']})")
        else:
            print(f"Error: {result['error']}", file=sys.stderr)
            sys.exit(1)
