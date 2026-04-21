from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from database.supabase_client import supabase
from services.exam_service import evaluate_answer, AnswerEvaluation
from core.auth import get_current_user

router = APIRouter(prefix="/exam", tags=["exam"])


class EvaluateRequest(BaseModel):
    question: str
    student_answer: str
    expected_answer: str = ""   # vacío para preguntas de seguimiento


@router.post("/{doc_id}/evaluate", response_model=AnswerEvaluation)
async def evaluate_exam_answer(
    doc_id: str,
    body: EvaluateRequest,
    current_user=Depends(get_current_user),
):
    """Evalúa la respuesta de un estudiante con IA y devuelve score + feedback + follow-ups."""
    # Verificar que el documento pertenece al usuario
    doc = (
        supabase.table("documents")
        .select("id")
        .eq("id", doc_id)
        .eq("user_id", current_user.id)
        .single()
        .execute()
    )
    if not doc.data:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")

    if not body.student_answer.strip():
        raise HTTPException(status_code=400, detail="La respuesta no puede estar vacía.")

    try:
        result = evaluate_answer(
            question=body.question,
            student_answer=body.student_answer,
            expected_answer=body.expected_answer,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error evaluando la respuesta: {str(e)}")
