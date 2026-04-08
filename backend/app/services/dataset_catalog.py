from __future__ import annotations

import csv
import io
import json
import math
import os
import re
import threading
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Iterator

import requests

from app.config import settings

API_KEY = (
    settings.DATA_GOV_API_KEY
    or os.getenv("DATA_GOV_API_KEY")
    or os.getenv("VITE_DATAGOVTAPI")
    or "579b464db66ec23bdd000001512ff0ae469e4783667632663591c20e"
)
API_BASE_URL = "https://api.data.gov.in"
LISTS_API_URL = f"{API_BASE_URL}/lists"
CATALOG_PAGE_SIZE = 9
DETAIL_PAGE_SIZE = 500
MAX_VISUALIZATION_ROWS = 10000
MAX_DYNAMIC_VISUALIZATION_ROWS = 50
SUMMARY_REFRESH_INTERVAL_SECONDS = 60 * 60 * 6
RESOURCE_METADATA_TTL_SECONDS = 60 * 60 * 24 * 7
VISUALIZATION_CACHE_TTL_SECONDS = 60 * 60  # Cache visualization for 1 hour
SUMMARY_LIST_PAGE_SIZE = 100
STATE_FILTER_BATCH_SIZE = 250  # Batch size for fetching datasets when state filtering
SUMMARY_METADATA_WORKERS = 8
SUMMARY_AUTO_REFRESH = os.getenv("SUMMARY_AUTO_REFRESH", "false").strip().lower() == "true"
MAX_CATEGORY_BUCKETS = 10
LONG_LABEL_THRESHOLD = 24
COLUMN_DETECTION_SAMPLE_SIZE = 500

SEARCH_STOP_WORDS = {
    "a",
    "all",
    "and",
    "by",
    "data",
    "dataset",
    "datasets",
    "details",
    "for",
    "from",
    "in",
    "list",
    "of",
    "records",
    "show",
    "the",
    "to",
    "with",
}

DOMAIN_KEYWORDS = {
    "health": {
        "health",
        "healthcare",
        "hospital",
        "hospitals",
        "clinic",
        "clinics",
        "medical",
        "medicine",
        "medicines",
        "medicinal",
        "drug",
        "drugs",
        "pharma",
        "pharmacy",
        "pharmaceutical",
        "pharmaceuticals",
        "phc",
        "chc",
    },
    "agriculture": {"agriculture", "agri", "crop", "crops", "fertilizer", "fertilizers", "farmer", "farmers"},
    "education": {
        "education",
        "educational",
        "school",
        "schools",
        "college",
        "colleges",
        "university",
        "universities",
        "higher",
        "higher education",
        "institute",
        "institutes",
        "institution",
        "institutions",
        "teacher",
        "teachers",
        "student",
        "students",
        "literacy",
        "enrolment",
        "enrollment",
    },
    "transport": {
        "transport",
        "transportation",
        "traffic",
        "vehicle",
        "vehicles",
        "road",
        "roads",
        "highway",
        "highways",
        "nh",
        "toll",
        "tolls",
        "tolling",
        "plaza",
        "plazas",
        "fare",
        "fares",
    },
    "finance": {"finance", "financial", "bank", "banks", "rbi", "loan", "loans"},
}

IDENTIFIER_HINTS = {"code", "id", "identifier", "no", "number", "serial", "uid", "uuid"}

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

RAW_STATE_FILTER_ALIASES = {
    "AP": {"andhra", "andhra pradesh"},
    "AR": {"arunachal pradesh"},
    "AS": {"assam"},
    "BR": {"bihar"},
    "CG": {"chhattisgarh"},
    "GA": {"goa"},
    "GJ": {"gujarat"},
    "HR": {"haryana"},
    "HP": {"himachal pradesh"},
    "JK": {"jammu and kashmir", "jammu kashmir"},
    "JH": {"jharkhand"},
    "KA": {"karnataka"},
    "KL": {"kerala"},
    "MP": {"madhya pradesh"},
    "MH": {"maharashtra"},
    "MN": {"manipur"},
    "ML": {"meghalaya"},
    "MZ": {"mizoram"},
    "NL": {"nagaland"},
    "OD": {"odisha", "orissa"},
    "PB": {"punjab"},
    "RJ": {"rajasthan"},
    "SK": {"sikkim"},
    "TN": {"tamil nadu", "tamil"},
    "TG": {"telangana"},
    "TR": {"tripura"},
    "UT": {"uttarakhand"},
    "UP": {"uttar pradesh"},
    "WB": {"west bengal"},
    "AN": {"andaman and nicobar islands", "andaman nicobar islands", "andaman nicobar"},
    "CH": {"chandigarh"},
    "DL": {"delhi", "nct of delhi"},
    "PY": {"puducherry", "pondicherry"},
}

SUMMARY_BACKED_CATALOG_SECTORS = {"health"}

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
_visualization_cache: dict[str, tuple[dict[str, Any], float]] = {}  # (visualization, timestamp)
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


def safe_float(value: Any) -> float | None:
    if isinstance(value, bool) or value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        parsed = float(value)
        return parsed if math.isfinite(parsed) else None

    text = str(value).strip()
    if not text or text.lower() in {"-", "--", "na", "n/a", "nan", "none", "null"}:
        return None

    normalized = text.replace(",", "")
    if normalized.endswith("%"):
        normalized = normalized[:-1]

    try:
        parsed = float(normalized)
    except (TypeError, ValueError):
        return None
    return parsed if math.isfinite(parsed) else None


