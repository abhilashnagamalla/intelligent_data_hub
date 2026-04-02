from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
import os
import pandas as pd
import requests


from app.services.dataset_catalog import (
    DETAIL_PAGE_SIZE,
    MAX_VISUALIZATION_ROWS,
    dataset_insights,
    enrich_dataset,
    fetch_dataset_page,
    fetch_full_dataset,
    get_all_datasets,
    get_catalog_dataset,
    get_dataset_by_id,
    get_sector_datasets,
    get_dataset_stats,
    increment_tracker,
    infer_visualization,
    search_datasets,
    start_summary_refresh,
    stream_dataset_csv,
)

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.get("/all")
def get_all_catalogs(limit: int = Query(9, ge=1, le=100)):
    start_summary_refresh()
    return get_all_datasets(limit=limit)


@router.get("/search")
def search_catalogs(q: str = Query(..., min_length=1), sector: str | None = None):
    start_summary_refresh()
    return search_datasets(q, sector)


@router.get("/data/{resource_id}")
def dataset_live_data(
    resource_id: str,
    limit: int = Query(DETAIL_PAGE_SIZE, ge=1, le=DETAIL_PAGE_SIZE),
    offset: int = Query(0, ge=0),
    fetchAll: bool = Query(False),
    maxRows: int = Query(MAX_VISUALIZATION_ROWS, ge=500, le=50000),
):
    try:
        if fetchAll:
            return fetch_full_dataset(resource_id, max_rows=maxRows)
        return fetch_dataset_page(resource_id, limit=limit, offset=offset)
    except requests.RequestException as exc:
        if "429" in str(exc):
            raise HTTPException(status_code=429, detail="data.gov.in rate limit reached. Please retry shortly.") from exc
        raise HTTPException(status_code=502, detail="Failed to fetch dataset from data.gov.in") from exc


@router.get("/by-id/{dataset_id}")
def dataset_by_id(dataset_id: str):
    start_summary_refresh()
    sector_key, dataset = get_dataset_by_id(dataset_id)
    if dataset is None or sector_key is None:
        raise HTTPException(status_code=404, detail=f"Dataset with id {dataset_id} not found")

    enriched = enrich_dataset(dataset, include_remote_metadata=True)
    return {
        "sector": sector_key,
        "dataset": enriched,
        "resources": [
            {
                "id": enriched["id"],
                "title": enriched["title"],
                "format": "CSV",
                "url": f"/datasets/{sector_key}/{enriched['id']}/raw?full=true",
                "publishedDate": enriched.get("publishedDate"),
                "updatedDate": enriched.get("updatedDate"),
                "views": enriched.get("views", 0),
                "downloads": enriched.get("downloads", 0),
            }
        ],
    }


@router.get("/by-id/{dataset_id}/raw")
def dataset_by_id_raw(dataset_id: str, full: bool = True):
    sector_key, dataset = get_dataset_by_id(dataset_id)
    if dataset is None or sector_key is None:
        raise HTTPException(status_code=404, detail=f"Dataset with id {dataset_id} not found")
    return dataset_raw(sector_key, dataset_id, full=full)


