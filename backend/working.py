# works if the DATA API is provided in the website.
# To check   https://api.data.gov.in/resource/RESOURCE_ID?api-key=YOUR_API_KEY&format=json&limit=10
# ctrl+c or taskkill /f /im python.exe   to end a long running process.


import requests
import pandas as pd
import os

API_KEY = "579b464db66ec23bdd000001512ff0ae469e4783667632663591c20e"

resource_ids = [
"9ef84268-d588-465a-a308-a864a43d0070",
"35be999b-0208-4354-b557-f6ca9a5355de",
"98a33686-715f-4076-97da-fa3dcf6bc61b",
"3c79c5f7-7f1b-4b8c-9a16-7b3d8c5e6e7f",
"0a3f1f6b-5c6a-4b6a-bd6c-0b8e2e6d8a2b"
]

os.makedirs("datasets", exist_ok=True)

count = 0

for rid in resource_ids:

    url = f"https://api.data.gov.in/resource/{rid}"

    params = {
        "api-key": "579b464db66ec23bdd000001512ff0ae469e4783667632663591c20e",
        "format": "json",
        "limit": 1000
    }

    r = requests.get(url, params=params)
    data = r.json()

    records = data.get("records", [])

    if not records:
        print("No data for:", rid)
        continue

    df = pd.DataFrame(records)

    filename = f"datasets/agriculture__{count}.csv"
    df.to_csv(filename, index=False)

    print("Saved:", filename, "Shape:", df.shape)

    count += 1

print("Total valid datasets:", count)