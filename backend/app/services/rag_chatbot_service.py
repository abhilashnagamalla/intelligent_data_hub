from __future__ import annotations

import json
import math
import os
import re
import threading
import time
import uuid
from typing import Any

import numpy as np
import pandas as pd
import requests
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.config import settings

from .dataset_catalog import (
    dataset_link_payload,
    dataset_matches_state_filter,
    detect_query_domains,
    detect_query_states,
    enrich_dataset,
    fetch_dataset_page,
    fetch_full_dataset,
    fetch_resource_metadata,
    format_metric_value,
    get_dataset_by_id,
    normalize_search_text,
    normalize_sector_key,
    search_datasets,
    sector_catalog_datasets,
    sector_keys,
    unique_query_terms,
)

TOP_K_RESULTS = 10
DEFAULT_LISTING_LIMIT = 10
BROAD_LISTING_LIMIT = 30
VECTOR_CANDIDATE_LIMIT = 24
LEXICAL_CANDIDATE_LIMIT = 60
CONTENT_RERANK_LIMIT = 20
DATA_ANALYSIS_MAX_ROWS = 5000
DATA_ANALYSIS_SAMPLE_ROWS = 500
OPENAI_EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
OPENAI_CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")

INSIGHT_HINTS = {
    "analysis",
    "analyze",
    "average",
    "compare",
    "comparison",
    "findings",
    "insight",
    "insights",
    "key insight",
    "key insights",
    "maximum",
    "mean",
    "minimum",
    "observation",
    "observations",
    "pattern",
    "patterns",
    "stat",
    "statistics",
    "stats",
    "summarize",
    "summary",
    "trend",
    "trends",
}
DATASET_DETAIL_HINTS = {
    "column",
    "columns",
    "feature",
    "features",
    "field",
    "fields",
    "first row",
    "header",
    "headers",
    "preview",
    "sample record",
    "sample row",
    "schema",
}
FOLLOW_UP_HINTS = {
    "it",
    "its",
    "that dataset",
    "that one",
    "this dataset",
    "this one",
}
ORDINAL_LOOKUP = {
    "first": 1,
    "1st": 1,
    "one": 1,
    "second": 2,
    "2nd": 2,
    "two": 2,
    "third": 3,
    "3rd": 3,
    "three": 3,
    "fourth": 4,
    "4th": 4,
    "four": 4,
    "fifth": 5,
    "5th": 5,
    "five": 5,
}
MISSING_MARKERS = {"", "-", "--", "na", "n/a", "nan", "none", "null"}

_session_history: dict[str, list[dict[str, str]]] = {}
_session_state: dict[str, dict[str, Any]] = {}

_metadata_index_lock = threading.Lock()
_metadata_index: dict[str, Any] | None = None

_content_cache_lock = threading.Lock()
_dataset_content_cache: dict[str, dict[str, Any]] = {}

_live_api_state_lock = threading.Lock()
_live_api_state = {"available": None, "checkedAt": 0.0}

_openai_client_ready = False
_openai_client: Any = None


def get_openai_client() -> Any:
    global _openai_client_ready, _openai_client

    if _openai_client_ready:
        return _openai_client

    api_key = (os.getenv("OPENAI_API_KEY") or settings.OPENAI_API_KEY or "").strip()
    if not api_key:
        _openai_client_ready = True
        return None

    try:
        from openai import OpenAI
    except Exception:
        _openai_client_ready = True
        return None

    try:
        _openai_client = OpenAI(api_key=api_key)
    except Exception:
        _openai_client = None

    _openai_client_ready = True
    return _openai_client


def live_api_available(force: bool = False) -> bool:
    with _live_api_state_lock:
        checked_at = float(_live_api_state["checkedAt"])
        available = _live_api_state["available"]
        if not force and available is not None:
            ttl = 60.0 if available else 300.0
            if time.time() - checked_at < ttl:
                return bool(available)

    try:
        response = requests.get("https://api.data.gov.in", timeout=2)
        available = response.ok
    except requests.RequestException:
        available = False

    with _live_api_state_lock:
        _live_api_state["available"] = available
        _live_api_state["checkedAt"] = time.time()

    return bool(available)


def compact_text(*parts: Any) -> str:
    text = " ".join(str(part or "").strip() for part in parts if str(part or "").strip())
    return re.sub(r"\s+", " ", text).strip()


def embed_texts(client: Any, texts: list[str]) -> np.ndarray:
    embeddings: list[list[float]] = []
    for start in range(0, len(texts), 64):
        batch = texts[start:start + 64]
        response = client.embeddings.create(model=OPENAI_EMBEDDING_MODEL, input=batch)
        embeddings.extend(item.embedding for item in response.data)
    return np.array(embeddings, dtype=float)


def fit_encoder(texts: list[str]) -> dict[str, Any]:
    client = get_openai_client()
    if client is not None:
        try:
            matrix = embed_texts(client, texts)
            return {"provider": "openai", "matrix": matrix}
        except Exception:
            pass

    vectorizer = TfidfVectorizer(
        stop_words="english",
        ngram_range=(1, 2),
        max_features=16000,
        strip_accents="unicode",
    )
    matrix = vectorizer.fit_transform(texts or ["dataset"])
    return {"provider": "tfidf", "vectorizer": vectorizer, "matrix": matrix}


