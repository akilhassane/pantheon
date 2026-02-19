import json

with open('taskbar-test.json', 'r') as f:
    data = json.load(f)

buttons = data['windowsAPI']['taskbarButtons']
print(f'Total taskbar buttons: {len(buttons)}')
print('\nTaskbar elements:')
for btn in buttons:
    print(f"  - {btn['name']} ({btn['type']})")
