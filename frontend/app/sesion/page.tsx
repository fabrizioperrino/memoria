"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  getSessionPlan,
  getReadiness,
  listDocuments,
  SessionPlan,
  SessionBlock,
} from "@/lib/api";
import { toast, Toaster } from "sonner";
import {
  ArrowRight,
  Check,
  GraduationCap,
  Layers,
  ListChecks,
  Loader2,
  Play,
  RotateCcw,
  Sparkle,
  Target,
} from "lucide-react";

const TIME_OPTIONS = [15, 30, 45, 60];
const STORAGE_KEY = "memoria_session";

const BLOCK_META: Record<
  SessionBlock["type"],
  { label: string; icon: typeof Layers; href: (id: string) => string; verb: string }
> = {
  review: { label: "Repaso", icon: RotateCcw, href: (id) => `/review/${id}`, verb: "Repasar" },
  quiz: { label: "Quiz", icon: Target, href: (id) => `/quiz/${id}`, verb: "Jugar quiz" },
  oral: { label: "Oral", icon: GraduationCap, href: (id) => `/oral/${id}`, verb: "Rendir oral" },
  study: { label: "Lectura", icon: Layers, href: (id) => `/study/${id}`, verb: "Abrir" },
};

interface StoredSession {
  plan: SessionPlan;
  done: boolean[];
}

