import requests

r = requests.get('http://127.0.0.1:8000/datasets/finance')
print('status', r.status_code)
js = r.json()
print('count', len(js.get('datasets', [])))
print(js.get('datasets', [])[:10])