def normalize_search_text(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


STATE_FILTER_ALIASES = {
    code: {normalize_search_text(alias) for alias in aliases if normalize_search_text(alias)}
    for code, aliases in RAW_STATE_FILTER_ALIASES.items()
}

STATE_FILTER_ALIAS_LOOKUP = sorted(
    ((alias, code) for code, aliases in STATE_FILTER_ALIASES.items() for alias in aliases),
    key=lambda item: len(item[0]),
    reverse=True,
)


def contains_normalized_phrase(text: str, phrase: str) -> bool:
    if not text or not phrase:
        return False
    return f" {phrase} " in f" {text} "


def normalize_state_code(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""

    raw_upper = raw.upper()
    if raw_upper == "ALL":
        return "ALL"

    normalized = normalize_search_text(raw)
    if normalized in {"all states", "all india", "india"}:
        return "ALL"

    if raw_upper in STATE_FILTER_ALIASES:
        return raw_upper

    for alias, code in STATE_FILTER_ALIAS_LOOKUP:
        if normalized == alias:
            return code

    return raw_upper


def dataset_matches_state_filter(dataset: dict[str, Any], state_filter: str) -> bool:
    normalized_state_filter = normalize_state_code(state_filter)
    if not normalized_state_filter or normalized_state_filter == "ALL":
        return True

    if normalize_state_code(dataset.get("state")) == normalized_state_filter:
        return True

    searchable_text = normalize_search_text(
        " ".join(
            str(part or "")
            for part in (
                dataset.get("title"),
                dataset.get("organization"),
                dataset.get("description"),
                dataset.get("state"),
                " ".join(str(tag) for tag in (dataset.get("tags") or [])),
            )
        )
    )

    return any(
        contains_normalized_phrase(searchable_text, alias)
        for alias in STATE_FILTER_ALIASES.get(normalized_state_filter, set())
    )


def token_variants(token: str) -> set[str]:
    normalized = normalize_search_text(token)
    if not normalized:
        return set()

    variants = {normalized}
    if normalized.endswith("ies") and len(normalized) > 4:
        variants.add(normalized[:-3] + "y")
    if normalized.endswith("es") and len(normalized) > 4:
        variants.add(normalized[:-2])
    if normalized.endswith("s") and len(normalized) > 3:
        variants.add(normalized[:-1])
    return {variant for variant in variants if variant}


def unique_query_terms(value: str) -> list[str]:
    terms: list[str] = []
    seen: set[str] = set()

    for token in normalize_search_text(value).split():
        for variant in token_variants(token):
            if variant in SEARCH_STOP_WORDS or variant in seen:
                continue
            seen.add(variant)
            terms.append(variant)

    return terms


def keyword_occurrence_count(text: str, keywords: list[str] | set[str]) -> int:
    if not text or not keywords:
        return 0

    total = 0
    for keyword in set(keywords):
        total += len(re.findall(rf"\b{re.escape(keyword)}\b", text))
    return total


def flatten_tag_values(value: Any) -> list[str]:
    if value in (None, ""):
        return []

    if isinstance(value, dict):
        flattened: list[str] = []
        for item in value.values():
            flattened.extend(flatten_tag_values(item))
        return flattened

    if isinstance(value, list):
        flattened: list[str] = []
        for item in value:
            flattened.extend(flatten_tag_values(item))
        return flattened

    text = str(value).strip()
    if not text:
        return []

    if text[0] in "[{" and text[-1] in "]}":
        try:
            parsed = json.loads(text.replace("'", '"'))
        except json.JSONDecodeError:
            parsed = None
        if parsed is not None and parsed != value:
            return flatten_tag_values(parsed)

    parts = re.split(r"[|,;/]+", text)
    return [part.strip() for part in parts if part.strip()]


def normalize_tag_list(*values: Any) -> list[str]:
    tags: list[str] = []
    seen: set[str] = set()

    for value in values:
        for tag in flatten_tag_values(value):
            normalized = normalize_search_text(tag)
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            tags.append(str(tag).strip())

    return tags


def detect_query_domains(query_terms: list[str]) -> set[str]:
    domains: set[str] = set()
    for sector_key, keywords in DOMAIN_KEYWORDS.items():
        if any(term in keywords for term in query_terms):
            domains.add(sector_key)
    return domains


def detect_query_states(query_text: str) -> set[str]:
    detected: set[str] = set()
    for alias, code in STATE_FILTER_ALIAS_LOOKUP:
        if contains_normalized_phrase(query_text, alias):
            detected.add(code)
    return detected


def removable_state_query_terms(state_codes: set[str]) -> set[str]:
    removable_terms: set[str] = set()
    for code in state_codes:
        for alias in STATE_FILTER_ALIASES.get(code, set()):
            removable_terms.update(alias.split())
    return removable_terms


def removable_sector_query_terms(domain_filters: set[str]) -> set[str]:
    removable_terms: set[str] = set()
    for sector_key in domain_filters:
        for alias in SECTOR_ALIASES.get(sector_key, set()):
            removable_terms.update(normalize_search_text(alias).split())
    return removable_terms


def required_query_terms(
    query_terms: list[str],
    state_codes: set[str],
    domain_filters: set[str],
) -> list[str]:
    excluded_terms = removable_state_query_terms(state_codes) | removable_sector_query_terms(domain_filters)
    return [term for term in query_terms if term not in excluded_terms]


def dataset_search_text(dataset: dict[str, Any]) -> tuple[str, str, str, str, str, str]:
    title_text = normalize_search_text(dataset.get("title"))
    description_text = normalize_search_text(dataset.get("description"))
    organization_text = normalize_search_text(dataset.get("organization"))
    state_text = normalize_search_text(dataset.get("state"))
    identifier_text = normalize_search_text(dataset.get("id"))
    tags = normalize_tag_list(dataset.get("tags"), dataset.get("category"), dataset.get("sector"))
    tags_text = normalize_search_text(" ".join(tags))
    combined_text = normalize_search_text(
        " ".join(
            part
            for part in (
                title_text,
                description_text,
                organization_text,
                state_text,
                identifier_text,
                tags_text,
            )
            if part
        )
    )
    return title_text, description_text, organization_text, state_text, tags_text, combined_text


def search_relevance_score(
    dataset: dict[str, Any],
    query_text: str,
    query_terms: list[str],
    domain_filters: set[str],
    required_terms: list[str],
    state_filters: set[str],
) -> int | None:
    title_text, description_text, organization_text, state_text, tags_text, combined_text = dataset_search_text(dataset)

    if domain_filters and dataset.get("sectorKey") not in domain_filters:
        return None

    if state_filters and not any(dataset_matches_state_filter(dataset, state_code) for state_code in state_filters):
        return None

    exact_title = int(bool(query_text and query_text in title_text))
    exact_description = int(bool(query_text and query_text in description_text))
    exact_organization = int(bool(query_text and query_text in organization_text))
    exact_state = int(bool(query_text and query_text in state_text))
    exact_tags = int(bool(query_text and query_text in tags_text))
    exact_combined = int(bool(query_text and query_text in combined_text))

    query_hits_title = keyword_occurrence_count(title_text, query_terms)
    query_hits_description = keyword_occurrence_count(description_text, query_terms)
    query_hits_organization = keyword_occurrence_count(organization_text, query_terms)
    query_hits_state = keyword_occurrence_count(state_text, query_terms)
    query_hits_tags = keyword_occurrence_count(tags_text, query_terms)

    domain_terms = sorted({keyword for domain in domain_filters for keyword in DOMAIN_KEYWORDS.get(domain, set())})
    domain_hits_title = keyword_occurrence_count(title_text, domain_terms)
    domain_hits_description = keyword_occurrence_count(description_text, domain_terms)
    domain_hits_organization = keyword_occurrence_count(organization_text, domain_terms)
    domain_hits_tags = keyword_occurrence_count(tags_text, domain_terms)

    required_total = keyword_occurrence_count(combined_text, required_terms)
    query_total = query_hits_title + query_hits_description + query_hits_organization + query_hits_state + query_hits_tags
    domain_total = domain_hits_title + domain_hits_description + domain_hits_organization + domain_hits_tags
    exact_total = exact_title + exact_description + exact_organization + exact_state + exact_tags + exact_combined

    if exact_total == 0 and query_total == 0 and domain_total == 0:
        return None

    if required_terms and required_total == 0:
        return None

    return (
        exact_title * 1000
        + exact_description * 700
        + exact_organization * 650
        + exact_state * 650
        + exact_tags * 500
        + exact_combined * 450
        + query_hits_title * 150
        + query_hits_description * 110
        + query_hits_organization * 95
        + query_hits_state * 85
        + query_hits_tags * 90
        + domain_hits_title * 35
        + domain_hits_description * 25
        + domain_hits_organization * 20
        + domain_hits_tags * 20
        + required_total * 240
    )


def normalized_column_name(column: str) -> str:
    return normalize_search_text(column)


def is_identifier_column(column: str) -> bool:
    normalized = normalized_column_name(column)
    tokens = set(normalized.split())
    return bool(tokens & IDENTIFIER_HINTS) or normalized.endswith(" id") or normalized == "id"


def format_metric_value(value: float | int | None) -> str:
    if value is None:
        return "0"
    numeric = float(value)
    if numeric.is_integer():
        return f"{int(numeric):,}"
    return f"{numeric:,.2f}".rstrip("0").rstrip(".")


def too_large_visualization_payload(total_rows: int | None) -> dict[str, Any]:
    total = safe_int(total_rows, 0)
    return {
        "message": "Data is too large to visualize immediately.",
        "charts": [],
        "rowCount": total,
        "threshold": MAX_DYNAMIC_VISUALIZATION_ROWS,
    }


def adaptive_category_bucket_limit(record_count: int) -> int:
    if record_count <= 0:
        return MAX_CATEGORY_BUCKETS
    if record_count <= MAX_CATEGORY_BUCKETS:
        return record_count
    return min(max(MAX_CATEGORY_BUCKETS, math.ceil(record_count * 0.35)), 16)


def percentile(values: list[float], ratio: float) -> float | None:
    if not values:
        return None
    if len(values) == 1:
        return values[0]

    sorted_values = sorted(values)
    position = (len(sorted_values) - 1) * ratio
    lower_index = math.floor(position)
    upper_index = math.ceil(position)

    if lower_index == upper_index:
        return sorted_values[lower_index]

    lower_value = sorted_values[lower_index]
    upper_value = sorted_values[upper_index]
    weight = position - lower_index
    return lower_value + (upper_value - lower_value) * weight


def label_mapping_payload(labels: list[str]) -> tuple[list[str], list[dict[str, str]]]:
    if not labels:
        return [], []

    use_short_labels = any(len(label) > LONG_LABEL_THRESHOLD for label in labels)
    if not use_short_labels:
        return labels, []

    display_labels: list[str] = []
    mapping: list[dict[str, str]] = []
    for index, label in enumerate(labels, start=1):
        short_label = str(index)
        display_labels.append(short_label)
        mapping.append({"shortLabel": short_label, "fullLabel": label})
    return display_labels, mapping


def detect_numeric_columns(records: list[dict[str, Any]], columns: list[str]) -> list[str]:
    # For visualization we only need 1-2 columns, so optimize for early exit
    sample = records[:COLUMN_DETECTION_SAMPLE_SIZE]
    candidates: list[tuple[int, int, str]] = []
    
    # First pass: quick check with smaller sample for speed
    quick_sample = sample[:min(100, len(sample))]
    
    for column in columns:
        non_empty = 0
        valid_numeric = 0
        for record in quick_sample:
            value = record.get(column)
            if value in (None, ""):
                continue
            non_empty += 1
            if safe_float(value) is not None:
                valid_numeric += 1

        # Skip obviously non-numeric columns immediately
        if non_empty == 0 or valid_numeric < 1:
            continue
        
        # For quick pass, require 50% validity (loose threshold)
        if valid_numeric / non_empty < 0.5:
            continue

        # Full validation only on promising candidates
        full_non_empty = 0
        full_valid_numeric = 0
        for record in sample:
            value = record.get(column)
            if value in (None, ""):
                continue
            full_non_empty += 1
            if safe_float(value) is not None:
                full_valid_numeric += 1
        
        if full_non_empty == 0 or full_valid_numeric < 2:
            continue
        
        if full_valid_numeric / full_non_empty < 0.7:
            continue

        candidates.append((1 if is_identifier_column(column) else 0, -full_valid_numeric, column))
        
        # Early exit: if we found 2+ good numeric columns, we can stop
        if len(candidates) >= 2:
            break

    candidates.sort(key=lambda item: (item[0], item[1], item[2].lower()))
    return [column for _, _, column in candidates]


def detect_categorical_columns(records: list[dict[str, Any]], columns: list[str], numeric: list[str]) -> list[str]:
    sample = records[:COLUMN_DETECTION_SAMPLE_SIZE]
    preferred: list[tuple[int, float, int, str]] = []
    fallback: list[tuple[int, float, int, str]] = []

    for column in columns:
        if column in numeric:
            continue

        values = [str(record.get(column) or "").strip() for record in sample]
        values = [value for value in values if value]
        if len(values) < 2:
            continue

        unique_count = len(set(values))
        if unique_count < 2:
            continue

        unique_ratio = unique_count / len(values)
        candidate = (1 if is_identifier_column(column) else 0, abs(unique_ratio - 0.25), unique_count, column)
        if unique_count <= max(MAX_CATEGORY_BUCKETS * 4, 20) or unique_ratio <= 0.65:
            preferred.append(candidate)
        else:
            fallback.append(candidate)

    ranked_candidates = preferred or fallback
    ranked_candidates.sort(key=lambda item: (item[0], item[1], item[2], item[3].lower()))
    return [column for _, _, _, column in ranked_candidates]


def aggregate_category_values(
    records: list[dict[str, Any]],
    category_column: str,
    numeric_column: str,
) -> list[dict[str, Any]]:
    aggregated: dict[str, float] = defaultdict(float)

    for record in records:
        category = str(record.get(category_column) or "").strip() or "Unknown"
        value = safe_float(record.get(numeric_column))
        if value is None:
            continue
        aggregated[category] += value

    return [
        {"label": label, "value": value}
        for label, value in sorted(aggregated.items(), key=lambda item: (-item[1], item[0].lower()))
    ]


def build_bar_chart(records: list[dict[str, Any]], category_column: str, numeric_column: str) -> dict[str, Any] | None:
    ranked_values = aggregate_category_values(records, category_column, numeric_column)
    if not ranked_values:
        return None

    bucket_limit = adaptive_category_bucket_limit(len(records))
    grouped_categories: list[dict[str, Any]] = []
    if bucket_limit > 1 and len(ranked_values) > bucket_limit:
        grouped_categories = ranked_values[bucket_limit - 1 :]
        others_value = sum(item["value"] for item in grouped_categories)
        ranked_values = ranked_values[: bucket_limit - 1]
        ranked_values.append({"label": "Others", "value": others_value})

    labels = [str(item["label"]) for item in ranked_values]
    display_labels, label_mapping = label_mapping_payload(labels)

    chart_data: list[dict[str, Any]] = []
    for index, item in enumerate(ranked_values):
        chart_data.append(
            {
                "displayLabel": display_labels[index],
                "fullLabel": str(item["label"]),
                "value": item["value"],
                "grouped": str(item["label"]) == "Others",
            }
        )

    return {
        "type": "bar",
        "title": f"{numeric_column} vs {category_column}",
        "xKey": "displayLabel",
        "yKey": "value",
        "xLabel": category_column,
        "yLabel": numeric_column,
        "data": chart_data,
        "labelMapping": label_mapping,
        "groupedCategories": [
            {"label": item["label"], "value": format_metric_value(item["value"])}
            for item in grouped_categories
        ],
        "groupedTotal": format_metric_value(sum(item["value"] for item in grouped_categories)) if grouped_categories else None,
    }


def build_histogram_chart(values: list[float], numeric_column: str) -> dict[str, Any] | None:
    if not values:
        return None

    minimum = min(values)
    maximum = max(values)
    if math.isclose(minimum, maximum):
        return {
            "type": "histogram",
            "title": f"Count vs {numeric_column}",
            "xKey": "displayLabel",
            "yKey": "count",
            "xLabel": numeric_column,
            "yLabel": "Count",
            "data": [
                {
                    "displayLabel": format_metric_value(minimum),
                    "fullLabel": f"{numeric_column} = {format_metric_value(minimum)}",
                    "count": len(values),
                }
            ],
            "labelMapping": [],
            "groupedCategories": [],
            "groupedTotal": None,
        }

    bin_count = min(10, max(5, int(math.sqrt(len(values)))))
    width = (maximum - minimum) / bin_count
    bins = [0 for _ in range(bin_count)]

    for value in values:
        index = min(int((value - minimum) / width), bin_count - 1)
        bins[index] += 1

    full_labels: list[str] = []
    for index in range(bin_count):
        lower = minimum + (width * index)
        upper = maximum if index == bin_count - 1 else minimum + (width * (index + 1))
        full_labels.append(f"{format_metric_value(lower)} to {format_metric_value(upper)}")

    display_labels, label_mapping = label_mapping_payload(full_labels)
    chart_data = [
        {
            "displayLabel": display_labels[index],
            "fullLabel": full_labels[index],
            "count": bins[index],
        }
        for index in range(bin_count)
    ]

    return {
        "type": "histogram",
        "title": f"Count vs {numeric_column}",
        "xKey": "displayLabel",
        "yKey": "count",
        "xLabel": numeric_column,
        "yLabel": "Count",
        "data": chart_data,
        "labelMapping": label_mapping,
        "groupedCategories": [],
        "groupedTotal": None,
    }


def api_url(resource_id: str, *, limit: int = 500, offset: int = 0) -> str:
    return (
        f"{API_BASE_URL}/resource/{resource_id}"
        f"?api-key={API_KEY}&format=json&offset={offset}&limit={limit}"
    )


def public_dataset_url(resource_id: str) -> str:
    normalized_id = str(resource_id).replace(".csv", "")
    return f"https://www.data.gov.in/resource/{normalized_id}"


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
                        "tags": normalize_tag_list(
                            item.get("tags"),
                            item.get("keywords"),
                            item.get("keyword"),
                            item.get("category"),
                            item.get("sector"),
                        ),
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


def sector_uses_summary_catalog(sector_key: str) -> bool:
    return normalize_sector_key(sector_key) in SUMMARY_BACKED_CATALOG_SECTORS


def summary_title_state(title: Any) -> str:
    text = str(title or "").strip()
    if " - " in text:
        suffix = text.rsplit(" - ", 1)[1].strip()
        if suffix:
            return suffix
    return "All States"


def summary_title_description(title: Any) -> str:
    text = str(title or "").strip()
    if " - " in text:
        return text.rsplit(" - ", 1)[0].strip()
    return text


def sector_catalog_datasets(sector_key: str) -> list[dict[str, Any]]:
    normalized_sector = normalize_sector_key(sector_key)
    base_datasets = load_catalogs().get(normalized_sector, [])

    if not sector_uses_summary_catalog(normalized_sector):
        return base_datasets

    summary_path = SUMMARY_DIR / f"{normalized_sector}.csv"
    if not summary_path.exists():
        return base_datasets

    merged: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    base_by_id = {str(dataset.get("id") or ""): dataset for dataset in base_datasets}

    try:
        with summary_path.open("r", newline="", encoding="utf-8-sig") as csv_file:
            for row in csv.DictReader(csv_file):
                resource_id = str(row.get("Resource ID") or "").strip().replace(".csv", "")
                if not resource_id or resource_id in seen_ids:
                    continue

                base_dataset = dict(base_by_id.get(resource_id) or {})
                title = str(row.get("Dataset Name") or base_dataset.get("title") or "Untitled Dataset").strip()
                merged.append(
                    {
                        "id": resource_id,
                        "resourceId": resource_id,
                        "title": title,
                        "description": str(base_dataset.get("description") or summary_title_description(title)).strip(),
                        "tags": normalize_tag_list(
                            base_dataset.get("tags"),
                            title,
                            sector_label(normalized_sector),
                        ),
                        "organization": str(
                            base_dataset.get("organization")
                            or f"Ministry of {sector_label(normalized_sector)}"
                        ).strip(),
                        "publishedDate": normalize_date(row.get("Published Date") or base_dataset.get("publishedDate")),
                        "updatedDate": normalize_date(base_dataset.get("updatedDate") or row.get("Published Date")),
                        "state": str(base_dataset.get("state") or summary_title_state(title)).strip(),
                        "sector": sector_label(normalized_sector),
                        "sectorKey": normalized_sector,
                        "category": str(base_dataset.get("category") or sector_label(normalized_sector)).strip(),
                        "datasetCount": safe_int(row.get("Number of Rows"), safe_int(base_dataset.get("datasetCount"))),
                        "apiCount": safe_int(base_dataset.get("apiCount"), 1),
                    }
                )
                seen_ids.add(resource_id)
    except OSError:
        return base_datasets

    for dataset in base_datasets:
        resource_id = str(dataset.get("id") or "").strip()
        if not resource_id or resource_id in seen_ids:
            continue
        merged.append(dataset)
        seen_ids.add(resource_id)

    return merged


def sector_page_from_catalog(
    sector_key: str,
    *,
    page: int = 1,
    limit: int = CATALOG_PAGE_SIZE,
    source: str = "local_fallback",
    warning: str | None = None,
) -> dict[str, Any]:
    normalized_sector = normalize_sector_key(sector_key)
    datasets = [enrich_dataset(dataset) for dataset in sector_catalog_datasets(normalized_sector)]
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
        "source": source,
        "warning": warning,
    }


def local_sector_page(sector_key: str, *, page: int = 1, limit: int = CATALOG_PAGE_SIZE) -> dict[str, Any]:
    return sector_page_from_catalog(
        sector_key,
        page=page,
        limit=limit,
        source="local_fallback",
        warning="Using fallback sector catalog because the live metadata API is unavailable.",
    )


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
    for dataset in sector_catalog_datasets(normalized_sector):
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

    title = str(record.get("title") or "Untitled Dataset").strip()
    description = str(record.get("desc") or record.get("description") or "").strip()

    # Extract state from metadata text so state filters can match title-based catalogs too.
    tags = normalize_tag_list(
        record.get("tags"),
        record.get("keywords"),
        record.get("keyword"),
        record.get("group_tags"),
        record.get("theme"),
        sector_values,
    )
    state = extract_state_from_tags(tags, organization, title, description)

    return {
        "id": str(record.get("index_name") or record.get("resource_id") or "").replace(".csv", ""),
        "resourceId": str(record.get("index_name") or record.get("resource_id") or "").replace(".csv", ""),
        "title": title,
        "description": description,
        "tags": tags,
        "organization": organization.strip() or "Government of India",
        "publishedDate": normalize_date(record.get("created_date")),
        "updatedDate": normalize_date(record.get("updated_date")),
        "state": state,
        "sector": sector_label(sector_key),
        "sectorKey": sector_key,
        "category": sector_label(sector_key),
        "datasetCount": 0,
        "apiCount": 1,
    }


def extract_state_from_tags(tags: list[str], organization: str, *extra_texts: Any) -> str:
    """Extract state code from tags and organization field.
    
    Returns state code (e.g., "UP", "KA", "DL") or "ALL" if not found.
    Must match the state codes from frontend constants/states.js
    """
    combined_text = normalize_search_text(" ".join([*tags, organization, *(str(item or "") for item in extra_texts)]))

    for alias, state_code in STATE_FILTER_ALIAS_LOOKUP:
        if contains_normalized_phrase(combined_text, alias):
            return state_code

    return "ALL"


def get_dataset_by_id(resource_id: str) -> tuple[str | None, dict[str, Any] | None]:
    normalized_id = str(resource_id).replace(".csv", "")
    for sector_key in sector_keys():
        items = sector_catalog_datasets(sector_key)
        for dataset in items:
            if dataset["id"] == normalized_id:
                return sector_key, dataset

    try:
        payload = request_json(api_url(normalized_id, limit=1, offset=0))
    except requests.RequestException as exc:
        # Preserve downstream status handling for API rate limits.
        if "429" in str(exc):
            raise
        # Dataset not found or API failure should be treated as missing dataset.
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
        "sourceUrl": str(dataset.get("sourceUrl") or public_dataset_url(dataset["id"])),
    }


