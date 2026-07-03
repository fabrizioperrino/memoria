"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  getProgressSummary,
  ProgressSummary,
  Achievement,
} from "@/lib/api";
import { toast, Toaster } from "sonner";
import {
  FileText,
  Flame,
  GraduationCap,
  Layers,
  Library,
  ListChecks,
  Loader2,
  Lock,
  Repeat,
  Star,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

// ── Iconos por logro ───────────────────────────────────────────────────────────
const ACHIEVEMENT_ICONS: Record<string, typeof Star> = {
  "primer-apunte": FileText,
  "biblioteca": Library,
  "primer-quiz": ListChecks,
  "constante": Repeat,
  "perfeccionista": Star,
  "centinela": Layers,
  "racha-7": Flame,
  "racha-30": Flame,
  "oral-aprobado": GraduationCap,
  "nivel-5": TrendingUp,
  "nivel-10": Trophy,
};

// ── Heatmap estilo GitHub ──────────────────────────────────────────────────────
function ActivityHeatmap({ data, days }: { data: { date: string; count: number }[]; days: number }) {
  const { weeks, monthLabels } = useMemo(() => {
    const counts = new Map(data.map((d) => [d.date, d.count]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const since = new Date(today);
    since.setDate(since.getDate() - (days - 1));
    // Alinear al lunes anterior
    const start = new Date(since);
    const dow = (start.getDay() + 6) % 7; // 0 = lunes
    start.setDate(start.getDate() - dow);

    const weeks: { date: string; count: number; future: boolean }[][] = [];
    const monthLabels: { index: number; label: string }[] = [];
    const cursor = new Date(start);
    let lastMonth = -1;

    while (cursor <= today) {
      const week: { date: string; count: number; future: boolean }[] = [];
      for (let i = 0; i < 7; i++) {
        const iso = cursor.toISOString().slice(0, 10);
        week.push({
          date: iso,
          count: counts.get(iso) ?? 0,
          future: cursor > today,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      const firstDay = new Date(week[0].date);
      const lastLabelIndex = monthLabels[monthLabels.length - 1]?.index ?? -4;
      // Evitar etiquetas superpuestas: mínimo 3 semanas entre una y otra
      if (firstDay.getMonth() !== lastMonth && weeks.length - lastLabelIndex >= 3) {
        lastMonth = firstDay.getMonth();
        monthLabels.push({
          index: weeks.length,
          label: firstDay.toLocaleDateString("es", { month: "short" }),
        });
      }
      weeks.push(week);
    }
    return { weeks, monthLabels };
  }, [data, days]);

  function cellColor(count: number, future: boolean) {
    if (future) return "bg-transparent";
    if (count === 0) return "bg-white/[0.04]";
    if (count <= 2) return "bg-violet-900/70";
    if (count <= 5) return "bg-violet-700";
    if (count <= 9) return "bg-violet-500";
    return "bg-violet-400";
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="min-w-max">
        <div className="mb-1.5 flex gap-[3px] text-[10px] text-gray-600" style={{ paddingLeft: 22 }}>
          {weeks.map((_, i) => {
            const label = monthLabels.find((m) => m.index === i);
            return (
              <span key={i} className="w-[11px] shrink-0 overflow-visible whitespace-nowrap">
                {label?.label ?? ""}
              </span>
            );
          })}
        </div>
        <div className="flex gap-[3px]">
          <div className="flex w-[19px] flex-col gap-[3px] pr-1 text-[9px] leading-[11px] text-gray-600">
            {["L", "", "M", "", "V", "", "D"].map((d, i) => (
              <span key={i} className="h-[11px]">{d}</span>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day) => (
                <div
                  key={day.date}
                  title={`${day.date} — ${day.count} ${day.count === 1 ? "actividad" : "actividades"}`}
                  className={`h-[11px] w-[11px] rounded-[3px] ${cellColor(day.count, day.future)}`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-gray-600" style={{ paddingLeft: 22 }}>
          Menos
          {["bg-white/[0.04]", "bg-violet-900/70", "bg-violet-700", "bg-violet-500", "bg-violet-400"].map((c) => (
            <span key={c} className={`h-[11px] w-[11px] rounded-[3px] ${c}`} />
          ))}
          Más
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta de logro ───────────────────────────────────────────────────────────
function AchievementCard({ a }: { a: Achievement }) {
  const Icon = ACHIEVEMENT_ICONS[a.id] ?? Star;
  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        a.unlocked
          ? "border-violet-500/30 bg-violet-500/[0.07]"
          : "border-white/8 bg-white/[0.015] opacity-60"
      }`}
      title={a.unlocked && a.unlocked_at ? `Desbloqueado el ${new Date(a.unlocked_at).toLocaleDateString("es")}` : undefined}
    >
      <div
        className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${
          a.unlocked ? "bg-violet-500/20 text-violet-300" : "bg-white/5 text-gray-600"
        }`}
      >
        {a.unlocked ? <Icon size={17} /> : <Lock size={15} />}
      </div>
      <p className={`text-sm font-semibold ${a.unlocked ? "text-white" : "text-gray-500"}`}>{a.name}</p>
      <p className="mt-1 text-xs leading-snug text-gray-500">{a.description}</p>
    </div>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────────
export default function ProgressPage() {
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProgressSummary()
      .then(setSummary)
      .catch(() => toast.error("No se pudo cargar tu progreso"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="animate-spin text-violet-500" size={28} />
      </main>
    );
  }

  if (!summary) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16 text-center text-gray-500">
        No se pudo cargar tu progreso. Probá de nuevo en un rato.
      </main>
    );
  }

  const levelSpan = summary.next_level_xp - summary.level_xp_floor;
  const levelProgress = levelSpan > 0
    ? Math.min(100, Math.round(((summary.xp_total - summary.level_xp_floor) / levelSpan) * 100))
    : 100;
  const unlockedCount = summary.achievements.filter((a) => a.unlocked).length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Toaster theme="dark" position="top-center" />

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tu progreso</h1>
          <p className="mt-1 text-sm text-gray-500">
            Todo lo que estudiaste, medido y acumulado.
          </p>
        </div>
        <Link
          href="/grupos"
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
        >
          <Users size={15} />
          Grupos y rankings
        </Link>
      </div>

      {/* ── Nivel + racha + totales ── */}
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.06] p-5 sm:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600 text-lg font-bold shadow-lg shadow-violet-600/30">
                {summary.level}
              </div>
              <div>
                <p className="text-sm font-semibold">Nivel {summary.level}</p>
                <p className="text-xs text-gray-500">
                  {summary.xp_total.toLocaleString("es")} XP total
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Zap size={13} className="text-violet-400" />
              {summary.next_level_xp - summary.xp_total} XP para el nivel {summary.level + 1}
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all"
              style={{ width: `${levelProgress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.02] p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
            <Flame size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none">{summary.streak}</p>
            <p className="mt-1 text-xs text-gray-500">
              {summary.streak === 1 ? "día de racha" : "días de racha"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Heatmap ── */}
      <div className="mb-5 rounded-2xl border border-white/8 bg-white/[0.02] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Actividad de los últimos 6 meses</h2>
          <span className="text-xs text-gray-600">
            {summary.totals.reviews + summary.totals.quizzes} sesiones de práctica
          </span>
        </div>
        <ActivityHeatmap data={summary.heatmap} days={summary.heatmap_days} />
      </div>

      {/* ── Precisión por materia ── */}
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
          <h2 className="mb-4 text-sm font-semibold">Precisión por materia</h2>
          {summary.subjects.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-600">
              Completá quizzes para ver tu precisión por materia.
            </p>
          ) : (
            <div className="space-y-4">
              {summary.subjects.slice(0, 8).map((s) => (
                <div key={s.subject}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm text-gray-300">{s.subject}</span>
                    <span className="shrink-0 text-xs text-gray-500">
                      {s.avg_pct}% · {s.attempts} {s.attempts === 1 ? "quiz" : "quizzes"}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div
                      className={`h-full rounded-full ${
                        s.avg_pct >= 70 ? "bg-emerald-500" : s.avg_pct >= 50 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{ width: `${s.avg_pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Totales ── */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
          <h2 className="mb-4 text-sm font-semibold">En números</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Documentos", value: summary.totals.documents },
              { label: "Quizzes", value: summary.totals.quizzes },
              { label: "Repasos", value: summary.totals.reviews },
            ].map((t) => (
              <div key={t.label} className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-center">
                <p className="text-2xl font-bold">{t.value.toLocaleString("es")}</p>
                <p className="mt-1 text-xs text-gray-500">{t.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-gray-600">
            Ganás XP con cada acción: subir material (+50), completar quizzes (+20 y +5 por
            acierto), repasar cartas (+5) y rendir orales con IA (+15, con bonus si sacás 8+).
          </p>
        </div>
      </div>

      {/* ── Logros ── */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Logros</h2>
          <span className="text-xs text-gray-600">
            {unlockedCount} de {summary.achievements.length}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {summary.achievements.map((a) => (
            <AchievementCard key={a.id} a={a} />
          ))}
        </div>
      </div>
    </main>
  );
}
