import subprocess
import json

# Take screenshot
result = subprocess.run([
    'python',
    r'C:\MCP\mcp-server\docker\windows-tools-api\tools\screenshot.py',
    '--output', r'C:\MCP\mcp-server\now.png',
    '--json',
    '--no-ocr'
], capture_output=True, text=True)

data = json.loads(result.stdout)

print('=' * 80)
print('COMPLETE TASKBAR SCAN')
print('=' * 80)

# 1. Windows API detected taskbar buttons
print('\n1. WINDOWS API TASKBAR BUTTONS:')
taskbar_icons = data['windowsAPI']['taskbar_icons']
for icon in taskbar_icons:
    print(f'   - {icon["name"]} at ({icon["center_x"]}, {icon["center_y"]})')

# 2. Check for UI Automation elements in taskbar area (y >= 898)
print('\n2. UI AUTOMATION ELEMENTS IN TASKBAR (y >= 898):')
taskbar_ui = [e for e in data['uiElements']['elements'] if e['y'] >= 898]
print(f'   Found {len(taskbar_ui)} UI elements in taskbar area')

# Show buttons specifically
buttons = [e for e in taskbar_ui if e['control_type_name'] == 'Button']
print(f'\n   Buttons in taskbar area: {len(buttons)}')
for btn in buttons:
    name = btn['name'] if btn['name'] else '[NO NAME]'
    print(f'   - {name} at ({btn["center_x"]}, {btn["center_y"]})')

# 3. Check for any elements we might be missing
print('\n3. CHECKING FOR HIDDEN/OVERFLOW ICONS:')
print(f'   TrayNotifyWnd area: 1393-1600 (207px wide)')

# Look for any clickable elements in that range
tray_area = [e for e in data['uiElements']['elements'] 
             if e['x'] >= 1393 and e['x'] < 1600 and e['y'] >= 898]
print(f'   UI elements in system tray area: {len(tray_area)}')
for elem in tray_area:
    name = elem['name'] if elem['name'] else '[NO NAME]'
    print(f'   - [{elem["control_type_name"]}] {name}')

# 4. Look for pinned apps that might not be running
print('\n4. CHECKING TASKBAR CENTER AREA (for pinned apps):')
# Taskbar center is roughly x=600-1000
center_area = [e for e in data['uiElements']['elements']
               if e['x'] >= 600 and e['x'] <= 1000 and e['y'] >= 898 
               and e['control_type_name'] in ['Button', 'MenuItem']]
print(f'   Clickable elements in center: {len(center_area)}')
for elem in center_area:
    name = elem['name'] if elem['name'] else '[NO NAME]'
    print(f'   - {name} at ({elem["center_x"]}, {elem["center_y"]})')

print('\n' + '=' * 80)
print(f'TOTAL TASKBAR ELEMENTS DETECTED: {len(taskbar_icons)}')
print('=' * 80)
