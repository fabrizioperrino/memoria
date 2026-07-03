"""
Duelos: mismas preguntas para todo el grupo, cada miembro juega una vez.
Las preguntas se congelan al crear el duelo (snapshot) para que todos reciban
exactamente las mismas, aunque después cambie el documento.
"""
import random

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database.supabase_client import supabase
from core.auth import get_current_user
from api.routers.groups import _get_membership, _display_name

router = APIRouter(tags=["duels"])

DEFAULT_NUM_QUESTIONS = 8
MIN_QUESTIONS = 3


class CreateDuelRequest(BaseModel):
    doc_id: str
    title: str = Field(default="", max_length=80)
    num_questions: int = Field(default=DEFAULT_NUM_QUESTIONS, ge=MIN_QUESTIONS, le=20)


class SubmitDuelRequest(BaseModel):
    answers: list[str]           # opción elegida por índice de pregunta ("" si no respondió)
    display_name: str = Field(default="", max_length=80)


def _duel_or_404(duel_id: str, user_id: str):
    duel = (
        supabase.table("duels")
        .select("*")
        .eq("id", duel_id)
        .maybe_single()
        .execute()
    )
    if not duel or not duel.data:
        raise HTTPException(status_code=404, detail="Duelo no encontrado.")
    if not _get_membership(duel.data["group_id"], user_id):
        raise HTTPException(status_code=404, detail="Duelo no encontrado.")
    return duel.data


@router.post("/groups/{group_id}/duels")
async def create_duel(group_id: str, body: CreateDuelRequest, current_user=Depends(get_current_user)):
    """Crea un duelo con preguntas de un documento (propio o compartido en el grupo)."""
    if not _get_membership(group_id, current_user.id):
        raise HTTPException(status_code=404, detail="Grupo no encontrado.")

    # El doc debe ser propio, o estar compartido en este grupo
    doc = (
        supabase.table("documents")
        .select("id, title, exam_questions, user_id")
        .eq("id", body.doc_id)
        .maybe_single()
        .execute()
    )
    if not doc or not doc.data:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")

    if doc.data["user_id"] != current_user.id:
        shared = (
            supabase.table("group_shares")
            .select("id")
            .eq("group_id", group_id)
            .eq("doc_id", body.doc_id)
            .execute()
        )
        if not shared.data:
            raise HTTPException(status_code=403, detail="Ese documento no está compartido en el grupo.")

    all_qs = doc.data.get("exam_questions") or []
    usable = [q for q in all_qs if q.get("options")]  # necesitamos opciones para el duelo
    if len(usable) < MIN_QUESTIONS:
        raise HTTPException(status_code=400, detail="El documento no tiene suficientes preguntas de opción múltiple.")

    random.shuffle(usable)
    snapshot = usable[: body.num_questions]

    resp = supabase.table("duels").insert({
        "group_id": group_id,
        "doc_id": body.doc_id,
        "title": body.title.strip() or doc.data["title"],
        "questions": snapshot,
        "created_by": current_user.id,
    }).execute()
    return {"id": resp.data[0]["id"], "title": resp.data[0]["title"], "total": len(snapshot)}


@router.get("/groups/{group_id}/duels")
async def list_duels(group_id: str, current_user=Depends(get_current_user)):
    """Duelos del grupo, con estado de mi intento."""
    if not _get_membership(group_id, current_user.id):
        raise HTTPException(status_code=404, detail="Grupo no encontrado.")

    duels = (
        supabase.table("duels")
        .select("id, title, questions, created_by, created_at")
        .eq("group_id", group_id)
        .order("created_at", desc=True)
        .execute()
    ).data or []
    if not duels:
        return []

    duel_ids = [d["id"] for d in duels]
    attempts = (
        supabase.table("duel_attempts")
        .select("duel_id, user_id, score, total")
        .in_("duel_id", duel_ids)
        .execute()
    ).data or []

    by_duel: dict[str, list] = {}
    for a in attempts:
        by_duel.setdefault(a["duel_id"], []).append(a)

    result = []
    for d in duels:
        mine = next((a for a in by_duel.get(d["id"], []) if a["user_id"] == current_user.id), None)
        result.append({
            "id": d["id"],
            "title": d["title"],
            "total": len(d.get("questions") or []),
            "created_at": d["created_at"],
            "played_count": len(by_duel.get(d["id"], [])),
            "my_score": mine["score"] if mine else None,
            "played": mine is not None,
        })
    return result


@router.get("/duels/{duel_id}")
async def get_duel(duel_id: str, current_user=Depends(get_current_user)):
    """Preguntas del duelo SIN la respuesta correcta (se valida al enviar)."""
    duel = _duel_or_404(duel_id, current_user.id)

    mine = (
        supabase.table("duel_attempts")
        .select("score, total")
        .eq("duel_id", duel_id)
        .eq("user_id", current_user.id)
        .execute()
    ).data
    already = mine[0] if mine else None

    questions = [
        {"question": q["question"], "options": q.get("options", [])}
        for q in (duel.get("questions") or [])
    ]
    return {
        "id": duel_id,
        "title": duel["title"],
        "group_id": duel["group_id"],
        "questions": questions,
        "total": len(questions),
        "already_played": already is not None,
        "my_score": already["score"] if already else None,
    }


@router.post("/duels/{duel_id}/submit")
async def submit_duel(duel_id: str, body: SubmitDuelRequest, current_user=Depends(get_current_user)):
    """Corrige el duelo server-side, guarda el intento (uno por usuario) y devuelve la revisión."""
    duel = _duel_or_404(duel_id, current_user.id)

    existing = (
        supabase.table("duel_attempts")
        .select("id")
        .eq("duel_id", duel_id)
        .eq("user_id", current_user.id)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="Ya jugaste este duelo.")

    questions = duel.get("questions") or []
    review = []
    score = 0
    for i, q in enumerate(questions):
        chosen = body.answers[i] if i < len(body.answers) else ""
        correct = q.get("correct_answer", "")
        is_correct = chosen.strip().lower() == correct.strip().lower() and chosen != ""
        if is_correct:
            score += 1
        review.append({
            "question": q["question"],
            "chosen": chosen,
            "correct_answer": correct,
            "is_correct": is_correct,
            "explanation": q.get("explanation", ""),
        })

    supabase.table("duel_attempts").insert({
        "duel_id": duel_id,
        "user_id": current_user.id,
        "display_name": _display_name(current_user, body.display_name),
        "score": score,
        "total": len(questions),
    }).execute()

    return {"score": score, "total": len(questions), "review": review}


@router.get("/duels/{duel_id}/results")
async def duel_results(duel_id: str, current_user=Depends(get_current_user)):
    """Tabla de resultados del duelo."""
    duel = _duel_or_404(duel_id, current_user.id)

    attempts = (
        supabase.table("duel_attempts")
        .select("user_id, display_name, score, total, created_at")
        .eq("duel_id", duel_id)
        .execute()
    ).data or []

    ranking = sorted(
        (
            {
                "display_name": a.get("display_name") or "Estudiante",
                "score": a["score"],
                "total": a["total"],
                "created_at": a["created_at"],
                "is_you": a["user_id"] == current_user.id,
            }
            for a in attempts
        ),
        key=lambda x: (x["score"], -_ts(x["created_at"])),
        reverse=True,
    )
    return {
        "id": duel_id,
        "title": duel["title"],
        "total": len(duel.get("questions") or []),
        "ranking": ranking,
    }


def _ts(iso: str) -> float:
    """Epoch de un ISO para desempatar (quien lo hizo antes queda mejor)."""
    from datetime import datetime
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0.0
