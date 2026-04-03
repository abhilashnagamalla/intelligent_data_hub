from __future__ import annotations

import re
import uuid
from difflib import get_close_matches

import requests

from .dataset_catalog import (
    MAX_VISUALIZATION_ROWS,
    RAW_STATE_FILTER_ALIASES,
    STATE_FILTER_ALIAS_LOOKUP,
    aggregate_category_values,
    contains_normalized_phrase,
    detect_categorical_columns,
    dataset_matches_state_filter,
    detect_query_domains,
    detect_query_states,
    dataset_insights,
    dataset_link_payload,
    enrich_dataset,
    get_sector_datasets,
    format_metric_value,
    fetch_full_dataset,
    get_dataset_by_id,
    normalize_search_text,
    safe_float,
    search_datasets,
    sector_catalog_datasets,
    sector_label,
    sector_link_payload,
    unique_query_terms,
)

SECTOR_ALIASES = {
    "health": {
        "health",
        "healthcare",
        "family welfare",
        "health and family welfare",
        "hospital",
        "hospitals",
        "medical",
        "medicine",
        "medicines",
        "pharma",
        "pharmacy",
    },
    "education": {
        "education",
        "educational",
        "school",
        "schools",
        "college",
        "colleges",
        "university",
        "universities",
        "higher education",
        "institute",
        "institutes",
        "institution",
        "institutions",
        "teacher",
        "teachers",
        "student",
        "students",
    },
    "transport": {"transport", "transportation", "vehicle", "vehicles", "road", "roads", "traffic"},
    "agriculture": {"agriculture", "agri", "farmer", "farmers"},
    "census": {"census", "census and surveys", "survey", "surveys", "population", "demographic", "demographics"},
    "finance": {"finance", "financial", "bank", "banking", "economy", "economic"},
}

TOPIC_ALIASES = {
    "college": {
        "college",
        "colleges",
        "colleague",
        "colleage",
        "colleges",
        "higher education",
        "educational institution",
        "educational institutions",
        "institution",
        "institutions",
        "institute",
        "institutes",
        "university",
        "universities",
    },
    "school": {
        "school",
        "schools",
        "schooling",
        "teacher",
        "teachers",
        "student",
        "students",
        "enrolment",
        "enrollment",
        "literacy",
    },
    "medicine": {
        "medicine",
        "medicines",
        "medical",
        "drug",
        "drugs",
        "pharma",
        "pharmacy",
        "pharmaceutical",
        "pharmaceuticals",
    },
    "toll": {
        "toll",
        "tolls",
        "tolling",
        "toll fee",
        "toll tax",
        "toll plaza",
        "toll plazas",
        "highway toll",
        "road toll",
        "plaza",
        "plazas",
    },
}

