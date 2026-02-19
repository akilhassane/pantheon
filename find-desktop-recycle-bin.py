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

# Look for desktop icons - they're usually ListItems on the left side
print("\nSearching for desktop icons (ListItems on left side)...")

desktop_icons = []
for elem in data['uiElements']['elements']:
    # Desktop icons are typically ListItems, on the left side (x < 150), in upper area
    if (elem['control_type_name'] == 'ListItem' and 
        elem['x'] < 150 and 
        elem['y'] < 600):
        desktop_icons.append(elem)

print(f"\nFound {len(desktop_icons)} desktop icons:")
for icon in desktop_icons:
    name = icon['name'] if icon['name'] else '[NO NAME]'
    print(f"  - {name} at ({icon['center_x']}, {icon['center_y']})")

# Find Recycle Bin specifically
recycle_bin = None
for icon in desktop_icons:
    if icon['name'] and 'recycle bin' in icon['name'].lower():
        recycle_bin = icon
        break

if recycle_bin:
    print(f"\n{'='*60}")
    print(f"✓ FOUND RECYCLE BIN: {recycle_bin['name']}")
    print('='*60)
    print(f"  Position: ({recycle_bin['x']}, {recycle_bin['y']})")
    print(f"  Center: ({recycle_bin['center_x']}, {recycle_bin['center_y']})")
    
    # Move mouse to it
    x = recycle_bin['center_x']
    y = recycle_bin['center_y']
    
    print(f"\nMoving mouse to Recycle Bin...")
    move_result = subprocess.run([
        'python',
        r'C:\MCP\mcp-server\docker\windows-tools-api\tools\mouse-move.py',
        '--x', str(x),
        '--y', str(y)
    ], capture_output=True, text=True)
    
    print(move_result.stdout)
    if move_result.returncode == 0:
        print(f"✓ Mouse successfully moved to Recycle Bin!")
    else:
        print(f"✗ Failed: {move_result.stderr}")
else:
    print("\n✗ Recycle Bin not found among desktop icons")
    print("\nTip: The desktop might be covered by windows. Try minimizing windows first.")
