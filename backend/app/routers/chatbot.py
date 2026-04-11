from fastapi import APIRouter, Query
from pydantic import BaseModel
import logging
from app.services.rag_chatbot_service import chatbot_response, get_top_datasets

router = APIRouter(prefix="/chatbot")
logger = logging.getLogger(__name__)

class ChatRequest(BaseModel):
    query: str
    session_id: str | None = None
    sector: str | None = None
    dataset_id: str | None = None
    dataset_title: str | None = None
    user_email: str | None = None
    user_id: str | None = None

@router.post("/query")
def ask_bot(request: ChatRequest):
    try:
        logger.info(
            f"[CHATBOT] Query received: query='{request.query[:50]}...', "
            f"dataset_id={request.dataset_id}, user_id={request.user_id}"
        )
        result = chatbot_response(
            request.query,
            session_id=request.session_id,
            sector=request.sector,
            dataset_id=request.dataset_id,
            dataset_title=request.dataset_title,
            user_email=request.user_email,
            user_id=request.user_id,
        )
        logger.info(f"[CHATBOT] Response sent successfully for session {request.session_id}")
        return result
    except ValueError as e:
        logger.warning(f"[CHATBOT] ValueError: {str(e)}")
        # Return user-friendly error response
        return {
            "sessionId": request.session_id or "unknown",
            "restricted": False,
            "content": f"Input error: {str(e)}",
            "matches": [],
            "insights": [],
            "result": None,
            "history": [],
        }
    except Exception as e:
        logger.error(f"[CHATBOT] Unexpected error: {type(e).__name__}: {str(e)}", exc_info=True)
        # Return error response instead of crashing
        import uuid
        session_id = request.session_id or str(uuid.uuid4())
        return {
            "sessionId": session_id,
            "restricted": False,
            "content": f"An unexpected error occurred: {str(e)}. Please try again or contact support.",
            "matches": [],
            "insights": ["Error details: " + type(e).__name__],
            "result": None,
            "history": [],
        }

@router.get("/top-datasets")
def top_datasets(
    sector: str | None = Query(None),
    state: str | None = Query(None),
    limit: int = Query(10, ge=1, le=50)
):
    """TOP/MOST VIEWED datasets filtered by state/sector, sorted by view_count."""

    session_id = "top-datasets-session"  # Dummy session
    return get_top_datasets(session_id, sector or 'all', limit=limit, state=state)