def fetch_sector_api_page(sector_key: str, *, page: int = 1, limit: int = CATALOG_PAGE_SIZE) -> dict[str, Any]:
    normalized_sector = normalize_sector_key(sector_key)
    bounded_page = max(page, 1)
    bounded_limit = max(limit, 1)
    cache_key = (normalized_sector, bounded_page, bounded_limit)
    cached_response = _sector_page_cache.get(cache_key)
    if cached_response and cached_response.get("source") in {"api", "summary_catalog"}:
        return _sector_page_cache[cache_key]

    if sector_uses_summary_catalog(normalized_sector):
        response = sector_page_from_catalog(
            normalized_sector,
            page=bounded_page,
            limit=bounded_limit,
            source="summary_catalog",
            warning=None,
        )
        _sector_page_cache[cache_key] = response
        _sector_total_cache[normalized_sector] = safe_int(response.get("totalDatasets"))
        return response

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


def fetch_all_sector_datasets(sector_key: str, *, max_batches: int = 4) -> list[dict[str, Any]]:
    """
    Fetch multiple batches of datasets for a sector to use with state filtering.
    
    Args:
        sector_key: Sector to fetch datasets for
        max_batches: Maximum batches to fetch (each batch = STATE_FILTER_BATCH_SIZE)
    
    Returns:
        List of all datasets fetched (up to max_batches * STATE_FILTER_BATCH_SIZE)
    """
    all_datasets = []
    normalized_sector = normalize_sector_key(sector_key)
    
    for batch_num in range(1, max_batches + 1):
        try:
            response = fetch_sector_api_page(normalized_sector, page=batch_num, limit=STATE_FILTER_BATCH_SIZE)
            datasets = response.get("datasets", [])
            
            if not datasets:
                # No more datasets to fetch
                break
            
            all_datasets.extend(datasets)
            
            # Stop if we've reached the end
            total_pages = response.get("totalPages", 0)
            if batch_num >= total_pages:
                break
                
        except Exception:
            # If batch fetch fails, return what we have
            break
    
    return all_datasets


