from groq import Groq
from settings.config import settings
from typing import Generator

client = Groq(api_key=settings.GROQ_API_KEY)

SYSTEM_PROMPT = """Sos un asistente de estudio. Tu ÚNICA función es responder preguntas sobre el documento que el estudiante subió.

REGLAS ESTRICTAS que debés seguir SIEMPRE:
1. Solo podés responder usando información que esté EXPLÍCITAMENTE en el documento provisto.
2. Si la pregunta NO está relacionada con el contenido del documento, respondé EXACTAMENTE esto: "Esa pregunta no está relacionada con el material de estudio. Solo puedo ayudarte con el contenido de este documento."
3. NUNCA uses tu conocimiento general para complementar la respuesta.
4. NUNCA respondas preguntas de otros temas aunque sepas la respuesta.
5. Si el documento no tiene suficiente información para responder, decí: "El documento no tiene información suficiente sobre eso."

Respondé en el mismo idioma que el estudiante usa para preguntar.
Sé claro y pedagógico cuando SÍ respondés."""


def stream_chat(
    question: str,
    document_content: str,
    history: list[dict],
) -> Generator[str, None, None]:
    """
    Streamea la respuesta del chat usando Groq.
    history: lista de {"role": "user"|"assistant", "content": "..."}
    """

    # Limitar el contenido del documento a ~100k chars para no exceder contexto
    content_truncated = document_content[:100_000]

    messages = [
        {
            "role": "system",
            "content": f"{SYSTEM_PROMPT}\n\n---\nCONTENIDO DEL DOCUMENTO:\n{content_truncated}\n---",
        },
        *history[-10:],  # últimos 10 mensajes del historial
        {"role": "user", "content": question},
    ]

    stream = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=messages,
        temperature=0.4,
        stream=True,
    )

    for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
