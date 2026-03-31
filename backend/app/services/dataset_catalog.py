from __future__ import annotations

import csv
import io
import json
import math
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Iterator

import requests

API_KEY = os.getenv("DATA_GOV_API_KEY", "579b464db66ec23bdd000001512ff0ae469e4783667632663591c20e")
API_BASE_URL = "https://api.data.gov.in"
LISTS_API_URL = f"{API_BASE_URL}/lists"
CATALOG_PAGE_SIZE = 9
DETAIL_PAGE_SIZE = 500
MAX_VISUALIZATION_ROWS = 10000
SUMMARY_REFRESH_INTERVAL_SECONDS = 60 * 60 * 6
RESOURCE_METADATA_TTL_SECONDS = 60 * 60 * 24 * 7
SUMMARY_LIST_PAGE_SIZE = 100
SUMMARY_METADATA_WORKERS = 8
SUMMARY_AUTO_REFRESH = os.getenv("SUMMARY_AUTO_REFRESH", "false").strip().lower() == "true"

SECTOR_LABELS = {
    "agriculture": "Agriculture",
    "census": "Census and Surveys",
    "education": "Education",
    "finance": "Finance",
    "health": "Health and Family Welfare",
    "transport": "Transport",
}

SECTOR_ALIASES = {
    "agriculture": {"agriculture", "agri"},
    "census": {"census", "census and surveys", "survey", "surveys"},
    "education": {"education", "school", "schools"},
    "finance": {"finance", "financial"},
    "health": {"health", "healthcare", "family welfare", "health and family welfare"},
    "transport": {"transport", "transportation"},
}

SUMMARY_COLUMNS = [
    "Serial Number",
    "Dataset Name",
    "Resource ID",
    "Published Date",
    "Number of Rows",
    "Number of Columns",
]

BACKEND_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = BACKEND_ROOT / "data"
SUMMARY_DIR = BACKEND_ROOT / "summary"
DATASETS_FILE = DATA_DIR / "datasets.json"
TRACKERS_FILE = DATA_DIR / "dataset_trackers.json"
RESOURCE_METADATA_CACHE_FILE = DATA_DIR / "resource_metadata_cache.json"
SUMMARY_SYNC_STATE_FILE = DATA_DIR / "summary_sync_state.json"

REQUEST_TIMEOUT = 30

_catalog_lock = threading.RLock()
_tracker_lock = threading.RLock()
_metadata_lock = threading.RLock()
_summary_lock = threading.RLock()
_summary_thread_lock = threading.Lock()

_catalog_cache: dict[str, list[dict[str, Any]]] | None = None
_tracker_cache: dict[str, dict[str, int]] | None = None
_resource_metadata_cache: dict[str, dict[str, Any]] | None = None
_summary_state_cache: dict[str, dict[str, Any]] | None = None
_summary_metadata_index_cache: dict[str, dict[str, Any]] | None = None
_dataset_page_cache: dict[tuple[str, int, int], dict[str, Any]] = {}
_sector_page_cache: dict[tuple[str, int, int], dict[str, Any]] = {}
_sector_total_cache: dict[str, int] = {}
_summary_thread: threading.Thread | None = None


def sector_keys() -> list[str]:
    return list(SECTOR_LABELS.keys())


def sector_label(sector_key: str) -> str:
    return SECTOR_LABELS[normalize_sector_key(sector_key)]


def normalize_sector_key(value: str | None) -> str:
    if not value:
        return ""
    normalized = str(value).strip().lower()
    for key, label in SECTOR_LABELS.items():
        aliases = SECTOR_ALIASES.get(key, set())
        if normalized == key or normalized == label.lower() or normalized in aliases:
            return key
    return normalized


def safe_int(value: Any, default: int = 0) -> int:
    try:
        if value in (None, ""):
            return default
        return int(float(value))
    except (TypeError, ValueError):
        return default


def normalize_date(value: Any) -> str | None:
    if value in (None, ""):
        return None
    text = str(value)
    return text[:10] if len(text) >= 10 else text


def api_url(resource_id: str, *, limit: int = 500, offset: int = 0) -> str:
    return (
        f"{API_BASE_URL}/resource/{resource_id}"
        f"?api-key={API_KEY}&format=json&offset={offset}&limit={limit}"
    )