def get_sector_datasets(
    sector_key: str,
    *,
    page: int = 1,
    limit: int = CATALOG_PAGE_SIZE,
    state_filter: str | None = None,
) -> dict[str, Any]:
    """Fetch datasets for a sector, optionally filtered by state."""
    normalized_sector = normalize_sector_key(sector_key)
    bounded_page = max(page, 1)
    bounded_limit = max(limit, 1)
    normalized_state_filter = normalize_state_code(state_filter)

    has_state_filter = bool(normalized_state_filter and normalized_state_filter != "ALL")

    if not has_state_filter:
        return fetch_sector_api_page(normalized_sector, page=bounded_page, limit=bounded_limit)

    filtered_datasets = [
        dataset
        for dataset in sector_catalog_datasets(normalized_sector)
        if dataset_matches_state_filter(dataset, normalized_state_filter)
    ]

    total = len(filtered_datasets)
    start_idx = (bounded_page - 1) * bounded_limit
    end_idx = start_idx + bounded_limit
    paginated_datasets = [enrich_dataset(dataset) for dataset in filtered_datasets[start_idx:end_idx]]

    return {
        "sector": sector_label(normalized_sector),
        "sectorKey": normalized_sector,
        "datasets": paginated_datasets,
        "page": bounded_page,
        "limit": bounded_limit,
        "totalDatasets": total,
        "totalPages": max(1, math.ceil(total / bounded_limit)) if total else 0,
        "source": "filtered_catalog",
        "warning": None,
        "stateFilter": normalized_state_filter if has_state_filter else "ALL",
    }


