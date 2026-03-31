import os
import pandas as pd

DATASET_FOLDER = "."

SECTORS = {
    "health": "health_datasets",
    "education": "education_datasets",
    "transport": "transport_datasets",
    "agriculture": "agriculture_datasets",
    "census": "census_datasets",
    "finance": "finance_datasets"
}


def get_sector_path(sector):
    if not isinstance(sector, str) or not sector.strip():
        return None

    normalized = sector.strip().lower()
    folder = SECTORS.get(normalized)

    if not folder:
        return None

    return os.path.join(DATASET_FOLDER, folder)


import re

def list_datasets(sector):

    path = get_sector_path(sector)

    if not path or not os.path.exists(path):
        return []

    # Only include real numbered dataset files.
    # This excludes helper files like summary CSVs and collapses duplicate exports
    # that share the same numeric dataset id.
    pattern = re.compile(r"^(\d{3})_.*\.csv$")
    files = sorted([f for f in os.listdir(path) if pattern.match(f)])

    seen_prefixes = set()
    unique_files = []

    for filename in files:
        prefix = pattern.match(filename).group(1)
        if prefix in seen_prefixes:
            continue
        seen_prefixes.add(prefix)
        unique_files.append(filename)

    return unique_files


def dataset_count(sector):

    return len(list_datasets(sector))


def load_dataset(sector, filename):

    path = os.path.join(get_sector_path(sector), filename)

    df = pd.read_csv(path)

    # 🔧 Fix JSON serialization issue
    df = df.replace([float("inf"), float("-inf")], None)
    df = df.where(pd.notnull(df), None)

    return df


def dataset_preview(df):

    preview = df.head(10)

    return preview.to_dict(orient="records")


def dataset_summary(df):

    return {
        "rows": int(len(df)),
        "columns": list(df.columns)
    }
