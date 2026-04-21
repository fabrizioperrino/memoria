"""
Generador de plan de estudio personalizado.
Usa los datos reales del usuario (documentos, flashcards, quizzes) y Groq
para crear un plan diario hasta la fecha del examen.
"""
import json
import logging
from datetime import datetime, timezone, timedelta
from groq import Groq
from pydantic import BaseModel, Field
from settings.config import settings
from database.supabase_client import supabase

logger = logging.getLogger(__name__)
client = Groq(api_key=settings.GROQ_API_KEY)


# ── Schemas de salida ─────────────────────────────────────────────────────────

class StudyTask(BaseModel):
    type: str = Field(description="Tipo: 'review' | 'quiz' | 'exam' | 'study'")
    description: str = Field(description="Descripción clara de la tarea")
    document_title: str = Field(description="Título del documento relacionado, o vacío")
    estimated_minutes: int = Field(description="Tiempo estimado en minutos", ge=5, le=120)


class DayPlan(BaseModel):
    day_label: str = Field(description="Etiqueta del día: 'Hoy', 'Mañana', 'Lunes 21 de abril', etc.")
    date: str = Field(description="Fecha en formato YYYY-MM-DD")
    tasks: list[StudyTask] = Field(description="Lista de tareas para ese día")
    total_minutes: int = Field(description="Total de minutos estimados para el día")


class StudyPlan(BaseModel):
    summary: str = Field(description="Resumen breve del plan (2-3 oraciones)")
    focus_areas: list[str] = Field(description="2-4 áreas o temas clave a priorizar")
    daily_plan: list[DayPlan] = Field(description="Plan día a día")


PLAN_SYSTEM = """Sos un tutor académico experto en crear planes de estudio personalizados y efectivos.

Tu tarea es generar un plan de estudio diario basado en los datos reales del estudiante:
- Documentos y materias que tiene cargados
- Flashcards vencidas o próximas a vencer (repaso espaciado SM-2)
- Rendimiento en quizzes anteriores (identificar puntos débiles)
- Días disponibles hasta el examen
- Minutos diarios que puede dedicar

Principios del plan:
1. Empezar por los temas con peor rendimiento en quizzes
2. Distribuir el repaso de flashcards según el algoritmo SM-2 (repasar lo vencido primero)
3. Alternar tipos de actividades para mantener el engagement
4. Ser realista con el tiempo disponible
5. Dejar los últimos 1-2 días para repaso general

Tipos de tareas disponibles:
- "review": Repasar flashcards (SM-2)
- "quiz": Hacer el quiz de un documento
- "exam": Hacer el Examen IA de un documento (respuestas abiertas con feedback)
- "study": Leer el resumen o los conceptos clave de un documento

Respondé SIEMPRE en español y en el mismo idioma formal pero cercano que usa el estudiante."""


def _collect_user_data(user_id: str) -> dict:
    """Recopila los datos del usuario para construir el contexto del plan."""
    now = datetime.now(timezone.utc)

    # Documentos
    docs_resp = (
        supabase.table("documents")
        .select("id, title, subject, flashcards, exam_questions, created_at, status")
        .eq("user_id", user_id)
        .eq("status", "ready")
        .execute()
    )
    docs = docs_resp.data or []

    # Quiz history
    quiz_resp = (
        supabase.table("quiz_results")
        .select("doc_id, percentage, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    quiz_results = quiz_resp.data or []

    # Quiz performance por documento
    quiz_by_doc: dict[str, list[int]] = {}
    for r in quiz_results:
        doc_id = r["doc_id"]
        quiz_by_doc.setdefault(doc_id, []).append(r["percentage"])

    # Construir resumen de cada documento
    docs_summary = []
    for doc in docs:
        flashcards = doc.get("flashcards") or []
        due_count = 0
        for fc in flashcards:
            nr = fc.get("next_review")
            if nr is None:
                due_count += 1
            else:
                try:
                    dt = datetime.fromisoformat(nr.replace("Z", "+00:00"))
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    if dt <= now + timedelta(days=3):
                        due_count += 1
                except Exception:
                    due_count += 1

        scores = quiz_by_doc.get(doc["id"], [])
        avg_score = round(sum(scores) / len(scores)) if scores else None

        docs_summary.append({
            "title":          doc["title"],
            "subject":        doc.get("subject") or "Sin materia",
            "total_cards":    len(flashcards),
            "cards_due":      due_count,
            "questions_count": len(doc.get("exam_questions") or []),
            "quiz_attempts":  len(scores),
            "avg_quiz_score": avg_score,
        })

    return {
        "documents": docs_summary,
        "total_cards_due": sum(d["cards_due"] for d in docs_summary),
        "total_documents": len(docs),
    }


def generate_study_plan(
    user_id: str,
    exam_date_str: str,
    daily_minutes: int,
) -> StudyPlan:
    """
    Genera un plan de estudio personalizado.
    exam_date_str: formato YYYY-MM-DD
    daily_minutes: minutos disponibles por día
    """
    today = datetime.now(timezone.utc).date()
    exam_date = datetime.strptime(exam_date_str, "%Y-%m-%d").date()
    days_until = (exam_date - today).days

    if days_until < 1:
        raise ValueError("La fecha del examen debe ser al menos mañana.")
    if days_until > 60:
        raise ValueError("El plan cubre un máximo de 60 días.")

    data = _collect_user_data(user_id)

    # Construir contexto para la IA
    def _quiz_str(d: dict) -> str:
        if d["avg_quiz_score"] is not None:
            return f"{d['avg_quiz_score']}% promedio en {d['quiz_attempts']} intentos"
        return "sin intentos"

    docs_text = "\n".join([
        f"  - '{d['title']}' (materia: {d['subject']}): "
        f"{d['total_cards']} flashcards ({d['cards_due']} vencidas o próximas), "
        f"{d['questions_count']} preguntas de examen, "
        f"quiz: {_quiz_str(d)}"
        for d in data["documents"]
    ]) or "  Sin documentos cargados."

    # Etiquetas de días
    day_labels = []
    for i in range(min(days_until, 14)):  # máximo 14 días en el plan
        d = today + timedelta(days=i)
        if i == 0:
            label = "Hoy"
        elif i == 1:
            label = "Mañana"
        else:
            day_names = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
            months = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
                      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
            label = f"{day_names[d.weekday()]} {d.day} de {months[d.month - 1]}"
        day_labels.append((d.isoformat(), label))

    days_context = "\n".join([f"  - {label} ({date})" for date, label in day_labels])

    schema = json.dumps(StudyPlan.model_json_schema(), indent=2)

    user_prompt = f"""DATOS DEL ESTUDIANTE:
- Días hasta el examen: {days_until}
- Minutos disponibles por día: {daily_minutes}
- Total de flashcards vencidas/próximas: {data['total_cards_due']}
- Documentos cargados:
{docs_text}

DÍAS A PLANIFICAR:
{days_context}

Generá un plan de estudio día por día para estos {len(day_labels)} días.
Cada día debe tener tareas que sumen aproximadamente {daily_minutes} minutos.
Priorizá los documentos con peor rendimiento en quiz y más tarjetas vencidas.
Si hay muchos días, distribuí el contenido de forma progresiva.

Devolvé exactamente este JSON:
{schema}"""

    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[
            {"role": "system", "content": PLAN_SYSTEM},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.4,
        max_tokens=4000,
    )

    return StudyPlan.model_validate_json(response.choices[0].message.content)