def get_all_datasets(limit: int = CATALOG_PAGE_SIZE) -> dict[str, dict[str, Any]]:
    return {sector_label(key): get_sector_datasets(key, page=1, limit=limit) for key in sector_keys()}


def search_datasets(query: str, sector_key: str | None = None) -> list[dict[str, Any]]:
    query_text = normalize_search_text(query)
    query_terms = unique_query_terms(query)
    if not query_text or not query_terms:
        return []

    normalized_sector = normalize_sector_key(sector_key) if sector_key else None
    domain_filters = detect_query_domains(query_terms)
    state_filters = detect_query_states(query_text)
    effective_domain_filters = {normalized_sector} if normalized_sector else domain_filters
    required_terms = required_query_terms(query_terms, state_filters, effective_domain_filters)
    sectors_to_search = [normalized_sector] if normalized_sector else sorted(domain_filters) or sector_keys()
    scored_results: dict[str, tuple[int, dict[str, Any]]] = {}

    for key in sectors_to_search:
        local_datasets = [enrich_dataset(dataset) for dataset in sector_catalog_datasets(key)]
        api_preview = fetch_sector_api_page(key, page=1, limit=50).get("datasets", [])
        for dataset in [*api_preview, *local_datasets]:
            score = search_relevance_score(
                dataset,
                query_text,
                query_terms,
                effective_domain_filters,
                required_terms,
                state_filters,
            )
            if score is None:
                continue

            dataset_id = str(dataset.get("id") or "")
            existing = scored_results.get(dataset_id)
            if existing is None or score > existing[0]:
                scored_results[dataset_id] = (score, dataset)

    ranked = sorted(
        scored_results.values(),
        key=lambda item: (-item[0], str(item[1].get("title") or "").lower()),
    )
    return [dataset for _, dataset in ranked]


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
            datasets = sector_catalog_datasets(normalized_sector)
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


