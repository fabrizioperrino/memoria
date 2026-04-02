import pymupdf  # PyMuPDF
from models.study_models import StudyMaterialSchema
from core.ai_adapter import ai
from typing import Tuple

SYSTEM_PROMPT = """
Sos un asistente experto en educación y aprendizaje.
Tu tarea es analizar el contenido de un documento de estudio y generar material educativo estructurado.
Siempre respondé en el mismo idioma que el documento.
Sé claro, preciso y pedagógico.
"""

USER_PROMPT_TEMPLATE = """
Analizá el siguiente contenido y generá:

1. **Resumen**: Un resumen claro y conciso (máximo 300 palabras) que capture las ideas principales.
2. **Flashcards**: Entre 8 y 15 flashcards con preguntas y respuestas concretas para memorizar conceptos clave.
3. **Preguntas de examen**: Entre 5 y 8 preguntas tipo parcial. Incluí opciones múltiples cuando sea posible y siempre la respuesta correcta con una breve explicación.
4. **Conceptos clave**: Los 5 a 10 conceptos más importantes con sus definiciones.

CONTENIDO DEL DOCUMENTO:
---
{content}
---
"""

CHUNK_MAX_CHARS = 9000
CHUNK_OVERLAP_CHARS = 800
MAX_TOTAL_INPUT_CHARS = 120000
MAX_CHUNKS = 8


def split_text_into_chunks(
    text: str,
    chunk_size: int = CHUNK_MAX_CHARS,
    overlap: int = CHUNK_OVERLAP_CHARS,
    max_chunks: int = MAX_CHUNKS,
) -> list[str]:
    """Divide texto largo en chunks con overlap para no perder contexto."""
    clean = text.strip()
    if not clean:
        return []
    if len(clean) <= chunk_size:
        return [clean]

    chunks: list[str] = []
    start = 0
    while start < len(clean) and len(chunks) < max_chunks:
        end = min(start + chunk_size, len(clean))
        # Intentar cortar por salto de línea para mantener coherencia.
        if end < len(clean):
            split = clean.rfind("\n", start, end)
            if split > start + int(chunk_size * 0.6):
                end = split
        part = clean[start:end].strip()
        if part:
            chunks.append(part)
        if end >= len(clean):
            break
        start = max(end - overlap, start + 1)
    return chunks


def merge_materials(materials: list[StudyMaterialSchema]) -> StudyMaterialSchema:
    """Combina outputs parciales con límites para evitar respuestas gigantes."""
    if not materials:
        raise ValueError("No se pudo generar material a partir de los chunks.")

    summary_parts = [m.summary.strip() for m in materials if m.summary and m.summary.strip()]
    merged_summary = "\n\n".join(summary_parts)[:6000]

    flashcards = []
    seen_questions = set()
    for m in materials:
        for fc in m.flashcards:
            key = fc.question.strip().lower()
            if key and key not in seen_questions:
                flashcards.append(fc)
                seen_questions.add(key)
            if len(flashcards) >= 18:
                break
        if len(flashcards) >= 18:
            break

    exam_questions = []
    seen_exam = set()
    for m in materials:
        for q in m.exam_questions:
            key = q.question.strip().lower()
            if key and key not in seen_exam:
                exam_questions.append(q)
                seen_exam.add(key)
            if len(exam_questions) >= 10:
                break
        if len(exam_questions) >= 10:
            break

    key_concepts = []
    seen_concepts = set()
    for m in materials:
        for kc in m.key_concepts:
            key = kc.concept.strip().lower()
            if key and key not in seen_concepts:
                key_concepts.append(kc)
                seen_concepts.add(key)
            if len(key_concepts) >= 12:
                break
        if len(key_concepts) >= 12:
            break

    return StudyMaterialSchema(
        summary=merged_summary,
        flashcards=flashcards,
        exam_questions=exam_questions,
        key_concepts=key_concepts,
    )


