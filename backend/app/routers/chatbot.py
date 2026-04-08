from fastapi import APIRouter, Query
from pydantic import BaseModel
from app.services.rag_chatbot_service import chatbot_response, get_top_datasets

router = APIRouter(prefix="/chatbot")

class ChatRequest(BaseModel):
    query: str
    session_id: str | None = None
    sector: str | None = None
    dataset_id: str | None = None
    dataset_title: str | None = None

@router.post("/query")
def ask_bot(request: ChatRequest):
    return chatbot_response(
        request.query,
        session_id=request.session_id,
        sector=request.sector,
        dataset_id=request.dataset_id,
        dataset_title=request.dataset_title,
    )

@router.get("/top-datasets")
def top_datasets(
    sector: str | None = Query(None),
    state: str | None = Query(None),
    limit: int = Query(10, ge=1, le=50)
):
    """TOP/MOST VIEWED datasets filtered by state/sector, sorted by view_count."""

    session_id = "top-datasets-session"  # Dummy session
    return get_top_datasets(session_id, sector or 'all', limit=limit, state=state)