def search_resource_metadata(query: str, limit: int = 10) -> list[dict]:
    """
    Search data.gov.in catalog for RESOURCE_ID matching query.
    Returns closest matching datasets with RESOURCE_ID.
    """
    params = {
        "api-key": API_KEY,
        "q": query,
        "limit": limit,
    }
    try:
        payload = request_json_params("https://api.data.gov.in/catalog", params)
        records = payload.get("results", [])
        return [
            {
                "resource_id": str(record.get("resource_id") or ""),
                "title": str(record.get("title") or ""),
                "description": str(record.get("desc") or ""),
                "sector": str(record.get("sector") or ""),
                "organization": str(record.get("organization") or ""),
            }
            for record in records if isinstance(record, dict) and record.get("resource_id")
        ][:limit]
    except requests.RequestException:
        return []

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
        "description": str(dataset.get("description") or "").strip(),
        "tags": normalize_tag_list(dataset.get("tags")),
        "organization": str(dataset.get("organization") or "").strip(),
        "publishedDate": dataset.get("publishedDate"),
        "updatedDate": dataset.get("updatedDate"),
        "sourceUrl": str(dataset.get("sourceUrl") or public_dataset_url(dataset["id"])),
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


def get_visualization_cache(resource_id: str) -> dict[str, Any] | None:
    """Retrieve cached visualization if it exists and hasn't expired."""
    if resource_id not in _visualization_cache:
        return None
    cached_viz, timestamp = _visualization_cache[resource_id]
    if time.time() - timestamp > VISUALIZATION_CACHE_TTL_SECONDS:
        del _visualization_cache[resource_id]
        return None
    return cached_viz


