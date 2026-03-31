from __future__ import annotations

import re
import uuid

import requests

from .dataset_catalog import (
    MAX_VISUALIZATION_ROWS,
    dataset_insights,
    dataset_link_payload,
    get_sector_datasets,
    fetch_full_dataset,
    get_dataset_by_id,
    search_datasets,
    sector_label,
    sector_link_payload,
)

SECTOR_ALIASES = {
    "health": {"health", "healthcare", "family welfare", "health and family welfare"},
    "education": {"education", "school", "schools"},
    "transport": {"transport", "transportation", "vehicle", "vehicles"},
    "agriculture": {"agriculture", "agri", "farmer", "farmers"},
    "census": {"census", "census and surveys", "survey", "surveys", "population", "demographic", "demographics"},
    "finance": {"finance", "financial", "bank", "banking", "economy", "economic"},
}

ALLOWED_TERMS = {
    "data",
    "dataset",
    "datasets",
    "table",
    "row",
    "rows",
    "column",
    "columns",
    "record",
    "records",
    "chart",
    "visualization",
    "visualize",
    "geo",
    "map",
    "insight",
    "insights",
    "summary",
    "analyze",
    "analysis",
    "trend",
    "trends",
    "download",
    "downloads",
    "view",
    "views",
}

_session_history: dict[str, list[dict[str, str]]] = {}


def detect_sector(query: str, requested_sector: str | None) -> str | None:
    if requested_sector and requested_sector in SECTOR_ALIASES:
        return requested_sector

    lowered = query.lower()
    for sector, aliases in SECTOR_ALIASES.items():
        if any(alias in lowered for alias in aliases):
            return sector
    return None


def should_restrict(query: str, matches: list[dict], sector: str | None) -> bool:
    lowered = query.lower()
    if matches or sector:
        return False
    if any(term in lowered for term in ALLOWED_TERMS):
        return False
    if any(alias in lowered for aliases in SECTOR_ALIASES.values() for alias in aliases):
        return False
    return True


def candidate_queries(query: str) -> list[str]:
    candidates = [query.strip()]
    tokens = [token for token in re.split(r"[^a-zA-Z0-9]+", query.lower()) if len(token) > 2]
    if tokens:
        candidates.extend([" ".join(tokens[:4]), *tokens[:6]])

    unique: list[str] = []
    for candidate in candidates:
        candidate = candidate.strip()
        if candidate and candidate not in unique:
            unique.append(candidate)
    return unique


def find_dataset_matches(query: str, sector: str | None) -> list[dict]:
    for candidate in candidate_queries(query):
        matches = search_datasets(candidate, sector)
        if matches:
            return matches[:8]
    return []


def wants_sector_summary(query: str, sector: str | None) -> bool:
    lowered = query.lower()
    return sector is not None and any(keyword in lowered for keyword in ["summary", "summarize", "list", "show", "few"])


def record_session_message(session_id: str, role: str, content: str) -> list[dict[str, str]]:
    history = _session_history.setdefault(session_id, [])
    history.append({"role": role, "content": content})
    return history


def build_restriction_response(session_id: str) -> dict:
    message = "This chatbot is restricted to dataset discovery, dataset details, and insights generated from dataset content only."
    record_session_message(session_id, "assistant", message)
    return {
        "sessionId": session_id,
        "restricted": True,
        "content": message,
        "matches": [],
        "insights": [],
        "history": _session_history[session_id],
    }


def build_match_response(session_id: str, matches: list[dict], sector: str | None) -> dict:
    sector_suffix = f" in {sector_label(sector)}" if sector else ""
    message = f"Found {len(matches)} matching datasets{sector_suffix}."
    record_session_message(session_id, "assistant", message)
    return {
        "sessionId": session_id,
        "restricted": False,
        "content": message,
        "matches": [dataset_link_payload(match) for match in matches],
        "insights": [],
        "history": _session_history[session_id],
    }


def build_sector_summary_response(session_id: str, sector: str, matches: list[dict]) -> dict:
    label = sector_label(sector)
    message = f"Here are a few datasets from the {label} section."
    record_session_message(session_id, "assistant", message)
    links = [sector_link_payload(sector, f"Open {label} sector"), *[dataset_link_payload(match) for match in matches]]
    return {
        "sessionId": session_id,
        "restricted": False,
        "content": message,
        "matches": links,
        "insights": [],
        "history": _session_history[session_id],
    }


def build_insight_response(session_id: str, dataset: dict, insights: list[str]) -> dict:
    message = f"Insights generated from dataset content for {dataset['title']}."
    record_session_message(session_id, "assistant", message)
    return {
        "sessionId": session_id,
        "restricted": False,
        "content": message,
        "matches": [dataset_link_payload(dataset)],
        "insights": insights,
        "history": _session_history[session_id],
    }


def chatbot_response(query: str, session_id: str | None = None, sector: str | None = None) -> dict:
    active_session_id = session_id or str(uuid.uuid4())
    record_session_message(active_session_id, "user", query)

    detected_sector = detect_sector(query, sector)
    matches = find_dataset_matches(query, detected_sector)

    if should_restrict(query, matches, detected_sector):
        return build_restriction_response(active_session_id)

    if wants_sector_summary(query, detected_sector):
        sector_page = get_sector_datasets(detected_sector, page=1, limit=5)
        sector_matches = sector_page.get("datasets", [])
        return build_sector_summary_response(active_session_id, detected_sector, sector_matches)

    wants_insights = any(keyword in query.lower() for keyword in ["insight", "insights", "analyze", "analysis", "summary", "about", "explain"])
    if wants_insights:
        selected_dataset = None
        if matches:
            selected_dataset = matches[0]
        else:
            sector_key, dataset = get_dataset_by_id(query.strip())
            if dataset is not None:
                selected_dataset = dataset

        if selected_dataset is not None:
            try:
                full_dataset = fetch_full_dataset(selected_dataset["id"], max_rows=MAX_VISUALIZATION_ROWS)
            except requests.RequestException:
                failure_message = "Dataset insights are temporarily unavailable because the dataset API could not be reached."
                record_session_message(active_session_id, "assistant", failure_message)
                return {
                    "sessionId": active_session_id,
                    "restricted": False,
                    "content": failure_message,
                    "matches": [dataset_link_payload(selected_dataset)],
                    "insights": [],
                    "history": _session_history[active_session_id],
                }

            if full_dataset.get("tooLarge"):
                too_large_message = "Dataset too large for visualization."
                record_session_message(active_session_id, "assistant", too_large_message)
                return {
                    "sessionId": active_session_id,
                    "restricted": False,
                    "content": too_large_message,
                    "matches": [dataset_link_payload(selected_dataset)],
                    "insights": [],
                    "history": _session_history[active_session_id],
                }

            insights = dataset_insights(full_dataset.get("records", []), full_dataset.get("columns", []))
            return build_insight_response(active_session_id, selected_dataset, insights)

    if matches:
        return build_match_response(active_session_id, matches, detected_sector)

    message = "No matching datasets were found for that request."
    record_session_message(active_session_id, "assistant", message)
    return {
        "sessionId": active_session_id,
        "restricted": False,
        "content": message,
        "matches": [],
        "insights": [],
        "history": _session_history[active_session_id],
    }
