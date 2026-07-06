"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getDocument, evaluateAnswer, AnswerEvaluation, ExamQuestion, Document } from "@/lib/api";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ChevronRight, Brain, MessageSquare } from "lucide-react";

type Phase = "intro" | "exam" | "results";

interface QuestionResult {
  question: ExamQuestion;
  studentAnswer: string;
  evaluation: AnswerEvaluation;
  followUpAnswers: { question: string; answer: string; evaluation: AnswerEvaluation | null }[];
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8 ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" :
    score >= 6 ? "bg-violet-500/15 text-violet-300 border-violet-500/30" :
    score >= 4 ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                 "bg-red-500/15 text-red-400 border-red-500/30";
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-bold ${color}`}>
      {score}/10
    </div>
  );
}

function FollowUpBlock({
  question,
  docId,
  onDone,
}: {
  question: string;
  docId: string;
  onDone: (answer: string, evaluation: AnswerEvaluation) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<AnswerEvaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEvaluate() {
    if (!answer.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const ev = await evaluateAnswer(docId, question, answer);
      setEvaluation(ev);
      onDone(answer, ev);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo evaluar. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
      <p className="text-sm font-medium text-violet-300 mb-3 flex items-center gap-2">
        <MessageSquare size={14} className="shrink-0" /> {question}
      </p>
      {!evaluation ? (
        <>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Respondé esta pregunta de seguimiento..."
            rows={3}
            disabled={loading}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500/60 transition-all resize-none disabled:opacity-50"
          />
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <button
              onClick={handleEvaluate}
              disabled={!answer.trim() || loading}
              className="px-4 py-2 rounded-lg bg-violet-600/80 hover:bg-violet-600 text-sm font-medium transition-all disabled:opacity-40 flex items-center gap-2"
            >
              {loading
                ? <><div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Evaluando...</>
                : error ? "Reintentar" : "Evaluar"
              }
            </button>
            {error && <span className="text-xs text-red-400">{error}</span>}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-400 italic">"{answer}"</p>
          <div className="flex items-center gap-3">
            <ScoreBadge score={evaluation.score} />
            <p className="text-sm text-gray-300">{evaluation.feedback}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExamPage() {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("intro");

  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [currentEval, setCurrentEval] = useState<AnswerEvaluation | null>(null);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [followUpsDone, setFollowUpsDone] = useState<Record<number, boolean>>({});

  useEffect(() => {
    getDocument(id).then(setDoc).finally(() => setLoading(false));
  }, [id]);

  function startExam() {
    if (!doc?.exam_questions?.length) return;
    const openOnly = doc.exam_questions.filter((q) => q.options.length === 0 || q.correct_answer.length > 40);
    const pool = openOnly.length >= 3 ? openOnly : doc.exam_questions;
    setQuestions(pool);
    setCurrentIdx(0);
    setAnswer("");
    setCurrentEval(null);
    setResults([]);
    setFollowUpsDone({});
    setPhase("exam");
  }

  async function handleEvaluate() {
    if (!answer.trim() || evaluating) return;
    setEvaluating(true);
    const q = questions[currentIdx];
    try {
      const ev = await evaluateAnswer(id, q.question, answer, q.correct_answer);
      setCurrentEval(ev);
    } catch {
      // ignore
    } finally {
      setEvaluating(false);
    }
  }

  function handleNext() {
    if (!currentEval) return;
    const q = questions[currentIdx];
    const result: QuestionResult = {
      question: q,
      studentAnswer: answer,
      evaluation: currentEval,
      followUpAnswers: [],
    };
    const newResults = [...results, result];
    setResults(newResults);

    if (currentIdx + 1 >= questions.length) {
      setPhase("results");
    } else {
      setCurrentIdx((i) => i + 1);
      setAnswer("");
      setCurrentEval(null);
    }
  }

  function handleFollowUpDone(
    resultIdx: number,
    fuQuestion: string,
    fuAnswer: string,
    fuEval: AnswerEvaluation
  ) {
    setResults((prev) => {
      const updated = [...prev];
      updated[resultIdx] = {
        ...updated[resultIdx],
        followUpAnswers: [
          ...updated[resultIdx].followUpAnswers,
          { question: fuQuestion, answer: fuAnswer, evaluation: fuEval },
        ],
      };
      return updated;
    });
  }

  // ── Loading / not found ─────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#0f0f13] flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
    </div>
  );
  if (!doc) return (
    <div className="min-h-screen bg-[#0f0f13] flex items-center justify-center text-gray-500">
      Documento no encontrado
    </div>
  );

  const q = questions[currentIdx];
  const progress = questions.length > 0 ? ((currentIdx) / questions.length) * 100 : 0;
  const avgScore = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.evaluation.score, 0) / results.length * 10) / 10
    : 0;

  // ── INTRO ───────────────────────────────────────────────────────────────────
  if (phase === "intro") return (
    <main className="min-h-screen bg-[#0f0f13] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <Link href={`/study/${id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-10">
          <ArrowLeft size={14} /> Volver al material
        </Link>
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-6">
          <Brain size={28} className="text-violet-400" />
        </div>
        <h1 className="text-3xl font-bold mb-3">Examen IA</h1>
        <p className="text-gray-400 mb-2 leading-relaxed">
          Respondé preguntas abiertas de <span className="text-white font-medium">{doc.title}</span>.
          La IA evalúa tu respuesta, te da feedback y te hace preguntas de seguimiento.
        </p>
        <p className="text-sm text-gray-600 mb-10">
          {doc.exam_questions?.length || 0} preguntas disponibles
        </p>
        {(!doc.exam_questions || doc.exam_questions.length === 0) ? (
          <p className="text-red-400 text-sm">Este documento no tiene preguntas de examen.</p>
        ) : (
          <button
            onClick={startExam}
            className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 font-semibold text-white transition-all shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2"
          >
            <Brain size={18} /> Comenzar examen
          </button>
        )}
      </div>
    </main>
  );

