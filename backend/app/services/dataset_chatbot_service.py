from __future__ import annotations

import re
import uuid
from collections import Counter
from datetime import datetime
from typing import Any

import requests

from .dataset_catalog import (
    detect_categorical_columns,
    detect_numeric_columns,
    fetch_full_dataset,
    format_metric_value,
    get_dataset_by_id,
    normalize_search_text,
    safe_float,
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
TEMPORAL_KEYWORDS = {"date", "day", "month", "quarter", "time", "timeline", "week", "year"}
COLUMN_STOP_WORDS = {"and", "by", "for", "in", "of", "the", "to"}

_session_history: dict[str, list[dict[str, str]]] = {}


def record_session_message(session_id: str, role: str, content: str) -> list[dict[str, str]]:
    history = _session_history.setdefault(session_id, [])
    history.append({"role": role, "content": content})
    return history


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
    if dataset_records and dataset_columns:
        return {
            "dataset": dataset_reference(dataset_id, dataset_title, dataset_records, dataset_columns),
            "records": dataset_records,
            "columns": dataset_columns,
        }

    if not dataset_id:
        raise ValueError("Select a dataset before asking a question.")

    full_dataset = fetch_full_dataset(dataset_id, max_rows=MAX_CHATBOT_ANALYSIS_ROWS)
    if full_dataset.get("tooLarge"):
        raise ValueError(
            f"The selected dataset has {full_dataset.get('totalRows', 0):,} rows. "
            f"Chat analysis is available for datasets with {MAX_CHATBOT_ANALYSIS_ROWS:,} rows or less."
        )

    records = full_dataset.get("records", [])
    columns = full_dataset.get("columns", [])
    if not records or not columns:
        raise ValueError("The selected dataset does not have enough rows to analyze.")

    resolved_title = dataset_title
    if not resolved_title:
        try:
            _sector_key, dataset = get_dataset_by_id(dataset_id)
            resolved_title = dataset.get("title") if dataset else dataset_id
        except requests.RequestException:
            resolved_title = dataset_id

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
    date_cols = detect_date_columns(records, columns)
    numeric_cols = detect_numeric_columns(records, columns)
    if not date_cols or not numeric_cols:
        return []
    
    insights = []
    for date_col in date_cols[:1]:
        for num_col in numeric_cols:
            # Group by year
            years = {}
            for r in records:
                year = parse_temporal_value(r.get(date_col))[1] if parse_temporal_value(r.get(date_col)) else None
                val = safe_float(r.get(num_col))
                if year and val:
                    y = str(year.year)
                    years.setdefault(y, 0)
                    years[y] += val
            
            if len(years) >= 2:
                sorted_years = sorted(years)
                first_y, first_v = sorted_years[0], years[sorted_years[0]]
                last_y, last_v = sorted_years[-1], years[sorted_years[-1]]
                growth = ((last_v - first_v) / first_v * 100) if first_v else 0
                insights.append(f"{num_col}: {first_y}={format_metric_value(first_v)}, {last_y}={format_metric_value(last_v)} (growth: {growth:+.1f}%)")
    
    return insights

def detect_anomalies(records, columns):
    """IQR-based outliers (anomalies)."""
    numeric_cols = detect_numeric_columns(records, columns)
    anomalies = []
    for col in numeric_cols:
        values = [safe_float(r.get(col)) for r in records if safe_float(r.get(col))]
        if len(values) < 4:
            continue
        q1, q3 = percentile(values, 0.25), percentile(values, 0.75)
        iqr = q3 - q1
        lower, upper = q1 - 1.5*iqr, q3 + 1.5*iqr
        outliers = [v for v in values if v < lower or v > upper]
        if outliers:
            anomalies.append(f"{col}: {len(outliers)} outliers (IQR range: {format_metric_value(lower)}-{format_metric_value(upper)})")
    return anomalies

def summary_response(context: dict[str, Any], numeric_columns: list[str], date_columns: list[str]) -> dict[str, Any]:
    dataset = context["dataset"]
    records = context["records"]
    columns = context["columns"]
    categorical_columns = detect_categorical_columns(records, columns, numeric_columns, limit=3)

    answer = (
        f"{dataset['title']} has {dataset['rows']:,} rows and {dataset['columns']:,} columns. "
        f"It includes {len(numeric_columns):,} numeric columns and {len(date_columns):,} time-aware columns."
    )
    observations = []
    if numeric_columns:
        observations.append(f"Numeric columns: {', '.join(numeric_columns[:5])}.")
    if categorical_columns:
        observations.append(f"Representative categorical columns: {', '.join(categorical_columns[:3])}.")
    if date_columns:
        observations.append(f"Time-aware columns: {', '.join(date_columns[:3])}.")
    sample_pairs = preview_row_pairs(records, columns)
    if sample_pairs:
        observations.append(f"First row preview: {'; '.join(sample_pairs)}.")

    # Enhanced insights
    year_insights = year_wise_comparison(records, columns)
    anomaly_insights = detect_anomalies(records, columns)
    observations.extend(year_insights + anomaly_insights)

    return structured_result(
        intent="summary",
        dataset=dataset,
        answer=answer,
        title="Dataset summary",
        metrics=[
            {"label": "Rows", "value": f"{dataset['rows']:,}"},
            {"label": "Columns", "value": f"{dataset['columns']:,}"},
            {"label": "Numeric columns", "value": str(len(numeric_columns))},
        ],
        observations=observations,
    )


def column_response(context: dict[str, Any], matched_columns: list[str], numeric_columns: list[str]) -> dict[str, Any]:
    dataset = context["dataset"]
    records = context["records"]
    columns = context["columns"]

    if not matched_columns:
        answer = f"{dataset['title']} contains {len(columns):,} columns."
        sample_pairs = preview_row_pairs(records, columns)
        observations = [f"Available columns: {', '.join(columns[:10])}."]
        if sample_pairs:
            observations.append(f"First row preview: {'; '.join(sample_pairs)}.")
        return structured_result(
            intent="column",
            dataset=dataset,
            answer=answer,
            title="Columns overview",
            metrics=[
                {"label": "Columns", "value": str(len(columns))},
                {"label": "Preview", "value": ", ".join(columns[:5])},
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

    categorical_columns = detect_categorical_columns(records, columns, numeric_columns, limit=1)
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


def restriction_response(session_id: str, message: str) -> dict[str, Any]:
    record_session_message(session_id, "assistant", message)
    return {
        "sessionId": session_id,
        "restricted": True,
        "content": message,
        "matches": [],
        "insights": [],
        "result": None,
        "history": _session_history[session_id],
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


def chatbot_response(
    query: str,
    session_id: str | None = None,
    sector: str | None = None,
    dataset_id: str | None = None,
    dataset_title: str | None = None,
    dataset_records: list[dict[str, Any]] | None = None,
    dataset_columns: list[str] | None = None,
) -> dict[str, Any]:
    del sector

    active_session_id = session_id or str(uuid.uuid4())
    record_session_message(active_session_id, "user", query)

    try:
        context = resolve_dataset_context(
            dataset_id=dataset_id,
            dataset_title=dataset_title,
            dataset_records=dataset_records,
            dataset_columns=dataset_columns,
        )
    except ValueError as exc:
        return restriction_response(active_session_id, str(exc))
    except requests.RequestException:
        return restriction_response(active_session_id, "Dataset analysis is temporarily unavailable because the dataset API could not be reached.")

    columns = context["columns"]
    records = context["records"]
    numeric_columns = detect_numeric_columns(records, columns)
    date_columns = detect_date_columns(records, columns)
    matched_columns = matched_columns_from_query(query, columns)
    intent = detect_intent(query)

    if not is_dataset_question(query, intent, matched_columns):
        return restriction_response(active_session_id, DATASET_RESTRICTION_MESSAGE)

    if intent == "column":
        result = column_response(context, matched_columns, numeric_columns)
    elif intent == "preview":
        result = preview_response(context, matched_columns)
    elif intent == "count":
        result = count_response(context, query, matched_columns)
    elif intent == "trend":
        result = trend_response(context, matched_columns, numeric_columns, date_columns)
    elif intent in {"mean", "max", "min"}:
        result = numeric_metric_response(context, intent, matched_columns, numeric_columns)
    else:
        result = summary_response(context, numeric_columns, date_columns)

    return answer_response(active_session_id, result)
