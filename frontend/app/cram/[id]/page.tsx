"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getDocument,
  getQuizHistory,
  Document,
  ExamQuestion,
  Flashcard,
  QuizResult,
} from "@/lib/api";
import { toast, Toaster } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Key,
  Layers,
  ListChecks,
  Loader2,
  RotateCcw,
  Siren,
  X,
} from "lucide-react";

type Phase = "intro" | "cards" | "concepts" | "quiz" | "done";

const MAX_CARDS = 10;
const MAX_QUIZ = 6;

/** Peores cartas primero: menor ease_factor (más difíciles), menos repasadas */
function worstCards(cards: Flashcard[]): Flashcard[] {
  return [...cards]
    .sort((a, b) => {
      const ea = a.ease_factor ?? 2.5;
      const eb = b.ease_factor ?? 2.5;
      if (ea !== eb) return ea - eb;
      return (a.repetitions ?? 0) - (b.repetitions ?? 0);
    })
    .slice(0, MAX_CARDS);
}

/** Preguntas antes falladas (dedupe), completadas con preguntas al azar si faltan */
function failedQuestions(doc: Document, history: QuizResult[]): ExamQuestion[] {
  const all = doc.exam_questions ?? [];
  const failedTexts = new Set<string>();
  for (const result of history) {
    for (const a of result.answers ?? []) {
      if (!a.is_correct) failedTexts.add(a.question.trim());
    }
  }
  const failed = all.filter((q) => failedTexts.has(q.question.trim()));
  const rest = all.filter((q) => !failedTexts.has(q.question.trim()));
  // Falladas primero; si no alcanzan, rellenar al azar
  const shuffledRest = [...rest].sort(() => Math.random() - 0.5);
  return [...failed, ...shuffledRest].slice(0, MAX_QUIZ);
}

