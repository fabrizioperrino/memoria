"use client";

import { useState } from "react";
import Link from "next/link";
import { generateStudyPlan, StudyPlan, DayPlan, StudyTask } from "@/lib/api";
import { ArrowLeft, CalendarDays, Clock, RotateCcw, Target, Brain, BookOpen } from "lucide-react";

const TASK_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  review: { icon: RotateCcw, color: "text-amber-400",   label: "Repaso SM-2" },
  quiz:   { icon: Target,    color: "text-violet-400",  label: "Quiz" },
  exam:   { icon: Brain,     color: "text-pink-400",    label: "Examen IA" },
  study:  { icon: BookOpen,  color: "text-cyan-400",    label: "Estudio" },
};

function TaskRow({ task }: { task: StudyTask }) {
  const meta = TASK_META[task.type] ?? TASK_META.study;
  const Icon = meta.icon;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
      <div className={`w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5`}>
        <Icon size={14} className={meta.color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white">{task.description}</p>
        {task.document_title && (
          <p className="text-xs text-gray-600 mt-0.5">{task.document_title}</p>
        )}
      </div>
      <span className="text-xs text-gray-600 shrink-0 mt-1">{task.estimated_minutes} min</span>
    </div>
  );
}

function DayCard({ day }: { day: DayPlan }) {
  const [open, setOpen] = useState(false);
  const isToday = day.day_label === "Hoy";
  const isTomorrow = day.day_label === "Mañana";

  return (
    <div className={`rounded-2xl border transition-all ${
      isToday
        ? "border-violet-500/30 bg-violet-500/5"
        : "border-white/5 bg-white/[0.02]"
    }`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
            isToday ? "bg-violet-500/20 text-violet-300" :
            isTomorrow ? "bg-white/10 text-gray-300" :
            "bg-white/5 text-gray-500"
          }`}>
            {new Date(day.date + "T12:00:00").getDate()}
          </div>
          <div>
            <p className={`font-semibold text-sm ${isToday ? "text-violet-300" : "text-white"}`}>
              {day.day_label}
            </p>
            <p className="text-xs text-gray-500">{day.tasks.length} tarea{day.tasks.length !== 1 ? "s" : ""} · {day.total_minutes} min</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {day.tasks.map((t, i) => {
              const meta = TASK_META[t.type] ?? TASK_META.study;
              const Icon = meta.icon;
              return <Icon key={i} size={13} className={`${meta.color} opacity-70`} />;
            })}
          </div>
          <span className={`text-gray-500 transition-transform duration-200 ${open ? "rotate-90" : ""}`}>›</span>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5">
          <div className="border-t border-white/5">
            {day.tasks.map((task, i) => (
              <TaskRow key={i} task={task} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlanPage() {
  const today = new Date();
  today.setDate(today.getDate() + 7);
  const defaultDate = today.toISOString().split("T")[0];

  const [examDate, setExamDate] = useState(defaultDate);
  const [dailyMinutes, setDailyMinutes] = useState(30);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split("T")[0];

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const result = await generateStudyPlan(examDate, dailyMinutes);
      setPlan(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error generando el plan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0f0f13]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">

        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-8">
          <ArrowLeft size={14} /> Volver al inicio
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
            <CalendarDays className="text-violet-400" size={28} /> Plan de estudio
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Ingresá la fecha de tu examen y la IA genera un plan día por día basado en tus documentos, flashcards vencidas y rendimiento en quizzes.
          </p>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6 mb-8">
          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 flex items-center gap-1.5">
                <CalendarDays size={13} /> Fecha del examen
              </label>
              <input
                type="date"
                value={examDate}
                min={minDateStr}
                onChange={(e) => setExamDate(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-violet-500/60 transition-all disabled:opacity-50 [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 flex items-center gap-1.5">
                <Clock size={13} /> Minutos por día
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={15}
                  max={120}
                  step={15}
                  value={dailyMinutes}
                  onChange={(e) => setDailyMinutes(Number(e.target.value))}
                  disabled={loading}
                  className="flex-1 accent-violet-500"
                />
                <span className="text-sm font-semibold text-violet-300 w-14 text-right">{dailyMinutes} min</span>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">{error}</p>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading || !examDate}
            className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold text-sm transition-all shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading
              ? <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Generando plan...</>
              : <><CalendarDays size={16} /> Generar plan</>
            }
          </button>
        </div>

        {/* Plan */}
        {plan && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6">
              <p className="text-sm text-gray-300 leading-relaxed mb-4">{plan.summary}</p>
              {plan.focus_areas.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Áreas prioritarias</p>
                  <div className="flex flex-wrap gap-2">
                    {plan.focus_areas.map((area, i) => (
                      <span key={i} className="px-3 py-1 rounded-full text-xs font-medium bg-violet-500/15 text-violet-300 border border-violet-500/20">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Daily plan */}
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Plan día a día</h2>
              <div className="space-y-3">
                {plan.daily_plan.map((day, i) => (
                  <DayCard key={i} day={day} />
                ))}
              </div>
            </div>

            {/* Regenerate */}
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-medium transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw size={15} /> Regenerar plan
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
