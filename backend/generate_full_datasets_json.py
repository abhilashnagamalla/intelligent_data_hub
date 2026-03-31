import json
from pathlib import Path
from datetime import datetime, timedelta
import random

def generate_full_datasets_json():
    base_path = Path(__file__).parent
    data_path = base_path.parent / "data"
    data_path.mkdir(exist_ok=True)
    
    # Predefined sectors and categories
    sectors = {
        "Health": {
            "categories": ["COVID-19", "Hospital", "Immunization", "Disease", "Health Infrastructure"],
            "count": 400
        },
        "Education": {
            "categories": ["Schools", "Students", "Curriculum", "Performance", "Enrollment"],
            "count": 400
        },
        "Transport": {
            "categories": ["Roads", "Traffic", "Public Transit", "Railways", "Aviation"],
            "count": 400
        },
        "Finance": {
            "categories": ["Budget", "Investment", "Banking", "Taxes", "Insurance"],
            "count": 400
        },
        "Census": {
            "categories": ["Population", "Demographics", "Housing", "Employment", "Social"],
            "count": 400
        },
        "Agriculture": {
            "categories": ["Crops", "Livestock", "Markets", "Irrigation", "Soil"],
            "count": 57  # We have 2 actual CSV files
        }
    }
    
    states = [
        "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
        "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
        "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
        "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
        "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
        "Andaman and Nicobar Islands", "Chandigarh", "Delhi", "Puducherry"
    ]
    
    datasets = {}
    
    base_date = datetime(2024, 1, 1)
    
    for sector, config in sectors.items():
        sector_datasets = []
        count = config["count"]
        categories = config["categories"]
        
        for i in range(1, count + 1):
            dataset_id = f"{sector.lower()}_{i:04d}"
            filename = f"{i:03d}_{sector}_{random.choice(categories)}_{dataset_id[-8:]}.csv"
            category = random.choice(categories)
            state = random.choice(states)
            
            # Generate realistic stats
            views = random.randint(100, 50000)
            downloads = random.randint(10, views // 2)
            records = random.randint(100, 100000)
            columns = random.randint(5, 50)
            
            # Updated and published dates
            updated_days_ago = random.randint(0, 365)
            published_days_ago = random.randint(updated_days_ago, updated_days_ago + 365)
            updated_date = (base_date + timedelta(days=365-updated_days_ago)).strftime("%Y-%m-%d")
            published_date = (base_date + timedelta(days=365-published_days_ago)).strftime("%Y-%m-%d")
            
            dataset = {
                "id": dataset_id,
                "filename": filename,
                "title": f"{category} Data - {state} ({i})",
                "sector": sector,
                "state": state,
                "organization": "Government of India",
                "description": f"{sector} dataset from {state} containing {records} records with {columns} columns. Category: {category}",
                "datasetCount": records,
                "apiCount": random.randint(0, 5),
                "views": views,
                "downloads": downloads,
                "updatedDate": updated_date,
                "publishedDate": published_date,
                "category": category
            }
            
            sector_datasets.append(dataset)
        
        datasets[sector] = sector_datasets
        print(f"✅ Generated {len(sector_datasets)} datasets for {sector}")
    
    # Write to data/datasets.json
    output_file = data_path / "datasets.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(datasets, f, indent=2, ensure_ascii=False)
    
    total = sum(len(v) for v in datasets.values())
    print(f"\n✅ Generated {output_file} with {total} datasets across {len(datasets)} sectors")
    
    # Print summary
    for sector, dsets in datasets.items():
        print(f"  - {sector}: {len(dsets)} datasets")

if __name__ == "__main__":
    generate_full_datasets_json()
