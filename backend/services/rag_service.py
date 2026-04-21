"""
RAG (Retrieval-Augmented Generation) usando pgvector en Supabase.

Flujo:
  1. Al procesar un documento → split en chunks → embeddings → guardar en document_chunks
  2. Al chatear → embed la pregunta → similarity search → pasar solo chunks relevantes al LLM

Requiere OPENAI_API_KEY configurado (text-embedding-3-small).
Si no está configurado, el chat usa el documento completo como fallback.
"""
import logging
from typing import Optional
from settings.config import settings
from database.supabase_client import supabase

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMS  = 1536

# Chunks más pequeños que los de procesamiento para mayor granularidad de retrieval
RAG_CHUNK_SIZE    = 1200   # chars (~300 tokens)
RAG_CHUNK_OVERLAP = 200    # chars


# ── Cliente OpenAI (lazy) ──────────────────────────────────────────────────────

_openai_client = None

def _get_client():
    global _openai_client
    if _openai_client is None:
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY no configurado. RAG no disponible.")
        from openai import OpenAI
        _openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _openai_client


def rag_enabled() -> bool:
    return bool(settings.OPENAI_API_KEY)


# ── Chunking ──────────────────────────────────────────────────────────────────

def _split_for_rag(text: str) -> list[str]:
    """Divide el texto en chunks pequeños con overlap para retrieval fino."""
    clean = text.strip()
    if not clean:
        return []
    if len(clean) <= RAG_CHUNK_SIZE:
        return [clean]

    chunks: list[str] = []
    start = 0
    while start < len(clean):
        end = min(start + RAG_CHUNK_SIZE, len(clean))
        if end < len(clean):
            # Intentar cortar en salto de línea o punto para no partir frases
            for sep in ("\n", ". ", " "):
                pos = clean.rfind(sep, start + int(RAG_CHUNK_SIZE * 0.5), end)
                if pos > start:
                    end = pos + len(sep)
                    break
        chunk = clean[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(clean):
            break
        start = max(end - RAG_CHUNK_OVERLAP, start + 1)

    return chunks


# ── Embeddings ────────────────────────────────────────────────────────────────

def _embed_batch(texts: list[str]) -> list[list[float]]:
    """Llama a OpenAI para generar embeddings en batch."""
    client = _get_client()
    response = client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
    return [item.embedding for item in response.data]


# ── Almacenamiento ────────────────────────────────────────────────────────────

def store_document_chunks(document_id: str, user_id: str, text: str) -> int:
    """
    Chunka el texto, genera embeddings y los guarda en document_chunks.
    Devuelve la cantidad de chunks guardados. Si falla, lanza excepción.
    """
    chunks = _split_for_rag(text)
    if not chunks:
        return 0

    # Procesar en batches de 100 para no exceder límites de la API
    embeddings: list[list[float]] = []
    batch_size = 100
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        embeddings.extend(_embed_batch(batch))

    # Eliminar chunks anteriores del documento (por si se reprocesa)
    supabase.table("document_chunks").delete().eq("document_id", document_id).execute()

    rows = [
        {
            "document_id": document_id,
            "user_id":     user_id,
            "chunk_index": idx,
            "content":     chunk,
            "embedding":   embedding,
        }
        for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings))
    ]

    supabase.table("document_chunks").insert(rows).execute()
    return len(rows)


# ── Retrieval ─────────────────────────────────────────────────────────────────

def retrieve_relevant_chunks(
    query: str,
    document_id: str,
    top_k: int = 5,
) -> Optional[str]:
    """
    Busca los chunks más relevantes para la query.
    Devuelve el contexto concatenado, o None si no hay chunks disponibles.
    """
    query_embedding = _embed_batch([query])[0]

    result = supabase.rpc("match_chunks", {
        "query_embedding":   query_embedding,
        "match_document_id": document_id,
        "match_count":       top_k,
    }).execute()

    if not result.data:
        return None

    # Ordenar por chunk_index para mantener coherencia narrativa
    chunks = sorted(result.data, key=lambda r: r["chunk_index"])
    return "\n\n---\n\n".join(r["content"] for r in chunks)