  // ── RESULTS ─────────────────────────────────────────────────────────────────
  if (phase === "results") {
    const scoreColor =
      avgScore >= 8 ? "text-emerald-400" :
      avgScore >= 6 ? "text-violet-400" :
      avgScore >= 4 ? "text-amber-400" : "text-red-400";

    return (
      <main className="min-h-screen bg-[#0f0f13] px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-3xl border border-white/5 bg-white/[0.03] p-8 text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
              <Brain size={28} className="text-violet-400" />
            </div>
            <h2 className="text-2xl font-bold mb-1">Examen completado</h2>
            <p className="text-gray-500 text-sm mb-6">{doc.title}</p>
            <p className={`text-5xl font-bold mb-1 ${scoreColor}`}>{avgScore}</p>
            <p className="text-xs text-gray-500">Promedio / 10</p>
          </div>

          <div className="space-y-6 mb-10">
            {results.map((r, i) => (
              <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.03] p-6">
                <div className="flex items-start gap-4 mb-4">
                  <ScoreBadge score={r.evaluation.score} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white mb-1">{r.question.question}</p>
                    <p className="text-sm text-gray-500 italic">"{r.studentAnswer}"</p>
                  </div>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed mb-4 border-l-2 border-violet-500/40 pl-4">
                  {r.evaluation.feedback}
                </p>

                {r.evaluation.follow_up_questions.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Preguntas de seguimiento</p>
                    {r.evaluation.follow_up_questions.map((fq, fi) => {
                      const fuKey = i * 10 + fi;
                      const alreadyAnswered = r.followUpAnswers.find((fa) => fa.question === fq);
                      if (alreadyAnswered) {
                        return (
                          <div key={fi} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                            <p className="text-sm text-violet-300 mb-2 flex items-center gap-2">
                              <MessageSquare size={13} /> {fq}
                            </p>
                            <p className="text-sm text-gray-400 italic mb-2">"{alreadyAnswered.answer}"</p>
                            {alreadyAnswered.evaluation && (
                              <div className="flex items-center gap-3">
                                <ScoreBadge score={alreadyAnswered.evaluation.score} />
                                <p className="text-xs text-gray-400">{alreadyAnswered.evaluation.feedback}</p>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return (
                        <FollowUpBlock
                          key={`${fuKey}-${followUpsDone[fuKey]}`}
                          question={fq}
                          docId={id}
                          onDone={(ans, ev) => {
                            handleFollowUpDone(i, fq, ans, ev);
                            setFollowUpsDone((p) => ({ ...p, [fuKey]: true }));
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={startExam}
              className="flex-1 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 font-medium text-white transition-all flex items-center justify-center gap-2"
            >
              <Brain size={16} /> Repetir examen
            </button>
            <Link
              href={`/study/${id}`}
              className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 font-medium text-white transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} /> Ver material
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ── EXAM ────────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#0f0f13] flex flex-col">
      {/* Top bar */}
      <div className="border-b border-white/5 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href={`/study/${id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors">
            <ArrowLeft size={14} /> Salir
          </Link>
          <span className="text-sm text-gray-500 font-medium">{currentIdx + 1} / {questions.length}</span>
        </div>
        <div className="max-w-2xl mx-auto mt-3 h-1 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full bg-violet-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-6 py-10">
        <div className="max-w-2xl w-full">

          {/* Question */}
          <div className="mb-6">
            <span className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-4 block">
              Pregunta {currentIdx + 1}
            </span>
            <h2 className="text-xl font-semibold text-white leading-snug">{q.question}</h2>
          </div>

          {/* Answer input (before evaluation) */}
          {!currentEval && (
            <>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Escribí tu respuesta desarrollada aquí..."
                rows={6}
                disabled={evaluating}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500/60 transition-all resize-none disabled:opacity-50 mb-4"
              />
              <button
                onClick={handleEvaluate}
                disabled={!answer.trim() || evaluating}
                className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 font-semibold text-white transition-all shadow-lg shadow-violet-600/25 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {evaluating
                  ? <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Evaluando...</>
                  : <><CheckCircle2 size={16} /> Enviar respuesta</>
                }
              </button>
            </>
          )}

          {/* Evaluation result */}
          {currentEval && (
            <div className="space-y-5">
              {/* Student answer */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-xs text-gray-600 mb-1">Tu respuesta</p>
                <p className="text-sm text-gray-300">{answer}</p>
              </div>

              {/* Score + Feedback */}
              <div className={`rounded-2xl p-5 border ${
                currentEval.score >= 8 ? "bg-emerald-500/5 border-emerald-500/20" :
                currentEval.score >= 6 ? "bg-violet-500/5 border-violet-500/20" :
                currentEval.score >= 4 ? "bg-amber-500/5 border-amber-500/20" :
                                          "bg-red-500/5 border-red-500/20"
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  <ScoreBadge score={currentEval.score} />
                  <span className="text-sm font-medium text-gray-400">Calificación IA</span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">{currentEval.feedback}</p>
              </div>

              {/* Follow-up questions */}
              {currentEval.follow_up_questions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Preguntas de seguimiento
                  </p>
                  <div className="space-y-3">
                    {currentEval.follow_up_questions.map((fq, fi) => (
                      <FollowUpBlock
                        key={fi}
                        question={fq}
                        docId={id}
                        onDone={(ans, ev) =>
                          handleFollowUpDone(results.length, fq, ans, ev)
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Next button */}
              <button
                onClick={handleNext}
                className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 font-semibold text-white transition-all shadow-lg shadow-violet-600/25 flex items-center justify-center gap-2"
              >
                {currentIdx + 1 >= questions.length
                  ? <><Brain size={16} /> Ver resultado final</>
                  : <><ChevronRight size={16} /> Siguiente pregunta</>
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
