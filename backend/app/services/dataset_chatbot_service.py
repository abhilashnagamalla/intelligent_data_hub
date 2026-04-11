from __future__ import annotations

import re
import uuid
from collections import Counter
from datetime import datetime
from difflib import get_close_matches
from typing import Any

import requests

from .dataset_catalog import (
    detect_categorical_columns,
    detect_numeric_columns,
    fetch_full_dataset,
    fetch_resource_metadata,
    format_metric_value,
    get_dataset_by_id,
    normalize_search_text,
    safe_float,
    safe_int,
)

MAX_CHATBOT_ANALYSIS_ROWS = 10000
DATASET_RESTRICTION_MESSAGE = "This chatbot only answers questions about the selected dataset."
DATASET_QUERY_TERMS = {
    "average",
    "avg",
    "column",
    "columns",
    "count",
    "dataset",
    "feature",
    "features",
    "field",
    "fields",
    "maximum",
    "max",
    "mean",
    "minimum",
    "min",
    "record",
    "records",
    "row",
    "rows",
    "schema",
    "header",
    "headers",
    "preview",
    "summary",
    "trend",
}
INTENT_KEYWORDS = {
    "mean": {"average", "avg", "mean"},
    "max": {"highest", "largest", "maximum", "max", "peak"},
    "min": {"lowest", "minimum", "min", "smallest"},
    "count": {"count", "how many", "number of", "total rows", "total records"},
    "column": {"column", "columns", "feature", "features", "field", "fields", "header", "headers", "schema"},
    "preview": {"example row", "first record", "first row", "preview", "sample record", "sample row", "show row"},
    "trend": {"change", "growth", "over time", "pattern", "timeline", "trend", "trends"},
}

# Enhanced keyword sets for specific query patterns with typo variations
FEATURES_KEYWORDS = {
    "features", "columns", "feature", "column", "attributes", "fields", 
    "schema", "structure", "headers", "col", "cols", "field", "header",
    "feture", "fetures", "colums", "columms",  # common typos
}
INSIGHTS_KEYWORDS = {
    "insights", "key insights", "analysis", "analyze", "summarize", 
    "summary", "metrics", "statistics", "overview", "stat", "stats",
    "insihgts", "analyis", "summery",  # common typos
}
COMPARISON_KEYWORDS = {
    "difference", "compare", "vs", "versus", "between", "compared to", 
    "growth", "change", "diff", "comparison", "comapre",  # typos
}
YEAR_KEYWORDS = {"year", "annual", "yearly", "on", "in", "during", "for year", "year of", "yr"}
SERIAL_ID_KEYWORDS = {
    "sl", "sno", "serial", "id", "serial no", "serial number", 
    "row number", "index", "ticket no", "case no", "code", "ticket",
}

TEMPORAL_KEYWORDS = {"date", "day", "month", "quarter", "time", "timeline", "week", "year"}
COLUMN_STOP_WORDS = {"and", "by", "for", "in", "of", "the", "to"}

_session_history: dict[str, list[dict[str, str]]] = {}


def record_session_message(session_id: str, role: str, content: str) -> list[dict[str, str]]:
    history = _session_history.setdefault(session_id, [])
    history.append({"role": role, "content": content})
    return history


