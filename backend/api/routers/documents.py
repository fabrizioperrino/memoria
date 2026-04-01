from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from pydantic import BaseModel
from typing import Optional
from models.study_models import DocumentResponse, DocumentStatus
from services.document_processor import process_pdf, process_image, process_text
from database.supabase_client import supabase
from core.auth import get_current_user
import uuid as uuid_module
from datetime import datetime

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_PDF_TYPES   = ["application/pdf"]
ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


# ─── Request body para texto ──────────────────────────────────────────────────

class UploadTextRequest(BaseModel):
    title: str
    content: str
    subject: Optional[str] = None


# ─── Upload archivo (PDF / imagen) ────────────────────────────────────────────

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    subject: Optional[str] = Form(None),
    current_user=Depends(get_current_user),
):
    """Sube un PDF o imagen, lo procesa con IA y guarda el resultado."""
    content_type = file.content_type or ""

    if content_type not in ALLOWED_PDF_TYPES + ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no soportado: {content_type}. Usá PDF o imagen (JPG, PNG, WEBP).",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="El archivo supera los 20 MB.")

    doc_id = str(uuid_module.uuid4())
    title  = file.filename or "Sin título"

    try:
        if content_type in ALLOWED_PDF_TYPES:
            study_material, raw_text = await process_pdf(file_bytes)
        else:
            study_material, raw_text = await process_image(file_bytes, content_type)

        data = {
            "id":             doc_id,
            "user_id":        current_user.id,
            "title":          title,
            "file_name":      file.filename,
            "file_type":      "pdf" if content_type in ALLOWED_PDF_TYPES else "image",
            "status":         DocumentStatus.READY,
            "subject":        subject or None,
            "content":        raw_text,
            "summary":        study_material.summary,
            "flashcards":     [fc.model_dump() for fc in study_material.flashcards],
            "exam_questions": [q.model_dump()  for q  in study_material.exam_questions],
            "key_concepts":   [kc.model_dump() for kc in study_material.key_concepts],
            "created_at":     datetime.utcnow().isoformat(),
        }

        supabase.table("documents").insert(data).execute()
        return DocumentResponse(**data)

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando el documento: {str(e)}")


# ─── Upload texto directo ──────────────────────────────────────────────────────

@router.post("/upload-text", response_model=DocumentResponse)
async def upload_text_document(
    body: UploadTextRequest,
    current_user=Depends(get_current_user),
):
    """Procesa texto pegado directamente por el usuario."""
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="El texto no puede estar vacío.")

    doc_id = str(uuid_module.uuid4())

    try:
        study_material, raw_text = await process_text(body.content)

        data = {
            "id":             doc_id,
            "user_id":        current_user.id,
            "title":          body.title.strip() or "Texto sin título",
            "file_name":      None,
            "file_type":      "text",
            "status":         DocumentStatus.READY,
            "subject":        body.subject or None,
            "content":        raw_text,
            "summary":        study_material.summary,
            "flashcards":     [fc.model_dump() for fc in study_material.flashcards],
            "exam_questions": [q.model_dump()  for q  in study_material.exam_questions],
            "key_concepts":   [kc.model_dump() for kc in study_material.key_concepts],
            "created_at":     datetime.utcnow().isoformat(),
        }

        supabase.table("documents").insert(data).execute()
        return DocumentResponse(**data)

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando el texto: {str(e)}")


# ─── Listar documentos ────────────────────────────────────────────────────────

@router.get("/", response_model=list[DocumentResponse])
async def list_documents(current_user=Depends(get_current_user)):
    """Lista los documentos del usuario autenticado."""
    response = (
        supabase.table("documents")
        .select("*")
        .eq("user_id", current_user.id)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data


# ─── Documento compartido (público, sin auth) ─────────────────────────────────

@router.get("/shared/{token}", response_model=DocumentResponse)
async def get_shared_document(token: str):
    """Obtiene un documento por su share_token (sin autenticación)."""
    response = (
        supabase.table("documents")
        .select("*")
        .eq("share_token", token)
        .single()
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Link inválido o documento eliminado.")
    return response.data


# ─── Obtener un documento ─────────────────────────────────────────────────────

@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: str, current_user=Depends(get_current_user)):
    """Obtiene un documento por ID (solo si pertenece al usuario)."""
    response = (
        supabase.table("documents")
        .select("*")
        .eq("id", doc_id)
        .eq("user_id", current_user.id)
        .single()
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    return response.data


# ─── Eliminar documento ───────────────────────────────────────────────────────

@router.delete("/{doc_id}")
async def delete_document(doc_id: str, current_user=Depends(get_current_user)):
    """Elimina un documento (solo si pertenece al usuario)."""
    supabase.table("documents").delete().eq("id", doc_id).eq("user_id", current_user.id).execute()
    return {"message": "Documento eliminado."}


# ─── Compartir documento ──────────────────────────────────────────────────────

@router.post("/{doc_id}/share")
async def share_document(doc_id: str, current_user=Depends(get_current_user)):
    """Genera (o devuelve) el token de compartir de un documento."""
    response = (
        supabase.table("documents")
        .select("id, share_token")
        .eq("id", doc_id)
        .eq("user_id", current_user.id)
        .single()
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")

    existing_token = response.data.get("share_token")
    if existing_token:
        return {"share_token": existing_token}

    token = str(uuid_module.uuid4())
    supabase.table("documents").update({"share_token": token}).eq("id", doc_id).execute()
    return {"share_token": token}


@router.delete("/{doc_id}/share")
async def unshare_document(doc_id: str, current_user=Depends(get_current_user)):
    """Elimina el link de compartir de un documento."""
    supabase.table("documents").update({"share_token": None}).eq("id", doc_id).eq("user_id", current_user.id).execute()
    return {"message": "Documento dejó de ser compartido."}