@router.get("/{sector}")
def sector_datasets(
    sector: str,
    page: int = Query(1, ge=1),
    limit: int = Query(9, ge=1, le=100),
):
    start_summary_refresh()
    try:
        return get_sector_datasets(sector, page=page, limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/{sector}/{dataset_id}/stats")
def dataset_stats(sector: str, dataset_id: str):
    start_summary_refresh()
    try:
        return {"stats": get_dataset_stats(sector, dataset_id)}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Dataset not found") from exc
    except requests.RequestException as exc:
        if "429" in str(exc):
            raise HTTPException(status_code=429, detail="data.gov.in rate limit reached. Please retry shortly.") from exc
        raise HTTPException(status_code=502, detail="Failed to fetch dataset metadata") from exc


@router.post("/{sector}/{dataset_id}/view")
def dataset_view(sector: str, dataset_id: str):
    start_summary_refresh()
    try:
        counts = increment_tracker(sector, dataset_id, "views")
        stats = get_dataset_stats(sector, dataset_id)
        stats["views"] = counts["views"]
        stats["downloads"] = counts["downloads"]
        return {"stats": stats}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Dataset not found") from exc


@router.post("/{sector}/{dataset_id}/download")
def dataset_download(sector: str, dataset_id: str):
    start_summary_refresh()
    try:
        counts = increment_tracker(sector, dataset_id, "downloads")
        return {"success": True, "downloads": counts["downloads"], "views": counts["views"]}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Dataset not found") from exc


@router.get("/{sector}/{dataset_id}")
def dataset_analysis(sector: str, dataset_id: str):
    start_summary_refresh()
    dataset = get_catalog_dataset(sector, dataset_id)
    if dataset is None:
        detected_sector, dataset = get_dataset_by_id(dataset_id)
        if dataset is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        sector = detected_sector or sector

    enriched = enrich_dataset(dataset, include_remote_metadata=True)
    stats = get_dataset_stats(sector, dataset_id)
    full_dataset = fetch_full_dataset(dataset_id, max_rows=MAX_VISUALIZATION_ROWS)

    records = full_dataset.get("records", [])
    columns = full_dataset.get("columns", [])
    if full_dataset.get("tooLarge") or not records:
        from ..services.dataset_catalog import summary_file_for_sector
        summary_path = summary_file_for_sector(sector)
        import os
        import pandas as pd
        if os.path.exists(summary_path):
            summary_df = pd.read_csv(summary_path)
            records = summary_df.to_dict('records')[:1000]
            columns = summary_df.columns.tolist()
            visualization = infer_visualization(records, columns)
            insights = dataset_insights(records, columns)
        else:
            visualization = {"message": "Dataset too large for live visualization. Summary charts unavailable.", "charts": []}
            insights = []
    else:
        visualization = infer_visualization(records, columns)
        insights = dataset_insights(records, columns)


>>>>>>> 14c050e (Updated UI and fixed chatbot issues)

=======
    records = full_dataset.get("records", [])
    columns = full_dataset.get("columns", [])
    if full_dataset.get("tooLarge") or not records:
        summary_path = summary_file_for_sector(sector)
        if os.path.exists(summary_path):
            summary_df = pd.read_csv(summary_path)
            records = summary_df.to_dict('records')[:1000]
            columns = summary_df.columns.tolist()
            visualization = infer_visualization(records, columns)
            insights = dataset_insights(records, columns)
        else:
            visualization = {"message": "Dataset too large for live visualization. Summary charts unavailable.", "charts": []}
            insights = []
    else:
        visualization = infer_visualization(records, columns)
        insights = dataset_insights(records, columns)


=======
    records = full_dataset.get("records", [])
    columns = full_dataset.get("columns", [])
    if full_dataset.get("tooLarge") or not records:
        from ..services.dataset_catalog import summary_file_for_sector
        summary_path = summary_file_for_sector(sector)
        import os
        import pandas as pd
        if os.path.exists(summary_path):
            summary_df = pd.read_csv(summary_path)
            records = summary_df.to_dict('records')[:1000]
            columns = summary_df.columns.tolist()
            visualization = infer_visualization(records, columns)
            insights = dataset_insights(records, columns)
        else:
            visualization = {"message": "Dataset too large for live visualization. Summary charts unavailable.", "charts": []}
            insights = []
    else:
        visualization = infer_visualization(records, columns)
        insights = dataset_insights(records, columns)


>>>>>>> 14c050e (Updated UI and fixed chatbot issues)
    return {
        "dataset": enriched,
        "stats": stats,
        "visualization": visualization,
        "insights": insights,
    }


@router.get("/{sector}/{dataset_id}/raw")
def dataset_raw(
    sector: str,
    dataset_id: str,
    limit: int = Query(DETAIL_PAGE_SIZE, ge=1, le=DETAIL_PAGE_SIZE),
    offset: int = Query(0, ge=0),
    full: bool = Query(False),
):
    start_summary_refresh()
    try:
        dataset = get_catalog_dataset(sector, dataset_id)
        if dataset is None:
            detected_sector, dataset = get_dataset_by_id(dataset_id)
            if dataset is None:
                raise KeyError(dataset_id)
            sector = detected_sector or sector

        if full:
            filename = f"{dataset['id']}.csv"
            headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
            return StreamingResponse(stream_dataset_csv(dataset["id"]), media_type="text/csv", headers=headers)

        page = fetch_dataset_page(dataset["id"], limit=limit, offset=offset)
        lines = [",".join(page["columns"])]
        for record in page["records"]:
            row = []
            for column in page["columns"]:
                value = str(record.get(column, ""))
                escaped = value.replace('"', '""')
                if any(ch in value for ch in [',', '"', '\n']):
                    escaped = f'"{escaped}"'
                row.append(escaped)
            lines.append(",".join(row))
        return {
            "resourceId": dataset["id"],
            "page": page["page"],
            "offset": page["offset"],
            "limit": page["limit"],
            "totalRows": page["totalRows"],
            "totalPages": page["totalPages"],
            "csv": "\n".join(lines),
        }
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Dataset not found") from exc
    except requests.RequestException as exc:
        if "429" in str(exc):
            raise HTTPException(status_code=429, detail="data.gov.in rate limit reached. Please retry shortly.") from exc
        raise HTTPException(status_code=502, detail="Failed to fetch dataset from data.gov.in") from exc