export default function SessionPage() {
  const [subjects, setSubjects] = useState<string[]>([]);
  const [minutes, setMinutes] = useState(30);
  const [subject, setSubject] = useState<string>("");
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [session, setSession] = useState<StoredSession | null>(null);
  const [finished, setFinished] = useState<{ before: number; after: number } | null>(null);

  // Cargar materias + sesión guardada
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved) {
      try {
        setSession(JSON.parse(saved));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    listDocuments()
      .then((docs) => {
        const set = new Set<string>();
        docs.forEach((d) => d.subject && set.add(d.subject));
        setSubjects(Array.from(set).sort());
      })
      .catch(() => {})
      .finally(() => setLoadingSubjects(false));
  }, []);

  function persist(s: StoredSession | null) {
    setSession(s);
    if (typeof window !== "undefined") {
      if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      else localStorage.removeItem(STORAGE_KEY);
    }
  }

  async function generate() {
    setGenerating(true);
    setFinished(null);
    try {
      const plan = await getSessionPlan(minutes, subject || undefined);
      if (plan.blocks.length === 0) {
        toast.error("No hay material listo para armar una sesión todavía.");
        return;
      }
      persist({ plan, done: new Array(plan.blocks.length).fill(false) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo armar la sesión");
    } finally {
      setGenerating(false);
    }
  }

  function toggleDone(i: number) {
    if (!session) return;
    const done = [...session.done];
    done[i] = !done[i];
    persist({ ...session, done });
  }

  async function finish() {
    const before = session?.plan.readiness_before ?? 0;
    let after = before;
    try {
      const r = await getReadiness();
      after = r.overall;
    } catch {
      /* mostramos igual */
    }
    setFinished({ before, after });
    persist(null);
  }

  const totalMin = useMemo(
    () => session?.plan.blocks.reduce((s, b) => s + b.est_minutes, 0) ?? 0,
    [session]
  );
  const doneCount = session?.done.filter(Boolean).length ?? 0;
  const allDone = session != null && doneCount === session.plan.blocks.length;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Toaster theme="dark" position="top-center" />

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Sesión de estudio</h1>
        <p className="mt-1 text-sm text-gray-500">
          Decinos cuánto tiempo tenés y armamos la sesión con tus datos: primero lo que estás por
          olvidar, después tus temas más flojos.
        </p>
      </div>

      {/* ── Cierre con delta ── */}
      {finished && (
        <div className="mb-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15">
            <Check className="text-emerald-400" size={24} />
          </div>
          <h2 className="text-lg font-bold">¡Sesión completa!</h2>
          <p className="mt-2 text-sm text-gray-400">
            Tu preparación pasó de <span className="font-semibold text-gray-300">{finished.before}%</span> a{" "}
            <span className="font-semibold text-emerald-300">{finished.after}%</span>
            {finished.after > finished.before && ` (+${finished.after - finished.before})`}.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <button
              onClick={() => setFinished(null)}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-violet-500"
            >
              Otra sesión
            </button>
            <Link
              href="/progreso"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm text-gray-300 transition-colors hover:border-white/20"
            >
              Ver progreso
            </Link>
          </div>
        </div>
      )}

      {/* ── Configurar sesión ── */}
      {!session && !finished && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
          <p className="mb-3 text-sm font-medium text-gray-300">¿Cuánto tiempo tenés?</p>
          <div className="mb-6 flex flex-wrap gap-2">
            {TIME_OPTIONS.map((m) => (
              <button
                key={m}
                onClick={() => setMinutes(m)}
                className={`rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors ${
                  minutes === m
                    ? "border-violet-500/50 bg-violet-500/15 text-white"
                    : "border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/20"
                }`}
              >
                {m} min
              </button>
            ))}
          </div>

          <p className="mb-3 text-sm font-medium text-gray-300">¿Alguna materia en particular?</p>
          {loadingSubjects ? (
            <Loader2 className="animate-spin text-violet-500" size={18} />
          ) : (
            <div className="mb-6 flex flex-wrap gap-2">
              <button
                onClick={() => setSubject("")}
                className={`rounded-xl border px-4 py-2 text-sm transition-colors ${
                  subject === "" ? "border-violet-500/50 bg-violet-500/15 text-white" : "border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/20"
                }`}
              >
                Todas
              </button>
              {subjects.map((s) => (
                <button
                  key={s}
                  onClick={() => setSubject(s)}
                  className={`rounded-xl border px-4 py-2 text-sm transition-colors ${
                    subject === s ? "border-violet-500/50 bg-violet-500/15 text-white" : "border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/20"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={generate}
            disabled={generating}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3.5 text-sm font-semibold text-white shadow-xl shadow-violet-600/25 transition-all hover:bg-violet-500 active:scale-[0.99] disabled:opacity-50"
          >
            {generating ? <Loader2 className="animate-spin" size={16} /> : <><Sparkle size={16} /> Armar mi sesión</>}
          </button>
        </div>
      )}

      {/* ── Checklist de la sesión ── */}
      {session && !finished && (
        <div>
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.02] px-5 py-4">
            <div className="flex items-center gap-2">
              <ListChecks size={16} className="text-violet-400" />
              <span className="text-sm font-semibold">
                {doneCount}/{session.plan.blocks.length} bloques · ~{totalMin} min
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {session.plan.subject || "Todas las materias"}
            </span>
          </div>

          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all"
              style={{ width: `${(doneCount / session.plan.blocks.length) * 100}%` }}
            />
          </div>

          <div className="space-y-2.5">
            {session.plan.blocks.map((b, i) => {
              const meta = BLOCK_META[b.type];
              const done = session.done[i];
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 transition-colors ${
                    done ? "border-emerald-500/25 bg-emerald-500/[0.04]" : "border-white/8 bg-white/[0.02]"
                  }`}
                >
                  <button
                    onClick={() => toggleDone(i)}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      done ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400" : "border-white/15 text-transparent hover:border-violet-500/50"
                    }`}
                    title={done ? "Marcar como pendiente" : "Marcar como hecho"}
                  >
                    <Check size={14} />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <meta.icon size={13} className="shrink-0 text-violet-400" />
                      <span className="text-xs font-medium text-gray-500">{meta.label}</span>
                      <span className="text-[10px] text-gray-600">~{b.est_minutes} min</span>
                    </div>
                    <p className={`mt-0.5 truncate text-sm ${done ? "text-gray-500 line-through" : "text-gray-200"}`}>
                      {b.detail}
                    </p>
                    <p className="truncate text-xs text-gray-600">{b.doc_title}</p>
                  </div>

                  {!done && (
                    <Link
                      href={meta.href(b.doc_id)}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-violet-500 active:scale-95"
                    >
                      <Play size={12} /> {meta.verb}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex gap-2">
            <button
              onClick={finish}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all ${
                allDone ? "bg-emerald-600 text-white hover:bg-emerald-500" : "border border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/20"
              }`}
            >
              {allDone ? <>Terminar sesión <ArrowRight size={15} /></> : "Terminar igual"}
            </button>
            <button
              onClick={() => persist(null)}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-500 transition-colors hover:text-gray-300"
            >
              Descartar
            </button>
          </div>

          <p className="mt-3 text-center text-xs text-gray-600">
            Abrí cada bloque, y cuando termines volvé acá y marcalo. Tu sesión se guarda sola.
          </p>
        </div>
      )}
    </main>
  );
}