def encode_query(encoder: dict[str, Any], query: str) -> Any:
    if encoder["provider"] == "openai":
        client = get_openai_client()
        if client is None:
            raise RuntimeError("OpenAI encoder is not available")
        return embed_texts(client, [query])
    return encoder["vectorizer"].transform([query])


def similarity_scores(encoder: dict[str, Any], query: str, matrix: Any | None = None) -> np.ndarray:
    target_matrix = matrix if matrix is not None else encoder["matrix"]
    query_embedding = encode_query(encoder, query)
    if encoder["provider"] == "openai":
        docs = np.array(target_matrix, dtype=float)
        query_vector = np.array(query_embedding[0], dtype=float)
        query_norm = np.linalg.norm(query_vector) or 1.0
        doc_norms = np.linalg.norm(docs, axis=1)
        doc_norms[doc_norms == 0] = 1.0
        return (docs @ query_vector) / (doc_norms * query_norm)
    return cosine_similarity(query_embedding, target_matrix).ravel()


def record_session_message(session_id: str, role: str, content: str) -> list[dict[str, str]]:
    history = _session_history.setdefault(session_id, [])
    history.append({"role": role, "content": content})
    return history


def session_state(session_id: str) -> dict[str, Any]:
    return _session_state.setdefault(session_id, {})


def metadata_document_text(dataset: dict[str, Any]) -> str:
    tags = " ".join(dataset.get("tags") or [])
    return compact_text(
        dataset.get("title"),
        dataset.get("description"),
        dataset.get("organization"),
        dataset.get("sector"),
        dataset.get("state"),
        tags,
    )


def build_metadata_index() -> dict[str, Any]:
    datasets_by_id: dict[str, dict[str, Any]] = {}

    for sector in sector_keys():
        for dataset in sector_catalog_datasets(sector):
            enriched = enrich_dataset(dataset)
            dataset_id = str(enriched.get("id") or "").strip()
            if not dataset_id:
                continue
            existing = datasets_by_id.get(dataset_id)
            if existing is None or len(metadata_document_text(enriched)) > len(metadata_document_text(existing)):
                datasets_by_id[dataset_id] = enriched

    documents = [
        {"id": dataset_id, "dataset": dataset, "text": metadata_document_text(dataset)}
        for dataset_id, dataset in sorted(datasets_by_id.items())
    ]
    encoder = fit_encoder([document["text"] for document in documents] or ["dataset"])
    return {"documents": documents, "encoder": encoder}


def get_metadata_index() -> dict[str, Any]:
    global _metadata_index

    with _metadata_index_lock:
        if _metadata_index is None:
            _metadata_index = build_metadata_index()
        return _metadata_index


def metadata_vector_search(query: str, *, sector: str | None = None, top_k: int = VECTOR_CANDIDATE_LIMIT) -> list[dict[str, Any]]:
    index = get_metadata_index()
    normalized_sector = normalize_sector_key(sector) if sector else None
    query_text = normalize_search_text(query)
    query_terms = unique_query_terms(query)
    state_filters = detect_query_states(query_text)
    domain_filters = {normalized_sector} if normalized_sector else detect_query_domains(query_terms)

    scores = similarity_scores(index["encoder"], query, matrix=index["encoder"]["matrix"])
    ranked: list[dict[str, Any]] = []

    for score, document in zip(scores, index["documents"], strict=False):
        dataset = document["dataset"]

        if normalized_sector and dataset.get("sectorKey") != normalized_sector:
            continue
        if not normalized_sector and domain_filters and dataset.get("sectorKey") not in domain_filters:
            continue
        if state_filters and not any(dataset_matches_state_filter(dataset, code) for code in state_filters):
            continue

        ranked.append({"dataset": dataset, "score": float(score)})

    ranked.sort(key=lambda item: (item["score"], str(item["dataset"].get("title") or "").lower()), reverse=True)
    return ranked[:top_k]


def sample_value_text(value: Any, *, max_length: int = 72) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    return text if len(text) <= max_length else f"{text[:max_length - 3].rstrip()}..."