def set_visualization_cache(resource_id: str, visualization: dict[str, Any]) -> None:
    """Store visualization in cache with current timestamp."""
    _visualization_cache[resource_id] = (visualization, time.time())


def numeric_columns(records: list[dict[str, Any]], columns: list[str] | None = None) -> list[str]:
    if not records:
        return []
    resolved_columns = columns or list(records[0].keys())
    return detect_numeric_columns(records, resolved_columns)


def infer_visualization(records: list[dict[str, Any]], columns: list[str], *, total_rows: int | None = None) -> dict[str, Any]:
    resolved_columns = columns or (list(records[0].keys()) if records else [])
    total = total_rows or len(records)

    if total > MAX_DYNAMIC_VISUALIZATION_ROWS:
        return too_large_visualization_payload(total)

    if not records or not resolved_columns:
        return {"message": "No visualization available for this dataset.", "charts": []}

    numeric = detect_numeric_columns(records, resolved_columns)
    if not numeric:
        return {"message": "No numeric columns available for visualization.", "charts": []}

    primary_numeric = numeric[0]
    categorical = detect_categorical_columns(records, resolved_columns, numeric)
    if categorical:
        bar_chart = build_bar_chart(records, categorical[0], primary_numeric)
        if bar_chart:
            return {"message": None, "charts": [bar_chart], "rowCount": total}

    numeric_values = [safe_float(record.get(primary_numeric)) for record in records]
    numeric_values = [value for value in numeric_values if value is not None]
    histogram_chart = build_histogram_chart(numeric_values, primary_numeric)
    if histogram_chart:
        return {"message": None, "charts": [histogram_chart], "rowCount": total}

    return {"message": "No visualization available for this dataset.", "charts": []}


