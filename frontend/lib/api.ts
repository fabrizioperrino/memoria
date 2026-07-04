import { createClient } from "@/lib/supabase/client";

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_URL =
  typeof window !== "undefined" &&
  window.location.protocol === "https:" &&
  RAW_API_URL.startsWith("http://") &&
  !RAW_API_URL.includes("localhost")
    ? RAW_API_URL.replace("http://", "https://")
    : RAW_API_URL;

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
  file_name: string | null;
  file_type: string | null;
  status: "processing" | "ready" | "error";
  subject: string | null;
  share_token: string | null;
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

export async function uploadDocument(file: File, subject?: string): Promise<Document> {
  const headers = await authHeadersNoContentType();
  const formData = new FormData();
  formData.append("file", file);
  if (subject?.trim()) formData.append("subject", subject.trim());

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

export async function uploadText(
  title: string,
  content: string,
  subject?: string
): Promise<Document> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/documents/upload-text`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title, content, subject: subject?.trim() || null }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Error procesando el texto");
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

export async function shareDocument(id: string): Promise<{ share_token: string }> {
  const headers = await authHeadersNoContentType();
  const res = await fetch(`${API_URL}/documents/${id}/share`, {
    method: "POST",
    headers,
  });
  if (!res.ok) throw new Error("Error generando el link");
  return res.json();
}

export async function unshareDocument(id: string): Promise<void> {
  const headers = await authHeadersNoContentType();
  await fetch(`${API_URL}/documents/${id}/share`, { method: "DELETE", headers });
}

export async function getSharedDocument(token: string): Promise<Document> {
  const res = await fetch(`${API_URL}/documents/shared/${token}`);
  if (!res.ok) throw new Error("Link inválido o documento eliminado");
  return res.json();
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

export interface TopSubject {
  subject: string;
  count: number;
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
  study_streak: number;
  top_subjects: TopSubject[];
}

export async function importFromUrl(url: string, subject?: string): Promise<Document> {
  const headers = await authHeaders();
  try {
    const res = await fetch(`${API_URL}/documents/import-url`, {
      method: "POST",
      headers,
      body: JSON.stringify({ url, subject: subject?.trim() || null }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || "Error importando la URL");
    }
    return res.json();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error de red";
    if (msg.toLowerCase().includes("failed to fetch")) {
      throw new Error("No se pudo conectar con la API. Revisá NEXT_PUBLIC_API_URL y que el backend esté online en HTTPS.");
    }
    throw new Error(msg);
  }
}

export async function getStatsSummary(): Promise<StatsSummary> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/stats/summary`, { headers });
  if (!res.ok) throw new Error("Error obteniendo estadísticas");
  return res.json();
}

// ─── Exam IA ──────────────────────────────────────────────────────────────────

export interface AnswerEvaluation {
  score: number;           // 1–10
  feedback: string;
  follow_up_questions: string[];
}

// ─── Study Plan ───────────────────────────────────────────────────────────────

export interface StudyTask {
  type: "review" | "quiz" | "exam" | "study";
  description: string;
  document_title: string;
  estimated_minutes: number;
}

export interface DayPlan {
  day_label: string;
  date: string;
  tasks: StudyTask[];
  total_minutes: number;
}

export interface StudyPlan {
  summary: string;
  focus_areas: string[];
  daily_plan: DayPlan[];
}

export async function generateStudyPlan(
  examDate: string,
  dailyMinutes: number,
): Promise<StudyPlan> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/study-plan/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ exam_date: examDate, daily_minutes: dailyMinutes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error generando el plan");
  }
  return res.json();
}

// ─── Exam IA ──────────────────────────────────────────────────────────────────

export async function evaluateAnswer(
  docId: string,
  question: string,
  studentAnswer: string,
  expectedAnswer?: string,
): Promise<AnswerEvaluation> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/exam/${docId}/evaluate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      question,
      student_answer: studentAnswer,
      expected_answer: expectedAnswer ?? "",
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error evaluando la respuesta");
  }
  return res.json();
}

