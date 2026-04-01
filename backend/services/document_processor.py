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
        content = text[:50000]
        material = ai.generate_structured(
            user_prompt=USER_PROMPT_TEMPLATE.format(content=content),
            system_prompt=SYSTEM_PROMPT,
            response_schema=StudyMaterialSchema,
        )
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

    content = text[:50000]

    material = ai.generate_structured(
        user_prompt=USER_PROMPT_TEMPLATE.format(content=content),
        system_prompt=SYSTEM_PROMPT,
        response_schema=StudyMaterialSchema,
    )
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
