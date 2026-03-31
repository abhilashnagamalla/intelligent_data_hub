import json

with open('data/datasets.json') as f:
    data = json.load(f)

for sector, value in list(data.items())[:2]:
    print(f'{sector}:')
    print(f'  Type: {type(value).__name__}')
    if isinstance(value, dict):
        print(f'  Keys: {list(value.keys())}')
    elif isinstance(value, list):
        print(f'  Length: {len(value)}')
        if value:
            item_id = value[0].get('id')
            print(f'  First item ID: {item_id}')
    print()
