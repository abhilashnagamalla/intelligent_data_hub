from fastapi import APIRouter
from pydantic import BaseModel
from app.services.rag_chatbot_service import chatbot_response

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
