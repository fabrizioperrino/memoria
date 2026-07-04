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

# ── Índice "¿Estoy listo?" ─────────────────────────────────────────────────────
# Pesos de la fórmula: readiness = retención + precisión + cobertura
READINESS_W_RETENTION = 0.45   # madurez SM-2 de las cartas
READINESS_W_ACCURACY = 0.35    # precisión en quizzes recientes
READINESS_W_COVERAGE = 0.20    # cuánto del material fue practicado
MATURE_INTERVAL_DAYS = 21      # una carta con intervalo de 21+ días se considera madura
RECENT_QUIZZES = 5             # quizzes que cuentan para la precisión


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
        # Solo documentos procesados: los que están en processing van a recibir
        # su XP cuando terminen (evita duplicar el evento).
        if doc.get("status") == "ready" and doc.get("created_at"):
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
        .select("id, title, subject, status, created_at")
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


def _doc_readiness(flashcards: list, doc_quizzes: list) -> dict:
    """Calcula los tres componentes del índice para un documento."""
    cards = flashcards or []
    total_cards = len(cards)

    # Retención: madurez SM-2 promedio (cartas nunca repasadas = 0)
    if total_cards:
        maturity_sum = 0.0
        reviewed = 0
        for fc in cards:
            reps = fc.get("repetitions") or 0
            if reps > 0:
                reviewed += 1
                interval = fc.get("interval") or 0
                maturity_sum += min(interval / MATURE_INTERVAL_DAYS, 1.0)
        retention = maturity_sum / total_cards
        coverage_cards = reviewed / total_cards
    else:
        retention = 0.0
        coverage_cards = 0.0

    # Precisión: promedio de los últimos N quizzes
    recent = sorted(doc_quizzes, key=lambda r: r.get("created_at") or "", reverse=True)[:RECENT_QUIZZES]
    accuracy = (sum((r.get("percentage") or 0) for r in recent) / len(recent) / 100) if recent else 0.0

    # Cobertura: cartas practicadas + haber hecho al menos ~3 quizzes
    coverage = coverage_cards * 0.6 + min(len(doc_quizzes), 3) / 3 * 0.4

    readiness = round(100 * (
        READINESS_W_RETENTION * retention
        + READINESS_W_ACCURACY * accuracy
        + READINESS_W_COVERAGE * coverage
    ))
    return {
        "readiness": readiness,
        "retention": round(retention * 100),
        "accuracy": round(accuracy * 100),
        "coverage": round(coverage * 100),
        "total_cards": total_cards,
    }


@router.get("/readiness")
async def get_readiness(current_user=Depends(get_current_user)):
    """
    Índice "¿Estoy listo?" por materia y por documento.
    100% dato, sin IA: madurez SM-2 + precisión de quizzes + cobertura.
    """
    uid = current_user.id

    docs_resp = (
        supabase.table("documents")
        .select("id, title, subject, status, flashcards")
        .eq("user_id", uid)
        .eq("status", "ready")
        .execute()
    )
    docs = docs_resp.data or []

    quiz_resp = (
        supabase.table("quiz_results")
        .select("doc_id, percentage, created_at")
        .eq("user_id", uid)
        .execute()
    )
    quizzes_by_doc: dict[str, list] = {}
    for r in quiz_resp.data or []:
        quizzes_by_doc.setdefault(r["doc_id"], []).append(r)

    # Por documento
    doc_scores = []
    for doc in docs:
        score = _doc_readiness(doc.get("flashcards"), quizzes_by_doc.get(doc["id"], []))
        doc_scores.append({
            "doc_id": doc["id"],
            "title": doc["title"],
            "subject": doc.get("subject") or "Sin materia",
            **score,
        })

    # Por materia: promedio ponderado por cantidad de cartas
    subjects: dict[str, dict] = {}
    for ds in doc_scores:
        s = subjects.setdefault(ds["subject"], {"weighted": 0.0, "weight": 0, "docs": []})
        w = max(ds["total_cards"], 1)
        s["weighted"] += ds["readiness"] * w
        s["weight"] += w
        s["docs"].append(ds)

    subject_list = sorted(
        (
            {
                "subject": name,
                "readiness": round(s["weighted"] / s["weight"]) if s["weight"] else 0,
                "docs": sorted(s["docs"], key=lambda d: d["readiness"]),
            }
            for name, s in subjects.items()
        ),
        key=lambda x: x["readiness"],
    )

    overall = round(sum(s["readiness"] for s in subject_list) / len(subject_list)) if subject_list else 0

    # Puntos más flojos: documentos con menor readiness (con material)
    weakest = sorted(
        (d for d in doc_scores if d["total_cards"] > 0),
        key=lambda d: d["readiness"],
    )[:3]

    return {
        "overall": overall,
        "subjects": subject_list,
        "weakest": weakest,
    }


# ── Sesión guiada ──────────────────────────────────────────────────────────────
# Arma una sesión de estudio determinística con los datos del usuario:
# 1) cartas vencidas  2) quiz de los temas más flojos  3) oral si sobra tiempo.
# Sin IA: es curaduría de tus propios datos.

