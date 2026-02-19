import json

with open('taskbar-test.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

screen_height = data['size']['height']
taskbar_area_start = screen_height - 100  # Look at bottom 100 pixels

print('=' * 80)
print(f'ALL ELEMENTS IN BOTTOM AREA (y >= {taskbar_area_start})')
print('=' * 80)
print(f'Screen height: {screen_height}')
print(f'Searching from y={taskbar_area_start} to y={screen_height}\n')

bottom_elements = []
for elem in data['uiElements']['elements']:
    if elem['y'] >= taskbar_area_start:
        bottom_elements.append(elem)

print(f'Found {len(bottom_elements)} UI elements in bottom area\n')

# Group by control type
by_type = {}
for elem in bottom_elements:
    elem_type = elem['control_type_name']
    if elem_type not in by_type:
        by_type[elem_type] = []
    by_type[elem_type].append(elem)

print('Breakdown by type:')
for elem_type, elements in sorted(by_type.items(), key=lambda x: -len(x[1])):
    print(f'  {elem_type}: {len(elements)}')

print('\n' + '=' * 80)
print('DETAILED LIST OF ALL BOTTOM ELEMENTS')
print('=' * 80 + '\n')

for i, elem in enumerate(sorted(bottom_elements, key=lambda e: (e['y'], e['x'])), 1):
    name = elem['name'] if elem['name'] else '[NO NAME]'
    print(f'{i}. [{elem["control_type_name"]}] "{name}"')
    print(f'   Position: ({elem["x"]}, {elem["y"]}) Size: {elem["width"]}x{elem["height"]}')
    print(f'   Center: ({elem["center_x"]}, {elem["center_y"]})')
    if elem.get('class_name'):
        print(f'   Class: {elem["class_name"][:80]}')
    if elem.get('automation_id'):
        print(f'   AutomationId: {elem["automation_id"]}')
    print()
