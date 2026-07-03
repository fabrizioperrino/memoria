"""
Gamificación: XP, niveles y logros.

El XP se registra como eventos en la tabla xp_events. El nivel y los logros
se derivan de los datos — nunca se guardan totales que puedan desincronizarse.
"""
import logging
from datetime import datetime, timezone, timedelta

from database.supabase_client import supabase

logger = logging.getLogger(__name__)

# ── Recompensas de XP por acción ───────────────────────────────────────────────
XP_UPLOAD = 50           # documento procesado con éxito
XP_QUIZ_BASE = 20        # completar un quiz
XP_QUIZ_PER_CORRECT = 5  # por respuesta correcta
XP_REVIEW_CARD = 5       # por flashcard repasada (cualquier rating: repasar ya vale)
XP_EXAM_ANSWER = 15      # por respuesta evaluada en examen oral
XP_EXAM_BONUS = 10       # bonus si la nota es >= 8


# ── Curva de niveles ───────────────────────────────────────────────────────────
# XP acumulado necesario para alcanzar el nivel L: 100 * (L-1)^1.5
# Nivel 2: 100 XP · Nivel 3: 283 · Nivel 5: 800 · Nivel 10: 2.700 · Nivel 20: 8.280

def xp_for_level(level: int) -> int:
    """XP total acumulado necesario para alcanzar un nivel."""
    if level <= 1:
        return 0
    return round(100 * (level - 1) ** 1.5)


def level_for_xp(xp: int) -> int:
    """Nivel actual según el XP total."""
    level = 1
    while xp >= xp_for_level(level + 1):
        level += 1
    return level


def award_xp(user_id: str, kind: str, amount: int, doc_id: str | None = None, meta: dict | None = None) -> None:
    """Registra un evento de XP. Nunca rompe el flujo principal si falla."""
    try:
        supabase.table("xp_events").insert({
            "user_id": user_id,
            "kind": kind,
            "amount": amount,
            "doc_id": doc_id,
            "meta": meta or {},
        }).execute()
    except Exception as e:
        logger.warning(f"No se pudo registrar XP ({kind}, {amount}) para {user_id}: {e}")


# ── Catálogo de logros ─────────────────────────────────────────────────────────
# check(data) recibe el dict de datos agregados del usuario y devuelve bool.

ACHIEVEMENTS = [
    {
        "id": "primer-apunte",
        "name": "Primer apunte",
        "description": "Subiste tu primer documento",
        "check": lambda d: d["total_documents"] >= 1,
    },
    {
        "id": "biblioteca",
        "name": "Biblioteca",
        "description": "10 documentos subidos",
        "check": lambda d: d["total_documents"] >= 10,
    },
    {
        "id": "primer-quiz",
        "name": "Primer quiz",
        "description": "Completaste tu primer quiz",
        "check": lambda d: d["total_quizzes"] >= 1,
    },
    {
        "id": "constante",
        "name": "Constante",
        "description": "10 quizzes completados",
        "check": lambda d: d["total_quizzes"] >= 10,
    },
    {
        "id": "perfeccionista",
        "name": "Perfeccionista",
        "description": "Un quiz con 100% de aciertos",
        "check": lambda d: d["best_quiz_pct"] >= 100,
    },
    {
        "id": "centinela",
        "name": "Centinela",
        "description": "100 flashcards repasadas",
        "check": lambda d: d["total_reviews"] >= 100,
    },
    {
        "id": "racha-7",
        "name": "Una semana al hilo",
        "description": "Racha de 7 días de estudio",
        "check": lambda d: d["streak"] >= 7,
    },
    {
        "id": "racha-30",
        "name": "Imparable",
        "description": "Racha de 30 días de estudio",
        "check": lambda d: d["streak"] >= 30,
    },
    {
        "id": "oral-aprobado",
        "name": "Listo para el oral",
        "description": "Sacaste 8 o más en un examen oral con IA",
        "check": lambda d: d["best_exam_score"] >= 8,
    },
    {
        "id": "nivel-5",
        "name": "Nivel 5",
        "description": "Alcanzaste el nivel 5",
        "check": lambda d: d["level"] >= 5,
    },
    {
        "id": "nivel-10",
        "name": "Nivel 10",
        "description": "Alcanzaste el nivel 10",
        "check": lambda d: d["level"] >= 10,
    },
]


def check_and_unlock_achievements(user_id: str, data: dict) -> list[dict]:
    """
    Evalúa el catálogo contra los datos del usuario, desbloquea los que falten
    y devuelve la lista completa con estado.
    """
    unlocked_resp = (
        supabase.table("user_achievements")
        .select("achievement_id, unlocked_at")
        .eq("user_id", user_id)
        .execute()
    )
    unlocked = {r["achievement_id"]: r["unlocked_at"] for r in (unlocked_resp.data or [])}

    result = []
    to_insert = []
    now = datetime.now(timezone.utc).isoformat()

    for ach in ACHIEVEMENTS:
        is_unlocked = ach["id"] in unlocked
        if not is_unlocked:
            try:
                if ach["check"](data):
                    to_insert.append({"user_id": user_id, "achievement_id": ach["id"]})
                    unlocked[ach["id"]] = now
                    is_unlocked = True
            except Exception:
                pass
        result.append({
            "id": ach["id"],
            "name": ach["name"],
            "description": ach["description"],
            "unlocked": is_unlocked,
            "unlocked_at": unlocked.get(ach["id"]),
        })

    if to_insert:
        try:
            supabase.table("user_achievements").insert(to_insert).execute()
        except Exception as e:
            logger.warning(f"No se pudieron guardar logros para {user_id}: {e}")

    return result


def compute_streak(activity_dates: set) -> int:
    """Racha de días consecutivos con actividad, contando desde hoy o ayer."""
    today = datetime.now(timezone.utc).date()
    streak = 0
    check = today
    while check in activity_dates:
        streak += 1
        check -= timedelta(days=1)
    if streak == 0:
        check = today - timedelta(days=1)
        while check in activity_dates:
            streak += 1
            check -= timedelta(days=1)
    return streak
