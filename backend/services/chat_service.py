from groq import Groq
from settings.config import settings
from typing import Generator, Optional
import logging

logger = logging.getLogger(__name__)
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


def _get_context(question: str, doc_id: Optional[str], document_content: str) -> tuple[str, str]:
    """
    Intenta obtener contexto relevante via RAG.
    Devuelve (contexto, modo) donde modo es "rag" o "full".
    """
    if doc_id:
        try:
            from services.rag_service import retrieve_relevant_chunks, rag_enabled
            if rag_enabled():
                chunks = retrieve_relevant_chunks(question, doc_id, top_k=5)
                if chunks:
                    return chunks, "rag"
        except Exception as e:
            logger.warning(f"RAG falló, usando documento completo: {e}")

    return document_content[:100_000], "full"


def stream_chat(
    question: str,
    document_content: str,
    history: list[dict],
    doc_id: Optional[str] = None,
) -> Generator[str, None, None]:
    """
    Streamea la respuesta usando RAG si está disponible, doc completo como fallback.
    history: lista de {"role": "user"|"assistant", "content": "..."}
    """
    context, mode = _get_context(question, doc_id, document_content)

    context_label = (
        "FRAGMENTOS RELEVANTES DEL DOCUMENTO (seleccionados por relevancia):"
        if mode == "rag"
        else "CONTENIDO DEL DOCUMENTO:"
    )

    messages = [
        {
            "role": "system",
            "content": f"{SYSTEM_PROMPT}\n\n---\n{context_label}\n{context}\n---",
        },
        *history[-10:],
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