def fuzzy_match_keyword(text: str, keyword_set: set[str], cutoff: float = 0.6) -> bool:
    """Check if text fuzzy-matches any keyword in the set (for typo tolerance).
    
    Examples:
    - \"fetures\" matches \"features\" (typo)
    - \"colums\" matches \"columns\" (typo)
    - \"insihgts\" matches \"insights\" (typo)
    \"\"\"
    normalized = normalize_search_text(text).split()
    
    for word in normalized:
        # First try exact match (fast path)
        if word in keyword_set:
            return True
        
        # Then try fuzzy match for typos
        matches = get_close_matches(word, keyword_set, n=1, cutoff=cutoff)
        if matches:
            return True
    
    return False


def clarification_response(session_id: str, query: str, query_type: str = \"ambiguous\") -> dict[str, Any]:
    \"\"\"Provide a clarification prompt when query intent is ambiguous.\"\"\"
    if query_type == \"ambiguous\":
        answer = (
            f\"I'm not sure what you're asking about '{query}'. Could you clarify?\
\
\"
            \"Are you asking for:\
\"
            \"• **Features/Columns** - List of column names and first row data\
\"
            \"• **Insights** - Summary stats, min/max values, trends, anomalies\
\"
            \"• **Specific metric** - Max/min value, comparison between columns\
\
\"
            \"Please rephrase using words like: features, columns, insights, max, min, compare, etc.\"
        )
    elif query_type == \"no_dataset\":
        answer = \"Please select a dataset first by saying something like 'show datasets related to agriculture' or 'tell me about census data'.\"
    elif query_type == \"error\":
        answer = (
            \"Something went wrong analyzing this query. Could you try:\
\"
            \"• Checking the spelling (e.g., 'features' not 'fetures')\
\"
            \"• Being more specific about what you want\
\"
            \"• Selecting a dataset first\
\
\"
            \"What would you like to know about the dataset?\"
        )
    else:
        answer = \"I didn't quite understand that. Could you rephrase your question?\"
    
    record_session_message(session_id, \"assistant\", answer)
    return {
        \"sessionId\": session_id,
        \"restricted\": False,
        \"content\": answer,
        \"matches\": [],
        \"insights\": [],
        \"result\": None,
        \"history\": _session_history[session_id],
    }


def matched_columns_from_query(query: str, columns: list[str], *, limit: int = 3) -> list[str]:
    normalized_query = normalize_search_text(query)
    query_terms = set(normalized_query.split())
    scored: list[tuple[int, int, str]] = []

    for column in columns:
        normalized_column = normalize_search_text(column)
        if not normalized_column:
            continue

        score = 0
        if normalized_column in normalized_query:
            score += 100

        tokens = [token for token in normalized_column.split() if token not in COLUMN_STOP_WORDS]
        score += sum(12 for token in tokens if token in query_terms)

        if score > 0:
            scored.append((score, len(normalized_column), column))

    scored.sort(key=lambda item: (-item[0], -item[1], item[2].lower()))
    return [column for _, _, column in scored[:limit]]


def detect_intent(query: str) -> str:
    normalized_query = normalize_search_text(query)

    for intent, keywords in INTENT_KEYWORDS.items():
        if any(keyword in normalized_query for keyword in keywords):
            return intent

    if "describe" in normalized_query or "about" in normalized_query:
        return "column"

    return "summary"


def is_features_question(query: str) -> bool:
    """Check if query asks for features/columns/schema with typo tolerance."""
    normalized = normalize_search_text(query)
    
    # Exact match first (fast path)
    if any(keyword in normalized for keyword in FEATURES_KEYWORDS):
        return True
    
    # Fuzzy match for typos
    return fuzzy_match_keyword(query, FEATURES_KEYWORDS, cutoff=0.70)


def is_insights_question(query: str) -> bool:
    """Check if query asks for insights/analysis with typo tolerance."""
    normalized = normalize_search_text(query)
    
    # Exact match first
    if any(keyword in normalized for keyword in INSIGHTS_KEYWORDS):
        return True
    
    # Fuzzy match for typos
    return fuzzy_match_keyword(query, INSIGHTS_KEYWORDS, cutoff=0.70)


def is_comparison_query(query: str) -> bool:
    """Check if query asks for comparisons with typo tolerance."""
    normalized = normalize_search_text(query)
    
    # Exact match first
    if any(keyword in normalized for keyword in COMPARISON_KEYWORDS):
        return True
    
    # Fuzzy match
    return fuzzy_match_keyword(query, COMPARISON_KEYWORDS, cutoff=0.70)


def extract_year_and_feature(query: str, columns: list[str]) -> tuple[str | None, str | None]:
    """Extract year value and feature name from queries like 'max value of production on 2020'."""
    normalized = normalize_search_text(query)
    
    year_value = None
    feature_name = None
    
    # Extract year (look for 4-digit numbers)
    year_match = re.search(r'\b(19|20)\d{2}\b', query)
    if year_match:
        year_value = year_match.group(0)
    
    # Extract feature from query
    for col in columns:
        col_normalized = normalize_search_text(col)
        if col_normalized in normalized and col_normalized not in COLUMN_STOP_WORDS:
            feature_name = col
            break
    
    return year_value, feature_name


def is_serial_id_column(column_name: str) -> bool:
    """Detect if column is a serial number or ID column to exclude from results."""
    normalized = normalize_search_text(column_name)
    return any(keyword in normalized for keyword in SERIAL_ID_KEYWORDS)


def filter_columns_exclude_serial(columns: list[str]) -> list[str]:
    """Return columns excluding serial numbers and IDs."""
    return [col for col in columns if not is_serial_id_column(col)]


def is_dataset_question(query: str, intent: str, matched_columns: list[str]) -> bool:
    normalized_query = normalize_search_text(query)
    if intent != "summary":
        return True
    if matched_columns:
        return True
    return any(term in normalized_query for term in DATASET_QUERY_TERMS)


def detect_date_columns(records: list[dict[str, Any]], columns: list[str]) -> list[str]:
    date_columns: list[str] = []

    for column in columns:
        normalized_column = normalize_search_text(column)
        if any(keyword in normalized_column for keyword in TEMPORAL_KEYWORDS):
            date_columns.append(column)
            continue

        values = [
            str(record.get(column) or "").strip()
            for record in records[:100]
            if str(record.get(column) or "").strip()
        ]
        if not values:
            continue

        parsed_count = sum(1 for value in values if parse_temporal_value(value) is not None)
        if parsed_count and parsed_count / len(values) >= 0.6:
            date_columns.append(column)

    return date_columns


def parse_temporal_value(value: Any) -> tuple[tuple[int, Any], str] | None:
    text = str(value or "").strip()
    if not text:
        return None

    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y", "%Y-%m", "%Y/%m", "%Y"):
        try:
            parsed = datetime.strptime(text, fmt)
            return (0, parsed), text
        except ValueError:
            continue

    year_match = re.search(r"\b(19|20)\d{2}\b", text)
    if year_match:
        return (1, int(year_match.group(0))), text

    numeric_value = safe_float(text)
    if numeric_value is not None:
        return (2, numeric_value), text

    return None


def top_samples(values: list[Any], *, limit: int = 5) -> list[str]:
    normalized_values = [str(value).strip() for value in values if str(value).strip()]
    return [value for value, _ in Counter(normalized_values).most_common(limit)]


def preview_row_pairs(records: list[dict[str, Any]], columns: list[str], *, limit: int = 8) -> list[str]:
    if not records or not columns:
        return []

    first_record = records[0]
    preview: list[str] = []
    for column in columns:
        value = str(first_record.get(column) or "").strip()
        if not value:
            continue
        compact_value = value if len(value) <= 48 else f"{value[:45].rstrip()}..."
        preview.append(f"{column}={compact_value}")
        if len(preview) >= limit:
            break
    return preview


def dataset_reference(dataset_id: str | None, dataset_title: str | None, records: list[dict[str, Any]], columns: list[str]) -> dict[str, Any]:
    return {
        "id": dataset_id,
        "title": dataset_title or dataset_id or "Selected dataset",
        "rows": len(records),
        "columns": len(columns),
    }


def resolve_dataset_context(
    *,
    dataset_id: str | None,
    dataset_title: str | None,
    dataset_records: list[dict[str, Any]] | None,
    dataset_columns: list[str] | None,
) -> dict[str, Any]:
    import logging
    logger = logging.getLogger(__name__)
    
    if dataset_records and dataset_columns:
        logger.info(f"Using provided dataset context: {len(dataset_records)} records, {len(dataset_columns)} columns")
        return {
            "dataset": dataset_reference(dataset_id, dataset_title, dataset_records, dataset_columns),
            "records": dataset_records,
            "columns": dataset_columns,
        }

    if not dataset_id:
        raise ValueError("Select a dataset before asking a question.")

    logger.info(f"Fetching full dataset {dataset_id} with max_rows={MAX_CHATBOT_ANALYSIS_ROWS}")
    try:
        full_dataset = fetch_full_dataset(dataset_id, max_rows=MAX_CHATBOT_ANALYSIS_ROWS)
    except Exception as e:
        logger.error(f"Error fetching dataset {dataset_id}: {type(e).__name__}: {str(e)}")
        raise ValueError(f"Could not fetch dataset from data.gov.in API: {str(e)}")
    
    logger.info(f"Fetch result: tooLarge={full_dataset.get('tooLarge')}, totalRows={full_dataset.get('totalRows')}, recordsReturned={len(full_dataset.get('records', []))}, columns={len(full_dataset.get('columns', []))}")
    
    if full_dataset.get("tooLarge"):
        raise ValueError(
            f"The selected dataset has {full_dataset.get('totalRows', 0):,} rows. "
            f"Chat analysis is available for datasets with {MAX_CHATBOT_ANALYSIS_ROWS:,} rows or less."
        )

    records = full_dataset.get("records", [])
    columns = full_dataset.get("columns", [])
    
    if not records:
        logger.warning(f"Dataset {dataset_id} returned no records. Columns available: {len(columns)}")
        raise ValueError(
            "The selected dataset returned no data. It may be empty, or the data.gov.in API may be temporarily unavailable. "
            "Please try another dataset or check back later."
        )
    
    if not columns:
        logger.error(f"Dataset {dataset_id} has no column information")
        raise ValueError(
            "The dataset has no column information available. The dataset format may not be supported by the system."
        )

    resolved_title = dataset_title
    if not resolved_title:
        try:
            _sector_key, dataset = get_dataset_by_id(dataset_id)
            resolved_title = dataset.get("title") if dataset else dataset_id
        except requests.RequestException:
            resolved_title = dataset_id
    
    logger.info(f"Successfully loaded dataset {dataset_id}: {len(records)} records, {len(columns)} columns")
    return {
        "dataset": dataset_reference(dataset_id, resolved_title, records, columns),
        "records": records,
        "columns": columns,
    }


def structured_result(
    *,
    intent: str,
    dataset: dict[str, Any],
    answer: str,
    title: str,
    columns: list[str] | None = None,
    metrics: list[dict[str, str]] | None = None,
    observations: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "intent": intent,
        "title": title,
        "dataset": dataset,
        "columns": columns or [],
        "metrics": metrics or [],
        "observations": observations or [],
        "answer": answer,
    }


def year_wise_comparison(records, columns):
    """Year-wise comparison and growth patterns."""
    try:
        date_cols = detect_date_columns(records, columns)
        numeric_cols = detect_numeric_columns(records, columns)
        if not date_cols or not numeric_cols:
            return []
        
        insights = []
        for date_col in date_cols[:1]:
            for num_col in numeric_cols:
                try:
                    # Group by year
                    years = {}
                    for r in records:
                        time_val = parse_temporal_value(r.get(date_col))
                        if time_val:
                            year = time_val[1]
                            val = safe_float(r.get(num_col))
                            if year and val is not None:
                                y = str(year.year if hasattr(year, 'year') else year)
                                years.setdefault(y, 0)
                                years[y] += val
                    
                    if len(years) >= 2:
                        sorted_years = sorted(years)
                        first_y, first_v = sorted_years[0], years[sorted_years[0]]
                        last_y, last_v = sorted_years[-1], years[sorted_years[-1]]
                        if first_v != 0:
                            growth = ((last_v - first_v) / first_v * 100)
                            insights.append(f"{num_col}: {first_y}={format_metric_value(first_v)}, {last_y}={format_metric_value(last_v)} (growth: {growth:+.1f}%)")
                except Exception:
                    continue  # Skip this column if analysis fails
        
        return insights
    except Exception:
        return []  # Return empty list if year-wise comparison fails

def detect_anomalies(records, columns):
    """IQR-based outliers (anomalies)."""
    numeric_cols = detect_numeric_columns(records, columns)
    anomalies = []
    for col in numeric_cols:
        try:
            values = [safe_float(r.get(col)) for r in records if safe_float(r.get(col)) is not None]
            if len(values) < 4:
                continue
            from numpy import percentile as np_percentile
            q1 = float(np_percentile(values, 25))
            q3 = float(np_percentile(values, 75))
            iqr = q3 - q1
            if iqr == 0:
                continue  # Skip columns with no variance
            lower, upper = q1 - 1.5*iqr, q3 + 1.5*iqr
            outliers = [v for v in values if v < lower or v > upper]
            if outliers:
                anomalies.append(f"{col}: {len(outliers)} outliers (IQR range: {format_metric_value(lower)}-{format_metric_value(upper)})")
        except Exception:
            continue  # Skip this column if anomaly detection fails
    return anomalies

def summary_response(context: dict[str, Any], numeric_columns: list[str], date_columns: list[str]) -> dict[str, Any]:
    dataset = context["dataset"]
    records = context["records"]
    columns = context["columns"]
    categorical_columns = detect_categorical_columns(records, columns, numeric_columns)

    answer = (
        f"**Dataset Overview**: {dataset['title']}

"
        f"**Key Metrics:**
"
        f"- Rows: {dataset['rows']:,}
"
        f"- Columns: {dataset['columns']:,}
"
        f"- Numeric columns: {len(numeric_columns)}
"
        f"- Time columns: {len(date_columns)}

"
        f"**Column Names:**
"
        f"{', '.join(columns)}"
    )
    
    observations = []
    observations.append(f"Total records: {dataset['rows']:,}")
    observations.append(f"Total columns: {dataset['columns']:,}")
    
    if numeric_columns:
        observations.append(f"Numeric columns ({len(numeric_columns)}): {', '.join(numeric_columns[:5])}{'...' if len(numeric_columns) > 5 else ''}")
    if categorical_columns:
        observations.append(f"Categorical columns: {', '.join(categorical_columns[:3])}")
    if date_columns:
        observations.append(f"Time-aware columns: {', '.join(date_columns[:3])}")
        
    # Show first row data
    if records:
        first_record = records[0]
        first_row_items = []
        for col in columns[:8]:
            value = first_record.get(col, "N/A")
            first_row_items.append(f"{col}={str(value)[:30]}")
        if first_row_items:
            observations.append(f"First row data: {' | '.join(first_row_items)}")
    
    sample_pairs = preview_row_pairs(records, columns)
    if sample_pairs:
        observations.append(f"First record preview: {'; '.join(sample_pairs)}")

    # Enhanced insights
    year_insights = year_wise_comparison(records, columns)
    anomaly_insights = detect_anomalies(records, columns)
    observations.extend(year_insights + anomaly_insights)

    return structured_result(
        intent="summary",
        dataset=dataset,
        answer=answer,
        title="Dataset Key Insights",
        columns=columns,
        metrics=[
            {"label": "Rows", "value": f"{dataset['rows']:,}"},
            {"label": "Columns", "value": f"{dataset['columns']:,}"},
            {"label": "Numeric columns", "value": str(len(numeric_columns))},
            {"label": "Time columns", "value": str(len(date_columns))},
        ],
        observations=observations,
    )


def column_response(context: dict[str, Any], matched_columns: list[str], numeric_columns: list[str]) -> dict[str, Any]:
    dataset = context["dataset"]
    records = context["records"]
    columns = context["columns"]
    
    # Filter out serial/ID columns from display
    filtered_columns = filter_columns_exclude_serial(columns)
    filtered_matched = [col for col in matched_columns if col in filtered_columns]

    if not filtered_matched:
        answer = f"{dataset['title']} contains {len(filtered_columns):,} data columns (excluding ID/serial columns).

**Column Names:**
" + ", ".join(filtered_columns)
        sample_pairs = preview_row_pairs(records, filtered_columns)
        
        observations = [f"Total data columns: {len(filtered_columns)}"]
        observations.append(f"Column names: {', '.join(filtered_columns[:15])}{'...' if len(filtered_columns) > 15 else ''}")
        
        # Show first row data (excluding serial columns)
        if records:
            first_record = records[0]
            first_row_data = []
            for col in filtered_columns[:10]:
                value = first_record.get(col, "N/A")
                first_row_data.append(f"{col}: {str(value)[:50]}")
            if first_row_data:
                observations.append(f"First row sample: {' | '.join(first_row_data)}")
        
        if sample_pairs:
            observations.append(f"Full preview of first row: {'; '.join(sample_pairs)}")
            
        return structured_result(
            intent="column",
            dataset=dataset,
            answer=answer,
            title="Columns overview",
            metrics=[
                {"label": "Total Columns", "value": str(len(columns))},
                {"label": "Column Names", "value": ", ".join(columns[:5]) + ("..." if len(columns) > 5 else "")},
                {"label": "Numeric Columns", "value": str(len(numeric_columns))},
            ],
            observations=observations,
        )

    column = matched_columns[0]
    values = [record.get(column) for record in records if record.get(column) not in (None, "")]
    distinct_values = {str(value).strip() for value in values if str(value).strip()}
    samples = top_samples(values)

    observations = [f"Non-empty values: {len(values):,}.", f"Distinct values: {len(distinct_values):,}."]
    metrics = [
        {"label": "Column", "value": column},
        {"label": "Non-empty values", "value": f"{len(values):,}"},
        {"label": "Distinct values", "value": f"{len(distinct_values):,}"},
    ]

    if column in numeric_columns:
        numeric_values = [safe_float(value) for value in values]
        numeric_values = [value for value in numeric_values if value is not None]
        if numeric_values:
            metrics.extend(
                [
                    {"label": "Mean", "value": format_metric_value(sum(numeric_values) / len(numeric_values))},
                    {"label": "Min", "value": format_metric_value(min(numeric_values))},
                    {"label": "Max", "value": format_metric_value(max(numeric_values))},
                ]
            )
            observations.append(
                f"{column} ranges from {format_metric_value(min(numeric_values))} to {format_metric_value(max(numeric_values))}."
            )

    if samples:
        observations.append(f"Sample values: {', '.join(samples)}.")

    answer = f"Column '{column}' was analyzed for {dataset['title']}."
    return structured_result(
        intent="column",
        dataset=dataset,
        answer=answer,
        title=f"Column profile: {column}",
        columns=[column],
        metrics=metrics,
        observations=observations,
    )


def preview_response(context: dict[str, Any], matched_columns: list[str]) -> dict[str, Any]:
    dataset = context["dataset"]
    records = context["records"]
    columns = context["columns"]

    selected_columns = matched_columns[:6] if matched_columns else columns[:8]
    preview_pairs = preview_row_pairs(records, selected_columns)
    if not preview_pairs:
        preview_pairs = preview_row_pairs(records, columns)

    answer = f"Here is a preview of the first available row from {dataset['title']}."
    observations = []
    if preview_pairs:
        observations.append(f"First row: {'; '.join(preview_pairs)}.")
    if len(columns) > len(selected_columns):
        observations.append(f"Additional columns available: {', '.join(columns[:12])}.")

    return structured_result(
        intent="preview",
        dataset=dataset,
        answer=answer,
        title="First row preview",
        columns=selected_columns,
        metrics=[
            {"label": "Rows", "value": f"{dataset['rows']:,}"},
            {"label": "Columns", "value": f"{dataset['columns']:,}"},
            {"label": "Shown fields", "value": ", ".join(selected_columns[:5])},
        ],
        observations=observations,
    )


def resolve_numeric_column(matched_columns: list[str], numeric_columns: list[str]) -> str | None:
    for column in matched_columns:
        if column in numeric_columns:
            return column
    if len(numeric_columns) == 1:
        return numeric_columns[0]
    return numeric_columns[0] if numeric_columns else None


def numeric_metric_response(context: dict[str, Any], intent: str, matched_columns: list[str], numeric_columns: list[str]) -> dict[str, Any]:
    dataset = context["dataset"]
    records = context["records"]
    columns = context["columns"]
    numeric_column = resolve_numeric_column(matched_columns, numeric_columns)
    if not numeric_column:
        return structured_result(
            intent=intent,
            dataset=dataset,
            answer="I could not find a numeric column for that calculation.",
            title="Numeric column required",
            observations=[f"Available numeric columns: {', '.join(numeric_columns[:8])}." if numeric_columns else "No numeric columns were detected."],
        )

    values: list[float] = []
    row_pairs: list[tuple[dict[str, Any], float]] = []
    for record in records:
        value = safe_float(record.get(numeric_column))
        if value is None:
            continue
        values.append(value)
        row_pairs.append((record, value))

    if not values:
        return structured_result(
            intent=intent,
            dataset=dataset,
            answer=f"Column '{numeric_column}' does not contain usable numeric values.",
            title="No numeric data available",
            columns=[numeric_column],
        )

    categorical_columns = detect_categorical_columns(records, columns, numeric_columns)
    category_column = categorical_columns[0] if categorical_columns else None

    if intent == "mean":
        metric_value = sum(values) / len(values)
        answer = f"The mean of '{numeric_column}' is {format_metric_value(metric_value)}."
        observations = [
            f"Based on {len(values):,} numeric values.",
            f"Minimum: {format_metric_value(min(values))}.",
            f"Maximum: {format_metric_value(max(values))}.",
        ]
        title = f"Mean of {numeric_column}"
        metrics = [
            {"label": "Mean", "value": format_metric_value(metric_value)},
            {"label": "Valid values", "value": f"{len(values):,}"},
            {"label": "Range", "value": f"{format_metric_value(min(values))} - {format_metric_value(max(values))}"},
        ]
    else:
        selected_pair = max(row_pairs, key=lambda item: item[1]) if intent == "max" else min(row_pairs, key=lambda item: item[1])
        selected_record, metric_value = selected_pair
        category_label = str(selected_record.get(category_column) or "").strip() if category_column else ""
        metric_label = "Maximum" if intent == "max" else "Minimum"
        answer = f"The {metric_label.lower()} value in '{numeric_column}' is {format_metric_value(metric_value)}."
        observations = [f"Based on {len(values):,} numeric values."]
        if category_label:
            observations.append(f"Associated {category_column}: {category_label}.")
        title = f"{metric_label} of {numeric_column}"
        metrics = [
            {"label": metric_label, "value": format_metric_value(metric_value)},
            {"label": "Valid values", "value": f"{len(values):,}"},
        ]
        if category_label:
            metrics.append({"label": category_column, "value": category_label})

    return structured_result(
        intent=intent,
        dataset=dataset,
        answer=answer,
        title=title,
        columns=[numeric_column],
        metrics=metrics,
        observations=observations,
    )


def count_response(context: dict[str, Any], query: str, matched_columns: list[str]) -> dict[str, Any]:
    dataset = context["dataset"]
    records = context["records"]
    normalized_query = normalize_search_text(query)

    if matched_columns:
        column = matched_columns[0]
        values = [record.get(column) for record in records if record.get(column) not in (None, "")]
        distinct_values = {str(value).strip() for value in values if str(value).strip()}
        use_distinct = "distinct" in normalized_query or "unique" in normalized_query
        metric_value = len(distinct_values) if use_distinct else len(values)
        metric_label = "Distinct values" if use_distinct else "Non-empty values"
        answer = f"Column '{column}' has {metric_value:,} {metric_label.lower()}."
        observations = []
        if not use_distinct:
            observations.append(f"Distinct values: {len(distinct_values):,}.")

        return structured_result(
            intent="count",
            dataset=dataset,
            answer=answer,
            title=f"Count for {column}",
            columns=[column],
            metrics=[
                {"label": metric_label, "value": f"{metric_value:,}"},
                {"label": "Distinct values", "value": f"{len(distinct_values):,}"},
            ],
            observations=observations,
        )

    answer = f"The dataset contains {len(records):,} rows."
    return structured_result(
        intent="count",
        dataset=dataset,
        answer=answer,
        title="Row count",
        metrics=[{"label": "Rows", "value": f"{len(records):,}"}],
    )


def trend_response(context: dict[str, Any], matched_columns: list[str], numeric_columns: list[str], date_columns: list[str]) -> dict[str, Any]:
    dataset = context["dataset"]
    records = context["records"]
    numeric_column = resolve_numeric_column(matched_columns, numeric_columns)
    time_column = None
    for column in matched_columns:
        if column in date_columns:
            time_column = column
            break
    if time_column is None and date_columns:
        time_column = date_columns[0]

    if not numeric_column or not time_column:
        return structured_result(
            intent="trend",
            dataset=dataset,
            answer="I could not identify both a numeric column and a time column for trend analysis.",
            title="Trend analysis unavailable",
            observations=[
                f"Numeric columns detected: {', '.join(numeric_columns[:5])}." if numeric_columns else "No numeric columns detected.",
                f"Time columns detected: {', '.join(date_columns[:5])}." if date_columns else "No time columns detected.",
            ],
        )

    aggregated: dict[tuple[int, Any], dict[str, Any]] = {}
    for record in records:
        time_value = parse_temporal_value(record.get(time_column))
        numeric_value = safe_float(record.get(numeric_column))
        if time_value is None or numeric_value is None:
            continue

        sort_key, label = time_value
        bucket = aggregated.setdefault(sort_key, {"label": label, "value": 0.0})
        bucket["value"] += numeric_value

    ordered_points = [aggregated[key] for key in sorted(aggregated)]
    if len(ordered_points) < 2:
        return structured_result(
            intent="trend",
            dataset=dataset,
            answer="There are not enough time-ordered values to calculate a trend.",
            title="Trend analysis unavailable",
            columns=[time_column, numeric_column],
        )

    first_point = ordered_points[0]
    last_point = ordered_points[-1]
    peak_point = max(ordered_points, key=lambda item: item["value"])
    low_point = min(ordered_points, key=lambda item: item["value"])
    direction = "upward" if last_point["value"] > first_point["value"] else "downward" if last_point["value"] < first_point["value"] else "flat"

    answer = (
        f"The trend for '{numeric_column}' over '{time_column}' is {direction}. "
        f"It changes from {format_metric_value(first_point['value'])} at {first_point['label']} "
        f"to {format_metric_value(last_point['value'])} at {last_point['label']}."
    )
    observations = [
        f"Peak: {format_metric_value(peak_point['value'])} at {peak_point['label']}.",
        f"Lowest point: {format_metric_value(low_point['value'])} at {low_point['label']}.",
    ]

    return structured_result(
        intent="trend",
        dataset=dataset,
        answer=answer,
        title=f"Trend of {numeric_column}",
        columns=[time_column, numeric_column],
        metrics=[
            {"label": "Start", "value": f"{first_point['label']} ({format_metric_value(first_point['value'])})"},
            {"label": "End", "value": f"{last_point['label']} ({format_metric_value(last_point['value'])})"},
            {"label": "Peak", "value": f"{peak_point['label']} ({format_metric_value(peak_point['value'])})"},
        ],
        observations=observations,
    )


def year_wise_metric_response(
    context: dict[str, Any],
    intent: str,
    query: str,
    numeric_columns: list[str],
    date_columns: list[str],
) -> dict[str, Any] | None:
    \"\"\"Handle queries like 'max value of column on 2020' with year filtering.\"\"\"
    dataset = context[\"dataset\"]
    records = context[\"records\"]
    columns = context[\"columns\"]
    
    if not date_columns or not numeric_columns:
        return None
    
    year_value, feature_name = extract_year_and_feature(query, columns)
    if not year_value or not feature_name:
        return None
    
    if feature_name not in numeric_columns:
        return None
    
    # Filter records by year
    date_col = date_columns[0]
    year_filtered = []
    for record in records:
        time_val = parse_temporal_value(record.get(date_col))
        if time_val:
            year = time_val[1]
            record_year = str(year.year if hasattr(year, 'year') else year)
            if record_year == year_value:
                val = safe_float(record.get(feature_name))
                if val is not None:
                    year_filtered.append({\"value\": val, \"record\": record})
    
    if not year_filtered:
        return None
    
    if intent in {\"max\", \"min\"}:
        selected = max(year_filtered, key=lambda x: x[\"value\"]) if intent == \"max\" else min(year_filtered, key=lambda x: x[\"value\"])
        metric_value = selected[\"value\"]
        metric_label = \"Maximum\" if intent == \"max\" else \"Minimum\"
        answer = f\"The {metric_label.lower()} value of '{feature_name}' in year {year_value} is {format_metric_value(metric_value)}.\"
        
        return structured_result(
            intent=intent,
            dataset=dataset,
            answer=answer,
            title=f\"{metric_label} of {feature_name} in {year_value}\",
            columns=[feature_name, date_col],
            metrics=[
                {\"label\": metric_label, \"value\": format_metric_value(metric_value)},
                {\"label\": \"Year\", \"value\": year_value},
                {\"label\": \"Records analyzed\", \"value\": f\"{len(year_filtered)}\"},
            ],
            observations=[f\"Based on {len(year_filtered)} records from {year_value}.\"],
        )
    
    return None


def feature_comparison_response(
    context: dict[str, Any],
    query: str,
    numeric_columns: list[str],
) -> dict[str, Any] | None:
    \"\"\"Handle queries asking for differences between features or years.\"\"\"
    dataset = context[\"dataset\"]
    records = context[\"records\"]
    columns = context[\"columns\"]
    
    if not numeric_columns or len(numeric_columns) < 2:
        return None
    
    if not any(kw in normalize_search_text(query) for kw in COMPARISON_KEYWORDS):
        return None
    
    # Try to find two numeric columns in query
    found_columns = []
    for col in numeric_columns:
        if col.lower() in normalize_search_text(query):
            found_columns.append(col)
        if len(found_columns) >= 2:
            break
    
    if len(found_columns) < 2:
        return None
    
    col1, col2 = found_columns[0], found_columns[1]
    
    # Calculate statistics for comparison
    vals1 = [safe_float(r.get(col1)) for r in records if safe_float(r.get(col1)) is not None]
    vals2 = [safe_float(r.get(col2)) for r in records if safe_float(r.get(col2)) is not None]
    
    if not vals1 or not vals2:
        return None
    
    mean1 = sum(vals1) / len(vals1)
    mean2 = sum(vals2) / len(vals2)
    difference = mean2 - mean1
    percent_diff = (difference / mean1 * 100) if mean1 != 0 else 0
    
    answer = f\"Comparing '{col1}' and '{col2}': Mean of '{col1}' is {format_metric_value(mean1)}, mean of '{col2}' is {format_metric_value(mean2)}. Difference: {format_metric_value(difference)} ({percent_diff:+.1f}%).\"
    
    return structured_result(
        intent=\"comparison\",
        dataset=dataset,
        answer=answer,
        title=f\"Comparison: {col1} vs {col2}\",
        columns=[col1, col2],
        metrics=[
            {\"label\": f\"{col1} Mean\", \"value\": format_metric_value(mean1)},
            {\"label\": f\"{col2} Mean\", \"value\": format_metric_value(mean2)},
            {\"label\": \"Difference\", \"value\": format_metric_value(difference)},
            {\"label\": \"Percent Change\", \"value\": f\"{percent_diff:+.1f}%\"},
        ],
        observations=[
            f\"{col1}: min={format_metric_value(min(vals1))}, max={format_metric_value(max(vals1))}\",
            f\"{col2}: min={format_metric_value(min(vals2))}, max={format_metric_value(max(vals2))}\",
        ],
    )


def restriction_response(session_id: str, message: str) -> dict[str, Any]:
    record_session_message(session_id, \"assistant\", message)
    return {
        \"sessionId\": session_id,
        \"restricted\": True,
        \"content\": message,
        \"matches\": [],
        \"insights\": [],
        \"result\": None,
        \"history\": _session_history[session_id],
    }


def answer_response(session_id: str, result: dict[str, Any]) -> dict[str, Any]:
    answer = result.get("answer", "")
    record_session_message(session_id, "assistant", answer)
    return {
        "sessionId": session_id,
        "restricted": False,
        "content": answer,
        "matches": [],
        "insights": result.get("observations", []),
        "result": result,
        "history": _session_history[session_id],
    }


def metadata_response(session_id: str, dataset_id: str, dataset_title: str | None) -> dict[str, Any]:
    """
    Fallback response using only metadata when live data is unavailable.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Providing metadata fallback for dataset {dataset_id}")
    
    try:
        metadata = fetch_resource_metadata(dataset_id)
        field_names = metadata.get("fieldNames", [])
        num_rows = safe_int(metadata.get("numberOfRows"))
        num_cols = safe_int(metadata.get("numberOfColumns"))
    except Exception as e:
        logger.warning(f"Could not fetch metadata for {dataset_id}: {str(e)}")
        field_names = []
        num_rows = 0
        num_cols = 0
    
    answer = f"Dataset '{dataset_title or dataset_id}' is temporarily unavailable for live analysis."
    
    observations = []
    observations.append(f"Dataset has approximately {num_rows:,} rows" if num_rows else "Row count unavailable")
    if field_names:
        observations.append(f"Contains {len(field_names)} columns: {', '.join(field_names[:10])}")
        if len(field_names) > 10:
            observations.append(f"And {len(field_names) - 10} more columns")
    observations.append("The live data API is temporarily unavailable. Please try again later.")
    
    result = {
        "intent": "metadata_fallback",
        "title": f"Dataset Info: {dataset_title or dataset_id}",
        "dataset": {
            "id": dataset_id,
            "title": dataset_title,
            "rows": num_rows,
            "columns": len(field_names),
        },
        "columns": field_names,
        "metrics": [
            {"label": "Rows", "value": f"{num_rows:,}" if num_rows else "Unknown"},
            {"label": "Columns", "value": f"{len(field_names)}"},
        ],
        "observations": observations,
        "answer": answer,
    }
    
    record_session_message(session_id, "assistant", answer)
    return {
        "sessionId": session_id,
        "restricted": False,
        "content": answer,
        "matches": [],
        "insights": observations,
        "result": result,
        "history": _session_history[session_id],
    }


