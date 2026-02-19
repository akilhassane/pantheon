import subprocess
import json

# Take screenshot
print("Taking screenshot...")
result = subprocess.run([
    'python',
    r'C:\MCP\mcp-server\docker\windows-tools-api\tools\screenshot.py',
    '--output', r'C:\MCP\mcp-server\current-screen.png',
    '--json',
    '--no-ocr'
], capture_output=True, text=True)

data = json.loads(result.stdout)

print(f"\nTotal elements detected: {len(data['uiElements']['elements'])}")

# Search for Recycle Bin
print("\nSearching for Recycle Bin...")
recycle_bin = None

for elem in data['uiElements']['elements']:
    name = elem.get('name', '').lower()
    # More specific search - must contain "recycle bin" together
    if 'recycle bin' in name:
        recycle_bin = elem
        print(f"\n✓ FOUND: {elem['name']}")
        print(f"  Type: {elem['control_type_name']}")
        print(f"  Position: ({elem['x']}, {elem['y']})")
        print(f"  Size: {elem['width']}x{elem['height']}")
        print(f"  Center: ({elem['center_x']}, {elem['center_y']})")
        break

if not recycle_bin:
    print("\n✗ Recycle Bin not found in UI elements")
    print("\nSearching for desktop icons...")
    
    # Look for ListItem elements on desktop (left side, top area)
    desktop_items = [e for e in data['uiElements']['elements'] 
                     if e['control_type_name'] in ['ListItem', 'Button', 'Custom']
                     and e['x'] < 200 and e['y'] < 400]
    
    if desktop_items:
        print(f"\nFound {len(desktop_items)} potential desktop icons:")
        for item in desktop_items[:10]:
            name = item['name'] if item['name'] else '[NO NAME]'
            print(f"  - [{item['control_type_name']}] {name} at ({item['center_x']}, {item['center_y']})")
    else:
        print("\nNo desktop icons detected")

# Now move mouse to Recycle Bin if found
if recycle_bin:
    print(f"\n{'='*60}")
    print("MOVING MOUSE TO RECYCLE BIN")
    print('='*60)
    
    x = recycle_bin['center_x']
    y = recycle_bin['center_y']
    
    print(f"\nExecuting: python mouse-move.py --x {x} --y {y}")
    
    move_result = subprocess.run([
        'python',
        r'C:\MCP\mcp-server\docker\windows-tools-api\tools\mouse-move.py',
        '--x', str(x),
        '--y', str(y)
    ], capture_output=True, text=True)
    
    print(move_result.stdout)
    if move_result.returncode == 0:
        print(f"✓ Mouse moved to Recycle Bin at ({x}, {y})")
    else:
        print(f"✗ Failed to move mouse: {move_result.stderr}")