// ─── Progreso y gamificación ──────────────────────────────────────────────────

export interface HeatmapDay {
  date: string;
  count: number;
}

export interface SubjectAccuracy {
  subject: string;
  attempts: number;
  avg_pct: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlocked_at: string | null;
}

export interface ProgressSummary {
  xp_total: number;
  level: number;
  level_xp_floor: number;
  next_level_xp: number;
  streak: number;
  heatmap: HeatmapDay[];
  heatmap_days: number;
  subjects: SubjectAccuracy[];
  achievements: Achievement[];
  totals: { documents: number; quizzes: number; reviews: number };
}

export async function getProgressSummary(): Promise<ProgressSummary> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/progress/summary`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error cargando el progreso");
  }
  return res.json();
}

// ─── Grupos ───────────────────────────────────────────────────────────────────

export interface Group {
  id: string;
  name: string;
  code: string;
  created_by: string;
  created_at: string;
  member_count: number;
  is_owner: boolean;
}

export interface GroupRankingEntry {
  user_id: string;
  display_name: string;
  xp_week: number;
  xp_total: number;
  is_you: boolean;
}

export interface GroupDetail extends Group {
  ranking: GroupRankingEntry[];
}

export async function listGroups(): Promise<Group[]> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/groups`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error cargando los grupos");
  }
  return res.json();
}

export async function createGroup(name: string, displayName?: string): Promise<Group> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/groups`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name, display_name: displayName ?? "" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error creando el grupo");
  }
  return res.json();
}

export async function joinGroup(
  code: string,
  displayName?: string,
): Promise<Group & { already_member: boolean }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/groups/join`, {
    method: "POST",
    headers,
    body: JSON.stringify({ code, display_name: displayName ?? "" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Código inválido");
  }
  return res.json();
}

export async function getGroup(groupId: string): Promise<GroupDetail> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/groups/${groupId}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error cargando el grupo");
  }
  return res.json();
}

export async function leaveGroup(groupId: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/groups/${groupId}/leave`, {
    method: "POST",
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error saliendo del grupo");
  }
}

// ─── Índice "¿Estoy listo?" ───────────────────────────────────────────────────

export interface DocReadiness {
  doc_id: string;
  title: string;
  subject: string;
  readiness: number;
  retention: number;
  accuracy: number;
  coverage: number;
  total_cards: number;
}

export interface SubjectReadiness {
  subject: string;
  readiness: number;
  docs: DocReadiness[];
}

export interface ReadinessSummary {
  overall: number;
  subjects: SubjectReadiness[];
  weakest: DocReadiness[];
}

export async function getReadiness(): Promise<ReadinessSummary> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/progress/readiness`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error cargando el índice de preparación");
  }
  return res.json();
}

// ─── Simulacro oral (voz) ─────────────────────────────────────────────────────

/** Transcribe la respuesta hablada del estudiante con Whisper. */
export async function transcribeOralAnswer(docId: string, audio: Blob): Promise<string> {
  const headers = await authHeadersNoContentType();
  const form = new FormData();
  form.append("audio", audio, "answer.webm");
  const res = await fetch(`${API_URL}/exam/${docId}/oral/transcribe`, {
    method: "POST",
    headers,
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "No se pudo transcribir el audio");
  }
  const data = await res.json();
  return data.transcript as string;
}

// ─── Mazos compartidos ────────────────────────────────────────────────────────

export interface GroupDeck {
  id: string;
  doc_id: string;
  shared_by: string;
  shared_by_name: string;
  title: string;
  created_at: string;
  is_mine: boolean;
}

export interface SharedDeckMaterial {
  id: string;
  title: string;
  summary: string | null;
  flashcards: Flashcard[] | null;
  exam_questions: ExamQuestion[] | null;
  key_concepts: KeyConcept[] | null;
  share_id: string;
  group_id: string;
}

