import json

with open('taskbar-test.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print('=' * 80)
print('TASKBAR ELEMENTS FROM WINDOWS API')
print('=' * 80)

taskbar = data['windowsAPI']['taskbar_icons']
print(f'\nTotal taskbar icons: {len(taskbar)}\n')

for i, icon in enumerate(taskbar, 1):
    print(f'{i}. NAME: "{icon["name"]}"')
    print(f'   Type: {icon.get("type", "Unknown")}')
    print(f'   Position: ({icon["x"]}, {icon["y"]})')
    print(f'   Size: {icon["width"]}x{icon["height"]}')
    print(f'   Center: ({icon["center_x"]}, {icon["center_y"]})')
    
    if icon.get('is_start_button'):
        print(f'   🔵 START BUTTON')
    elif icon.get('is_search'):
        print(f'   🔍 SEARCH BOX')
    elif icon.get('is_app_button'):
        print(f'   📱 APP BUTTON')
        print(f'   Window: {icon.get("window_title", "N/A")}')
    elif icon.get('is_notification'):
        print(f'   🔔 NOTIFICATION CENTER')
    elif icon.get('is_system_tray'):
        print(f'   🔧 SYSTEM TRAY ICON')
    
    print()

print('=' * 80)
print('TASKBAR UI AUTOMATION ELEMENTS')
print('=' * 80)

# Find taskbar pane
taskbar_pane = None
for elem in data['uiElements']['elements']:
    if elem.get('name') == 'Taskbar' and elem.get('class_name') == 'Shell_TrayWnd':
        taskbar_pane = elem
        break

if taskbar_pane:
    print(f'\nTaskbar Pane found:')
    print(f'  Position: ({taskbar_pane["x"]}, {taskbar_pane["y"]})')
    print(f'  Size: {taskbar_pane["width"]}x{taskbar_pane["height"]}')
    
    # Find all UI elements within taskbar bounds
    taskbar_ui_elements = []
    for elem in data['uiElements']['elements']:
        if (elem['y'] >= taskbar_pane['y'] and 
            elem['y'] < taskbar_pane['y'] + taskbar_pane['height']):
            taskbar_ui_elements.append(elem)
    
    print(f'\nUI Automation elements in taskbar area: {len(taskbar_ui_elements)}')
    
    # Group by type
    by_type = {}
    for elem in taskbar_ui_elements:
        elem_type = elem['control_type_name']
        if elem_type not in by_type:
            by_type[elem_type] = []
        by_type[elem_type].append(elem)
    
    print(f'\nBreakdown by type:')
    for elem_type, elements in sorted(by_type.items()):
        print(f'  {elem_type}: {len(elements)}')
    
    print(f'\nDetailed list of taskbar UI elements:')
    for i, elem in enumerate(taskbar_ui_elements, 1):
        name = elem['name'] if elem['name'] else '[NO NAME]'
        print(f'{i}. [{elem["control_type_name"]}] "{name}"')
        print(f'   Position: ({elem["x"]}, {elem["y"]}) Size: {elem["width"]}x{elem["height"]}')
        if elem.get('class_name'):
            print(f'   Class: {elem["class_name"]}')
        if elem.get('automation_id'):
            print(f'   AutomationId: {elem["automation_id"]}')
        print()
else:
    print('\nTaskbar pane not found in UI Automation elements')
