from fastapi import APIRouter
from pydantic import BaseModel
from app.services.chatbot_service import chatbot_response

router = APIRouter(prefix="/chatbot")

class ChatRequest(BaseModel):
    query: str
    session_id: str | None = None
    sector: str | None = None

@router.post("/query")
def ask_bot(request: ChatRequest):
    return chatbot_response(request.query, session_id=request.session_id, sector=request.sector)