export async function listGroupDecks(groupId: string): Promise<GroupDeck[]> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/groups/${groupId}/decks`, { headers });
  if (!res.ok) throw new Error("Error cargando los mazos");
  return res.json();
}

export async function shareDeck(groupId: string, docId: string): Promise<GroupDeck> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/groups/${groupId}/decks`, {
    method: "POST",
    headers,
    body: JSON.stringify({ doc_id: docId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "No se pudo compartir el mazo");
  }
  return res.json();
}

export async function getSharedDeck(shareId: string): Promise<SharedDeckMaterial> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/groups/decks/${shareId}`, { headers });
  if (!res.ok) throw new Error("Error cargando el mazo");
  return res.json();
}

export async function unshareDeck(groupId: string, shareId: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/groups/${groupId}/decks/${shareId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "No se pudo quitar el mazo");
  }
}

// ─── Duelos ───────────────────────────────────────────────────────────────────

export interface DuelListItem {
  id: string;
  title: string;
  total: number;
  created_at: string;
  played_count: number;
  my_score: number | null;
  played: boolean;
}

export interface DuelQuestion {
  question: string;
  options: string[];
}

export interface DuelPlay {
  id: string;
  title: string;
  group_id: string;
  questions: DuelQuestion[];
  total: number;
  already_played: boolean;
  my_score: number | null;
}

export interface DuelReviewItem {
  question: string;
  chosen: string;
  correct_answer: string;
  is_correct: boolean;
  explanation: string;
}

export interface DuelSubmitResult {
  score: number;
  total: number;
  review: DuelReviewItem[];
}

export interface DuelRankingEntry {
  display_name: string;
  score: number;
  total: number;
  created_at: string;
  is_you: boolean;
}

export interface DuelResults {
  id: string;
  title: string;
  total: number;
  ranking: DuelRankingEntry[];
}

export async function listDuels(groupId: string): Promise<DuelListItem[]> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/groups/${groupId}/duels`, { headers });
  if (!res.ok) throw new Error("Error cargando los duelos");
  return res.json();
}

export async function createDuel(
  groupId: string,
  docId: string,
  title?: string,
  numQuestions = 8,
): Promise<{ id: string; title: string; total: number }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/groups/${groupId}/duels`, {
    method: "POST",
    headers,
    body: JSON.stringify({ doc_id: docId, title: title ?? "", num_questions: numQuestions }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "No se pudo crear el duelo");
  }
  return res.json();
}

export async function getDuel(duelId: string): Promise<DuelPlay> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/duels/${duelId}`, { headers });
  if (!res.ok) throw new Error("Duelo no encontrado");
  return res.json();
}

export async function submitDuel(duelId: string, answers: string[]): Promise<DuelSubmitResult> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/duels/${duelId}/submit`, {
    method: "POST",
    headers,
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "No se pudo enviar el duelo");
  }
  return res.json();
}

export async function getDuelResults(duelId: string): Promise<DuelResults> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/duels/${duelId}/results`, { headers });
  if (!res.ok) throw new Error("Error cargando los resultados");
  return res.json();
}

// ─── Sesión guiada ────────────────────────────────────────────────────────────

export interface SessionBlock {
  type: "review" | "quiz" | "oral" | "study";
  doc_id: string;
  doc_title: string;
  detail: string;
  est_minutes: number;
}

export interface SessionPlan {
  minutes: number;
  subject: string | null;
  blocks: SessionBlock[];
  readiness_before: number;
}

export async function getSessionPlan(minutes: number, subject?: string): Promise<SessionPlan> {
  const headers = await authHeaders();
  const qs = new URLSearchParams({ minutes: String(minutes) });
  if (subject) qs.set("subject", subject);
  const res = await fetch(`${API_URL}/progress/session-plan?${qs}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "No se pudo armar la sesión");
  }
  return res.json();
}
