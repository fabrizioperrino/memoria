from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from database.supabase_client import supabase
from services.chat_service import stream_chat
from core.auth import get_current_user
import json

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    question: str
    history: list[dict] = []


@router.post("/{doc_id}")
async def chat_with_document(doc_id: str, body: ChatMessage, current_user=Depends(get_current_user)):
    """Chatea con el documento usando Groq streaming (SSE)."""
    response = (
        supabase.table("documents")
        .select("content, title")
        .eq("id", doc_id)
        .eq("user_id", current_user.id)
        .single()
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")

    content = response.data.get("content")
    if not content:
        raise HTTPException(
            status_code=422,
            detail="Este documento no tiene contenido extraído. Volvé a subirlo.",
        )

    def generate():
        try:
            for token in stream_chat(
                question=body.question,
                document_content=content,
                history=body.history,
                doc_id=doc_id,
            ):
                yield f"data: {json.dumps({'token': token})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