def dataset_insights(
    records: list[dict[str, Any]],
    columns: list[str],
    *,
    total_rows: int | None = None,
    sampled: bool = False,
) -> list[str]:
    resolved_columns = columns or (list(records[0].keys()) if records else [])
    if not records or not resolved_columns:
        return []

    insights: list[str] = []
    analyzed_rows = len(records)
    actual_total_rows = total_rows or analyzed_rows
    insights.append(
        f"Dataset has {analyzed_rows:,} rows and {len(resolved_columns):,} columns."
    )

    if sampled and actual_total_rows > analyzed_rows:
        insights.append(
            f"Insights are based on the first {analyzed_rows:,} rows sampled from {actual_total_rows:,} total rows."
        )

    numeric = detect_numeric_columns(records, resolved_columns)
    categorical = detect_categorical_columns(records, resolved_columns, numeric)

    if categorical:
        insights.append(
            f"Key categorical column detected: {categorical[0]}."
        )
    if numeric:
        insights.append(
            f"Numeric columns include: {', '.join(numeric)}."
        )

    def parse_year(col_name: str) -> str | None:
        match = re.search(r"(\d{4}(?:-\d{2})?)", col_name)
        if match:
            return match.group(1)
        return None

    def normalize_metric_name(col_name: str) -> str:
        base = re.sub(r"(\d{4}(?:-\d{2})?|grand total)", "", col_name, flags=re.IGNORECASE)
        base = re.sub(r"[^a-z0-9]+", " ", base.lower()).strip()
        return base

    major_groups: dict[str, dict[str, str]] = {}
    for col in resolved_columns:
        if col in categorical:
            continue
        year = parse_year(col)
        if not year:
            continue
        group = normalize_metric_name(col)
        if not group:
            continue
        major_groups.setdefault(group, {})[year] = col

    if categorical and major_groups:
        category_column = categorical[0]
        for group_name, yearly_cols in major_groups.items():
            if len(yearly_cols) < 2:
                continue

            group_insights: list[str] = []
            annual_leaders: list[str] = []
            overall_totals: dict[str, float] = {}

            for year, col_name in sorted(yearly_cols.items()):
                best_state = None
                best_value = float("-inf")
                for row in records:
                    state_key = str(row.get(category_column, "")).strip() or "Unknown"
                    value = safe_float(row.get(col_name))
                    if value is None:
                        continue
                    overall_totals[state_key] = overall_totals.get(state_key, 0.0) + value
                    if value > best_value:
                        best_value = value
                        best_state = state_key

                if best_state is not None:
                    annual_leaders.append(f"{year}={best_state} ({format_metric_value(best_value)})")

            if not overall_totals or not annual_leaders:
                continue

            highest_state = max(overall_totals.items(), key=lambda pair: pair[1])
            group_insights.append(
                f"For '{group_name}', overall top state is {highest_state[0]} with {format_metric_value(highest_state[1])}."
            )
            group_insights.append(
                f"Year-by-year leaders for '{group_name}': {', '.join(annual_leaders)}."
            )

            if len(group_insights) > 0:
                insights.extend(group_insights)

            # Add a rapid growth highlight if possible
            if len(yearly_cols) >= 2:
                sorted_years = sorted(yearly_cols.keys())
                first_year = sorted_years[0]
                last_year = sorted_years[-1]
                first_col = yearly_cols[first_year]
                last_col = yearly_cols[last_year]
                growth_candidates = []
                for state, total in overall_totals.items():
                    first_val = safe_float(next((r.get(first_col) for r in records if str(r.get(category_column, "")).strip() == state), None))
                    last_val = safe_float(next((r.get(last_col) for r in records if str(r.get(category_column, "")).strip() == state), None))
                    if first_val is None or last_val is None or first_val == 0:
                        continue
                    growth_candidates.append((state, (last_val - first_val) / first_val * 100.0))
                if growth_candidates:
                    best_growth = max(growth_candidates, key=lambda item: item[1])
                    insights.append(
                        f"{best_growth[0]} has the highest growth for '{group_name}' from {first_year} to {last_year} ({format_metric_value(best_growth[1])}% increase)."
                    )

    if not numeric:
        return insights

    primary_numeric = numeric[0]
    numeric_values = [safe_float(record.get(primary_numeric)) for record in records]
    numeric_values = [value for value in numeric_values if value is not None]
    if not numeric_values:
        return insights

    if categorical:
        category_column = categorical[0]
        ranked_values = aggregate_category_values(records, category_column, primary_numeric)
        if ranked_values:
            highest = ranked_values[0]
            lowest = ranked_values[-1]
            category_values = [item["value"] for item in ranked_values]
            average_value = sum(category_values) / len(category_values)
            total_value = sum(category_values)
            top_three_share = (sum(item["value"] for item in ranked_values[:3]) / total_value * 100) if total_value else 0

            insights.append(
                f"{category_column} '{highest['label']}' has the highest {primary_numeric} ({format_metric_value(highest['value'])})."
            )
            insights.append(
                f"{category_column} '{lowest['label']}' has the lowest {primary_numeric} ({format_metric_value(lowest['value'])})."
            )
            insights.append(
                f"Average {primary_numeric} across {len(ranked_values):,} {category_column.lower()} categories is {format_metric_value(average_value)}."
            )
            insights.append(
                f"The top 3 {category_column.lower()} categories contribute {format_metric_value(top_three_share)}% of the total {primary_numeric}."
            )

            q1 = percentile(category_values, 0.25)
            q3 = percentile(category_values, 0.75)
            if q1 is not None and q3 is not None:
                insights.append(
                    f"Most category totals fall between {format_metric_value(q1)} and {format_metric_value(q3)} for {primary_numeric}."
                )

            if len(category_values) >= 4 and q1 is not None and q3 is not None:
                iqr = q3 - q1
                upper_bound = q3 + (1.5 * iqr)
                outliers = [item["label"] for item in ranked_values if item["value"] > upper_bound]
                if outliers:
                    insights.append(
                        f"Potential high-value outliers in {primary_numeric}: {', '.join(outliers[:5])}."
                    )
            return insights

    average_value = sum(numeric_values) / len(numeric_values)
    median_value = percentile(numeric_values, 0.5)
    q1 = percentile(numeric_values, 0.25)
    q3 = percentile(numeric_values, 0.75)
    minimum = min(numeric_values)
    maximum = max(numeric_values)

    insights.append(
        f"{primary_numeric} ranges from {format_metric_value(minimum)} to {format_metric_value(maximum)}."
    )
    insights.append(
        f"Average {primary_numeric} is {format_metric_value(average_value)} and the median is {format_metric_value(median_value)}."
    )
    if q1 is not None and q3 is not None:
        insights.append(
            f"Most values fall between {format_metric_value(q1)} and {format_metric_value(q3)}."
        )
        if len(numeric_values) >= 4:
            iqr = q3 - q1
            lower_bound = q1 - (1.5 * iqr)
            upper_bound = q3 + (1.5 * iqr)
            outlier_count = sum(1 for value in numeric_values if value < lower_bound or value > upper_bound)
            if outlier_count:
                insights.append(f"{outlier_count:,} values appear as potential outliers for {primary_numeric}.")


    return insights


def create_custom_visualization(
    records: list[dict[str, Any]],
    columns: list[str],
    category_column: str,
    numeric_column: str,
    *,
    total_rows: int | None = None,
) -> dict[str, Any]:
    """
    Create a custom visualization based on user-selected categorical and numeric columns.
    
    Args:
        records: List of data records
        columns: Available column names
        category_column: Name of categorical column for X-axis
        numeric_column: Name of numeric column for Y-axis (values to aggregate)
        total_rows: Total row count (for large datasets)
    
    Returns:
        Visualization response with bar chart or error message
    """
    total = total_rows or len(records)
    
    # Check row count
    if total > MAX_DYNAMIC_VISUALIZATION_ROWS:
        return too_large_visualization_payload(total)
    
    # Validate column names exist
    if category_column not in columns:
        return {
            "message": f"Category column '{category_column}' not found in dataset. Available columns: {', '.join(columns[:10])}{'...' if len(columns) > 10 else ''}",
            "charts": [],
        }
    
    if numeric_column not in columns:
        return {
            "message": f"Numeric column '{numeric_column}' not found in dataset. Available columns: {', '.join(columns[:10])}{'...' if len(columns) > 10 else ''}",
            "charts": [],
        }
    
    # Verify numeric column is actually numeric
    numeric_values = [safe_float(record.get(numeric_column)) for record in records[:100]]
    numeric_values = [v for v in numeric_values if v is not None]
    if not numeric_values:
        return {
            "message": f"Column '{numeric_column}' does not contain numeric values. Please select a numeric column.",
            "charts": [],
        }
    
    # Verify category column has string/categorical values
    category_values = [str(record.get(category_column, "")).strip() for record in records[:100]]
    category_values = [v for v in category_values if v]
    if not category_values:
        return {
            "message": f"Column '{category_column}' does not contain usable categorical values.",
            "charts": [],
        }
    
    # Build the bar chart
    bar_chart = build_bar_chart(records, category_column, numeric_column)
    if bar_chart:
        return {
            "message": None,
            "charts": [bar_chart],
            "rowCount": total,
            "customVisualization": True,
        }
    
    return {
        "message": "Could not generate visualization with selected columns.",
        "charts": [],
    }