MIN_PER_CARD = 0.5      # repasar una flashcard
MIN_PER_QUIZ_Q = 0.75   # responder una pregunta de quiz
MIN_PER_ORAL_Q = 4.0    # responder una pregunta oral hablando
ORAL_MIN_BUDGET = 8     # minutos libres necesarios para proponer un oral


def _count_due_cards(flashcards: list) -> int:
    now = datetime.now(timezone.utc)
    due = 0
    for fc in flashcards or []:
        nr = fc.get("next_review")
        if nr is None:
            due += 1
            continue
        try:
            d = datetime.fromisoformat(str(nr).replace("Z", "+00:00"))
            if d.tzinfo is None:
                d = d.replace(tzinfo=timezone.utc)
            if d <= now:
                due += 1
        except Exception:
            due += 1
    return due


@router.get("/session-plan")
async def get_session_plan(
    minutes: int = 45,
    subject: str | None = None,
    current_user=Depends(get_current_user),
):
    """Plan de sesión guiada: qué estudiar ahora, con presupuesto de tiempo."""
    minutes = max(10, min(minutes, 240))
    uid = current_user.id

    docs_resp = (
        supabase.table("documents")
        .select("id, title, subject, status, flashcards, exam_questions")
        .eq("user_id", uid)
        .eq("status", "ready")
        .execute()
    )
    docs = docs_resp.data or []
    if subject:
        docs = [d for d in docs if (d.get("subject") or "Sin materia") == subject]
    if not docs:
        return {"minutes": minutes, "subject": subject, "blocks": [], "readiness_before": 0}

    quiz_resp = (
        supabase.table("quiz_results")
        .select("doc_id, percentage, created_at")
        .eq("user_id", uid)
        .execute()
    )
    quizzes_by_doc: dict[str, list] = {}
    for r in quiz_resp.data or []:
        quizzes_by_doc.setdefault(r["doc_id"], []).append(r)

    # Métricas por doc
    metas = []
    for d in docs:
        score = _doc_readiness(d.get("flashcards"), quizzes_by_doc.get(d["id"], []))
        metas.append({
            "doc": d,
            "due": _count_due_cards(d.get("flashcards")),
            "readiness": score["readiness"],
            "questions": len(d.get("exam_questions") or []),
        })

    overall = round(sum(m["readiness"] for m in metas) / len(metas))
    remaining = float(minutes)
    blocks = []

    # 1) Repaso de vencidas (hasta ~50% del tiempo), más vencidas primero
    review_budget = minutes * 0.5
    for m in sorted(metas, key=lambda x: x["due"], reverse=True):
        if m["due"] == 0 or review_budget <= 1:
            break
        cards = min(m["due"], int(review_budget / MIN_PER_CARD), 20)
        if cards < 1:
            break
        est = round(cards * MIN_PER_CARD) or 1
        blocks.append({
            "type": "review",
            "doc_id": m["doc"]["id"],
            "doc_title": m["doc"]["title"],
            "detail": f"{cards} {'carta vencida' if cards == 1 else 'cartas vencidas'}",
            "est_minutes": est,
        })
        review_budget -= est
        remaining -= est

    # 2) Quiz de los temas más flojos (1-2 bloques)
    for m in sorted(metas, key=lambda x: x["readiness"]):
        if len([b for b in blocks if b["type"] == "quiz"]) >= 2:
            break
        if m["questions"] < 3 or remaining < 5:
            continue
        qcount = min(m["questions"], 8)
        est = round(qcount * MIN_PER_QUIZ_Q) or 3
        if est > remaining:
            continue
        blocks.append({
            "type": "quiz",
            "doc_id": m["doc"]["id"],
            "doc_title": m["doc"]["title"],
            "detail": f"Quiz — tu tema más flojo ({m['readiness']}% listo)",
            "est_minutes": est,
        })
        remaining -= est

    # 3) Oral si sobra tiempo y hay preguntas
    if remaining >= ORAL_MIN_BUDGET:
        candidates = [m for m in metas if m["questions"] >= 2]
        if candidates:
            weakest = min(candidates, key=lambda x: x["readiness"])
            qcount = max(2, min(int(remaining / MIN_PER_ORAL_Q), 4))
            blocks.append({
                "type": "oral",
                "doc_id": weakest["doc"]["id"],
                "doc_title": weakest["doc"]["title"],
                "detail": f"Simulacro oral — {qcount} preguntas habladas",
                "est_minutes": round(qcount * MIN_PER_ORAL_Q),
            })

    # Fallback: sin vencidas ni quizzes posibles → releer el más flojo
    if not blocks:
        weakest = min(metas, key=lambda x: x["readiness"])
        blocks.append({
            "type": "study",
            "doc_id": weakest["doc"]["id"],
            "doc_title": weakest["doc"]["title"],
            "detail": "Releé el resumen y los conceptos clave",
            "est_minutes": min(minutes, 20),
        })

    return {
        "minutes": minutes,
        "subject": subject,
        "blocks": blocks,
        "readiness_before": overall,
    }
