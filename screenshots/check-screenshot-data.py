import json

# Load the correct data
with open('docker/windows-tools-api/tools/ui_elements.json', 'r') as f:
    data = json.load(f)

windowsAPI = data.get('windowsAPI', {})
elements = windowsAPI.get('elements', [])

print(f"Total elements: {len(elements)}")
print(f"\nFirst 5 elements:")
for i, el in enumerate(elements[:5]):
    print(f"{i+1}. {el.get('name', 'Unknown')}")
    print(f"   Type: {el.get('type', 'Unknown')}")
    print(f"   Position: ({el.get('x')}, {el.get('y')})")
    print(f"   Center: ({el.get('center_x')}, {el.get('center_y')})")
    print()

# Check taskbar buttons specifically
taskbar_buttons = [el for el in elements if el.get('type') in ['StartButton', 'SearchBox', 'AppButton', 'NotificationButton', 'SystemTrayIcon']]
print(f"\nTaskbar buttons: {len(taskbar_buttons)}")
for i, btn in enumerate(taskbar_buttons[:5]):
    print(f"{i+1}. {btn.get('name', 'Unknown')}")
    print(f"   Type: {btn.get('type')}")
    print(f"   Position: ({btn.get('x')}, {btn.get('y')})")
    print()
