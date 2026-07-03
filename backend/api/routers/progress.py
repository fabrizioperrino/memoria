from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends

from database.supabase_client import supabase
from core.auth import get_current_user
from services.gamification import (
    XP_QUIZ_BASE,
    XP_QUIZ_PER_CORRECT,
    XP_UPLOAD,
    check_and_unlock_achievements,
    compute_streak,
    level_for_xp,
    xp_for_level,
)

router = APIRouter(prefix="/progress", tags=["progress"])

HEATMAP_DAYS = 182  # ~26 semanas


def _parse_date(value: str):
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except Exception:
        return None


def _backfill_xp_events(uid: str, docs: list, quiz_results: list) -> list:
    """
    Usuarios anteriores a la gamificación: reconstruye eventos de XP retroactivos
    desde documentos y quizzes existentes (con su fecha original).
    Devuelve los eventos creados.
    """
    events = []
    for doc in docs:
        if doc.get("created_at"):
            events.append({
                "user_id": uid,
                "kind": "upload",
                "amount": XP_UPLOAD,
                "doc_id": doc["id"],
                "meta": {"backfill": True},
                "created_at": doc["created_at"],
            })
    for r in quiz_results:
        events.append({
            "user_id": uid,
            "kind": "quiz",
            "amount": XP_QUIZ_BASE + XP_QUIZ_PER_CORRECT * (r.get("score") or 0),
            "doc_id": r.get("doc_id"),
            "meta": {"backfill": True, "percentage": r.get("percentage")},
            "created_at": r.get("created_at"),
        })
    if events:
        try:
            supabase.table("xp_events").insert(events).execute()
        except Exception:
            return []
    return events


@router.get("/summary")
async def get_progress_summary(current_user=Depends(get_current_user)):
    """Resumen de progreso: XP, nivel, heatmap de actividad, materias y logros."""
    uid = current_user.id

    # ── Datos base ────────────────────────────────────────────────────────────
    docs_resp = (
        supabase.table("documents")
        .select("id, title, subject, created_at")
        .eq("user_id", uid)
        .execute()
    )
    docs = docs_resp.data or []

    quiz_resp = (
        supabase.table("quiz_results")
        .select("doc_id, score, total, percentage, created_at")
        .eq("user_id", uid)
        .execute()
    )
    quiz_results = quiz_resp.data or []

    events_resp = (
        supabase.table("xp_events")
        .select("kind, amount, meta, created_at")
        .eq("user_id", uid)
        .execute()
    )
    events = events_resp.data or []

    # Migración transparente: usuarios con actividad previa pero sin eventos
    if not events and (docs or quiz_results):
        events = _backfill_xp_events(uid, docs, quiz_results)

    # ── XP y nivel ────────────────────────────────────────────────────────────
    xp_total = sum(e["amount"] for e in events)
    level = level_for_xp(xp_total)
    level_floor = xp_for_level(level)
    next_level_xp = xp_for_level(level + 1)

    # ── Heatmap de actividad (últimas ~26 semanas) ────────────────────────────
    today = datetime.now(timezone.utc).date()
    since = today - timedelta(days=HEATMAP_DAYS - 1)
    heatmap: dict[str, int] = {}
    activity_dates: set = set()

    for e in events:
        d = _parse_date(e.get("created_at") or "")
        if d is None:
            continue
        activity_dates.add(d)
        if d >= since:
            key = d.isoformat()
            heatmap[key] = heatmap.get(key, 0) + 1

    # ── Precisión por materia ─────────────────────────────────────────────────
    doc_subject = {d["id"]: (d.get("subject") or "Sin materia") for d in docs}
    subject_stats: dict[str, dict] = {}
    for r in quiz_results:
        subj = doc_subject.get(r["doc_id"], "Sin materia")
        s = subject_stats.setdefault(subj, {"attempts": 0, "pct_sum": 0})
        s["attempts"] += 1
        s["pct_sum"] += r.get("percentage") or 0

    subjects = sorted(
        (
            {
                "subject": subj,
                "attempts": s["attempts"],
                "avg_pct": round(s["pct_sum"] / s["attempts"]) if s["attempts"] else 0,
            }
            for subj, s in subject_stats.items()
        ),
        key=lambda x: x["attempts"],
        reverse=True,
    )

    # ── Datos para logros ─────────────────────────────────────────────────────
    streak = compute_streak(activity_dates)
    best_exam_score = 0
    total_reviews = 0
    for e in events:
        if e["kind"] == "review":
            total_reviews += 1
        elif e["kind"] == "exam":
            try:
                best_exam_score = max(best_exam_score, int((e.get("meta") or {}).get("score") or 0))
            except (TypeError, ValueError):
                pass

    achievements = check_and_unlock_achievements(uid, {
        "total_documents": len(docs),
        "total_quizzes": len(quiz_results),
        "best_quiz_pct": max((r.get("percentage") or 0 for r in quiz_results), default=0),
        "total_reviews": total_reviews,
        "streak": streak,
        "best_exam_score": best_exam_score,
        "level": level,
    })

    return {
        "xp_total": xp_total,
        "level": level,
        "level_xp_floor": level_floor,
        "next_level_xp": next_level_xp,
        "streak": streak,
        "heatmap": [{"date": k, "count": v} for k, v in sorted(heatmap.items())],
        "heatmap_days": HEATMAP_DAYS,
        "subjects": subjects,
        "achievements": achievements,
        "totals": {
            "documents": len(docs),
            "quizzes": len(quiz_results),
            "reviews": total_reviews,
        },
    }