def build_dataset_content_document(dataset: dict[str, Any]) -> dict[str, Any]:
    dataset_id = str(dataset.get("id") or "").replace(".csv", "")

    with _content_cache_lock:
        cached = _dataset_content_cache.get(dataset_id)
        if cached is not None:
            return cached

    metadata: dict[str, Any] = {}
    sample_page = {"records": [], "columns": []}

    if live_api_available():
        try:
            metadata = fetch_resource_metadata(dataset_id)
        except requests.RequestException:
            metadata = {}

        try:
            sample_page = fetch_dataset_page(dataset_id, limit=30, offset=0)
        except requests.RequestException:
            sample_page = {"records": [], "columns": metadata.get("fieldNames", [])}

    columns = list(sample_page.get("columns") or metadata.get("fieldNames") or [])
    sample_rows: list[str] = []
    visible_columns = columns[: min(8, len(columns))]

    for record in sample_page.get("records", [])[:12]:
        row_parts: list[str] = []
        for column in visible_columns:
            value_text = sample_value_text(record.get(column))
            if value_text:
                row_parts.append(f"{column}: {value_text}")
        if row_parts:
            sample_rows.append("; ".join(row_parts))

    document = {
        "text": compact_text(
            dataset.get("title"),
            dataset.get("description"),
            f"Columns: {', '.join(columns[:12])}" if columns else "",
            " ".join(f"Sample row {index + 1}: {row}" for index, row in enumerate(sample_rows)),
        ),
        "columns": columns,
        "sampleRows": sample_rows,
    }

    with _content_cache_lock:
        _dataset_content_cache[dataset_id] = document

    return document


