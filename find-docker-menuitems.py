import json

with open('taskbar-test.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Find Docker Desktop window bounds
docker_window = None
for window in data['windowsAPI']['windows']:
    if 'Docker' in window['name']:
        docker_window = window
        break

if not docker_window:
    print('Docker Desktop window not found!')
    exit(1)

print(f'Docker Desktop window: {docker_window["name"]}')
print(f'Position: ({docker_window["x"]}, {docker_window["y"]})')
print(f'Size: {docker_window["width"]}x{docker_window["height"]}\n')

# Find UI elements within Docker window
docker_elements = []
for elem in data['uiElements']['elements']:
    if (elem['x'] >= docker_window['x'] and 
        elem['x'] < docker_window['x'] + docker_window['width'] and
        elem['y'] >= docker_window['y'] and 
        elem['y'] < docker_window['y'] + docker_window['height']):
        docker_elements.append(elem)

print(f'Total UI elements in Docker window: {len(docker_elements)}\n')

# Find MenuItems
menu_items = [e for e in docker_elements if e['control_type_name'] == 'MenuItem']
print(f'MenuItem elements found: {len(menu_items)}\n')

# Show MenuItems with and without names
with_names = [m for m in menu_items if m['name']]
without_names = [m for m in menu_items if not m['name']]

print(f'MenuItems WITH names: {len(with_names)}')
for i, item in enumerate(with_names[:10]):
    print(f'  {i+1}. "{item["name"]}" at ({item["x"]}, {item["y"]})')

print(f'\nMenuItems WITHOUT names: {len(without_names)}')
for i, item in enumerate(without_names[:10]):
    print(f'  {i+1}. [NO NAME] at ({item["x"]}, {item["y"]}) - class: {item["class_name"]}')
