from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Dict

from services.assistant_service import ask_assistant

router = APIRouter()


class AssistantRequest(BaseModel):
    message: str
    context: Optional[Dict[str, str]] = None


@router.post("/api/assistant/chat")
async def chat(payload: AssistantRequest):
    return ask_assistant(payload.message, payload.context)
