from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from database.supabase_client import supabase
from core.auth import get_current_user
from services.gamification import award_xp, XP_QUIZ_BASE, XP_QUIZ_PER_CORRECT
import uuid
from datetime import datetime

router = APIRouter(prefix="/quiz", tags=["quiz"])


class QuizAnswer(BaseModel):
    question: str
    chosen: str | None
    correct_answer: str
    explanation: str
    is_correct: bool


class SaveQuizRequest(BaseModel):
    doc_id: str
    score: int
    total: int
    answers: list[QuizAnswer]


class QuizResultResponse(BaseModel):
    id: str
    doc_id: str
    score: int
    total: int
    percentage: int
    answers: list[dict]
    created_at: str


@router.post("/save", response_model=QuizResultResponse)
async def save_quiz_result(body: SaveQuizRequest, current_user=Depends(get_current_user)):
    """Guarda el resultado de un quiz terminado."""
    # Verificar que el documento pertenece al usuario
    doc_resp = (
        supabase.table("documents")
        .select("id")
        .eq("id", body.doc_id)
        .eq("user_id", current_user.id)
        .single()
        .execute()
    )
    if not doc_resp.data:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")

    percentage = round((body.score / body.total) * 100) if body.total > 0 else 0

    data = {
        "id":         str(uuid.uuid4()),
        "user_id":    current_user.id,
        "doc_id":     body.doc_id,
        "score":      body.score,
        "total":      body.total,
        "percentage": percentage,
        "answers":    [a.model_dump() for a in body.answers],
        "created_at": datetime.utcnow().isoformat(),
    }

    response = supabase.table("quiz_results").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Error guardando el resultado.")

    award_xp(
        current_user.id,
        kind="quiz",
        amount=XP_QUIZ_BASE + XP_QUIZ_PER_CORRECT * body.score,
        doc_id=body.doc_id,
        meta={"percentage": percentage, "score": body.score, "total": body.total},
    )

    return response.data[0]


@router.get("/{doc_id}/history", response_model=list[QuizResultResponse])
async def get_quiz_history(doc_id: str, current_user=Depends(get_current_user)):
    """Devuelve el historial de intentos de quiz para un documento."""
    response = (
        supabase.table("quiz_results")
        .select("*")
        .eq("doc_id", doc_id)
        .eq("user_id", current_user.id)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data or []
