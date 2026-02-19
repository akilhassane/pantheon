import subprocess
import json

# Take screenshot with full UI element detection
result = subprocess.run([
    'python',
    r'C:\MCP\mcp-server\docker\windows-tools-api\tools\screenshot.py',
    '--output', r'C:\MCP\mcp-server\complete.png',
    '--json',
    '--no-ocr'
], capture_output=True, text=True)

data = json.loads(result.stdout)

print('=' * 80)
print('ALL SCREEN ELEMENTS DETECTED')
print('=' * 80)

elements = data['uiElements']['elements']
print(f'\nTotal UI elements detected: {len(elements)}')

# Group by control type
by_type = {}
for elem in elements:
    elem_type = elem['control_type_name']
    if elem_type not in by_type:
        by_type[elem_type] = []
    by_type[elem_type].append(elem)

print(f'\nBreakdown by type:')
for elem_type, items in sorted(by_type.items(), key=lambda x: -len(x[1])):
    with_names = len([e for e in items if e['name']])
    print(f'  {elem_type:20s}: {len(items):4d} total, {with_names:4d} with names')

# Show elements with names by area
print('\n' + '=' * 80)
print('ELEMENTS WITH NAMES (by screen area)')
print('=' * 80)

named_elements = [e for e in elements if e['name']]
print(f'\nTotal elements with names: {len(named_elements)}')

# Group by Y position (screen areas)
areas = {
    'Top (0-100)': [e for e in named_elements if e['y'] < 100],
    'Upper (100-300)': [e for e in named_elements if 100 <= e['y'] < 300],
    'Middle (300-600)': [e for e in named_elements if 300 <= e['y'] < 600],
    'Lower (600-800)': [e for e in named_elements if 600 <= e['y'] < 800],
    'Bottom (800-900)': [e for e in named_elements if e['y'] >= 800]
}

for area_name, area_elements in areas.items():
    if area_elements:
        print(f'\n{area_name}: {len(area_elements)} elements')
        # Show first 10 from each area
        for elem in sorted(area_elements, key=lambda e: (e['y'], e['x']))[:10]:
            print(f'  [{elem["control_type_name"]:12s}] "{elem["name"][:60]}" at ({elem["x"]}, {elem["y"]})')
        if len(area_elements) > 10:
            print(f'  ... and {len(area_elements) - 10} more')

# Show interactive elements (Buttons, MenuItems, Hyperlinks)
print('\n' + '=' * 80)
print('INTERACTIVE ELEMENTS')
print('=' * 80)

interactive_types = ['Button', 'MenuItem', 'Hyperlink', 'CheckBox', 'RadioButton']
interactive = [e for e in named_elements if e['control_type_name'] in interactive_types]
print(f'\nTotal interactive elements with names: {len(interactive)}')

for elem_type in interactive_types:
    type_elements = [e for e in interactive if e['control_type_name'] == elem_type]
    if type_elements:
        print(f'\n{elem_type}s: {len(type_elements)}')
        for elem in type_elements[:5]:
            print(f'  "{elem["name"][:50]}" at ({elem["center_x"]}, {elem["center_y"]})')
        if len(type_elements) > 5:
            print(f'  ... and {len(type_elements) - 5} more')

print('\n' + '=' * 80)
print(f'SUMMARY: {len(elements)} total elements, {len(named_elements)} with names')
print('=' * 80)
