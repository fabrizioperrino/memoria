"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getDocument, getQuizHistory, Document, QuizResult } from "@/lib/api";
import Link from "next/link";
import { ArrowLeft, RotateCcw, CheckCircle2, ChevronRight, BookOpen, Layers, Key, FileText, MessageSquare, Target, TrendingUp, AlertCircle, Brain, Siren, GraduationCap } from "lucide-react";

type Tab = "summary" | "flashcards" | "exam" | "concepts";

const POLL_INTERVAL_MS = 3000;

export default function StudyPage() {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("summary");
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [quizHistory, setQuizHistory] = useState<QuizResult[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getDocument(id)
      .then((d) => {
        setDoc(d);
        if (d.status === "processing") startPolling();
        else getQuizHistory(id).then(setQuizHistory).catch(() => {});
      })
      .finally(() => setLoading(false));

    return () => stopPolling();
  }, [id]);

  function startPolling() {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const fresh = await getDocument(id);
        setDoc(fresh);
        if (fresh.status !== "processing") {
          stopPolling();
          if (fresh.status === "ready") {
            getQuizHistory(id).then(setQuizHistory).catch(() => {});
          }
        }
      } catch {
        stopPolling();
      }
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

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

  // ── Estado: procesando ───────────────────────────────────────────────────────
  if (doc.status === "processing") return (
    <main className="min-h-screen bg-[#0f0f13] flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-10">
          <ArrowLeft size={14} /> Volver al inicio
        </Link>
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-6">
          <div className="w-6 h-6 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
        </div>
        <h2 className="text-xl font-bold mb-2">{doc.title}</h2>
        <p className="text-gray-400 text-sm mb-1">La IA está generando tu material de estudio.</p>
        <p className="text-gray-600 text-xs">Esto puede tardar entre 20 y 60 segundos según el tamaño del documento.</p>
      </div>
    </main>
  );

  // ── Estado: error ────────────────────────────────────────────────────────────
  if (doc.status === "error") return (
    <main className="min-h-screen bg-[#0f0f13] flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-10">
          <ArrowLeft size={14} /> Volver al inicio
        </Link>
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={28} className="text-red-400" />
        </div>
        <h2 className="text-xl font-bold mb-2">No se pudo procesar</h2>
        <p className="text-gray-400 text-sm">Hubo un error al generar el material. Intentá subir el documento de nuevo.</p>
      </div>
    </main>
  );

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "summary", label: "Resumen", icon: <FileText size={15} /> },
    { id: "flashcards", label: "Flashcards", icon: <Layers size={15} />, count: doc.flashcards?.length },
    { id: "exam", label: "Examen", icon: <BookOpen size={15} />, count: doc.exam_questions?.length },
    { id: "concepts", label: "Conceptos", icon: <Key size={15} />, count: doc.key_concepts?.length },
  ];

  return (
    <main className="min-h-screen bg-[#0f0f13]">
      <div className="max-w-4xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-3">
            <ArrowLeft size={14} /> Volver
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-5">{doc.title}</h1>

          {/* Acciones */}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/review/${id}`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-medium transition-all shadow-lg shadow-violet-600/20 active:scale-[0.98]"
            >
              <RotateCcw size={15} /> Repasar
            </Link>
            <Link
              href={`/quiz/${id}`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-medium transition-all active:scale-[0.98]"
            >
              <Target size={15} /> Quiz
            </Link>
            <Link
              href={`/oral/${id}`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-medium transition-all active:scale-[0.98]"
              title="Simulacro de final oral: respondé hablando"
            >
              <GraduationCap size={15} /> Oral
            </Link>
            <Link
              href={`/exam/${id}`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-medium transition-all active:scale-[0.98]"
            >
              <Brain size={15} /> Examen IA
            </Link>
            <Link
              href={`/chat/${id}`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-medium transition-all active:scale-[0.98]"
            >
              <MessageSquare size={15} /> Chat
            </Link>
            <Link
              href={`/cram/${id}`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 hover:bg-red-500/20 text-sm font-medium transition-all active:scale-[0.98]"
              title="Repaso intensivo de última hora: lo que más te cuesta"
            >
              <Siren size={15} /> Rindo mañana
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/5 mb-8 w-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${tab === t.id ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              {t.icon}
              {t.label}
              {t.count !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-md ${tab === t.id ? "bg-white/10 text-gray-300" : "bg-white/5 text-gray-600"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* RESUMEN */}
        {tab === "summary" && (
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-8">
            <p className="text-gray-300 leading-relaxed whitespace-pre-wrap text-[15px]">{doc.summary}</p>
          </div>
        )}

        {/* FLASHCARDS */}
        {tab === "flashcards" && (
          <div className="grid gap-4 md:grid-cols-2">
            {doc.flashcards?.map((fc, i) => (
              <div
                key={i}
                onClick={() => setFlipped((p) => ({ ...p, [i]: !p[i] }))}
                style={{ perspective: "1000px" }}
                className="cursor-pointer h-44"
              >
                <div
                  className="relative w-full h-full transition-transform duration-500"
                  style={{
                    transformStyle: "preserve-3d",
                    transform: flipped[i] ? "rotateY(180deg)" : "rotateY(0deg)",
                  }}
                >
                  {/* Front */}
                  <div
                    className="absolute inset-0 rounded-2xl border border-white/5 bg-white/[0.03] p-6 flex flex-col justify-between"
                    style={{ backfaceVisibility: "hidden" }}
                  >
                    <span className="text-xs font-medium text-violet-400 uppercase tracking-wider">Pregunta</span>
                    <p className="text-white font-medium leading-snug">{fc.question}</p>
                    <span className="text-xs text-gray-600">Tocá para ver la respuesta →</span>
                  </div>
                  {/* Back */}
                  <div
                    className="absolute inset-0 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6 flex flex-col justify-between"
                    style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                  >
                    <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Respuesta</span>
                    <p className="text-white leading-snug">{fc.answer}</p>
                    <span className="text-xs text-gray-600">Tocá para volver →</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PREGUNTAS DE EXAMEN */}
        {tab === "exam" && (
          <div className="grid gap-4">
            {doc.exam_questions?.map((q, i) => (
              <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.03] p-6">
                <p className="font-semibold text-white mb-4">
                  <span className="text-violet-400 mr-2">{i + 1}.</span>{q.question}
                </p>
                {q.options.length > 0 && (
                  <ul className="space-y-2 mb-4">
                    {q.options.map((opt, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-gray-400">
                        <span className="text-gray-600 mt-0.5">{String.fromCharCode(65 + j)}.</span>
                        {opt}
                      </li>
                    ))}
                  </ul>
                )}
                {revealed[i] ? (
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
                    <p className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5 mb-1">
                      <CheckCircle2 size={14} /> {q.correct_answer}
                    </p>
                    <p className="text-sm text-gray-400">{q.explanation}</p>
                  </div>
                ) : (
                  <button
                    onClick={() => setRevealed((p) => ({ ...p, [i]: true }))}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors"
                  >
                    Ver respuesta <ChevronRight size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* CONCEPTOS CLAVE */}
        {tab === "concepts" && (
          <div className="grid gap-3 md:grid-cols-2">
            {doc.key_concepts?.map((kc, i) => (
              <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
                <p className="font-semibold text-violet-300 mb-2">{kc.concept}</p>
                <p className="text-sm text-gray-400 leading-relaxed">{kc.definition}</p>
              </div>
            ))}
          </div>
        )}

        {/* HISTORIAL DE QUIZ */}
        {quizHistory.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-violet-400" />
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Historial de Quiz</h3>
            </div>
            <div className="grid gap-2">
              {quizHistory.map((r, i) => {
                const date = new Date(r.created_at);
                const label = date.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
                const time = date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
                const pctColor = r.percentage >= 70 ? "text-emerald-400" : r.percentage >= 50 ? "text-amber-400" : "text-red-400";
                const barColor = r.percentage >= 70 ? "bg-emerald-500" : r.percentage >= 50 ? "bg-amber-500" : "bg-red-500";
                return (
                  <div key={r.id} className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                    <span className="text-xs text-gray-600 w-5 text-right shrink-0">#{quizHistory.length - i}</span>
                    <div className="flex-1 min-w-0">
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${r.percentage}%` }} />
                      </div>
                    </div>
                    <span className={`text-sm font-bold w-10 text-right shrink-0 ${pctColor}`}>{r.percentage}%</span>
                    <span className="text-xs text-gray-600 shrink-0">{r.score}/{r.total}</span>
                    <span className="text-xs text-gray-700 shrink-0 hidden sm:block">{label} {time}</span>
                  </div>
                );
              })}
            </div>
            {/* Trend */}
            {quizHistory.length >= 2 && (() => {
              const latest = quizHistory[0].percentage;
              const prev = quizHistory[1].percentage;
              const diff = latest - prev;
              return (
                <p className={`text-xs mt-3 ${diff >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {diff >= 0 ? `↑ Mejoraste ${diff}% respecto al intento anterior` : `↓ Bajaste ${Math.abs(diff)}% respecto al intento anterior`}
                </p>
              );
            })()}
          </div>
        )}
      </div>
    </main>
  );
}