def content_rerank(query: str, datasets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    scored: list[tuple[float, dict[str, Any]]] = []

    for dataset in datasets:
        content_document = build_dataset_content_document(dataset)
        content_text = content_document.get("text") or metadata_document_text(dataset)
        try:
            matrix = TfidfVectorizer(
                stop_words="english",
                ngram_range=(1, 2),
                strip_accents="unicode",
            ).fit_transform([query, content_text])
            score = float(cosine_similarity(matrix[0:1], matrix[1:2]).ravel()[0])
        except ValueError:
            score = 0.0
        scored.append((score, dataset))

    scored.sort(key=lambda item: (item[0], str(item[1].get("title") or "").lower()), reverse=True)
    return [dataset for _, dataset in scored]


def hybrid_retrieve_bundle(query: str, *, sector: str | None = None, limit: int = TOP_K_RESULTS) -> dict[str, Any]:
    lexical_limit = max(LEXICAL_CANDIDATE_LIMIT, limit * 4)
    vector_limit = max(VECTOR_CANDIDATE_LIMIT, limit * 3)
    rerank_limit = min(max(CONTENT_RERANK_LIMIT, limit), 24)

    lexical_hits = search_datasets(query, sector)[:lexical_limit]
    vector_hits = metadata_vector_search(query, sector=sector, top_k=vector_limit)

    combined: dict[str, dict[str, Any]] = {}

    for rank, dataset in enumerate(lexical_hits, start=1):
        dataset_id = str(dataset.get("id") or "")
        if not dataset_id:
            continue
        entry = combined.setdefault(dataset_id, {"dataset": dataset, "score": 0.0})
        entry["score"] += 1.25 / (45 + rank)

    for rank, item in enumerate(vector_hits, start=1):
        dataset = item["dataset"]
        dataset_id = str(dataset.get("id") or "")
        if not dataset_id:
            continue
        entry = combined.setdefault(dataset_id, {"dataset": dataset, "score": 0.0})
        entry["score"] += 1.0 / (45 + rank)

    if not combined:
        return []

    initial_candidates = sorted(
        combined.values(),
        key=lambda item: (item["score"], str(item["dataset"].get("title") or "").lower()),
        reverse=True,
    )[:rerank_limit]

    reranked = content_rerank(query, [item["dataset"] for item in initial_candidates])
    for rank, dataset in enumerate(reranked, start=1):
        dataset_id = str(dataset.get("id") or "")
        if dataset_id in combined:
            combined[dataset_id]["score"] += 0.9 / (35 + rank)

    final_results = sorted(
        combined.values(),
        key=lambda item: (item["score"], str(item["dataset"].get("title") or "").lower()),
        reverse=True,
    )
    return {
        "results": [item["dataset"] for item in final_results[:limit]],
        "total": len(final_results),
    }


def hybrid_retrieve_datasets(query: str, *, sector: str | None = None, limit: int = TOP_K_RESULTS) -> list[dict[str, Any]]:
    return hybrid_retrieve_bundle(query, sector=sector, limit=limit)["results"]


def query_keywords(query: str) -> list[str]:
    return unique_query_terms(query)[:8]


def listing_limit_for_query(query: str) -> int:
    normalized_query = normalize_search_text(query)
    query_terms = unique_query_terms(query)
    state_filters = detect_query_states(normalized_query)

    if state_filters and len(query_terms) <= 2:
        return BROAD_LISTING_LIMIT
    if ("dataset" in normalized_query or "datasets" in normalized_query) and len(query_terms) <= 3:
        return BROAD_LISTING_LIMIT
    return DEFAULT_LISTING_LIMIT


def is_analysis_query(query: str, *, dataset_id: str | None = None) -> bool:
    if dataset_id:
        return True

    normalized = normalize_search_text(query)
    if any(hint in normalized for hint in INSIGHT_HINTS | DATASET_DETAIL_HINTS):
        return True

    return any(alias in normalized for alias in ORDINAL_LOOKUP)


def referenced_previous_dataset(query: str) -> bool:
    normalized = normalize_search_text(query)
    return any(hint in normalized for hint in FOLLOW_UP_HINTS)


def parse_ordinal_reference(query: str) -> int | None:
    normalized = normalize_search_text(query)
    tokens = normalized.split()
    for token in tokens:
        if token in ORDINAL_LOOKUP:
            return ORDINAL_LOOKUP[token]
    return None


def message_dataset_payload(dataset: dict[str, Any], rank: int) -> dict[str, Any]:
    payload = dataset_link_payload(dataset)
    payload["rank"] = rank
    return payload


def llm_summary(task: str, payload: dict[str, Any]) -> str | None:
    client = get_openai_client()
    if client is None:
        return None

    system_prompt = (
        "You are an Indian public data assistant. "
        "Use only the facts in the payload. "
        "Do not invent datasets, links, or statistics. "
        "Keep the answer concise, factual, and easy to scan."
    )
    user_prompt = json.dumps({"task": task, "payload": payload}, ensure_ascii=False)

    try:
        response = client.chat.completions.create(
            model=OPENAI_CHAT_MODEL,
            temperature=0.2,
            max_tokens=220,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
    except Exception:
        return None

    content = response.choices[0].message.content if response.choices else None
    if isinstance(content, str):
        return content.strip() or None
    return None


def listing_fallback_summary(query: str, matches: list[dict[str, Any]], keywords: list[str], total_count: int) -> str:
    if not matches:
        return f"I couldn't find relevant datasets for '{query}'."

    lead = matches[0]
    keyword_text = ", ".join(keywords) if keywords else query
    if total_count > len(matches):
        return (
            f"I found {total_count} relevant datasets for '{query}' and I’m showing the top {len(matches)}. "
            f"The strongest match is '{lead['title']}', ranked using metadata plus sampled dataset content for keywords like {keyword_text}."
        )
    return (
        f"I found {total_count} relevant datasets for '{query}'. "
        f"The strongest match is '{lead['title']}', ranked using metadata plus sampled dataset content for keywords like {keyword_text}."
    )


def no_match_response(session_id: str, query: str) -> dict[str, Any]:
    message = f"I couldn't find relevant datasets for '{query}'. Try adding a sector, state, or dataset topic."
    record_session_message(session_id, "assistant", message)
    session_state(session_id)["lastMatches"] = []
    return {
        "sessionId": session_id,
        "restricted": False,
        "content": message,
        "matches": [],
        "insights": [],
        "result": None,
        "history": _session_history[session_id],
    }


def listing_response(session_id: str, query: str, matches: list[dict[str, Any]], total_count: int) -> dict[str, Any]:
    keywords = query_keywords(query)
    match_payloads = [message_dataset_payload(dataset, rank) for rank, dataset in enumerate(matches, start=1)]
    insights = []

    if keywords:
        insights.append(f"Matched keywords: {', '.join(keywords)}.")
    if matches:
        sectors = sorted({str(dataset.get('sector') or dataset.get('sectorKey') or '').strip() for dataset in matches if dataset.get("sector") or dataset.get("sectorKey")})
        if sectors:
            insights.append(f"Matching sectors: {', '.join(sectors)}.")
        if total_count > len(matches):
            insights.append(f"Showing top {len(matches)} of {total_count} matching datasets.")
        insights.append(f"Result 1 is '{matches[0]['title']}'. Open any dataset card below for details or source access.")

    summary = llm_summary(
        "listing",
        {
            "query": query,
            "totalMatches": total_count,
            "displayedMatches": len(match_payloads),
            "keywords": keywords,
            "matches": [
                {
                    "title": item["title"],
                    "description": item.get("description"),
                    "tags": item.get("tags"),
                    "sourceUrl": item.get("sourceUrl"),
                }
                for item in match_payloads
            ],
        },
    ) or listing_fallback_summary(query, match_payloads, keywords, total_count)

    record_session_message(session_id, "assistant", summary)
    state = session_state(session_id)
    state["lastMatches"] = matches
    if len(matches) == 1:
        state["lastDataset"] = matches[0]
    else:
        state.pop("lastDataset", None)

    return {
        "sessionId": session_id,
        "restricted": False,
        "content": summary,
        "matches": match_payloads,
        "insights": insights,
        "result": None,
        "history": _session_history[session_id],
    }


def resolve_requested_dataset(
    query: str,
    session_id: str,
    *,
    sector: str | None = None,
    dataset_id: str | None = None,
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    if dataset_id:
        resolved_sector, dataset = get_dataset_by_id(dataset_id)
        if dataset is not None:
            enriched = enrich_dataset(dataset)
            if resolved_sector and enriched.get("sectorKey") != resolved_sector:
                enriched["sectorKey"] = resolved_sector
            return enriched, [enriched]

    state = session_state(session_id)
    last_matches = state.get("lastMatches") or []
    ordinal = parse_ordinal_reference(query)
    if ordinal and 1 <= ordinal <= len(last_matches):
        selected = last_matches[ordinal - 1]
        return selected, last_matches

    if referenced_previous_dataset(query) and state.get("lastDataset"):
        return state["lastDataset"], last_matches

    retrieved = hybrid_retrieve_datasets(query, sector=sector, limit=TOP_K_RESULTS)
    if not retrieved:
        return None, []
    return retrieved[0], retrieved


def query_matched_columns(query: str, columns: list[str]) -> list[str]:
    normalized_query = normalize_search_text(query)
    terms = set(unique_query_terms(query))
    scored: list[tuple[int, int, str]] = []

    for column in columns:
        normalized_column = normalize_search_text(column)
        if not normalized_column:
            continue
        score = 0
        if normalized_column in normalized_query:
            score += 100
        score += sum(8 for token in normalized_column.split() if token in terms)
        if score:
            scored.append((score, len(normalized_column), column))

    scored.sort(key=lambda item: (-item[0], -item[1], item[2].lower()))
    return [column for _, _, column in scored]


def cleaned_string_series(series: pd.Series) -> pd.Series:
    return (
        series.astype("string")
        .str.strip()
        .replace({marker: pd.NA for marker in MISSING_MARKERS})
    )


def coerce_numeric_series(series: pd.Series) -> pd.Series:
    cleaned = cleaned_string_series(series).str.replace(",", "", regex=False).str.replace("%", "", regex=False)
    return pd.to_numeric(cleaned, errors="coerce")


def numeric_candidates(frame: pd.DataFrame, query_matches: list[str]) -> dict[str, pd.Series]:
    candidates: list[tuple[int, int, float, str, pd.Series]] = []
    minimum_valid = max(3, math.ceil(len(frame) * 0.35)) if len(frame) else 1

    for column in frame.columns:
        numeric = coerce_numeric_series(frame[column])
        valid = int(numeric.notna().sum())
        if valid < minimum_valid:
            continue
        variance = float(numeric.var(skipna=True) or 0.0)
        query_bonus = 1 if column in query_matches else 0
        candidates.append((query_bonus, valid, variance, column, numeric))

    candidates.sort(key=lambda item: (-item[0], -item[1], -item[2], item[3].lower()))
    return {column: numeric for _, _, _, column, numeric in candidates[:5]}


def datetime_candidates(frame: pd.DataFrame, query_matches: list[str]) -> dict[str, pd.Series]:
    candidates: list[tuple[int, int, str, pd.Series]] = []
    minimum_valid = max(3, math.ceil(len(frame) * 0.35)) if len(frame) else 1

    for column in frame.columns:
        parsed = pd.to_datetime(cleaned_string_series(frame[column]), errors="coerce")
        valid = int(parsed.notna().sum())
        if valid < minimum_valid:
            continue
        query_bonus = 1 if column in query_matches else 0
        candidates.append((query_bonus, valid, column, parsed))

    candidates.sort(key=lambda item: (-item[0], -item[1], item[2].lower()))
    return {column: parsed for _, _, column, parsed in candidates[:3]}


def categorical_candidates(
    frame: pd.DataFrame,
    *,
    excluded_columns: set[str],
    query_matches: list[str],
) -> list[str]:
    candidates: list[tuple[int, float, int, str]] = []

    for column in frame.columns:
        if column in excluded_columns:
            continue

        cleaned = cleaned_string_series(frame[column]).dropna()
        if cleaned.empty:
            continue

        unique_count = int(cleaned.nunique())
        unique_ratio = unique_count / len(cleaned)
        if unique_count < 2 or unique_count > 20 or unique_ratio > 0.6:
            continue

        normalized_column = normalize_search_text(column)
        if any(token in normalized_column for token in {"code", "id", "identifier", "serial"}):
            continue

        query_bonus = 1 if column in query_matches else 0
        candidates.append((query_bonus, unique_ratio, unique_count, column))

    candidates.sort(key=lambda item: (-item[0], item[1], item[2], item[3].lower()))
    return [column for _, _, _, column in candidates[:3]]


def format_change(first_value: float, last_value: float) -> str:
    if first_value == 0:
        return "from 0"
    change = ((last_value - first_value) / abs(first_value)) * 100
    direction = "increased" if change >= 0 else "decreased"
    return f"{direction} by {abs(change):.1f}%"


def build_trend_section(date_series: pd.Series, numeric_series: pd.Series, *, date_column: str, numeric_column: str) -> dict[str, Any] | None:
    trend_frame = pd.DataFrame({"date": date_series, "value": numeric_series}).dropna()
    if len(trend_frame) < 4:
        return None

    trend_frame = trend_frame.sort_values("date")
    monthly = trend_frame["date"].dt.to_period("M")
    yearly = trend_frame["date"].dt.to_period("Y")

    if 3 <= monthly.nunique() <= 48:
        grouped = trend_frame.groupby(monthly)["value"].mean().sort_index()
        label_name = "month"
    elif yearly.nunique() >= 2:
        grouped = trend_frame.groupby(yearly)["value"].mean().sort_index()
        label_name = "year"
    else:
        grouped = trend_frame.groupby(trend_frame["date"].dt.strftime("%Y-%m-%d"))["value"].mean().sort_index().tail(12)
        label_name = "date"

    if len(grouped) < 2:
        return None

    first_label = str(grouped.index[0])
    last_label = str(grouped.index[-1])
    first_value = float(grouped.iloc[0])
    last_value = float(grouped.iloc[-1])
    peak_label = str(grouped.idxmax())
    peak_value = float(grouped.max())

    items = [
        f"Across {label_name}s in '{date_column}', average {numeric_column} moved from {format_metric_value(first_value)} in {first_label} to {format_metric_value(last_value)} in {last_label}.",
        f"That series {format_change(first_value, last_value)} over the observed period.",
        f"The highest observed average {numeric_column} was {format_metric_value(peak_value)} in {peak_label}.",
    ]

    return {
        "title": f"Trend for {numeric_column}",
        "items": items,
    }


def build_comparison_section(category_series: pd.Series, numeric_series: pd.Series, *, category_column: str, numeric_column: str) -> dict[str, Any] | None:
    comparison_frame = pd.DataFrame({"category": cleaned_string_series(category_series), "value": numeric_series}).dropna()
    comparison_frame = comparison_frame[comparison_frame["category"].notna()]
    if comparison_frame.empty:
        return None

    grouped = (
        comparison_frame.groupby("category", dropna=True)["value"]
        .agg(["sum", "mean", "count"])
        .sort_values("sum", ascending=False)
        .head(5)
    )
    if len(grouped) < 2:
        return None

    top_category = str(grouped.index[0])
    top_value = float(grouped.iloc[0]["sum"])

    items = [
        f"{top_category} has the highest total {numeric_column} at {format_metric_value(top_value)}.",
    ]

    for category, row in grouped.iloc[1:3].iterrows():
        items.append(
            f"{category} follows with total {format_metric_value(float(row['sum']))} across {int(row['count'])} records."
        )

    items.append(f"Comparison is grouped by '{category_column}' using summed '{numeric_column}' values.")
    return {"title": f"Comparison by {category_column}", "items": items}


def build_frequency_section(category_series: pd.Series, *, category_column: str) -> dict[str, Any] | None:
    cleaned = cleaned_string_series(category_series).dropna()
    if cleaned.empty:
        return None

    counts = cleaned.value_counts().head(5)
    if counts.empty:
        return None

    items = [f"{label}: {int(count)} records." for label, count in counts.items()]
    return {"title": f"Most common {category_column} values", "items": items}


def load_dataset_frame(dataset: dict[str, Any]) -> tuple[pd.DataFrame, dict[str, Any]]:
    dataset_id = str(dataset.get("id") or "").replace(".csv", "")
    full_dataset = fetch_full_dataset(dataset_id, max_rows=DATA_ANALYSIS_MAX_ROWS)
    sampled = bool(full_dataset.get("tooLarge"))

    if sampled:
        sample_page = fetch_dataset_page(dataset_id, limit=DATA_ANALYSIS_SAMPLE_ROWS, offset=0)
        records = sample_page.get("records", [])
        columns = sample_page.get("columns", [])
        total_rows = full_dataset.get("totalRows") or sample_page.get("totalRows") or len(records)
    else:
        records = full_dataset.get("records", [])
        columns = full_dataset.get("columns", [])
        total_rows = full_dataset.get("totalRows") or len(records)

    if not records:
        raise ValueError("The dataset does not contain accessible rows for analysis.")

    frame = pd.DataFrame(records)
    if columns:
        existing_columns = [column for column in columns if column in frame.columns]
        if existing_columns:
            frame = frame.reindex(columns=existing_columns)

    return frame, {
        "sampled": sampled,
        "analyzedRows": int(len(frame)),
        "totalRows": int(total_rows),
        "columnCount": int(len(frame.columns)),
        "columns": list(frame.columns),
    }


def analysis_fallback_summary(dataset: dict[str, Any], profile: dict[str, Any]) -> str:
    dataset_name = dataset.get("title") or "the selected dataset"
    sample_text = f" sampled from {profile['totalRows']:,} total rows" if profile["sampled"] else ""
    base = (
        f"I analyzed {dataset_name} using {profile['analyzedRows']:,} rows"
        f"{sample_text}. "
        f"The dataset has {profile['columnCount']:,} columns, and the key findings are listed below."
    )
    return base


def analyze_dataset(query: str, dataset: dict[str, Any]) -> tuple[str, list[str], dict[str, Any]]:
    frame, profile = load_dataset_frame(dataset)
    matched_columns = query_matched_columns(query, list(frame.columns))
    numeric_map = numeric_candidates(frame, matched_columns)
    datetime_map = datetime_candidates(frame, matched_columns)
    categorical = categorical_candidates(
        frame,
        excluded_columns=set(numeric_map) | set(datetime_map),
        query_matches=matched_columns,
    )

    metrics = [
        {"label": "Rows analyzed", "value": f"{profile['analyzedRows']:,}"},
        {"label": "Total rows", "value": f"{profile['totalRows']:,}"},
        {"label": "Columns", "value": f"{profile['columnCount']:,}"},
    ]
    if profile["sampled"]:
        metrics.append({"label": "Analysis mode", "value": "Sampled"})
    else:
        metrics.append({"label": "Analysis mode", "value": "Full dataset"})

    sections: list[dict[str, Any]] = []
    insights: list[str] = []

    for column, series in list(numeric_map.items())[:3]:
        valid = series.dropna()
        if valid.empty:
            continue
        mean_value = float(valid.mean())
        min_value = float(valid.min())
        max_value = float(valid.max())
        insights.append(
            f"{column}: mean {format_metric_value(mean_value)}, min {format_metric_value(min_value)}, max {format_metric_value(max_value)}."
        )

    primary_numeric = next(iter(numeric_map.items()), None)
    primary_date = next(iter(datetime_map.items()), None)
    primary_category = categorical[0] if categorical else None

    if primary_date and primary_numeric:
        trend_section = build_trend_section(
            primary_date[1],
            primary_numeric[1],
            date_column=primary_date[0],
            numeric_column=primary_numeric[0],
        )
        if trend_section:
            sections.append(trend_section)
            insights.extend(trend_section["items"][:2])

    if primary_category and primary_numeric:
        comparison_section = build_comparison_section(
            frame[primary_category],
            primary_numeric[1],
            category_column=primary_category,
            numeric_column=primary_numeric[0],
        )
        if comparison_section:
            sections.append(comparison_section)
            insights.extend(comparison_section["items"][:2])
    elif primary_category:
        frequency_section = build_frequency_section(frame[primary_category], category_column=primary_category)
        if frequency_section:
            sections.append(frequency_section)
            insights.extend(frequency_section["items"][:2])

    if matched_columns:
        metrics.append({"label": "Matched columns", "value": ", ".join(matched_columns[:3])})
    if numeric_map:
        metrics.append({"label": "Numeric focus", "value": ", ".join(list(numeric_map)[:2])})

    deduped_insights: list[str] = []
    seen: set[str] = set()
    for insight in insights:
        normalized = insight.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        deduped_insights.append(normalized)

    summary = llm_summary(
        "analysis",
        {
            "query": query,
            "dataset": {
                "title": dataset.get("title"),
                "description": dataset.get("description"),
                "sourceUrl": dataset.get("sourceUrl"),
                "tags": dataset.get("tags"),
            },
            "metrics": metrics,
            "highlights": deduped_insights[:6],
            "sampled": profile["sampled"],
        },
    ) or analysis_fallback_summary(dataset, profile)

    result = {
        "title": f"Insights from {dataset.get('title') or 'dataset'}",
        "dataset": message_dataset_payload(dataset, 1),
        "metrics": metrics,
        "sections": sections,
    }
    return summary, deduped_insights[:8], result


def analysis_unavailable_response(
    session_id: str,
    dataset: dict[str, Any],
    message: str,
) -> dict[str, Any]:
    record_session_message(session_id, "assistant", message)
    session_state(session_id)["lastMatches"] = [dataset]
    session_state(session_id)["lastDataset"] = dataset
    return {
        "sessionId": session_id,
        "restricted": False,
        "content": message,
        "matches": [message_dataset_payload(dataset, 1)],
        "insights": [],
        "result": None,
        "history": _session_history[session_id],
    }


def analysis_response(session_id: str, query: str, dataset: dict[str, Any]) -> dict[str, Any]:
    summary, insights, result = analyze_dataset(query, dataset)
    record_session_message(session_id, "assistant", summary)

    state = session_state(session_id)
    state["lastMatches"] = [dataset]
    state["lastDataset"] = dataset

    return {
        "sessionId": session_id,
        "restricted": False,
        "content": summary,
        "matches": [message_dataset_payload(dataset, 1)],
        "insights": insights,
        "result": result,
        "history": _session_history[session_id],
    }


def metadata_fallback_response(session_id: str, dataset: dict[str, Any]) -> dict[str, Any]:
    content_document = build_dataset_content_document(dataset)
    columns = content_document.get("columns") or []
    sample_rows = content_document.get("sampleRows") or []
    dataset_title = dataset.get("title") or "Selected dataset"
    description = str(dataset.get("description") or "").strip()

    insights: list[str] = []
    if columns:
        insights.append(f"Detected columns: {', '.join(columns[:12])}.")
    if sample_rows:
        insights.append(f"Sample row: {sample_rows[0]}.")
    if description:
        insights.append(description)

    summary = (
        f"I couldn't reach the live dataset API, but I can still share cached metadata for {dataset_title}."
    )

    result = {
        "title": f"Cached metadata for {dataset_title}",
        "dataset": message_dataset_payload(dataset, 1),
        "metrics": [
            {"label": "Columns detected", "value": str(len(columns)) if columns else "Unavailable"},
            {"label": "Sample rows", "value": str(len(sample_rows)) if sample_rows else "Unavailable"},
            {"label": "Sector", "value": str(dataset.get("sector") or dataset.get("sectorKey") or "Unknown")},
        ],
        "sections": [
            {"title": "Available metadata", "items": insights or ["Live dataset rows are unavailable right now."]},
        ],
    }

    record_session_message(session_id, "assistant", summary)
    state = session_state(session_id)
    state["lastMatches"] = [dataset]
    state["lastDataset"] = dataset

    return {
        "sessionId": session_id,
        "restricted": False,
        "content": summary,
        "matches": [message_dataset_payload(dataset, 1)],
        "insights": insights,
        "result": result,
        "history": _session_history[session_id],
    }


def chatbot_response(
    query: str,
    session_id: str | None = None,
    sector: str | None = None,
    dataset_id: str | None = None,
    dataset_title: str | None = None,
) -> dict[str, Any]:
    from .dataset_chatbot_service import chatbot_response as dataset_chatbot_response

    normalized_query = compact_text(query)
    active_session_id = session_id or str(uuid.uuid4())

    if not normalized_query:
        return no_match_response(active_session_id, "your request")

    record_session_message(active_session_id, "user", normalized_query)

    normalized_sector = normalize_sector_key(sector) if sector and normalize_sector_key(sector) != "all" else None
    target_dataset, _known_matches = resolve_requested_dataset(
        normalized_query,
        active_session_id,
        sector=normalized_sector,
        dataset_id=dataset_id,
    )

    if target_dataset and is_analysis_query(normalized_query, dataset_id=dataset_id):
        state = session_state(active_session_id)
        state["lastMatches"] = [target_dataset]
        state["lastDataset"] = target_dataset

        try:
            response = dataset_chatbot_response(
                normalized_query,
                session_id=active_session_id,
                sector=target_dataset.get("sectorKey") or normalized_sector,
                dataset_id=str(target_dataset.get("id") or dataset_id or ""),
                dataset_title=dataset_title or target_dataset.get("title"),
            )
            if response.get("restricted") and "dataset api could not be reached" in normalize_search_text(response.get("content")):
                return metadata_fallback_response(active_session_id, target_dataset)
            return response
        except Exception:
            return analysis_unavailable_response(
                active_session_id,
                target_dataset,
                "Dataset analysis is temporarily unavailable. Please retry in a moment.",
            )

    retrieval = hybrid_retrieve_bundle(normalized_query, sector=normalized_sector, limit=TOP_K_RESULTS)
    matches = retrieval.get("results", [])
    total_count = int(retrieval.get("total") or len(matches))

    if matches:
        return listing_response(active_session_id, normalized_query, matches, total_count)

    state_filters = detect_query_states(normalize_search_text(normalized_query))
    if normalized_sector or state_filters:
        resolved_state = next(iter(state_filters), None)
        return get_top_datasets(
            active_session_id,
            normalized_sector or "all",
            limit=TOP_K_RESULTS,
            state=resolved_state,
        )

    return no_match_response(active_session_id, normalized_query)


def get_top_datasets(session_id: str, sector: str, limit: int = 10, state: str | None = None) -> dict[str, Any]:
    from .dataset_catalog import read_trackers, sector_label, tracker_key_candidates

    trackers = read_trackers()
    normalized_sector = normalize_sector_key(sector) if sector else "all"
    sectors_to_scan = sector_keys() if normalized_sector == "all" else [normalized_sector]
    state_filters = detect_query_states(normalize_search_text(state or ""))

    scored: list[tuple[int, int, dict[str, Any]]] = []
    for sector_key in sectors_to_scan:
        for dataset in sector_catalog_datasets(sector_key):
            enriched = enrich_dataset(dataset)
            if state_filters and not any(dataset_matches_state_filter(enriched, code) for code in state_filters):
                continue

            tracker_views = 0
            tracker_downloads = 0
            for tracker_key in tracker_key_candidates(sector_key, enriched["id"]):
                tracker = trackers.get(tracker_key, {})
                tracker_views = max(tracker_views, int(tracker.get("views") or 0))
                tracker_downloads = max(tracker_downloads, int(tracker.get("downloads") or 0))

            scored.append((tracker_views, tracker_downloads, enriched))

    scored.sort(key=lambda item: (-item[0], -item[1], str(item[2].get("title") or "").lower()))
    matches = [item[2] for item in scored[:limit]]
    total_count = len(scored)

    sector_text = sector_label(normalized_sector) if normalized_sector != "all" else "all sectors"
    state_text = f" for {state}" if state else ""
    message = (
        f"I found {total_count} tracked datasets in {sector_text}{state_text}. "
        f"Showing the top {len(matches)} by engagement."
    )

    insights = []
    if matches:
        insights.append(f"Top result: {matches[0].get('title')}.")
        insights.append(f"Showing top {len(matches)} of {total_count} tracked datasets.")

    record_session_message(session_id, "assistant", message)
    state_store = session_state(session_id)
    state_store["lastMatches"] = matches
    if len(matches) == 1:
        state_store["lastDataset"] = matches[0]
    else:
        state_store.pop("lastDataset", None)

    return {
        "sessionId": session_id,
        "restricted": False,
        "content": message,
        "matches": [message_dataset_payload(dataset, rank) for rank, dataset in enumerate(matches, start=1)],
        "insights": insights,
        "result": None,
        "history": _session_history[session_id],
    }