QUERY_FILTER_TERMS = {
    "about",
    "all",
    "any",
    "details",
    "filter",
    "filtered",
    "for",
    "from",
    "in",
    "list",
    "of",
    "or",
    "section",
    "sector",
    "show",
    "that",
    "the",
    "to",
    "under",
    "with",
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

EXTREME_MAX_TERMS = {"highest", "maximum", "max", "largest", "most", "peak"}
EXTREME_MIN_TERMS = {"lowest", "minimum", "min", "least", "smallest"}
AMBIGUOUS_MAX_TERMS = {"high", "higher", "top", "more"}
AMBIGUOUS_MIN_TERMS = {"low", "lower", "less"}
EXTREME_CONTEXT_TERMS = {
    "amount",
    "amounts",
    "avg",
    "average",
    "collected",
    "count",
    "counts",
    "fee",
    "fees",
    "metric",
    "metrics",
    "rate",
    "rates",
    "record",
    "records",
    "row",
    "rows",
    "toll",
    "value",
    "values",
    "vehicle",
    "vehicles",
}

_session_history: dict[str, list[dict[str, str]]] = {}


def detect_sector(query: str, requested_sector: str | None) -> str | None:
    if requested_sector and requested_sector in SECTOR_ALIASES:
        return requested_sector

    lowered = query.lower()
    for sector, aliases in SECTOR_ALIASES.items():
        if any(alias in lowered for alias in aliases):
            return sector

    query_terms = unique_query_terms(query)
    best_match = None
    best_score = 0
    for sector, aliases in SECTOR_ALIASES.items():
        score = 0
        single_word_aliases = [alias for alias in aliases if " " not in alias]
        for term in query_terms:
            if term in aliases:
                score += 3
                continue
            if get_close_matches(term, single_word_aliases, n=1, cutoff=0.84):
                score += 2
        if score > best_score:
            best_match = sector
            best_score = score

    if best_match:
        return best_match

    inferred_domains = sorted(detect_query_domains(query_terms))
    if inferred_domains:
        return inferred_domains[0]
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
        candidates.append(" ".join(tokens[:4]))
        if len(tokens) <= 2:
            candidates.extend(tokens[:6])

    unique: list[str] = []
    for candidate in candidates:
        candidate = candidate.strip()
        if candidate and candidate not in unique:
            unique.append(candidate)
    return unique


def state_label_from_code(code: str) -> str:
    aliases = RAW_STATE_FILTER_ALIASES.get(code, set())
    if not aliases:
        return code
    preferred = max(aliases, key=len)
    return " ".join(part.capitalize() for part in preferred.split())


def detect_states(query: str) -> set[str]:
    normalized_query = normalize_search_text(query)
    detected = set(detect_query_states(normalized_query))
    if detected:
        return detected

    tokens = normalized_query.split()
    phrases: list[str] = []
    for size in (3, 2, 1):
        for index in range(0, max(len(tokens) - size + 1, 0)):
            phrases.append(" ".join(tokens[index:index + size]))

    alias_map = {alias: code for alias, code in STATE_FILTER_ALIAS_LOOKUP}
    for phrase in phrases:
        if not phrase:
            continue
        word_count = len(phrase.split())
        candidate_aliases = [alias for alias in alias_map if len(alias.split()) == word_count]
        if not candidate_aliases:
            continue
        cutoff = 0.92 if word_count == 1 else 0.9
        closest = get_close_matches(phrase, candidate_aliases, n=1, cutoff=cutoff)
        if closest:
            detected.add(alias_map[closest[0]])
    return detected


def canonical_topic_term(term: str) -> str:
    normalized = normalize_search_text(term)
    if not normalized:
        return ""

    for canonical, aliases in TOPIC_ALIASES.items():
        if normalized == canonical or normalized in aliases:
            return canonical
        single_word_aliases = [alias for alias in aliases if " " not in alias]
        if get_close_matches(normalized, [canonical, *single_word_aliases], n=1, cutoff=0.84):
            return canonical
    return normalized


def expand_topic_aliases(term: str) -> set[str]:
    canonical = canonical_topic_term(term)
    aliases = {canonical}
    aliases.update(TOPIC_ALIASES.get(canonical, set()))
    return {normalize_search_text(alias) for alias in aliases if normalize_search_text(alias)}


def parse_query_context(query: str, requested_sector: str | None) -> dict[str, object]:
    normalized_query = normalize_search_text(query)
    sector = detect_sector(query, requested_sector)
    states = detect_states(query)

    excluded_terms = set(QUERY_FILTER_TERMS)
    for state_code in states:
        for alias in RAW_STATE_FILTER_ALIASES.get(state_code, set()):
            excluded_terms.update(normalize_search_text(alias).split())
    if sector:
        for alias in SECTOR_ALIASES.get(sector, set()):
            excluded_terms.update(normalize_search_text(alias).split())

    topic_terms: list[str] = []
    for term in unique_query_terms(query):
        if term.isdigit() or term in excluded_terms:
            continue
        canonical = canonical_topic_term(term)
        if canonical in excluded_terms or canonical in topic_terms:
            continue
        topic_terms.append(canonical)

    return {
        "sector": sector,
        "states": sorted(states),
        "topicTerms": topic_terms,
        "queryText": normalized_query,
        "structured": bool(states or topic_terms),
    }


def detect_extreme_mode(query: str) -> str | None:
    query_terms = set(unique_query_terms(query))
    if not query_terms:
        return None

    has_max = bool(query_terms & EXTREME_MAX_TERMS)
    has_min = bool(query_terms & EXTREME_MIN_TERMS)
    if has_max and not has_min:
        return "max"
    if has_min and not has_max:
        return "min"

    has_max = bool(query_terms & AMBIGUOUS_MAX_TERMS and query_terms & EXTREME_CONTEXT_TERMS)
    has_min = bool(query_terms & AMBIGUOUS_MIN_TERMS and query_terms & EXTREME_CONTEXT_TERMS)
    if has_max and not has_min:
        return "max"
    if has_min and not has_max:
        return "min"
    return None


def metric_label_from_query(query: str) -> str:
    normalized_query = normalize_search_text(query)
    if "toll" in normalized_query or "fee" in normalized_query:
        return "toll fee"
    if "count" in normalized_query:
        return "count"
    if "rate" in normalized_query:
        return "rate"
    if "amount" in normalized_query:
        return "amount"
    return "value"


def dataset_analysis_numeric_columns(records: list[dict], columns: list[str]) -> list[str]:
    numeric_columns: list[str] = []
    for column in columns:
        non_empty = 0
        numeric_values = 0
        for record in records:
            value = record.get(column)
            if value in (None, ""):
                continue
            non_empty += 1
            if safe_float(value) is not None:
                numeric_values += 1
        if non_empty and (numeric_values * 100) >= (non_empty * 60):
            numeric_columns.append(column)
    return numeric_columns


def answer_extreme_dataset_query(
    query: str,
    dataset: dict,
    records: list[dict],
    columns: list[str],
) -> tuple[str, list[str]] | None:
    mode = detect_extreme_mode(query)
    resolved_columns = columns or (list(records[0].keys()) if records else [])
    if mode is None or not records or not resolved_columns:
        return None

    numeric_columns = dataset_analysis_numeric_columns(records, resolved_columns)
    if not numeric_columns:
        return None

    metric_label = metric_label_from_query(query)
    direction_label = "highest" if mode == "max" else "lowest"
    comparator = max if mode == "max" else min
    categorical_columns = detect_categorical_columns(records, resolved_columns, numeric_columns)
    if not categorical_columns:
        text_columns = [column for column in resolved_columns if column not in numeric_columns]
        for column in text_columns:
            values = [str(record.get(column) or "").strip() for record in records]
            non_empty_values = [value for value in values if value]
            if len(non_empty_values) >= 2 and len(set(non_empty_values)) == len(non_empty_values):
                categorical_columns = [column]
                break
        if not categorical_columns and text_columns:
            categorical_columns = [text_columns[0]]

    if categorical_columns:
        category_column = categorical_columns[0]

        if len(numeric_columns) == 1:
            numeric_column = numeric_columns[0]
            ranked_values = aggregate_category_values(records, category_column, numeric_column)
            if not ranked_values:
                return None
            selected = ranked_values[0] if mode == "max" else ranked_values[-1]
            message = (
                f"For {dataset['title']}, {selected['label']} has the {direction_label} {numeric_column} "
                f"at {format_metric_value(selected['value'])}."
            )
            insights = [
                f"{category_column}: {selected['label']}.",
                f"{numeric_column}: {format_metric_value(selected['value'])}.",
            ]
            return message, insights

        row_summaries: list[dict[str, object]] = []
        for record in records:
            category_label = str(record.get(category_column) or "").strip() or "Unknown"
            numeric_values: list[tuple[str, float]] = []
            for column in numeric_columns:
                value = safe_float(record.get(column))
                if value is None:
                    continue
                numeric_values.append((column, value))
            if not numeric_values:
                continue

            total = sum(value for _, value in numeric_values)
            average = total / len(numeric_values)
            max_column, max_value = max(numeric_values, key=lambda item: (item[1], item[0].lower()))
            min_column, min_value = min(numeric_values, key=lambda item: (item[1], item[0].lower()))
            row_summaries.append(
                {
                    "label": category_label,
                    "average": average,
                    "count": len(numeric_values),
                    "maxColumn": max_column,
                    "maxValue": max_value,
                    "minColumn": min_column,
                    "minValue": min_value,
                }
            )

        if not row_summaries:
            return None

        selected = comparator(
            row_summaries,
            key=lambda item: (
                float(item["average"]),
                float(item["maxValue"]) if mode == "max" else float(item["minValue"]),
                str(item["label"]).lower(),
            ),
        )
        selected_average = float(selected["average"])
        selected_peak_column = str(selected["maxColumn"] if mode == "max" else selected["minColumn"])
        selected_peak_value = float(selected["maxValue"] if mode == "max" else selected["minValue"])
        sorted_rows = sorted(row_summaries, key=lambda item: float(item["average"]), reverse=(mode == "max"))
        runner_up = sorted_rows[1] if len(sorted_rows) > 1 else None

        message = (
            f"For {dataset['title']}, {selected['label']} has the {direction_label} overall {metric_label}. "
            f"Its average across {selected['count']} numeric fields is {format_metric_value(selected_average)}, "
            f"and its {'peak' if mode == 'max' else 'lowest'} recorded value is "
            f"{format_metric_value(selected_peak_value)} in {selected_peak_column}."
        )

        insights = [
            f"{category_column}: {selected['label']}.",
            f"Average across numeric fields: {format_metric_value(selected_average)}.",
            f"{'Peak' if mode == 'max' else 'Lowest'} value: {format_metric_value(selected_peak_value)} in {selected_peak_column}.",
        ]
        if runner_up is not None:
            insights.append(
                f"{'Next highest' if mode == 'max' else 'Next lowest'} category by average is "
                f"{runner_up['label']} at {format_metric_value(float(runner_up['average']))}."
            )
        return message, insights

    extreme_cells: list[tuple[float, str, int]] = []
    for row_index, record in enumerate(records, start=1):
        for column in numeric_columns:
            value = safe_float(record.get(column))
            if value is None:
                continue
            extreme_cells.append((value, column, row_index))

    if not extreme_cells:
        return None

    selected_value, selected_column, selected_row = comparator(
        extreme_cells,
        key=lambda item: (item[0], item[1].lower(), item[2]),
    )
    message = (
        f"For {dataset['title']}, the {direction_label} {metric_label} is "
        f"{format_metric_value(selected_value)} in {selected_column} (row {selected_row})."
    )
    insights = [
        f"Column: {selected_column}.",
        f"Row: {selected_row}.",
        f"Value: {format_metric_value(selected_value)}.",
    ]
    return message, insights


def dataset_filter_text(dataset: dict) -> str:
    tags = dataset.get("tags") or []
    tag_text = " ".join(str(tag) for tag in tags) if isinstance(tags, list) else str(tags or "")
    return normalize_search_text(
        " ".join(
            str(value or "")
            for value in (
                dataset.get("title"),
                dataset.get("description"),
                dataset.get("organization"),
                dataset.get("state"),
                dataset.get("category"),
                dataset.get("sector"),
                tag_text,
            )
        )
    )
def score_structured_topic_match(dataset: dict, topic_terms: list[str]) -> int:
    if not topic_terms:
        return 1

    text = dataset_filter_text(dataset)
    score = 0
    for term in topic_terms:
        term_score = 0
        for alias in expand_topic_aliases(term):
            if contains_normalized_phrase(text, alias):
                term_score = max(term_score, 10 + (len(alias.split()) * 3))
                continue

            word_hits = sum(1 for word in alias.split() if contains_normalized_phrase(text, word))
            term_score = max(term_score, word_hits * 3)
        score += term_score

    return score


def find_structured_dataset_matches(query_context: dict[str, object]) -> list[dict]:
    sector = query_context.get("sector")
    if not sector:
        return []

    states = list(query_context.get("states") or [])
    topic_terms = list(query_context.get("topicTerms") or [])

    candidates = [enrich_dataset(dataset) for dataset in sector_catalog_datasets(str(sector))]
    filtered: list[tuple[int, dict]] = []

    for dataset in candidates:
        if states and not any(dataset_matches_state_filter(dataset, state_code) for state_code in states):
            continue

        topic_score = score_structured_topic_match(dataset, topic_terms)
        if topic_terms and topic_score == 0:
            continue

        filtered.append((topic_score, dataset))

    filtered.sort(
        key=lambda item: (
            -item[0],
            str(item[1].get("title") or "").lower(),
        )
    )
    return [dataset for _, dataset in filtered[:8]]


def query_context_suffix(query_context: dict[str, object], sector: str | None) -> str:
    parts: list[str] = []
    resolved_sector = str(query_context.get("sector") or sector or "").strip()
    if resolved_sector:
        parts.append(f"in {sector_label(resolved_sector)}")

    states = list(query_context.get("states") or [])
    if states:
        labels = ", ".join(state_label_from_code(state) for state in states)
        parts.append(f"for {labels}")

    return f" {' '.join(parts)}" if parts else ""


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


def build_match_response(session_id: str, matches: list[dict], sector: str | None, query_context: dict[str, object] | None = None) -> dict:
    sector_suffix = query_context_suffix(query_context or {}, sector)
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


def build_no_match_response(session_id: str, sector: str | None, query_context: dict[str, object] | None = None) -> dict:
    sector_suffix = query_context_suffix(query_context or {}, sector)
    message = f"No matching datasets were found{f' after filtering{sector_suffix}' if sector_suffix else ' for that request'}."
    record_session_message(session_id, "assistant", message)
    return {
        "sessionId": session_id,
        "restricted": False,
        "content": message,
        "matches": [],
        "insights": [],
        "history": _session_history[session_id],
    }


def build_dataset_answer_response(session_id: str, dataset: dict, message: str, insights: list[str]) -> dict:
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

    query_context = parse_query_context(query, sector)
    detected_sector = str(query_context.get("sector") or "") or detect_sector(query, sector)

    if query_context.get("structured"):
        matches = find_structured_dataset_matches(query_context)
        if not matches and not query_context.get("sector"):
            matches = find_dataset_matches(query, detected_sector)
        if not matches and not query_context.get("states"):
            matches = find_dataset_matches(query, detected_sector)
    else:
        matches = find_dataset_matches(query, detected_sector)

    if should_restrict(query, matches, detected_sector):
        return build_restriction_response(active_session_id)

    if wants_sector_summary(query, detected_sector):
        sector_page = get_sector_datasets(detected_sector, page=1, limit=5)
        sector_matches = sector_page.get("datasets", [])
        return build_sector_summary_response(active_session_id, detected_sector, sector_matches)

    extreme_mode = detect_extreme_mode(query)
    wants_insights = extreme_mode is not None or any(
        keyword in query.lower() for keyword in ["insight", "insights", "analyze", "analysis", "summary", "about", "explain"]
    )
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

            if extreme_mode is not None:
                extreme_answer = answer_extreme_dataset_query(
                    query,
                    selected_dataset,
                    full_dataset.get("records", []),
                    full_dataset.get("columns", []),
                )
                if extreme_answer is not None:
                    message, insights = extreme_answer
                    return build_dataset_answer_response(active_session_id, selected_dataset, message, insights)

            insights = dataset_insights(full_dataset.get("records", []), full_dataset.get("columns", []))
            return build_insight_response(active_session_id, selected_dataset, insights)

    if matches:
        return build_match_response(active_session_id, matches, detected_sector, query_context=query_context)

    return build_no_match_response(active_session_id, detected_sector, query_context=query_context)
