"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getDuel,
  submitDuel,
  getDuelResults,
  DuelPlay,
  DuelSubmitResult,
  DuelResults,
} from "@/lib/api";
import { toast, Toaster } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Loader2,
  Medal,
  Swords,
  Trophy,
  X,
} from "lucide-react";

type Phase = "intro" | "playing" | "result";

function RankBadge({ position }: { position: number }) {
  const styles: Record<number, string> = {
    1: "bg-amber-500/20 text-amber-400",
    2: "bg-gray-400/15 text-gray-300",
    3: "bg-orange-700/20 text-orange-400",
  };
  if (position <= 3) {
    return (
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${styles[position]}`}>
        {position === 1 ? <Trophy size={15} /> : <Medal size={15} />}
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-sm font-semibold text-gray-500">
      {position}
    </div>
  );
}

function Leaderboard({ results, meScore }: { results: DuelResults; meScore?: number | null }) {
  return (
    <div className="space-y-2">
      {results.ranking.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-600">Todavía no jugó nadie.</p>
      ) : (
        results.ranking.map((r, i) => (
          <div
            key={`${r.display_name}-${i}`}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
              r.is_you ? "border-violet-500/35 bg-violet-500/[0.07]" : "border-white/8 bg-white/[0.015]"
            }`}
          >
            <RankBadge position={i + 1} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {r.display_name}
              {r.is_you && <span className="ml-1.5 text-xs text-violet-400">(vos)</span>}
            </span>
            <span className="shrink-0 text-sm font-bold">
              {r.score}
              <span className="text-gray-600">/{r.total}</span>
            </span>
          </div>
        ))
      )}
    </div>
  );
}