def chatbot_response(
    query: str,
    session_id: str | None = None,
    sector: str | None = None,
    dataset_id: str | None = None,
    dataset_title: str | None = None,
    dataset_records: list[dict[str, Any]] | None = None,
    dataset_columns: list[str] | None = None,
    user_email: str | None = None,
    user_id: str | None = None,
) -> dict[str, Any]:
    del sector

    active_session_id = session_id or str(uuid.uuid4())
    record_session_message(active_session_id, "user", query)
    
    import logging
    logger = logging.getLogger(__name__)

    try:
        context = resolve_dataset_context(
            dataset_id=dataset_id,
            dataset_title=dataset_title,
            dataset_records=dataset_records,
            dataset_columns=dataset_columns,
        )
    except ValueError as exc:
        # Try metadata fallback if available
        if dataset_id:
            logger.info(f"Attempting metadata fallback for {dataset_id}: {str(exc)}")
            return metadata_response(active_session_id, dataset_id, dataset_title)
        # Dataset not selected - provide helpful prompt
        logger.warning(f"No dataset selected for query: {query}")
        return clarification_response(active_session_id, query, "no_dataset")
    except requests.RequestException as e:
        # Try metadata fallback if API is unavailable
        if dataset_id:
            logger.info(f"API unavailable, using metadata fallback for {dataset_id}: {str(e)}")
            return metadata_response(active_session_id, dataset_id, dataset_title)
        logger.error(f"API request failed: {str(e)}")
        return clarification_response(active_session_id, query, "error")
    except Exception as e:
        logger.error(f"Unexpected error in dataset context: {type(e).__name__}: {str(e)}")
        return clarification_response(active_session_id, query, "error")

    try:
        columns = context["columns"]
        records = context["records"]
        numeric_columns = detect_numeric_columns(records, columns)
        date_columns = detect_date_columns(records, columns)
        matched_columns = matched_columns_from_query(query, columns)
        intent = detect_intent(query)

        if not is_dataset_question(query, intent, matched_columns):
            return restriction_response(active_session_id, DATASET_RESTRICTION_MESSAGE)

        # Enhanced query handling for specific patterns with intent detection
        result = None
        
        # 1. Check for "features/columns" keyword pattern
        if is_features_question(query):
            logger.debug(f"Detected features question: {query}")
            result = column_response(context, matched_columns, numeric_columns)
        
        # 2. Check for "insights/key insights" keyword pattern
        elif is_insights_question(query):
            logger.debug(f"Detected insights question: {query}")
            result = summary_response(context, numeric_columns, date_columns)
        
        # 3. Check for year-wise metric queries (e.g., "max of column in year")
        elif intent in {"max", "min"} and date_columns and len(date_columns) > 0:
            logger.debug(f"Detecting year-wise metric: {query}")
            year_result = year_wise_metric_response(context, intent, query, numeric_columns, date_columns)
            if year_result:
                result = year_result
            else:
                result = numeric_metric_response(context, intent, matched_columns, numeric_columns)
        
        # 4. Check for comparison queries (e.g., "difference between X and Y")
        elif is_comparison_query(query):
            logger.debug(f"Detected comparison query: {query}")
            comp_result = feature_comparison_response(context, query, numeric_columns)
            if comp_result:
                result = comp_result
            else:
                result = numeric_metric_response(context, intent, matched_columns, numeric_columns)
        
        # 5. Standard intent-based routing
        elif intent == "column":
            logger.debug(f"Detected column intent: {query}")
            result = column_response(context, matched_columns, numeric_columns)
        elif intent == "preview":
            logger.debug(f"Detected preview intent: {query}")
            result = preview_response(context, matched_columns)
        elif intent == "count":
            logger.debug(f"Detected count intent: {query}")
            result = count_response(context, query, matched_columns)
        elif intent == "trend":
            logger.debug(f"Detected trend intent: {query}")
            result = trend_response(context, matched_columns, numeric_columns, date_columns)
        elif intent in {"mean", "max", "min"}:
            logger.debug(f"Detected numeric intent: {query}")
            result = numeric_metric_response(context, intent, matched_columns, numeric_columns)
        else:
            logger.debug(f"No specific intent matched, using summary: {query}")
            result = summary_response(context, numeric_columns, date_columns)

        if result is None:
            logger.warning(f"Query processing returned None result: {query}")
            return clarification_response(active_session_id, query, "ambiguous")

        return answer_response(active_session_id, result)
        
    except Exception as e:
        logger.error(f"Unexpected error processing query '{query}': {type(e).__name__}: {str(e)}")
        return clarification_response(active_session_id, query, "error")
