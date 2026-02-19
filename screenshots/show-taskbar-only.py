import subprocess
import json

# Take screenshot
result = subprocess.run([
    'python',
    r'C:\MCP\mcp-server\docker\windows-tools-api\tools\screenshot.py',
    '--output', r'C:\MCP\mcp-server\now.png',
    '--json',
    '--no-ocr'
], capture_output=True, text=True)

data = json.loads(result.stdout)

print('=' * 80)
print('TASKBAR ELEMENTS')
print('=' * 80)

taskbar_icons = data['windowsAPI']['taskbar_icons']
print(f'\nTotal: {len(taskbar_icons)} taskbar elements\n')

for i, icon in enumerate(taskbar_icons, 1):
    print(f'{i}. {icon["name"]}')
    print(f'   Position: ({icon["center_x"]}, {icon["center_y"]})')
    print()