def generate_material_with_chunking(text: str) -> StudyMaterialSchema:
    """
    Para textos largos evita un request gigante (TPM) y procesa por chunks.
    Luego unifica y hace una síntesis final.
    """
    clipped_text = text[:MAX_TOTAL_INPUT_CHARS]
    chunks = split_text_into_chunks(clipped_text)
    if not chunks:
        raise ValueError("No se encontró contenido para procesar.")

    if len(chunks) == 1:
        return ai.generate_structured(
            user_prompt=USER_PROMPT_TEMPLATE.format(content=chunks[0]),
            system_prompt=SYSTEM_PROMPT,
            response_schema=StudyMaterialSchema,
        )

    partials: list[StudyMaterialSchema] = []
    for i, chunk in enumerate(chunks, start=1):
        chunk_prompt = f"""
Este es el bloque {i}/{len(chunks)} de un documento largo.
Generá material parcial útil de este bloque:
- resumen breve del bloque
- 4 a 8 flashcards
- 2 a 4 preguntas de examen
- 3 a 6 conceptos clave

BLOQUE:
---
{chunk}
---
"""
        partial = ai.generate_structured(
            user_prompt=chunk_prompt,
            system_prompt=SYSTEM_PROMPT,
            response_schema=StudyMaterialSchema,
        )
        partials.append(partial)

    merged = merge_materials(partials)

    final_prompt = f"""
Unificá y mejorá este material parcial generado por chunks de un documento largo.
El objetivo es entregar una versión final limpia, sin duplicados, pedagógica y completa.

MATERIAL PARCIAL:
---
{merged.model_dump_json()}
---
"""
    return ai.generate_structured(
        user_prompt=final_prompt,
        system_prompt=SYSTEM_PROMPT,
        response_schema=StudyMaterialSchema,
    )


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extrae el texto de un PDF usando PyMuPDF."""
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    full_text = ""
    for page in doc:
        full_text += page.get_text()
    doc.close()
    return full_text.strip()


def render_pdf_pages_as_images(pdf_bytes: bytes, max_pages: int = 6, dpi: int = 100) -> list[bytes]:
    """Renderiza las primeras páginas de un PDF como imágenes PNG (para PDFs escaneados)."""
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    images = []
    for i, page in enumerate(doc):
        if i >= max_pages:
            break
        pix = page.get_pixmap(dpi=dpi)
        images.append(pix.tobytes("png"))
    doc.close()
    return images


async def process_pdf(pdf_bytes: bytes) -> Tuple[StudyMaterialSchema, str]:
    """
    Procesa un PDF: extrae texto y genera material de estudio.
    Si el PDF es escaneado (sin texto), usa Groq Vision como fallback.
    Devuelve (material, raw_text) — el texto crudo se guarda para el chat RAG.
    """
    text = extract_text_from_pdf(pdf_bytes)

    # ── PDF con texto normal ───────────────────────────────────────────────
    if text and len(text.strip()) >= 100:
        material = generate_material_with_chunking(text)
        return material, text

    # ── PDF escaneado: fallback a visión ──────────────────────────────────
    images = render_pdf_pages_as_images(pdf_bytes, max_pages=6)
    if not images:
        raise ValueError("No se pudo procesar el PDF. Probá con un PDF con texto seleccionable.")

    prompt = USER_PROMPT_TEMPLATE.format(
        content="[El contenido está en las imágenes adjuntas (páginas del PDF escaneado). "
                "Leé y analizá todo el texto visible en cada página.]"
    )
    image_tuples = [(img, "image/png") for img in images]
    material = ai.generate_from_images(image_tuples, prompt, StudyMaterialSchema)
    raw_text = f"[PDF escaneado — procesado con visión IA, {len(images)} páginas]\n\n{material.summary}"
    return material, raw_text


async def process_text(text: str) -> Tuple[StudyMaterialSchema, str]:
    """
    Procesa texto pegado directamente por el usuario.
    Devuelve (material, raw_text).
    """
    if not text.strip():
        raise ValueError("El texto no puede estar vacío.")

    material = generate_material_with_chunking(text)
    return material, text


async def process_image(image_bytes: bytes, mime_type: str) -> Tuple[StudyMaterialSchema, str]:
    """
    Procesa una foto de cuaderno con Groq Vision.
    Devuelve (material, raw_text).
    """
    prompt = USER_PROMPT_TEMPLATE.format(
        content="[El contenido está en la imagen adjunta. Leé y analizá todo el texto visible.]"
    )

    material = ai.generate_from_image(
        image_bytes=image_bytes,
        mime_type=mime_type,
        prompt=prompt,
        response_schema=StudyMaterialSchema,
    )
    # Para imágenes el "texto crudo" es el resumen generado (no hay texto extraído directamente)
    raw_text = f"[Imagen procesada con IA]\n\n{material.summary}"
    return material, raw_text