def request_json(url: str, *, retries: int = 3) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            response = requests.get(url, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                raise ValueError("Unexpected API payload")
            return payload
        except (requests.RequestException, ValueError) as exc:
            last_error = exc
            if attempt == retries - 1:
                raise requests.RequestException(str(exc)) from exc
            time.sleep(0.75 * (attempt + 1))
    raise RuntimeError(f"Unable to fetch JSON payload: {last_error}")


def request_json_params(url: str, params: dict[str, Any], *, retries: int = 3) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                raise ValueError("Unexpected API payload")
            return payload
        except (requests.RequestException, ValueError) as exc:
            last_error = exc
            if attempt == retries - 1:
                raise requests.RequestException(str(exc)) from exc
            time.sleep(0.75 * (attempt + 1))
    raise RuntimeError(f"Unable to fetch JSON payload: {last_error}")


def ensure_storage() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SUMMARY_DIR.mkdir(parents=True, exist_ok=True)


def dataset_tracker_key(sector_key: str, resource_id: str) -> str:
    return f"{normalize_sector_key(sector_key)}:{str(resource_id).replace('.csv', '')}"


def tracker_key_candidates(sector_key: str, resource_id: str) -> list[str]:
    normalized_sector = normalize_sector_key(sector_key)
    display_sector = sector_label(normalized_sector)
    base_id = str(resource_id).replace(".csv", "")
    return [
        f"{normalized_sector}:{base_id}",
        f"{normalized_sector}:{base_id}.csv",
        f"{display_sector}:{base_id}",
        f"{display_sector}:{base_id}.csv",
    ]


def load_catalogs() -> dict[str, list[dict[str, Any]]]:
    global _catalog_cache

    with _catalog_lock:
        if _catalog_cache is not None:
            return _catalog_cache

        if not DATASETS_FILE.exists():
            _catalog_cache = {sector: [] for sector in sector_keys()}
            return _catalog_cache

        raw = json.loads(DATASETS_FILE.read_text(encoding="utf-8"))
        catalogs: dict[str, list[dict[str, Any]]] = {sector: [] for sector in sector_keys()}

        for raw_sector, items in raw.items():
            sector_key = normalize_sector_key(raw_sector)
            if sector_key not in catalogs or not isinstance(items, list):
                continue

            normalized_items: list[dict[str, Any]] = []
            for item in items:
                if not isinstance(item, dict):
                    continue
                resource_id = str(item.get("id") or item.get("resource_id") or "").strip().replace(".csv", "")
                if not resource_id:
                    continue

                normalized_items.append(
                    {
                        "id": resource_id,
                        "resourceId": resource_id,
                        "title": str(item.get("title") or "Untitled Dataset").strip(),
                        "description": str(item.get("description") or item.get("desc") or "").strip(),
                        "organization": str(item.get("organization") or item.get("department") or "Government of India").strip(),
                        "publishedDate": normalize_date(item.get("publishedDate") or item.get("date_created")),
                        "updatedDate": normalize_date(item.get("updatedDate") or item.get("date_updated")),
                        "state": str(item.get("state") or "All States").strip(),
                        "sector": sector_label(sector_key),
                        "sectorKey": sector_key,
                        "category": str(item.get("category") or sector_label(sector_key)).strip(),
                        "datasetCount": safe_int(item.get("datasetCount")),
                        "apiCount": safe_int(item.get("apiCount"), 1),
                    }
                )

            catalogs[sector_key] = normalized_items

        _catalog_cache = catalogs
        return catalogs


def local_sector_page(sector_key: str, *, page: int = 1, limit: int = CATALOG_PAGE_SIZE) -> dict[str, Any]:
    normalized_sector = normalize_sector_key(sector_key)
    datasets = [enrich_dataset(dataset) for dataset in load_catalogs().get(normalized_sector, [])]
    total = len(datasets)
    bounded_page = max(page, 1)
    bounded_limit = max(limit, 1)
    start = (bounded_page - 1) * bounded_limit
    end = start + bounded_limit
    return {
        "sector": sector_label(normalized_sector),
        "sectorKey": normalized_sector,
        "datasets": datasets[start:end],
        "page": bounded_page,
        "limit": bounded_limit,
        "totalDatasets": total,
        "totalPages": max(1, math.ceil(total / bounded_limit)) if total else 0,
        "source": "local_fallback",
        "warning": "Using fallback sector catalog because the live metadata API is unavailable.",
    }


def read_trackers() -> dict[str, dict[str, int]]:
    global _tracker_cache

    with _tracker_lock:
        if _tracker_cache is not None:
            return _tracker_cache

        if not TRACKERS_FILE.exists():
            _tracker_cache = {}
            return _tracker_cache

        try:
            raw = json.loads(TRACKERS_FILE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            raw = {}

        trackers: dict[str, dict[str, int]] = {}
        if isinstance(raw, dict):
            for key, value in raw.items():
                if not isinstance(value, dict):
                    continue
                trackers[key] = {
                    "views": safe_int(value.get("views")),
                    "downloads": safe_int(value.get("downloads")),
                }

        _tracker_cache = trackers
        return trackers


def save_trackers() -> None:
    ensure_storage()
    with _tracker_lock:
        trackers = read_trackers()
        temp_file = TRACKERS_FILE.with_suffix(".tmp")
        temp_file.write_text(json.dumps(trackers, indent=2, sort_keys=True), encoding="utf-8")
        temp_file.replace(TRACKERS_FILE)


def load_resource_metadata_cache() -> dict[str, dict[str, Any]]:
    global _resource_metadata_cache

    with _metadata_lock:
        if _resource_metadata_cache is not None:
            return _resource_metadata_cache

        if not RESOURCE_METADATA_CACHE_FILE.exists():
            _resource_metadata_cache = {}
            return _resource_metadata_cache

        try:
            raw = json.loads(RESOURCE_METADATA_CACHE_FILE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            raw = {}

        _resource_metadata_cache = raw if isinstance(raw, dict) else {}
        return _resource_metadata_cache


def save_resource_metadata_cache() -> None:
    ensure_storage()
    with _metadata_lock:
        cache = load_resource_metadata_cache()
        temp_file = RESOURCE_METADATA_CACHE_FILE.with_suffix(".tmp")
        temp_file.write_text(json.dumps(cache, indent=2, sort_keys=True), encoding="utf-8")
        temp_file.replace(RESOURCE_METADATA_CACHE_FILE)


def load_summary_sync_state() -> dict[str, dict[str, Any]]:
    global _summary_state_cache

    with _summary_lock:
        if _summary_state_cache is not None:
            return _summary_state_cache

        if not SUMMARY_SYNC_STATE_FILE.exists():
            _summary_state_cache = {}
            return _summary_state_cache

        try:
            raw = json.loads(SUMMARY_SYNC_STATE_FILE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            raw = {}

        _summary_state_cache = raw if isinstance(raw, dict) else {}
        return _summary_state_cache


def save_summary_sync_state() -> None:
    ensure_storage()
    with _summary_lock:
        state = load_summary_sync_state()
        temp_file = SUMMARY_SYNC_STATE_FILE.with_suffix(".tmp")
        temp_file.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")
        temp_file.replace(SUMMARY_SYNC_STATE_FILE)


def load_summary_metadata_index() -> dict[str, dict[str, Any]]:
    global _summary_metadata_index_cache

    with _summary_lock:
        if _summary_metadata_index_cache is not None:
            return _summary_metadata_index_cache

        index: dict[str, dict[str, Any]] = {}
        for sector in sector_keys():
            target = summary_file_for_sector(sector)
            if not target.exists():
                continue
            try:
                with target.open("r", newline="", encoding="utf-8") as csv_file:
                    reader = csv.DictReader(csv_file)
                    for row in reader:
                        resource_id = str(row.get("Resource ID") or "").replace(".csv", "").strip()
                        if not resource_id:
                            continue
                        index[resource_id] = {
                            "resourceId": resource_id,
                            "publishedDate": normalize_date(row.get("Published Date")),
                            "updatedDate": None,
                            "numberOfRows": safe_int(row.get("Number of Rows")),
                            "numberOfColumns": safe_int(row.get("Number of Columns")),
                            "fieldIds": [],
                            "fieldNames": [],
                            "cachedAt": int(time.time()),
                            "source": "summary",
                        }
            except OSError:
                continue

        _summary_metadata_index_cache = index
        return _summary_metadata_index_cache


def reset_summary_metadata_index() -> None:
    global _summary_metadata_index_cache
    with _summary_lock:
        _summary_metadata_index_cache = None


def get_cached_resource_metadata(resource_id: str) -> dict[str, Any] | None:
    normalized_id = str(resource_id).replace(".csv", "")
    cache = load_resource_metadata_cache()
    cached = cache.get(normalized_id)
    if isinstance(cached, dict):
        return cached
    summary_metadata = load_summary_metadata_index().get(normalized_id)
    if isinstance(summary_metadata, dict):
        return summary_metadata
    return None


def aggregate_tracker_counts(sector_key: str, resource_id: str) -> dict[str, int]:
    trackers = read_trackers()
    canonical_key = dataset_tracker_key(sector_key, resource_id)
    if canonical_key in trackers:
        tracker = trackers.get(canonical_key, {})
        return {
            "views": safe_int(tracker.get("views")),
            "downloads": safe_int(tracker.get("downloads")),
        }

    totals = {"views": 0, "downloads": 0}
    seen = set()

    for key in tracker_key_candidates(sector_key, resource_id):
        if key in seen:
            continue
        seen.add(key)
        tracker = trackers.get(key, {})
        totals["views"] += safe_int(tracker.get("views"))
        totals["downloads"] += safe_int(tracker.get("downloads"))

    return totals


def increment_tracker(sector_key: str, resource_id: str, field: str) -> dict[str, int]:
    canonical_key = dataset_tracker_key(sector_key, resource_id)

    with _tracker_lock:
        trackers = read_trackers()
        base_counts = aggregate_tracker_counts(sector_key, resource_id)
        current = trackers.get(canonical_key, {"views": 0, "downloads": 0})
        current["views"] = safe_int(current.get("views"))
        current["downloads"] = safe_int(current.get("downloads"))

        current[field] = base_counts[field] + 1
        other_field = "downloads" if field == "views" else "views"
        current[other_field] = max(current[other_field], base_counts[other_field])
        trackers[canonical_key] = current
        save_trackers()

    return aggregate_tracker_counts(sector_key, resource_id)


def get_catalog_dataset(sector_key: str, resource_id: str) -> dict[str, Any] | None:
    normalized_sector = normalize_sector_key(sector_key)
    normalized_id = str(resource_id).replace(".csv", "")
    for dataset in load_catalogs().get(normalized_sector, []):
        if dataset["id"] == normalized_id:
            return dataset
    return None


def infer_sector_from_values(values: list[str] | None, fallback: str | None = None) -> str:
    joined = " ".join(values or []).lower()
    for key, label in SECTOR_LABELS.items():
        aliases = SECTOR_ALIASES.get(key, set())
        if key in joined or label.lower() in joined or any(alias in joined for alias in aliases):
            return key
    if fallback:
        normalized = normalize_sector_key(fallback)
        if normalized in SECTOR_LABELS:
            return normalized
    return "health"


def build_dataset_from_api_record(record: dict[str, Any], fallback_sector: str | None = None) -> dict[str, Any]:
    sectors = record.get("sector", [])
    sector_values = sectors if isinstance(sectors, list) else [str(sectors)]
    sector_key = infer_sector_from_values([str(value) for value in sector_values], fallback_sector)

    organizations = record.get("org", [])
    if isinstance(organizations, list):
        organization = " | ".join(str(item) for item in organizations if item)
    else:
        organization = str(organizations or record.get("org_type") or "Government of India")

    return {
        "id": str(record.get("index_name") or record.get("resource_id") or "").replace(".csv", ""),
        "resourceId": str(record.get("index_name") or record.get("resource_id") or "").replace(".csv", ""),
        "title": str(record.get("title") or "Untitled Dataset").strip(),
        "description": str(record.get("desc") or record.get("description") or "").strip(),
        "organization": organization.strip() or "Government of India",
        "publishedDate": normalize_date(record.get("created_date")),
        "updatedDate": normalize_date(record.get("updated_date")),
        "state": "All States",
        "sector": sector_label(sector_key),
        "sectorKey": sector_key,
        "category": sector_label(sector_key),
        "datasetCount": 0,
        "apiCount": 1,
    }


def get_dataset_by_id(resource_id: str) -> tuple[str | None, dict[str, Any] | None]:
    normalized_id = str(resource_id).replace(".csv", "")
    catalogs = load_catalogs()
    for sector_key, items in catalogs.items():
        for dataset in items:
            if dataset["id"] == normalized_id:
                return sector_key, dataset

    try:
        payload = request_json(api_url(normalized_id, limit=1, offset=0))
    except requests.RequestException:
        return None, None

    dataset = build_dataset_from_api_record(payload)
    if dataset["id"]:
        return dataset["sectorKey"], dataset
    return None, None


def field_map_from_payload(payload: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, str]]:
    fields = payload.get("field", [])
    if not isinstance(fields, list):
        fields = []
    mapping = {}
    for field in fields:
        if not isinstance(field, dict):
            continue
        field_id = str(field.get("id") or "").strip()
        if not field_id:
            continue
        mapping[field_id] = str(field.get("name") or field_id).strip()
    return fields, mapping


def remap_record(record: dict[str, Any], field_map: dict[str, str]) -> dict[str, Any]:
    mapped: dict[str, Any] = {}
    for key, value in record.items():
        mapped[field_map.get(key, key)] = value
    return mapped


def fetch_resource_metadata(resource_id: str, *, force: bool = False) -> dict[str, Any]:
    normalized_id = str(resource_id).replace(".csv", "")

    with _metadata_lock:
        cache = load_resource_metadata_cache()
        cached = cache.get(normalized_id)
        cached_age = time.time() - safe_int((cached or {}).get("cachedAt")) if cached else None
        if cached and not force and cached_age is not None and cached_age < RESOURCE_METADATA_TTL_SECONDS:
            return cached

    try:
        payload = request_json(api_url(normalized_id, limit=1, offset=0))
    except requests.RequestException:
        cached = get_cached_resource_metadata(normalized_id)
        if cached:
            return cached
        raise

    fields, _ = field_map_from_payload(payload)
    metadata = {
        "resourceId": normalized_id,
        "publishedDate": normalize_date(payload.get("created_date")),
        "updatedDate": normalize_date(payload.get("updated_date")),
        "numberOfRows": safe_int(payload.get("total") or payload.get("count")),
        "numberOfColumns": len(fields),
        "fieldIds": [str(field.get("id") or "") for field in fields if isinstance(field, dict)],
        "fieldNames": [str(field.get("name") or field.get("id") or "") for field in fields if isinstance(field, dict)],
        "cachedAt": int(time.time()),
    }

    with _metadata_lock:
        cache = load_resource_metadata_cache()
        cache[normalized_id] = metadata

    return metadata


def enrich_dataset(dataset: dict[str, Any], *, include_remote_metadata: bool = False) -> dict[str, Any]:
    tracker = aggregate_tracker_counts(dataset["sectorKey"], dataset["id"])

    metadata = None
    if include_remote_metadata:
        try:
            metadata = fetch_resource_metadata(dataset["id"])
        except requests.RequestException:
            metadata = get_cached_resource_metadata(dataset["id"])

    return {
        **dataset,
        "publishedDate": (metadata or {}).get("publishedDate") or dataset.get("publishedDate"),
        "updatedDate": (metadata or {}).get("updatedDate") or dataset.get("updatedDate"),
        "numberOfRows": (metadata or {}).get("numberOfRows", dataset.get("datasetCount", 0)),
        "numberOfColumns": (metadata or {}).get("numberOfColumns", 0),
        "views": tracker["views"],
        "downloads": tracker["downloads"],
        "detailPath": f"/dataset/{dataset['id']}",
    }


def fetch_sector_api_page(sector_key: str, *, page: int = 1, limit: int = CATALOG_PAGE_SIZE) -> dict[str, Any]:
    normalized_sector = normalize_sector_key(sector_key)
    bounded_page = max(page, 1)
    bounded_limit = max(limit, 1)
    cache_key = (normalized_sector, bounded_page, bounded_limit)
    cached_response = _sector_page_cache.get(cache_key)
    if cached_response and cached_response.get("source") == "api":
        return _sector_page_cache[cache_key]

    params = {
        "api-key": API_KEY,
        "format": "json",
        "offset": (bounded_page - 1) * bounded_limit,
        "limit": bounded_limit,
        "filters[active]": 1,
        "filters[source]": "data.gov.in",
        "filters[sector]": sector_label(normalized_sector),
    }

    try:
        payload = request_json_params(LISTS_API_URL, params)
        records = payload.get("records", [])
        if not isinstance(records, list):
            records = []

        datasets = [enrich_dataset(build_dataset_from_api_record(record, normalized_sector)) for record in records if isinstance(record, dict)]
        total = safe_int(payload.get("total"))
        response = {
            "sector": sector_label(normalized_sector),
            "sectorKey": normalized_sector,
            "datasets": datasets,
            "page": bounded_page,
            "limit": bounded_limit,
            "totalDatasets": total,
            "totalPages": max(1, math.ceil(total / bounded_limit)) if total else 0,
            "source": "api",
            "warning": None,
        }
        _sector_page_cache[cache_key] = response
        _sector_total_cache[normalized_sector] = total
        return response
    except requests.RequestException:
        fallback = local_sector_page(normalized_sector, page=bounded_page, limit=bounded_limit)
        _sector_total_cache[normalized_sector] = fallback["totalDatasets"]
        return fallback


def get_sector_total(sector_key: str) -> int:
    normalized_sector = normalize_sector_key(sector_key)
    if normalized_sector in _sector_total_cache:
        return _sector_total_cache[normalized_sector]
    response = fetch_sector_api_page(normalized_sector, page=1, limit=1)
    return safe_int(response.get("totalDatasets"))


def get_sector_datasets(sector_key: str, *, page: int = 1, limit: int = CATALOG_PAGE_SIZE) -> dict[str, Any]:
    return fetch_sector_api_page(sector_key, page=page, limit=limit)


def get_all_datasets(limit: int = CATALOG_PAGE_SIZE) -> dict[str, dict[str, Any]]:
    return {sector_label(key): get_sector_datasets(key, page=1, limit=limit) for key in sector_keys()}


def search_datasets(query: str, sector_key: str | None = None) -> list[dict[str, Any]]:
    term = (query or "").strip().lower()
    if not term:
        return []

    sectors_to_search = [normalize_sector_key(sector_key)] if sector_key else sector_keys()
    results: list[dict[str, Any]] = []

    for key in sectors_to_search:
        local_datasets = [enrich_dataset(dataset) for dataset in load_catalogs().get(key, [])]
        api_preview = fetch_sector_api_page(key, page=1, limit=50).get("datasets", [])
        for dataset in [*api_preview, *local_datasets]:
            haystack = " ".join(
                [
                    str(dataset.get("title") or ""),
                    str(dataset.get("description") or ""),
                    str(dataset.get("organization") or ""),
                    str(dataset.get("state") or ""),
                    str(dataset.get("id") or ""),
                ]
            ).lower()
            if term in haystack:
                results.append(dataset)

    results.sort(
        key=lambda item: (
            term not in str(item.get("title") or "").lower(),
            str(item.get("title") or "").lower(),
        )
    )
    return results


def fetch_dataset_page(resource_id: str, *, limit: int = DETAIL_PAGE_SIZE, offset: int = 0) -> dict[str, Any]:
    normalized_id = str(resource_id).replace(".csv", "")
    bounded_limit = max(1, min(limit, DETAIL_PAGE_SIZE))
    bounded_offset = max(0, offset)
    cache_key = (normalized_id, bounded_limit, bounded_offset)
    cached_page = _dataset_page_cache.get(cache_key)
    try:
        payload = request_json(api_url(normalized_id, limit=bounded_limit, offset=bounded_offset))
    except requests.RequestException:
        if cached_page:
            return cached_page
        raise
    fields, field_map = field_map_from_payload(payload)
    raw_records = payload.get("records", [])
    if not isinstance(raw_records, list):
        raw_records = []

    ordered_columns = [
        field_map.get(str(field.get("id") or ""), str(field.get("id") or ""))
        for field in fields
        if isinstance(field, dict) and str(field.get("id") or "").strip()
    ]

    records = [remap_record(record, field_map) for record in raw_records if isinstance(record, dict)]
    total_rows = safe_int(payload.get("total") or payload.get("count") or len(records))
    page_number = (bounded_offset // bounded_limit) + 1
    total_pages = max(1, math.ceil(total_rows / bounded_limit)) if total_rows else 1

    resolved_columns = ordered_columns or (list(records[0].keys()) if records else [])

    page_payload = {
        "resourceId": normalized_id,
        "records": records,
        "columns": resolved_columns,
        "fields": [
            {
                "id": str(field.get("id") or ""),
                "name": field_map.get(str(field.get("id") or ""), str(field.get("id") or "")),
                "type": str(field.get("type") or ""),
            }
            for field in fields
            if isinstance(field, dict)
        ],
        "limit": bounded_limit,
        "offset": bounded_offset,
        "page": page_number,
        "totalRows": total_rows,
        "totalPages": total_pages,
    }
    _dataset_page_cache[cache_key] = page_payload
    return page_payload


def fetch_full_dataset(resource_id: str, *, max_rows: int = MAX_VISUALIZATION_ROWS) -> dict[str, Any]:
    metadata = fetch_resource_metadata(resource_id)
    total_rows = safe_int(metadata.get("numberOfRows"))
    if total_rows > max_rows:
        return {"tooLarge": True, "totalRows": total_rows, "maxRows": max_rows, "records": [], "columns": metadata.get("fieldNames", [])}

    rows: list[dict[str, Any]] = []
    columns: list[str] = []
    offset = 0

    while True:
        page = fetch_dataset_page(resource_id, limit=DETAIL_PAGE_SIZE, offset=offset)
        if not columns:
            columns = page["columns"]
        page_records = page["records"]
        if not page_records:
            break
        rows.extend(page_records)
        offset += page["limit"]
        if len(rows) >= total_rows or len(page_records) < page["limit"]:
            break
        if len(rows) > max_rows:
            return {"tooLarge": True, "totalRows": total_rows or len(rows), "maxRows": max_rows, "records": [], "columns": columns}

    return {"tooLarge": False, "totalRows": total_rows or len(rows), "maxRows": max_rows, "records": rows, "columns": columns}


def iter_dataset_pages(resource_id: str, *, chunk_size: int = DETAIL_PAGE_SIZE):
    offset = 0
    while True:
        page = fetch_dataset_page(resource_id, limit=chunk_size, offset=offset)
        records = page["records"]
        yield page
        if not records or len(records) < page["limit"]:
            break
        offset += page["limit"]


def stream_dataset_csv(resource_id: str):
    columns: list[str] = []
    header_written = False

    for page in iter_dataset_pages(resource_id):
        if not columns:
            columns = page["columns"]

        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=columns or page["columns"])
        if not header_written:
            writer.writeheader()
            header_written = True

        for record in page["records"]:
            writer.writerow({column: record.get(column, "") for column in columns})

        yield buffer.getvalue()


def get_dataset_stats(sector_key: str, resource_id: str) -> dict[str, Any]:
    dataset = get_catalog_dataset(sector_key, resource_id)
    if dataset is None:
        detected_sector, dataset = get_dataset_by_id(resource_id)
        if dataset is None:
            raise KeyError(resource_id)
        sector_key = detected_sector or sector_key

    tracker = aggregate_tracker_counts(sector_key, resource_id)
    metadata = fetch_resource_metadata(resource_id)

    return {
        "rows": metadata.get("numberOfRows", dataset.get("datasetCount", 0)),
        "columns": metadata.get("fieldNames", []),
        "columnCount": metadata.get("numberOfColumns", 0),
        "views": tracker["views"],
        "downloads": tracker["downloads"],
        "publishedDate": metadata.get("publishedDate") or dataset.get("publishedDate"),
        "updatedDate": metadata.get("updatedDate") or dataset.get("updatedDate"),
    }


def summary_file_for_sector(sector_key: str) -> Path:
    return SUMMARY_DIR / f"{normalize_sector_key(sector_key)}.csv"


def summary_sector_needs_refresh(sector_key: str, *, force: bool = False) -> bool:
    if force:
        return True

    target = summary_file_for_sector(sector_key)
    if not target.exists():
        return True

    state = load_summary_sync_state().get(normalize_sector_key(sector_key), {})
    if state.get("source") != "api":
        return True

    updated_at = safe_int(state.get("updatedAt"))
    if not updated_at:
        return True

    return time.time() - updated_at >= SUMMARY_REFRESH_INTERVAL_SECONDS


def iter_sector_summary_datasets(sector_key: str, *, batch_size: int = SUMMARY_LIST_PAGE_SIZE) -> Iterator[list[dict[str, Any]]]:
    normalized_sector = normalize_sector_key(sector_key)
    offset = 0

    while True:
        params = {
            "api-key": API_KEY,
            "format": "json",
            "offset": offset,
            "limit": batch_size,
            "filters[active]": 1,
            "filters[source]": "data.gov.in",
            "filters[sector]": sector_label(normalized_sector),
        }
        payload = request_json_params(LISTS_API_URL, params)
        records = payload.get("records", [])
        if not isinstance(records, list):
            records = []

        datasets = [
            build_dataset_from_api_record(record, normalized_sector)
            for record in records
            if isinstance(record, dict)
        ]
        if not datasets:
            break

        yield datasets

        offset += len(datasets)
        total = safe_int(payload.get("total"))
        if len(datasets) < batch_size or (total and offset >= total):
            break


def summary_row_from_dataset(serial_number: int, dataset: dict[str, Any]) -> dict[str, Any]:
    try:
        metadata = fetch_resource_metadata(dataset["id"])
    except requests.RequestException:
        metadata = {
            "publishedDate": dataset.get("publishedDate"),
            "numberOfRows": dataset.get("datasetCount", 0),
            "numberOfColumns": dataset.get("numberOfColumns", 0),
        }

    return {
        "Serial Number": serial_number,
        "Dataset Name": dataset.get("title") or "",
        "Resource ID": dataset.get("id") or "",
        "Published Date": metadata.get("publishedDate") or dataset.get("publishedDate") or "",
        "Number of Rows": safe_int(metadata.get("numberOfRows"), safe_int(dataset.get("datasetCount"))),
        "Number of Columns": safe_int(metadata.get("numberOfColumns")),
    }


def write_summary_rows_batch(
    writer: csv.DictWriter,
    datasets: list[dict[str, Any]],
    *,
    start_serial: int,
    executor: ThreadPoolExecutor,
) -> int:
    futures = {
        executor.submit(summary_row_from_dataset, start_serial + index, dataset): start_serial + index
        for index, dataset in enumerate(datasets)
    }
    rows: list[dict[str, Any]] = []
    for future in as_completed(futures):
        rows.append(future.result())

    rows.sort(key=lambda row: safe_int(row.get("Serial Number")))
    writer.writerows(rows)
    return len(rows)


def write_sector_summary_from_local_catalog(sector_key: str) -> dict[str, Any]:
    normalized_sector = normalize_sector_key(sector_key)
    target = summary_file_for_sector(normalized_sector)
    temp_target = target.with_suffix(".tmp")
    count = 0

    with temp_target.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=SUMMARY_COLUMNS)
        writer.writeheader()
        with ThreadPoolExecutor(max_workers=SUMMARY_METADATA_WORKERS) as executor:
            datasets = load_catalogs().get(normalized_sector, [])
            count = write_summary_rows_batch(writer, datasets, start_serial=1, executor=executor)

    temp_target.replace(target)
    return {"source": "local_fallback", "datasetCount": count}


def write_sector_summary(sector_key: str) -> None:
    ensure_storage()
    normalized_sector = normalize_sector_key(sector_key)
    target = summary_file_for_sector(normalized_sector)
    temp_target = target.with_suffix(".tmp")
    source = "api"
    total_written = 0

    try:
        with temp_target.open("w", newline="", encoding="utf-8") as csv_file:
            writer = csv.DictWriter(csv_file, fieldnames=SUMMARY_COLUMNS)
            writer.writeheader()
            with ThreadPoolExecutor(max_workers=SUMMARY_METADATA_WORKERS) as executor:
                serial_number = 1
                for batch in iter_sector_summary_datasets(normalized_sector):
                    total_written += write_summary_rows_batch(
                        writer,
                        batch,
                        start_serial=serial_number,
                        executor=executor,
                    )
                    serial_number += len(batch)

        temp_target.replace(target)
    except requests.RequestException:
        source = "local_fallback"
        result = write_sector_summary_from_local_catalog(normalized_sector)
        total_written = result["datasetCount"]

    state = load_summary_sync_state()
    state[normalized_sector] = {
        "updatedAt": int(time.time()),
        "datasetCount": total_written,
        "source": source,
        "label": sector_label(normalized_sector),
    }
    save_summary_sync_state()
    save_resource_metadata_cache()
    reset_summary_metadata_index()


def refresh_summary_files(force: bool = False) -> None:
    with _summary_lock:
        sectors_to_refresh = [sector for sector in sector_keys() if summary_sector_needs_refresh(sector, force=force)]
        if not sectors_to_refresh:
            return

    ensure_storage()
    for sector in sectors_to_refresh:
        write_sector_summary(sector)


def ensure_summary_files_exist() -> None:
    ensure_storage()
    for sector in sector_keys():
        target = summary_file_for_sector(sector)
        if target.exists():
            continue
        with target.open("w", newline="", encoding="utf-8") as csv_file:
            writer = csv.DictWriter(csv_file, fieldnames=SUMMARY_COLUMNS)
            writer.writeheader()


def start_summary_refresh(force: bool = False) -> None:
    ensure_summary_files_exist()
    if not force and not SUMMARY_AUTO_REFRESH:
        return
    sectors_to_refresh = [sector for sector in sector_keys() if summary_sector_needs_refresh(sector, force=force)]
    if not sectors_to_refresh:
        return

    global _summary_thread
    with _summary_thread_lock:
        if _summary_thread and _summary_thread.is_alive():
            return
        _summary_thread = threading.Thread(target=refresh_summary_files, kwargs={"force": force}, daemon=True)
        _summary_thread.start()


def domain_stats() -> list[dict[str, Any]]:
    stats: list[dict[str, Any]] = []
    for sector in sector_keys():
        datasets = fetch_sector_api_page(sector, page=1, limit=25).get("datasets", [])
        total_datasets = get_sector_total(sector)
        total_views = sum(safe_int(item.get("views")) for item in datasets)
        total_downloads = sum(safe_int(item.get("downloads")) for item in datasets)
        top_datasets = sorted(datasets, key=lambda item: (-safe_int(item.get("views")), str(item.get("title") or "")))[:3]
        stats.append(
            {
                "sector": sector,
                "catalogs": max(1, math.ceil(total_datasets / CATALOG_PAGE_SIZE)) if total_datasets else 0,
                "datasets": total_datasets,
                "views": total_views,
                "downloads": total_downloads,
                "topDatasets": [item.get("title") or "" for item in top_datasets],
            }
        )
    return stats


def dataset_link_payload(dataset: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": dataset["id"],
        "title": dataset["title"],
        "sector": dataset["sectorKey"],
        "kind": "dataset",
        "href": f"/dataset/{dataset['id']}",
    }


def sector_link_payload(sector_key: str, title: str | None = None) -> dict[str, Any]:
    normalized_sector = normalize_sector_key(sector_key)
    return {
        "id": normalized_sector,
        "title": title or sector_label(normalized_sector),
        "sector": normalized_sector,
        "kind": "sector",
        "href": f"/domain/{normalized_sector}",
    }


def numeric_columns(records: list[dict[str, Any]]) -> list[str]:
    if not records:
        return []
    columns = list(records[0].keys())
    numeric: list[str] = []
    for column in columns:
        valid = 0
        for record in records[: min(len(records), 200)]:
            try:
                float(record.get(column))
                valid += 1
            except (TypeError, ValueError):
                continue
        if valid:
            numeric.append(column)
    return numeric


def infer_visualization(records: list[dict[str, Any]], columns: list[str]) -> dict[str, Any]:
    if not records:
        return {"message": "No visualization available for this dataset.", "charts": []}

    numeric = numeric_columns(records)
    non_numeric = [column for column in columns if column not in numeric]
    if not numeric:
        return {"message": "No numeric columns available for visualization.", "charts": []}

    primary_metric = numeric[0]
    label_column = next((column for column in non_numeric if "date" in column.lower() or "year" in column.lower() or "month" in column.lower()), None)
    if label_column:
        chart_type = "line"
        data = [
            {"label": str(record.get(label_column, "")), primary_metric: safe_int(record.get(primary_metric))}
            for record in records[:50]
        ]
        return {
            "message": None,
            "charts": [
                {
                    "type": chart_type,
                    "title": f"{primary_metric} by {label_column}",
                    "xKey": "label",
                    "yKey": primary_metric,
                    "data": data,
                }
            ],
        }

    category_column = next((column for column in non_numeric if len({str(record.get(column, "")) for record in records[:100]}) <= 20), None)
    if category_column:
        bucket: dict[str, float] = {}
        for record in records:
            key = str(record.get(category_column, "")).strip() or "Unknown"
            try:
                bucket[key] = bucket.get(key, 0.0) + float(record.get(primary_metric) or 0)
            except (TypeError, ValueError):
                continue
        data = [{"label": key, primary_metric: value} for key, value in sorted(bucket.items(), key=lambda item: item[1], reverse=True)[:20]]
        return {
            "message": None,
            "charts": [
                {
                    "type": "bar",
                    "title": f"{primary_metric} by {category_column}",
                    "xKey": "label",
                    "yKey": primary_metric,
                    "data": data,
                }
            ],
        }

    values = []
    for record in records:
        try:
            values.append(float(record.get(primary_metric) or 0))
        except (TypeError, ValueError):
            continue

    histogram_data = [{"label": str(index + 1), primary_metric: value} for index, value in enumerate(values[:100])]
    return {
        "message": None,
        "charts": [
            {
                "type": "histogram",
                "title": primary_metric,
                "xKey": "label",
                "yKey": primary_metric,
                "data": histogram_data,
            }
        ],
    }


def dataset_insights(records: list[dict[str, Any]], columns: list[str]) -> list[str]:
    insights: list[str] = []
    total_rows = len(records)
    insights.append(f"Rows analyzed: {total_rows}.")
    insights.append(f"Columns analyzed: {len(columns)}.")

    numeric = numeric_columns(records)
    if numeric:
        primary_metric = numeric[0]
        values = []
        for record in records:
            try:
                values.append(float(record.get(primary_metric) or 0))
            except (TypeError, ValueError):
                continue
        if values:
            insights.append(f"{primary_metric}: min {min(values):.2f}, max {max(values):.2f}, average {sum(values) / len(values):.2f}.")

    categorical = [column for column in columns if column not in numeric]
    if categorical:
        primary_label = categorical[0]
        counts: dict[str, int] = {}
        for record in records:
            key = str(record.get(primary_label, "")).strip() or "Unknown"
            counts[key] = counts.get(key, 0) + 1
        top_label = max(counts.items(), key=lambda item: item[1])
        insights.append(f"Most frequent {primary_label}: {top_label[0]} ({top_label[1]} rows).")

    return insights
