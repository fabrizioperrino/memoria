from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from database.supabase_client import supabase
from services.exam_service import evaluate_answer, AnswerEvaluation
from services.oral_service import transcribe_audio, MAX_AUDIO_BYTES
from services.gamification import award_xp, XP_EXAM_ANSWER, XP_EXAM_BONUS
from core.auth import get_current_user

router = APIRouter(prefix="/exam", tags=["exam"])


def _assert_owns_document(doc_id: str, user_id: str):
    doc = (
        supabase.table("documents")
        .select("id")
        .eq("id", doc_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not doc or not doc.data:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")


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
    _assert_owns_document(doc_id, current_user.id)

    if not body.student_answer.strip():
        raise HTTPException(status_code=400, detail="La respuesta no puede estar vacía.")

    try:
        result = evaluate_answer(
            question=body.question,
            student_answer=body.student_answer,
            expected_answer=body.expected_answer,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error evaluando la respuesta: {str(e)}")

    amount = XP_EXAM_ANSWER + (XP_EXAM_BONUS if result.score >= 8 else 0)
    award_xp(current_user.id, kind="exam", amount=amount, doc_id=doc_id, meta={"score": result.score})

    return result


class TranscriptResponse(BaseModel):
    transcript: str


@router.post("/{doc_id}/oral/transcribe", response_model=TranscriptResponse)
async def transcribe_oral_answer(
    doc_id: str,
    audio: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    """Transcribe la respuesta hablada del estudiante en el simulacro oral (Whisper)."""
    _assert_owns_document(doc_id, current_user.id)

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="No se recibió audio.")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="El audio es demasiado largo. Grabá respuestas más cortas.")

    try:
        transcript = transcribe_audio(audio_bytes, audio.filename or "answer.webm")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error transcribiendo el audio: {str(e)}")

    if not transcript:
        raise HTTPException(status_code=422, detail="No se entendió la respuesta. Probá hablar más fuerte y claro.")

    return TranscriptResponse(transcript=transcript)
