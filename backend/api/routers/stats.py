from fastapi import APIRouter, Depends
from database.supabase_client import supabase
from core.auth import get_current_user

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/summary")
async def get_stats_summary(current_user=Depends(get_current_user)):
    """Devuelve estadísticas globales del usuario autenticado."""
    from datetime import datetime, timezone

    uid = current_user.id

    # ── Documentos del usuario ────────────────────────────────────────────────
    docs_resp = (
        supabase.table("documents")
        .select("id, flashcards, exam_questions, key_concepts")
        .eq("user_id", uid)
        .execute()
    )
    docs = docs_resp.data or []

    total_documents  = len(docs)
    total_flashcards = sum(len(d.get("flashcards")     or []) for d in docs)
    total_questions  = sum(len(d.get("exam_questions") or []) for d in docs)
    total_concepts   = sum(len(d.get("key_concepts")   or []) for d in docs)

    # ── Tarjetas vencidas hoy ─────────────────────────────────────────────────
    now = datetime.now(timezone.utc)
    cards_due_today = 0
    for doc in docs:
        for fc in doc.get("flashcards") or []:
            next_review = fc.get("next_review")
            if next_review is None:
                cards_due_today += 1
            else:
                try:
                    nr = datetime.fromisoformat(next_review.replace("Z", "+00:00"))
                    if nr.tzinfo is None:
                        nr = nr.replace(tzinfo=timezone.utc)
                    if nr <= now:
                        cards_due_today += 1
                except Exception:
                    cards_due_today += 1

    # ── Quiz results del usuario ──────────────────────────────────────────────
    quiz_resp = (
        supabase.table("quiz_results")
        .select("id, doc_id, score, total, percentage, created_at")
        .eq("user_id", uid)
        .order("created_at", desc=True)
        .execute()
    )
    quiz_results = quiz_resp.data or []

    total_quiz_attempts = len(quiz_results)
    average_quiz_score  = round(sum(r["percentage"] for r in quiz_results) / total_quiz_attempts) if total_quiz_attempts else 0
    best_quiz_score     = max((r["percentage"] for r in quiz_results), default=0)

    # Últimos 15 para el gráfico (orden cronológico)
    recent_quiz = list(reversed(quiz_results[:15]))

    # ── Actividad reciente (últimos 5) ────────────────────────────────────────
    recent_activity = []
    for r in quiz_results[:5]:
        doc_info = (
            supabase.table("documents")
            .select("title")
            .eq("id", r["doc_id"])
            .eq("user_id", uid)
            .single()
            .execute()
        )
        doc_title = doc_info.data["title"] if doc_info.data else "Documento"
        recent_activity.append({
            "doc_id":    r["doc_id"],
            "doc_title": doc_title,
            "percentage": r["percentage"],
            "score":     r["score"],
            "total":     r["total"],
            "created_at": r["created_at"],
        })

    return {
        "total_documents":     total_documents,
        "total_flashcards":    total_flashcards,
        "total_questions":     total_questions,
        "total_concepts":      total_concepts,
        "cards_due_today":     cards_due_today,
        "total_quiz_attempts": total_quiz_attempts,
        "average_quiz_score":  average_quiz_score,
        "best_quiz_score":     best_quiz_score,
        "recent_quiz_chart":   recent_quiz,
        "recent_activity":     recent_activity,
    }
