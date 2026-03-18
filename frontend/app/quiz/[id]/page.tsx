"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getDocument, saveQuizResult, Document, ExamQuestion, QuizAnswer as ApiQuizAnswer } from "@/lib/api";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Trophy,
  RotateCcw,
  BookOpen,
  Target,
  Flame,
  Star,
} from "lucide-react";

type Phase = "intro" | "quiz" | "results";
type AnswerState = "idle" | "correct" | "wrong" | "revealed"; // revealed = open question

interface QuizAnswer {
  question: string;
  chosen: string | null;
  correct_answer: string;
  explanation: string;
  isCorrect: boolean;
}

export default function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("intro");

  // Quiz state
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>("idle");
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDocument(id)
      .then(setDoc)
      .finally(() => setLoading(false));
  }, [id]);

  function startQuiz() {
    if (!doc?.exam_questions?.length) return;
    // Shuffle questions
    const shuffled = [...doc.exam_questions].sort(() => Math.random() - 0.5);
    setQuestions(shuffled);
    setCurrent(0);
    setSelected(null);
    setAnswerState("idle");
    setAnswers([]);
    setPhase("quiz");
  }

  function handleSelect(option: string) {
    if (answerState !== "idle") return;
    const q = questions[current];
    setSelected(option);

    // Normalize for comparison
    const normalize = (s: string) => s.trim().toLowerCase();
    const isMatch =
      normalize(option) === normalize(q.correct_answer) ||
      q.correct_answer.toLowerCase().includes(normalize(option)) ||
      normalize(option).includes(normalize(q.correct_answer));

    setAnswerState(isMatch ? "correct" : "wrong");
  }

  function handleRevealOpen() {
    if (answerState !== "idle") return;
    setAnswerState("revealed");
  }

  async function finishQuiz(finalAnswers: QuizAnswer[]) {
    setSaving(true);
    try {
      const correctCount = finalAnswers.filter((a) => a.isCorrect).length;
      const apiAnswers: ApiQuizAnswer[] = finalAnswers.map((a) => ({
        question: a.question,
        chosen: a.chosen,
        correct_answer: a.correct_answer,
        explanation: a.explanation,
        is_correct: a.isCorrect,
      }));
      await saveQuizResult(id, correctCount, finalAnswers.length, apiAnswers);
    } catch (e) {
      console.error("No se pudo guardar el resultado:", e);
    } finally {
      setSaving(false);
      setPhase("results");
    }
  }

  function handleNext() {
    const q = questions[current];
    const isCorrect = answerState === "correct" || answerState === "revealed";

    const newAnswer: QuizAnswer = {
      question: q.question,
      chosen: selected,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      isCorrect,
    };
    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);

    if (current + 1 >= questions.length) {
      finishQuiz(updatedAnswers);
    } else {
      setCurrent((c) => c + 1);
      setSelected(null);
      setAnswerState("idle");
    }
  }

  // ── Score calc ──────────────────────────────────────────────────────────────
  const scoreCount = answers.filter((a) => a.isCorrect).length;
  const total = answers.length;
  const pct = total > 0 ? Math.round((scoreCount / total) * 100) : 0;

  function getScoreLabel() {
    if (pct >= 90) return { label: "¡Excelente!", color: "text-emerald-400", icon: <Trophy size={32} className="text-emerald-400" /> };
    if (pct >= 70) return { label: "¡Muy bien!", color: "text-violet-400", icon: <Star size={32} className="text-violet-400" /> };
    if (pct >= 50) return { label: "Bien, seguí practicando", color: "text-amber-400", icon: <Flame size={32} className="text-amber-400" /> };
    return { label: "Repasá el material", color: "text-red-400", icon: <BookOpen size={32} className="text-red-400" /> };
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading)
    return (
      <div className="min-h-screen bg-[#0f0f13] flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );

  if (!doc)
    return (
      <div className="min-h-screen bg-[#0f0f13] flex items-center justify-center text-gray-500">
        Documento no encontrado
      </div>
    );

  const q = questions[current];
  const isOpen = q?.options?.length === 0;
  const progress = questions.length > 0 ? ((current) / questions.length) * 100 : 0;

  // ── INTRO ───────────────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <main className="min-h-screen bg-[#0f0f13] flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <Link
            href={`/study/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-10"
          >
            <ArrowLeft size={14} /> Volver al material
          </Link>

          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-6">
            <Target size={28} className="text-violet-400" />
          </div>

          <h1 className="text-3xl font-bold mb-3">Modo Quiz</h1>
          <p className="text-gray-400 mb-2 leading-relaxed">
            Ponete a prueba con las preguntas generadas de{" "}
            <span className="text-white font-medium">{doc.title}</span>.
          </p>
          <p className="text-sm text-gray-600 mb-10">
            {doc.exam_questions?.length || 0} preguntas · orden aleatorio
          </p>

          {(!doc.exam_questions || doc.exam_questions.length === 0) ? (
            <p className="text-red-400 text-sm">Este documento no tiene preguntas de examen.</p>
          ) : (
            <button
              onClick={startQuiz}
              className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 font-semibold text-white transition-all shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2"
            >
              <Target size={18} /> Empezar Quiz
            </button>
          )}
        </div>
      </main>
    );
  }

  // ── RESULTS ─────────────────────────────────────────────────────────────────
  if (phase === "results" || saving) {
    if (saving) return (
      <div className="min-h-screen bg-[#0f0f13] flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        <p className="text-sm text-gray-500">Guardando resultado...</p>
      </div>
    );
    const { label, color, icon } = getScoreLabel();
    return (
      <main className="min-h-screen bg-[#0f0f13] px-6 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Score card */}
          <div className="rounded-3xl border border-white/5 bg-white/[0.03] p-8 text-center mb-8">
            <div className="flex justify-center mb-4">{icon}</div>
            <h2 className={`text-2xl font-bold mb-1 ${color}`}>{label}</h2>
            <p className="text-gray-500 mb-6 text-sm">{doc.title}</p>

            <div className="flex items-center justify-center gap-8 mb-6">
              <div className="text-center">
                <p className="text-4xl font-bold text-white">{pct}%</p>
                <p className="text-xs text-gray-500 mt-1">Puntuación</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-emerald-400">{scoreCount}</p>
                <p className="text-xs text-gray-500 mt-1">Correctas</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-red-400">{total - scoreCount}</p>
                <p className="text-xs text-gray-500 mt-1">Incorrectas</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mb-10">
            <button
              onClick={startQuiz}
              className="flex-1 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 font-medium text-white transition-all shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2"
            >
              <RotateCcw size={16} /> Repetir Quiz
            </button>
            <Link
              href={`/study/${id}`}
              className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 font-medium text-white transition-all flex items-center justify-center gap-2"
            >
              <BookOpen size={16} /> Ver material
            </Link>
          </div>

          {/* Answer review */}
          <h3 className="text-lg font-semibold mb-4 text-gray-300">Revisión de respuestas</h3>
          <div className="grid gap-3">
            {answers.map((a, i) => (
              <div
                key={i}
                className={`rounded-2xl border p-5 ${
                  a.isCorrect
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-red-500/20 bg-red-500/5"
                }`}
              >
                <div className="flex items-start gap-3">
                  {a.isCorrect ? (
                    <CheckCircle2 size={18} className="text-emerald-400 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle size={18} className="text-red-400 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm mb-2">{a.question}</p>
                    {!a.isCorrect && a.chosen && (
                      <p className="text-xs text-red-400 mb-1">
                        Tu respuesta: <span className="font-medium">{a.chosen}</span>
                      </p>
                    )}
                    <p className="text-xs text-emerald-400 mb-2">
                      Respuesta correcta: <span className="font-medium">{a.correct_answer}</span>
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed">{a.explanation}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ── QUIZ ────────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#0f0f13] flex flex-col">
      {/* Top bar */}
      <div className="border-b border-white/5 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link
            href={`/study/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ArrowLeft size={14} /> Salir
          </Link>
          <span className="text-sm text-gray-500 font-medium">
            {current + 1} / {questions.length}
          </span>
        </div>
        {/* Progress bar */}
        <div className="max-w-2xl mx-auto mt-3 h-1 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-violet-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question area */}
      <div className="flex-1 flex items-start justify-center px-6 py-10">
        <div className="max-w-2xl w-full">
          {/* Question */}
          <div className="mb-8">
            <span className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-4 block">
              Pregunta {current + 1}
            </span>
            <h2 className="text-xl font-semibold text-white leading-snug">{q.question}</h2>
          </div>

          {/* Multiple choice */}
          {!isOpen && (
            <div className="grid gap-3 mb-6">
              {q.options.map((opt, j) => {
                const isSelected = selected === opt;
                const normalize = (s: string) => s.trim().toLowerCase();
                const isCorrectOpt =
                  normalize(opt) === normalize(q.correct_answer) ||
                  q.correct_answer.toLowerCase().includes(normalize(opt)) ||
                  normalize(opt).includes(normalize(q.correct_answer));

                let style =
                  "border border-white/8 bg-white/[0.03] text-gray-300 hover:bg-white/8 hover:border-white/15 hover:text-white";
                if (answerState !== "idle") {
                  if (isCorrectOpt) {
                    style = "border border-emerald-500/50 bg-emerald-500/10 text-emerald-300";
                  } else if (isSelected) {
                    style = "border border-red-500/50 bg-red-500/10 text-red-300";
                  } else {
                    style = "border border-white/5 bg-white/[0.02] text-gray-600 opacity-60";
                  }
                }

                return (
                  <button
                    key={j}
                    onClick={() => handleSelect(opt)}
                    disabled={answerState !== "idle"}
                    className={`w-full text-left rounded-2xl px-5 py-4 transition-all duration-200 flex items-center gap-3 ${style}`}
                  >
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                        answerState !== "idle" && isCorrectOpt
                          ? "bg-emerald-500 text-white"
                          : answerState !== "idle" && isSelected
                          ? "bg-red-500 text-white"
                          : "bg-white/5 text-gray-500"
                      }`}
                    >
                      {String.fromCharCode(65 + j)}
                    </span>
                    <span className="font-medium text-sm leading-snug">{opt}</span>
                    {answerState !== "idle" && isCorrectOpt && (
                      <CheckCircle2 size={16} className="ml-auto text-emerald-400 shrink-0" />
                    )}
                    {answerState !== "idle" && isSelected && !isCorrectOpt && (
                      <XCircle size={16} className="ml-auto text-red-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Open question */}
          {isOpen && (
            <div className="mb-6">
              {answerState === "idle" ? (
                <button
                  onClick={handleRevealOpen}
                  className="w-full py-4 rounded-2xl border border-dashed border-white/15 text-gray-500 hover:text-white hover:border-white/30 transition-all text-sm font-medium"
                >
                  Ver respuesta →
                </button>
              ) : (
                <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6">
                  <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-3">
                    Respuesta correcta
                  </p>
                  <p className="text-white font-medium mb-3">{q.correct_answer}</p>
                  <p className="text-sm text-gray-400 leading-relaxed">{q.explanation}</p>
                </div>
              )}
            </div>
          )}

          {/* Feedback + explanation (MC) */}
          {answerState !== "idle" && !isOpen && (
            <div
              className={`rounded-2xl p-5 mb-6 ${
                answerState === "correct"
                  ? "bg-emerald-500/10 border border-emerald-500/20"
                  : "bg-red-500/10 border border-red-500/20"
              }`}
            >
              <p
                className={`text-sm font-semibold flex items-center gap-2 mb-2 ${
                  answerState === "correct" ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {answerState === "correct" ? (
                  <><CheckCircle2 size={16} /> ¡Correcto!</>
                ) : (
                  <><XCircle size={16} /> Incorrecto</>
                )}
              </p>
              <p className="text-sm text-gray-400 leading-relaxed">{q.explanation}</p>
            </div>
          )}

          {/* Open question self-eval */}
          {answerState === "revealed" && isOpen && (
            <div className="flex gap-3 mb-6">
              <p className="text-sm text-gray-500 self-center">¿Lo sabías?</p>
              <button
                onClick={() => {
                  const curr = questions[current];
                  const newAnswer: QuizAnswer = { question: curr.question, chosen: null, correct_answer: curr.correct_answer, explanation: curr.explanation, isCorrect: true };
                  const updatedAnswers = [...answers, newAnswer];
                  setAnswers(updatedAnswers);
                  if (current + 1 >= questions.length) {
                    finishQuiz(updatedAnswers);
                  } else {
                    setCurrent((c) => c + 1);
                    setSelected(null);
                    setAnswerState("idle");
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-all"
              >
                ✓ Sí, lo sabía
              </button>
              <button
                onClick={() => {
                  const curr = questions[current];
                  const newAnswer: QuizAnswer = { question: curr.question, chosen: null, correct_answer: curr.correct_answer, explanation: curr.explanation, isCorrect: false };
                  const updatedAnswers = [...answers, newAnswer];
                  setAnswers(updatedAnswers);
                  if (current + 1 >= questions.length) {
                    finishQuiz(updatedAnswers);
                  } else {
                    setCurrent((c) => c + 1);
                    setSelected(null);
                    setAnswerState("idle");
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all"
              >
                ✗ No lo sabía
              </button>
            </div>
          )}

          {/* Next button (MC and after feedback) */}
          {answerState !== "idle" && !isOpen && (
            <button
              onClick={handleNext}
              className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 font-semibold text-white transition-all shadow-lg shadow-violet-600/25 flex items-center justify-center gap-2"
            >
              {current + 1 >= questions.length ? (
                <>Ver resultados <Trophy size={16} /></>
              ) : (
                <>Siguiente <ChevronRight size={16} /></>
              )}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
