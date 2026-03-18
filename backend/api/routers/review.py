from fastapi import APIRouter, HTTPException, Depends
from models.study_models import Flashcard, FlashcardReview
from services.spaced_repetition import update_flashcard, get_cards_due
from database.supabase_client import supabase
from core.auth import get_current_user

router = APIRouter(prefix="/review", tags=["review"])


def _get_doc_for_user(doc_id: str, user_id: str):
    """Helper: obtiene un documento verificando que pertenezca al usuario."""
    response = (
        supabase.table("documents")
        .select("flashcards")
        .eq("id", doc_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    return response.data


@router.get("/{doc_id}/due")
async def get_due_cards(doc_id: str, current_user=Depends(get_current_user)):
    """Devuelve las flashcards que hay que repasar hoy."""
    doc = _get_doc_for_user(doc_id, current_user.id)
    flashcards = [Flashcard(**fc) for fc in doc.get("flashcards", [])]
    due = get_cards_due(flashcards)

    return {
        "doc_id":      doc_id,
        "total_cards": len(flashcards),
        "due_count":   len(due),
        "due_cards":   [{"index": flashcards.index(fc), **fc.model_dump()} for fc in due],
    }


@router.post("/{doc_id}/rate")
async def rate_flashcard(doc_id: str, review: FlashcardReview, current_user=Depends(get_current_user)):
    """Registra la respuesta a una flashcard y actualiza el schedule SM-2."""
    doc = _get_doc_for_user(doc_id, current_user.id)
    flashcards_data = doc.get("flashcards", [])

    try:
        idx  = int(review.flashcard_id)
        card = Flashcard(**flashcards_data[idx])
    except (ValueError, IndexError):
        raise HTTPException(status_code=404, detail="Flashcard no encontrada.")

    updated_card        = update_flashcard(card, review.rating)
    flashcards_data[idx] = updated_card.model_dump()

    for fc in flashcards_data:
        if fc.get("next_review") and hasattr(fc["next_review"], "isoformat"):
            fc["next_review"] = fc["next_review"].isoformat()

    supabase.table("documents").update({"flashcards": flashcards_data}).eq("id", doc_id).execute()

    return {
        "message":       "Flashcard actualizada.",
        "next_review":   updated_card.next_review,
        "interval_days": updated_card.interval,
        "ease_factor":   round(updated_card.ease_factor, 2),
    }
