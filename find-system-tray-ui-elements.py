import json

with open('taskbar-test.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# System tray area is at x=1393, y=898, width=207, height=48
tray_x = 1393
tray_y = 898
tray_width = 207
tray_height = 48

print('=' * 80)
print(f'SYSTEM TRAY AREA: ({tray_x}, {tray_y}) Size: {tray_width}x{tray_height}')
print('=' * 80)

# Find all UI elements in system tray area
tray_elements = []
for elem in data['uiElements']['elements']:
    # Check if element is within system tray bounds
    if (elem['x'] >= tray_x and 
        elem['x'] < tray_x + tray_width and
        elem['y'] >= tray_y and 
        elem['y'] < tray_y + tray_height):
        tray_elements.append(elem)

print(f'\nFound {len(tray_elements)} UI elements in system tray area:\n')

for i, elem in enumerate(tray_elements, 1):
    name = elem['name'] if elem['name'] else '[NO NAME]'
    print(f'{i}. [{elem["control_type_name"]}] "{name}"')
    print(f'   Position: ({elem["x"]}, {elem["y"]}) Size: {elem["width"]}x{elem["height"]}')
    print(f'   Center: ({elem["center_x"]}, {elem["center_y"]})')
    if elem.get('class_name'):
        print(f'   Class: {elem["class_name"]}')
    if elem.get('automation_id'):
        print(f'   AutomationId: {elem["automation_id"]}')
    print()

# Also check for Button elements near the system tray
print('=' * 80)
print('BUTTONS IN TASKBAR AREA (y >= 898)')
print('=' * 80)

buttons = []
for elem in data['uiElements']['elements']:
    if elem['control_type_name'] == 'Button' and elem['y'] >= 898:
        buttons.append(elem)

print(f'\nFound {len(buttons)} buttons in taskbar area:\n')
for i, btn in enumerate(buttons, 1):
    name = btn['name'] if btn['name'] else '[NO NAME]'
    print(f'{i}. "{name}" at ({btn["center_x"]}, {btn["center_y"]})')
