"""
Servicio de evaluación de respuestas para el modo examen interactivo.
Usa Groq para calificar respuestas abiertas y generar preguntas de seguimiento.
"""
import json
import logging
from groq import Groq
from pydantic import BaseModel, Field
from settings.config import settings

logger = logging.getLogger(__name__)
client = Groq(api_key=settings.GROQ_API_KEY)


class AnswerEvaluation(BaseModel):
    score: int = Field(description="Puntaje del 1 al 10", ge=1, le=10)
    feedback: str = Field(description="Feedback constructivo explicando el puntaje y qué mejorar")
    follow_up_questions: list[str] = Field(
        description="1 o 2 preguntas de seguimiento para profundizar el tema",
        min_length=1,
        max_length=2,
    )


# ── Perfiles de profesor para la Mesa de Final ────────────────────────────────
# Modifican el tono y la exigencia del evaluador. Solo prompt: costo cero extra.
PROFESSOR_PROFILES: dict[str, str] = {
    "clasico": (
        "Sos un profesor universitario equilibrado y justo. Corregís con claridad, "
        "reconocés lo que está bien y marcás lo que falta sin dramatizar."
    ),
    "exigente": (
        "Sos un profesor universitario EXIGENTE, de los que toman el final más difícil "
        "de la carrera. Puntuá con rigor: una respuesta incompleta no pasa de 5. "
        "Señalá cada imprecisión conceptual. Tus repreguntas van directo a los huecos "
        "de la respuesta y exigen precisión técnica. Tono seco pero profesional, nunca cruel."
    ),
    "tribunal": (
        "Sos un TRIBUNAL de tres profesores en una mesa de final. En el feedback, "
        "reflejá las tres voces: uno valora lo conceptual, otro pide ejemplos concretos "
        "y aplicación práctica, y el tercero cuestiona la precisión de los términos. "
        "Redactá el feedback como una deliberación breve del tribunal (por ejemplo: "
        "'El tribunal coincide en que…, aunque se esperaba…'). Las repreguntas pueden "
        "venir de cualquiera de los tres."
    ),
}


EVAL_SYSTEM = """Sos un docente universitario evaluando la respuesta de un estudiante a una pregunta de examen.

Tu tarea:
1. Leé la pregunta, la respuesta esperada (si hay una) y la respuesta del estudiante
2. Asigná un puntaje justo del 1 al 10
3. Escribí un feedback pedagógico: destacá lo correcto, señalá omisiones y explicá errores
4. Generá exactamente 2 preguntas de seguimiento para verificar comprensión más profunda

Criterios de puntaje:
- 9-10: Respuesta completa, correcta y bien fundamentada
- 7-8: Correcta con pequeñas omisiones o imprecisiones menores
- 5-6: Parcialmente correcta, falta profundidad o hay conceptos confusos
- 3-4: Muy incompleta o con errores conceptuales importantes
- 1-2: Incorrecta, irrelevante o muestra desconocimiento del tema

IMPORTANTE:
- Respondé siempre en el mismo idioma que la respuesta del estudiante
- Sé justo pero exigente, como un docente universitario real
- El feedback debe ser constructivo y orientado al aprendizaje
- Las preguntas de seguimiento deben profundizar en el tema, no repetir la pregunta original"""


def evaluate_answer(
    question: str,
    student_answer: str,
    expected_answer: str = "",
    professor: str = "clasico",
) -> AnswerEvaluation:
    """
    Evalúa la respuesta del estudiante y devuelve score, feedback y follow-ups.
    Si hay expected_answer, se usa como referencia para la corrección.
    `professor` elige el perfil del evaluador (clasico | exigente | tribunal).
    """
    schema = json.dumps(AnswerEvaluation.model_json_schema(), indent=2)

    ref = f"\nRESPUESTA ESPERADA (referencia): {expected_answer}" if expected_answer.strip() else ""

    user_prompt = f"""PREGUNTA: {question}{ref}

RESPUESTA DEL ESTUDIANTE: {student_answer}

Evaluá esta respuesta y devolvé exactamente este JSON:
{schema}"""

    persona = PROFESSOR_PROFILES.get(professor, PROFESSOR_PROFILES["clasico"])

    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[
            {"role": "system", "content": f"{persona}\n\n{EVAL_SYSTEM}"},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )

    return AnswerEvaluation.model_validate_json(response.choices[0].message.content)
