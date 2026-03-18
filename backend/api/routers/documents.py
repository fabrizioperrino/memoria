from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from models.study_models import DocumentResponse, DocumentStatus
from services.document_processor import process_pdf, process_image
from database.supabase_client import supabase
from core.auth import get_current_user
import uuid
from datetime import datetime

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_PDF_TYPES   = ["application/pdf"]
ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
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

    doc_id = str(uuid.uuid4())
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


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, current_user=Depends(get_current_user)):
    """Elimina un documento (solo si pertenece al usuario)."""
    supabase.table("documents").delete().eq("id", doc_id).eq("user_id", current_user.id).execute()
    return {"message": "Documento eliminado."}
