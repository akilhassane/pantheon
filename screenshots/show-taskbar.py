import json

with open('enhanced-test.json', encoding='utf-8') as f:
    data = json.load(f)

taskbar = data['windowsAPI']['taskbar_icons']
print(f'Taskbar icons detected: {len(taskbar)}\n')

for i, icon in enumerate(taskbar):
    print(f'{i+1}. {icon["name"]} at ({icon["center_x"]}, {icon["center_y"]})')
    print(f'   Type: {icon.get("type", "Unknown")}')
    if icon.get('is_start_button'):
        print(f'   -> START BUTTON')
    elif icon.get('is_search'):
        print(f'   -> SEARCH BOX')
    elif icon.get('is_app_button'):
        print(f'   -> APP BUTTON')
    elif icon.get('is_notification'):
        print(f'   -> NOTIFICATION CENTER')
    print()
