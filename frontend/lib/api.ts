import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function authHeaders(): Promise<HeadersInit> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

async function authHeadersNoContentType(): Promise<HeadersInit> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface Flashcard {
  question: string;
  answer: string;
  interval: number;
  ease_factor: number;
  repetitions: number;
  next_review: string | null;
}

export interface ExamQuestion {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
}

export interface KeyConcept {
  concept: string;
  definition: string;
}

export interface Document {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
  status: "processing" | "ready" | "error";
  summary: string | null;
  flashcards: Flashcard[] | null;
  exam_questions: ExamQuestion[] | null;
  key_concepts: KeyConcept[] | null;
  created_at: string;
}

export interface DueCardsResponse {
  doc_id: string;
  total_cards: number;
  due_count: number;
  due_cards: Array<{ index: number } & Flashcard>;
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function uploadDocument(file: File): Promise<Document> {
  const headers = await authHeadersNoContentType();
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/documents/upload`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Error subiendo el documento");
  }

  return res.json();
}

export async function listDocuments(): Promise<Document[]> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/documents/`, { headers });
  if (!res.ok) throw new Error("Error obteniendo documentos");
  return res.json();
}

export async function getDocument(id: string): Promise<Document> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/documents/${id}`, { headers });
  if (!res.ok) throw new Error("Documento no encontrado");
  return res.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const headers = await authHeadersNoContentType();
  await fetch(`${API_URL}/documents/${id}`, { method: "DELETE", headers });
}

// ─── Review ───────────────────────────────────────────────────────────────────

export async function getDueCards(docId: string): Promise<DueCardsResponse> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/review/${docId}/due`, { headers });
  if (!res.ok) throw new Error("Error obteniendo tarjetas");
  return res.json();
}

export async function rateFlashcard(
  docId: string,
  flashcardId: string,
  rating: "easy" | "medium" | "hard" | "forgot"
): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/review/${docId}/rate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ flashcard_id: flashcardId, rating }),
  });
  if (!res.ok) throw new Error("Error guardando calificación");
}

// ─── Quiz ─────────────────────────────────────────────────────────────────────

export interface QuizAnswer {
  question: string;
  chosen: string | null;
  correct_answer: string;
  explanation: string;
  is_correct: boolean;
}

export interface QuizResult {
  id: string;
  doc_id: string;
  score: number;
  total: number;
  percentage: number;
  answers: QuizAnswer[];
  created_at: string;
}

export async function saveQuizResult(
  docId: string,
  score: number,
  total: number,
  answers: QuizAnswer[]
): Promise<QuizResult | null> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/quiz/save`, {
    method: "POST",
    headers,
    body: JSON.stringify({ doc_id: docId, score, total, answers }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.warn(`[memorIA] Quiz save failed (${res.status}):`, errText);
    return null;
  }
  return res.json();
}

export async function getQuizHistory(docId: string): Promise<QuizResult[]> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/quiz/${docId}/history`, { headers });
  if (!res.ok) throw new Error("Error obteniendo historial");
  return res.json();
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface RecentActivity {
  doc_id: string;
  doc_title: string;
  percentage: number;
  score: number;
  total: number;
  created_at: string;
}

export interface QuizChartPoint {
  percentage: number;
  created_at: string;
}

export interface StatsSummary {
  total_documents: number;
  total_flashcards: number;
  total_questions: number;
  total_concepts: number;
  cards_due_today: number;
  total_quiz_attempts: number;
  average_quiz_score: number;
  best_quiz_score: number;
  recent_quiz_chart: QuizChartPoint[];
  recent_activity: RecentActivity[];
}

export async function getStatsSummary(): Promise<StatsSummary> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/stats/summary`, { headers });
  if (!res.ok) throw new Error("Error obteniendo estadísticas");
  return res.json();
}
