from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


# ─── Enums ────────────────────────────────────────────────────────────────────

class DifficultyRating(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    FORGOT = "forgot"


class DocumentStatus(str, Enum):
    PROCESSING = "processing"
    READY = "ready"
    ERROR = "error"


# ─── Flashcard ────────────────────────────────────────────────────────────────

class Flashcard(BaseModel):
    question: str
    answer: str
    # Campos SM-2 para repaso espaciado
    interval: int = 1           # días hasta el próximo repaso
    ease_factor: float = 2.5    # factor de facilidad (SM-2)
    repetitions: int = 0        # cantidad de veces repasada
    next_review: Optional[datetime] = None


class FlashcardReview(BaseModel):
    flashcard_id: str
    rating: DifficultyRating


# ─── Preguntas de examen ───────────────────────────────────────────────────────

class ExamQuestion(BaseModel):
    question: str
    options: list[str] = Field(default_factory=list)   # vacío = pregunta abierta
    correct_answer: str
    explanation: str


# ─── Concepto clave ───────────────────────────────────────────────────────────

class KeyConcept(BaseModel):
    concept: str
    definition: str


# ─── Material de estudio (output de Gemini) ───────────────────────────────────

class StudyMaterialSchema(BaseModel):
    """Schema que Gemini debe devolver con structured output."""
    summary: str = Field(description="Resumen claro y conciso del documento")
    flashcards: list[Flashcard] = Field(description="Lista de flashcards pregunta-respuesta")
    exam_questions: list[ExamQuestion] = Field(description="Preguntas tipo parcial/examen")
    key_concepts: list[KeyConcept] = Field(description="Conceptos clave con definición")


# ─── Document (guardado en Supabase) ──────────────────────────────────────────

class DocumentCreate(BaseModel):
    title: str
    file_name: str
    file_type: str  # "pdf" | "image"


class DocumentResponse(BaseModel):
    id: str
    title: str
    file_name: str
    status: DocumentStatus
    summary: Optional[str] = None
    flashcards: Optional[list[Flashcard]] = None
    exam_questions: Optional[list[ExamQuestion]] = None
    key_concepts: Optional[list[KeyConcept]] = None
    created_at: datetime
