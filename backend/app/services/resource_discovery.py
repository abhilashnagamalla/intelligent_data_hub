import os

from .data_service import SECTORS, get_sector_path


def dataset_matches_keywords(file_path, filename, keywords):
    if not keywords:
        return True, 1

    filename_lower = filename.lower()
    matched_keywords = {keyword for keyword in keywords if keyword in filename_lower}

    remaining_keywords = [keyword for keyword in keywords if keyword not in matched_keywords]
    if remaining_keywords:
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as dataset_file:
                content = dataset_file.read().lower()
        except OSError:
            content = ""

        for keyword in remaining_keywords:
            if keyword in content:
                matched_keywords.add(keyword)

    return bool(matched_keywords), len(matched_keywords)


def search_datasets(keywords, sectors=None):
    if isinstance(keywords, str):
        keywords = [keywords]

    normalized_keywords = [keyword.lower() for keyword in keywords if keyword]
    sectors_to_search = sectors or SECTORS.keys()

    results = []

    for sector in sectors_to_search:
        path = get_sector_path(sector)
        if not path or not os.path.exists(path):
            continue

        for file in os.listdir(path):
            file_path = os.path.join(path, file)
            is_match, match_count = dataset_matches_keywords(file_path, file, normalized_keywords)

            if is_match:
                results.append({
                    "sector": sector,
                    "dataset": file,
                    "matches": match_count
                })

    results.sort(key=lambda item: (-item["matches"], item["sector"], item["dataset"]))
    return results
