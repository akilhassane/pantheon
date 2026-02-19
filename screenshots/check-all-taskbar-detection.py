import json

with open('taskbar-test.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print('=' * 80)
print('CHECKING WINDOWS API TASKBAR DETECTION')
print('=' * 80)

windows_api = data['windowsAPI']
print(f"\nSummary from Windows API:")
print(f"  Total elements: {windows_api['summary']['total_elements']}")
print(f"  Taskbar icons count: {windows_api['summary']['taskbar_icons_count']}")
print(f"  Taskbar buttons: {windows_api['summary']['taskbar_buttons']}")

print(f"\n\nAll elements in windowsAPI['elements']:")
for i, elem in enumerate(windows_api['elements'], 1):
    print(f"{i}. {elem['type']}: {elem['name']}")
    print(f"   Position: ({elem['x']}, {elem['y']}) Center: ({elem['center_x']}, {elem['center_y']})")
    if elem.get('is_system_tray'):
        print(f"   ⭐ SYSTEM TRAY ICON")
    print()

print('=' * 80)
print('CHECKING FOR SYSTEM TRAY ICONS SPECIFICALLY')
print('=' * 80)

# Check taskbar_icons array
taskbar_icons = windows_api.get('taskbar_icons', [])
system_tray_icons = [icon for icon in taskbar_icons if icon.get('is_system_tray')]
print(f"\nSystem tray icons in taskbar_icons array: {len(system_tray_icons)}")
for icon in system_tray_icons:
    print(f"  - {icon['name']} at ({icon['center_x']}, {icon['center_y']})")

# Check if TrayNotifyWnd was found
print(f"\n\nLooking for TrayNotifyWnd in UI elements...")
for elem in data['uiElements']['elements']:
    if 'TrayNotify' in elem.get('class_name', ''):
        print(f"Found TrayNotifyWnd:")
        print(f"  Position: ({elem['x']}, {elem['y']})")
        print(f"  Size: {elem['width']}x{elem['height']}")
        print(f"  This is where system tray icons should be")
