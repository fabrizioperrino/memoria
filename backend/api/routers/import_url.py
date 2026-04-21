from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from models.study_models import DocumentResponse, DocumentStatus
from services.document_processor import process_text
from database.supabase_client import supabase
from core.auth import get_current_user
from api.routers.documents import _process_and_save, _base_doc
import uuid as uuid_module
from datetime import datetime

router = APIRouter(prefix="/documents", tags=["documents"])


class ImportUrlRequest(BaseModel):
    url: str
    subject: Optional[str] = None


@router.post("/import-url", response_model=DocumentResponse)
async def import_from_url(
    background_tasks: BackgroundTasks,
    body: ImportUrlRequest,
    current_user=Depends(get_current_user),
):
    """Importa contenido desde una URL, extrae el texto y genera material de estudio."""
    import httpx
    from bs4 import BeautifulSoup

    url = body.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL inválida. Debe empezar con http:// o https://")

    # ── Fetch de la página ────────────────────────────────────────────────────
    browser_headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Referer": "https://www.google.com/",
    }

    response = None
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=20.0,
            headers=browser_headers,
        ) as client:
            response = await client.get(url)

            # Algunas webs bloquean el primer request sin cookies/challenge.
            # Intentamos fallback por espejo lector para evitar 403/401.
            if response.status_code in (401, 403):
                proxy_url = f"https://r.jina.ai/http://{url.replace('https://', '').replace('http://', '')}"
                proxy_resp = await client.get(proxy_url)
                if proxy_resp.is_success and len(proxy_resp.text or "") > 200:
                    response = proxy_resp
                else:
                    response.raise_for_status()
            else:
                response.raise_for_status()
    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="La página tardó demasiado en responder.")
    except httpx.HTTPStatusError as e:
        if e.response.status_code in (401, 403):
            raise HTTPException(
                status_code=400,
                detail=(
                    "La web bloqueó el acceso (HTTP 403/401). "
                    "Probá con otra URL pública o copiá el texto en 'Pegar texto'."
                ),
            )
        raise HTTPException(status_code=400, detail=f"No se pudo acceder a la URL: HTTP {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo acceder a la URL: {str(e)}")

    # ── Extraer texto limpio ───────────────────────────────────────────────────
    try:
        soup = BeautifulSoup(response.text, "lxml")

        # Eliminar scripts, estilos, nav, footer, etc.
        for tag in soup(["script", "style", "nav", "footer", "header", "aside",
                         "noscript", "iframe", "form", "button", "input"]):
            tag.decompose()

        # Priorizar contenido principal
        main = (
            soup.find("article") or
            soup.find("main") or
            soup.find(id="content") or
            soup.find(id="main-content") or
            soup.find(class_="content") or
            soup.find(class_="article") or
            soup.body
        )

        raw_text = (main or soup).get_text(separator="\n", strip=True)

        # Limpiar líneas vacías excesivas
        lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
        clean_text = "\n".join(lines)

        # Título de la página
        title_tag = soup.find("title")
        page_title = title_tag.get_text(strip=True) if title_tag else url

        # Limitar longitud del título
        if len(page_title) > 120:
            page_title = page_title[:120] + "..."

    except Exception as e:
        raise HTTPException(status_code=422, detail=f"No se pudo extraer el contenido de la página: {str(e)}")

    if not clean_text or len(clean_text) < 200:
        raise HTTPException(
            status_code=422,
            detail="No se encontró suficiente texto en esa URL. Probá con otra página o usá 'Pegar texto'."
        )

    # ── Insertar inmediatamente y procesar en background ─────────────────────
    doc_id  = str(uuid_module.uuid4())
    clipped = clean_text[:100000]
    data    = _base_doc(doc_id, current_user.id, page_title, url, "url", body.subject)
    # Guardamos el texto crudo ya disponible; el contenido IA llegará en background
    data["content"] = clipped

    supabase.table("documents").insert(data).execute()
    background_tasks.add_task(_process_and_save, doc_id, current_user.id, process_text, clipped)

    return DocumentResponse(**data)
