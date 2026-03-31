import requests

for nid in range(603900000, 603900050):

    url = f"https://www.data.gov.in/backend/dms/v1/ogdp/node/{nid}?_format=json"

    r = requests.get(url)

    if r.status_code == 200:
        data = r.json()

        if data.get("type")[0]["target_id"] == "resources":
            print("Dataset found:", nid)