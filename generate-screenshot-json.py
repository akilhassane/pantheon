import subprocess
import json

# Run screenshot script and capture output
result = subprocess.run([
    'python',
    r'C:\MCP\mcp-server\docker\windows-tools-api\tools\screenshot.py',
    '--output', r'C:\MCP\mcp-server\test-taskbar.png',
    '--json',
    '--no-ocr'
], capture_output=True, text=True)

# Parse JSON output
data = json.loads(result.stdout)

# Save to file
with open('taskbar-test.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print('Screenshot data saved to taskbar-test.json')

# Show taskbar info
taskbar = data['windowsAPI']['taskbar_icons']
print(f'\nTaskbar icons detected: {len(taskbar)}\n')

for i, icon in enumerate(taskbar):
    print(f'{i+1}. {icon["name"]} at ({icon["center_x"]}, {icon["center_y"]})')
    if icon.get('is_start_button'):
        print(f'   -> START BUTTON')
    elif icon.get('is_search'):
        print(f'   -> SEARCH BOX')
    elif icon.get('is_app_button'):
        print(f'   -> APP BUTTON: {icon.get("window_title", "")}')
    elif icon.get('is_notification'):
        print(f'   -> NOTIFICATION CENTER')
    print()
