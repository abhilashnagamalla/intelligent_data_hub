import os
import json
import pandas as pd
from pathlib import Path

def generate_datasets_json():
    base_path = Path(__file__).parent
    agriculture_path = base_path / "agriculture_datasets"
    data_path = base_path.parent / "data"
    data_path.mkdir(exist_ok=True)
    
    datasets = {}
    
    if agriculture_path.exists():
        files = list(agriculture_path.glob("*.csv"))
        agriculture_datasets = []
        
        for file_path in files:
            try:
                df = pd.read_csv(file_path)
                filename = file_path.name
                dataset_id = filename.split('_')[0]  # e.g., 001
                
                # Extract title from filename
                title_part = '_'.join(filename.split('_')[1:]).replace('.csv', '').replace('_', ' ')
                title = title_part[:50] + '...' if len(title_part) > 50 else title_part
                
                # Get basic stats
                row_count = len(df)
                col_count = len(df.columns)
                
                dataset = {
                    "id": dataset_id,
                    "filename": filename,
                    "title": title,
                    "sector": "Agriculture",
                    "state": "India",  # or extract from data if available
                    "organization": "Government of India",
                    "description": f"Agriculture dataset containing {row_count} records with {col_count} columns. Source: data.gov.in",
                    "datasetCount": row_count,
                    "apiCount": 0,
                    "views": 0,
                    "downloads": 0,
                    "updatedDate": "2024-01-01",
                    "publishedDate": "2024-01-01",
                    "category": "Agriculture"
                }
                
                agriculture_datasets.append(dataset)
                
            except Exception as e:
                print(f"Error processing {file_path}: {e}")
        
        if agriculture_datasets:
            datasets["Agriculture"] = agriculture_datasets
    
    # Write to data/datasets.json
    output_file = data_path / "datasets.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(datasets, f, indent=2, ensure_ascii=False)
    
    print(f"Generated {output_file} with {len(agriculture_datasets)} datasets")

if __name__ == "__main__":
    generate_datasets_json()