export default function CramPage() {
  const params = useParams<{ id: string }>();
  const [doc, setDoc] = useState<Document | null>(null);
  const [history, setHistory] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("intro");

  // Fase cartas
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // Fase quiz
  const [quizIdx, setQuizIdx] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);

  useEffect(() => {
    if (!params.id) return;
    Promise.all([
      getDocument(params.id),
      getQuizHistory(params.id).catch(() => []),
    ])
      .then(([d, h]) => {
        setDoc(d);
        setHistory(h);
      })
      .catch(() => toast.error("No se pudo cargar el documento"))
      .finally(() => setLoading(false));
  }, [params.id]);

  const cards = useMemo(() => (doc ? worstCards(doc.flashcards ?? []) : []), [doc]);
  const questions = useMemo(() => (doc ? failedQuestions(doc, history) : []), [doc, history]);
  const failedCount = useMemo(() => {
    const s = new Set<string>();
    history.forEach((r) => (r.answers ?? []).forEach((a) => !a.is_correct && s.add(a.question)));
    return s.size;
  }, [history]);

  if (loading) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="animate-spin text-violet-500" size={28} />
      </main>
    );
  }

  if (!doc || (cards.length === 0 && questions.length === 0)) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-gray-500">Este documento todavía no tiene material para repasar.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-violet-400 hover:text-violet-300">
          Volver al dashboard
        </Link>
      </main>
    );
  }

  const concepts = doc.key_concepts ?? [];

  function nextCard() {
    setFlipped(false);
    if (cardIdx + 1 < cards.length) {
      setCardIdx((i) => i + 1);
    } else {
      setPhase(concepts.length > 0 ? "concepts" : questions.length > 0 ? "quiz" : "done");
    }
  }

  function answer(option: string) {
    if (chosen) return;
    setChosen(option);
    const q = questions[quizIdx];
    if (option.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()) {
      setCorrect((c) => c + 1);
    }
  }

  function nextQuestion() {
    setChosen(null);
    if (quizIdx + 1 < questions.length) {
      setQuizIdx((i) => i + 1);
    } else {
      setPhase("done");
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Toaster theme="dark" position="top-center" />

      <div className="mb-6 flex items-center justify-between">
        <Link
          href={`/study/${doc.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-white"
        >
          <ArrowLeft size={15} />
          {doc.title}
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">
          <Siren size={12} />
          Modo intensivo
        </span>
      </div>

      {/* ── Intro ── */}
      {phase === "intro" && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
            <Siren className="text-red-400" size={26} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">¿Rendís mañana?</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-400">
            Sesión de triage con lo que más te cuesta de este documento. No toca tu
            calendario de repaso — es un refuerzo de última hora.
          </p>

          <div className="mx-auto mt-6 max-w-sm space-y-2 text-left">
            {[
              { icon: Layers, label: `${cards.length} ${cards.length === 1 ? "carta" : "cartas"} — las que más te cuestan` },
              ...(concepts.length ? [{ icon: Key, label: `${concepts.length} ${concepts.length === 1 ? "concepto clave" : "conceptos clave"}, de una pasada` }] : []),
              ...(questions.length ? [{ icon: ListChecks, label: failedCount > 0 ? `${questions.length} preguntas — priorizando las que fallaste` : `${questions.length} preguntas de repaso` }] : []),
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
                <s.icon size={16} className="shrink-0 text-violet-400" />
                <span className="text-sm text-gray-300">{s.label}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setPhase(cards.length > 0 ? "cards" : "quiz")}
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-red-600 px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-red-600/25 transition-all hover:bg-red-500 active:scale-[0.98]"
          >
            Empezar el repaso
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* ── Cartas ── */}
      {phase === "cards" && (
        <div>
          <div className="mb-4 flex items-center justify-between text-xs text-gray-500">
            <span>Carta {cardIdx + 1} de {cards.length}</span>
            <span>Las que más te cuestan primero</span>
          </div>
          <div className="mb-4 h-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-red-500 transition-all"
              style={{ width: `${((cardIdx + (flipped ? 1 : 0.5)) / cards.length) * 100}%` }}
            />
          </div>

          <button
            onClick={() => setFlipped((f) => !f)}
            className="flex min-h-[260px] w-full flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#16161c] p-8 text-center transition-colors hover:border-white/20"
          >
            <span className="mb-4 text-[11px] font-medium uppercase tracking-widest text-gray-600">
              {flipped ? "Respuesta" : "Pregunta"}
            </span>
            <p className={`leading-relaxed ${flipped ? "text-gray-200" : "text-xl font-semibold text-white"}`}>
              {flipped ? cards[cardIdx].answer : cards[cardIdx].question}
            </p>
            {!flipped && (
              <span className="mt-6 flex items-center gap-1.5 text-xs text-gray-600">
                <RotateCcw size={12} />
                Tocá para ver la respuesta
              </span>
            )}
          </button>

          {flipped && (
            <button
              onClick={nextCard}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition-all hover:bg-violet-500 active:scale-[0.99]"
            >
              Siguiente
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      )}

      {/* ── Conceptos ── */}
      {phase === "concepts" && (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Key size={15} className="text-violet-400" />
            <h2 className="text-sm font-semibold">Conceptos clave — una pasada rápida</h2>
          </div>
          <div className="space-y-2.5">
            {concepts.map((c, i) => (
              <div key={i} className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3.5">
                <p className="text-sm font-semibold text-violet-300">{c.concept}</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-400">{c.definition}</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => setPhase(questions.length > 0 ? "quiz" : "done")}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition-all hover:bg-violet-500 active:scale-[0.99]"
          >
            {questions.length > 0 ? "Ir al quiz final" : "Terminar"}
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ── Quiz ── */}
      {phase === "quiz" && questions.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between text-xs text-gray-500">
            <span>Pregunta {quizIdx + 1} de {questions.length}</span>
            <span>{correct} correctas</span>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
            <p className="text-base font-semibold leading-relaxed">{questions[quizIdx].question}</p>
            <div className="mt-5 space-y-2">
              {questions[quizIdx].options.map((opt) => {
                const isCorrect = opt.trim().toLowerCase() === questions[quizIdx].correct_answer.trim().toLowerCase();
                const isChosen = chosen === opt;
                let cls = "border-white/10 bg-white/[0.02] hover:border-white/25";
                if (chosen) {
                  if (isCorrect) cls = "border-emerald-500/50 bg-emerald-500/10";
                  else if (isChosen) cls = "border-red-500/50 bg-red-500/10";
                  else cls = "border-white/5 bg-white/[0.01] opacity-50";
                }
                return (
                  <button
                    key={opt}
                    onClick={() => answer(opt)}
                    disabled={!!chosen}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${cls}`}
                  >
                    <span>{opt}</span>
                    {chosen && isCorrect && <Check size={15} className="shrink-0 text-emerald-400" />}
                    {chosen && isChosen && !isCorrect && <X size={15} className="shrink-0 text-red-400" />}
                  </button>
                );
              })}
            </div>
            {chosen && questions[quizIdx].explanation && (
              <p className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-xs leading-relaxed text-gray-400">
                {questions[quizIdx].explanation}
              </p>
            )}
          </div>
          {chosen && (
            <button
              onClick={nextQuestion}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition-all hover:bg-violet-500 active:scale-[0.99]"
            >
              {quizIdx + 1 < questions.length ? "Siguiente" : "Ver resultado"}
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      )}

      {/* ── Fin ── */}
      {phase === "done" && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
            <Check className="text-emerald-400" size={26} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Repaso intensivo completo</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-400">
            Pasaste por {cards.length > 0 ? `${cards.length} cartas difíciles` : ""}
            {cards.length > 0 && questions.length > 0 ? " y " : ""}
            {questions.length > 0 ? `${questions.length} preguntas (${correct} correctas)` : ""}.
            Ahora descansá: dormir consolida lo que repasaste.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/progreso"
              className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-violet-500"
            >
              Ver mi preparación
            </Link>
            <button
              onClick={() => {
                setPhase("intro");
                setCardIdx(0);
                setQuizIdx(0);
                setChosen(null);
                setCorrect(0);
                setFlipped(false);
              }}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3 text-sm text-gray-300 transition-colors hover:border-white/20"
            >
              Repetir
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