export default function DuelPage() {
  const params = useParams<{ id: string }>();
  const duelId = params.id;

  const [duel, setDuel] = useState<DuelPlay | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("intro");

  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<DuelSubmitResult | null>(null);
  const [results, setResults] = useState<DuelResults | null>(null);

  useEffect(() => {
    if (!duelId) return;
    getDuel(duelId)
      .then((d) => {
        setDuel(d);
        setAnswers(new Array(d.questions.length).fill(""));
        if (d.already_played) {
          setPhase("result");
          getDuelResults(duelId).then(setResults).catch(() => {});
        }
      })
      .catch(() => toast.error("No se pudo cargar el duelo"))
      .finally(() => setLoading(false));
  }, [duelId]);

  function choose(option: string) {
    setAnswers((prev) => {
      const next = [...prev];
      next[qIndex] = option;
      return next;
    });
  }

  async function finish() {
    if (!duel) return;
    setSubmitting(true);
    try {
      const res = await submitDuel(duelId, answers);
      setResult(res);
      const lb = await getDuelResults(duelId).catch(() => null);
      setResults(lb);
      setPhase("result");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar");
      // Si ya había jugado (409), mostrar resultados igual
      const lb = await getDuelResults(duelId).catch(() => null);
      if (lb) {
        setResults(lb);
        setPhase("result");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="animate-spin text-violet-500" size={28} />
      </main>
    );
  }

  if (!duel) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-gray-500">Duelo no encontrado.</p>
        <Link href="/grupos" className="mt-4 inline-block text-sm text-violet-400 hover:text-violet-300">
          Volver a mis grupos
        </Link>
      </main>
    );
  }

  const answeredCount = answers.filter((a) => a).length;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Toaster theme="dark" position="top-center" />

      <div className="mb-6 flex items-center justify-between">
        <Link
          href={`/grupos/${duel.group_id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-white"
        >
          <ArrowLeft size={15} />
          Grupo
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
          <Swords size={12} />
          Duelo
        </span>
      </div>

      {/* ── Intro ── */}
      {phase === "intro" && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10">
            <Swords className="text-violet-400" size={26} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{duel.title}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-400">
            {duel.total} preguntas, las mismas para todo el grupo. Jugás una sola vez — elegí bien.
            Al terminar vas a ver la tabla de posiciones.
          </p>
          <button
            onClick={() => setPhase("playing")}
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-violet-600/25 transition-all hover:bg-violet-500 active:scale-[0.98]"
          >
            Empezar el duelo
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* ── Jugando ── */}
      {phase === "playing" && (
        <div>
          <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
            <span>Pregunta {qIndex + 1} de {duel.total}</span>
            <span>{answeredCount} respondidas</span>
          </div>
          <div className="mb-4 h-1 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${((qIndex + 1) / duel.total) * 100}%` }} />
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
            <p className="text-base font-semibold leading-relaxed">{duel.questions[qIndex].question}</p>
            <div className="mt-5 space-y-2">
              {duel.questions[qIndex].options.map((opt) => {
                const selected = answers[qIndex] === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => choose(opt)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                      selected ? "border-violet-500/50 bg-violet-500/10 text-white" : "border-white/10 bg-white/[0.02] text-gray-300 hover:border-white/25"
                    }`}
                  >
                    <span>{opt}</span>
                    {selected && <Check size={15} className="shrink-0 text-violet-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            {qIndex > 0 && (
              <button
                onClick={() => setQIndex((i) => i - 1)}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm text-gray-300 transition-colors hover:border-white/20"
              >
                Anterior
              </button>
            )}
            {qIndex + 1 < duel.total ? (
              <button
                onClick={() => setQIndex((i) => i + 1)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition-all hover:bg-violet-500"
              >
                Siguiente <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={finish}
                disabled={submitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-500 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="animate-spin" size={16} /> : <>Entregar duelo <Check size={16} /></>}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Resultado ── */}
      {phase === "result" && (
        <div className="space-y-5">
          {result && (
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10">
                <Swords className="text-violet-400" size={26} />
              </div>
              <h2 className="text-xl font-bold tracking-tight">¡Duelo entregado!</h2>
              <div className="my-3">
                <span className="text-5xl font-bold text-violet-400">{result.score}</span>
                <span className="text-2xl text-gray-600">/{result.total}</span>
              </div>
            </div>
          )}

          {duel.already_played && !result && (
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 text-center">
              <p className="text-sm text-gray-400">
                Ya jugaste este duelo{duel.my_score != null ? ` — sacaste ${duel.my_score}/${duel.total}` : ""}. Mirá cómo va la tabla:
              </p>
            </div>
          )}

          {results && (
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Trophy size={15} className="text-amber-400" />
                Tabla de posiciones
              </div>
              <Leaderboard results={results} meScore={result?.score ?? duel.my_score} />
            </div>
          )}

          {/* Revisión de respuestas (solo tras jugar en esta sesión) */}
          {result && (
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
              <p className="mb-3 text-sm font-semibold">Revisión</p>
              <div className="space-y-3">
                {result.review.map((r, i) => (
                  <div key={i} className={`rounded-xl border px-4 py-3 ${r.is_correct ? "border-emerald-500/25 bg-emerald-500/5" : "border-red-500/25 bg-red-500/5"}`}>
                    <div className="flex items-start gap-2">
                      {r.is_correct ? <Check size={15} className="mt-0.5 shrink-0 text-emerald-400" /> : <X size={15} className="mt-0.5 shrink-0 text-red-400" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{r.question}</p>
                        {!r.is_correct && (
                          <p className="mt-1 text-xs text-gray-400">
                            Tu respuesta: <span className="text-red-300">{r.chosen || "—"}</span> · Correcta:{" "}
                            <span className="text-emerald-300">{r.correct_answer}</span>
                          </p>
                        )}
                        {r.explanation && <p className="mt-1 text-xs leading-relaxed text-gray-500">{r.explanation}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Link
            href={`/grupos/${duel.group_id}`}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-3 text-sm text-gray-300 transition-colors hover:border-white/20"
          >
            Volver al grupo
          </Link>
        </div>
      )}
    </main>
  );
}
