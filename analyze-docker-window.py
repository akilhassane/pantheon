import json

with open('C:/MCP/mcp-server/docker-now.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Find Docker Desktop window
docker_windows = [w for w in data['windowsAPI']['windows'] if 'Docker' in w['name']]
if docker_windows:
    docker_window = docker_windows[0]
    print(f"Docker window: x={docker_window['x']}, y={docker_window['y']}, width={docker_window['width']}, height={docker_window['height']}")
    print(f"Name: {docker_window['name']}")
    
    # Find UI elements within Docker window bounds
    docker_elements = []
    for elem in data['uiElements']['elements']:
        if (elem['x'] >= docker_window['x'] and 
            elem['x'] < docker_window['x'] + docker_window['width'] and
            elem['y'] >= docker_window['y'] and 
            elem['y'] < docker_window['y'] + docker_window['height']):
            docker_elements.append(elem)
    
    print(f"\nFound {len(docker_elements)} UI elements in Docker window")
    
    # Find MenuItem elements
    menu_items = [e for e in docker_elements if e['control_type_name'] == 'MenuItem']
    print(f"Found {len(menu_items)} MenuItem elements")
    
    # Show first 20 MenuItems
    for i, item in enumerate(menu_items[:20]):
        print(f"\n{i+1}. MenuItem at ({item['x']}, {item['y']})")
        print(f"   Name: '{item['name']}'")
        print(f"   Class: '{item['class_name']}'")
        print(f"   AutomationId: '{item['automation_id']}'")
