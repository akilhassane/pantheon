import subprocess
import json

# Take screenshot
print("Taking screenshot...")
result = subprocess.run([
    'python',
    r'C:\MCP\mcp-server\docker\windows-tools-api\tools\screenshot.py',
    '--output', r'C:\MCP\mcp-server\docker-screen.png',
    '--json',
    '--no-ocr'
], capture_output=True, text=True)

data = json.loads(result.stdout)

print(f"\nTotal elements detected: {len(data['uiElements']['elements'])}")

# Find Docker Desktop window
docker_window = None
for window in data['windowsAPI']['windows']:
    if 'Docker' in window['name']:
        docker_window = window
        break

if not docker_window:
    print("\n✗ Docker Desktop window not found!")
    exit(1)

print(f"\n✓ Docker Desktop window found: {docker_window['name']}")
print(f"  Position: ({docker_window['x']}, {docker_window['y']})")
print(f"  Size: {docker_window['width']}x{docker_window['height']}")

# Find all elements in Docker window
docker_elements = [e for e in data['uiElements']['elements']
                   if (e['x'] >= docker_window['x'] and 
                       e['x'] < docker_window['x'] + docker_window['width'] and
                       e['y'] >= docker_window['y'] and 
                       e['y'] < docker_window['y'] + docker_window['height'])]

print(f"\nTotal elements in Docker window: {len(docker_elements)}")

# Search for Extensions button
print("\nSearching for 'Extensions' button...")
extensions_buttons = []

for elem in docker_elements:
    name = elem.get('name', '').lower()
    if 'extension' in name:
        extensions_buttons.append(elem)
        print(f"\n✓ FOUND: {elem['name']}")
        print(f"  Type: {elem['control_type_name']}")
        print(f"  Position: ({elem['x']}, {elem['y']})")
        print(f"  Center: ({elem['center_x']}, {elem['center_y']})")
        print(f"  Size: {elem['width']}x{elem['height']}")

if not extensions_buttons:
    print("\n✗ Extensions button not found by name")
    print("\nSearching in left navigation (MenuItems at x < 100)...")
    
    nav_items = [e for e in docker_elements 
                 if e['control_type_name'] in ['MenuItem', 'Button', 'ListItem']
                 and e['x'] < 100]
    
    print(f"\nFound {len(nav_items)} navigation items:")
    for i, item in enumerate(nav_items, 1):
        name = item['name'] if item['name'] else '[NO NAME]'
        print(f"{i:2d}. [{item['control_type_name']:10s}] {name} at ({item['center_x']}, {item['center_y']})")

# If found, move mouse to it
if extensions_buttons:
    target = extensions_buttons[0]
    x = target['center_x']
    y = target['center_y']
    
    print(f"\n{'='*60}")
    print(f"Moving mouse to Extensions button...")
    print('='*60)
    
    move_result = subprocess.run([
        'python',
        r'C:\MCP\mcp-server\docker\windows-tools-api\tools\mouse-move.py',
        '--x', str(x),
        '--y', str(y)
    ], capture_output=True, text=True)
    
    print(move_result.stdout)
    if move_result.returncode == 0:
        print(f"✓ Mouse moved to Extensions button!")
