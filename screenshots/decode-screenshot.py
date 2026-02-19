import json
import base64

with open('screenshot-output.json', 'r') as f:
    data = json.load(f)

with open('current-screenshot.png', 'wb') as f:
    f.write(base64.b64decode(data['screenshot']))

print(f"Screenshot saved: {data['size']['width']}x{data['size']['height']}")
print(f"Mouse position: ({data['mousePosition']['x']}, {data['mousePosition']['y']})")
