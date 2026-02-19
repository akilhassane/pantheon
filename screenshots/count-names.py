import sys
import json

data = json.load(sys.stdin)
elements = data['uiElements']['elements']
empty = [e for e in elements if not e['name']]
with_names = [e for e in elements if e['name']]

print(f'Total elements: {len(elements)}')
print(f'Elements with NO name: {len(empty)}')
print(f'Elements WITH names: {len(with_names)}')
print(f'\nPercentage with names: {len(with_names)/len(elements)*100:.1f}%')

# Show some examples of elements that now have names
print(f'\nFirst 10 elements with names:')
for i, e in enumerate(with_names[:10]):
    print(f'{i+1}. [{e["control_type_name"]}] "{e["name"]}" at ({e["x"]}, {e["y"]})')
