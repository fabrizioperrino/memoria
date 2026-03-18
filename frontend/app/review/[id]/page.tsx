"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getDueCards, rateFlashcard, DueCardsResponse } from "@/lib/api";
import { toast, Toaster } from "sonner";
import Link from "next/link";
import { ArrowLeft, Trophy, Flame } from "lucide-react";

type Rating = "forgot" | "hard" | "medium" | "easy";

const RATINGS: { value: Rating; label: string; emoji: string; color: string; border: string }[] = [
  { value: "forgot", label: "No supe", emoji: "😵", color: "bg-red-500/10 hover:bg-red-500/20 text-red-400", border: "border-red-500/20 hover:border-red-500/40" },
  { value: "hard", label: "Difícil", emoji: "😓", color: "bg-orange-500/10 hover:bg-orange-500/20 text-orange-400", border: "border-orange-500/20 hover:border-orange-500/40" },
  { value: "medium", label: "Regular", emoji: "🙂", color: "bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400", border: "border-yellow-500/20 hover:border-yellow-500/40" },
  { value: "easy", label: "Fácil", emoji: "😎", color: "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400", border: "border-emerald-500/20 hover:border-emerald-500/40" },
];

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [dueData, setDueData] = useState<DueCardsResponse | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [rating, setRating] = useState(false);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    getDueCards(id).then(setDueData).finally(() => setLoading(false));
  }, [id]);

  const currentCard = dueData?.due_cards[currentIdx];
  const total = dueData?.due_count || 0;
  const progress = total > 0 ? ((currentIdx) / total) * 100 : 0;

  async function handleRating(r: Rating) {
    if (!currentCard || rating) return;
    setRating(true);

    if (r === "easy" || r === "medium") setStreak((s) => s + 1);
    else setStreak(0);

    try {
      await rateFlashcard(id, String(currentCard.index), r);
    } catch {
      toast.error("Error guardando calificación");
    }

    if (currentIdx + 1 >= total) {
      setDone(true);
    } else {
      setCurrentIdx((i) => i + 1);
      setFlipped(false);
    }
    setRating(false);
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0f0f13] flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
    </div>
  );

  if (done || (dueData && dueData.due_count === 0)) return (
    <div className="min-h-screen bg-[#0f0f13] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-6">
          <Trophy className="text-yellow-400" size={36} />
        </div>
        <h2 className="text-2xl font-bold mb-2">
          {dueData?.due_count === 0 ? "¡Al día!" : "¡Sesión completada!"}
        </h2>
        <p className="text-gray-400 mb-2">
          {dueData?.due_count === 0
            ? "No hay tarjetas para repasar hoy. Volvé mañana."
            : `Repasaste ${total} tarjeta${total !== 1 ? "s" : ""}.`}
        </p>
        {streak > 0 && (
          <p className="text-orange-400 text-sm flex items-center justify-center gap-1 mb-6">
            <Flame size={14} /> {streak} tarjetas de racha
          </p>
        )}
        <Link
          href={`/study/${id}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-medium transition-all"
        >
          Ver material completo
        </Link>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#0f0f13] flex flex-col items-center justify-center p-6">
      <Toaster richColors theme="dark" />

      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href={`/study/${id}`} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors">
            <ArrowLeft size={14} /> Volver
          </Link>
          <div className="flex items-center gap-3">
            {streak > 1 && (
              <span className="flex items-center gap-1 text-sm text-orange-400">
                <Flame size={14} /> {streak}
              </span>
            )}
            <span className="text-sm text-gray-500">{currentIdx + 1} / {total}</span>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="h-1 rounded-full bg-white/5 mb-8 overflow-hidden">
          <div
            className="h-full rounded-full bg-violet-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Card con flip 3D */}
        <div
          onClick={() => !flipped && setFlipped(true)}
          style={{ perspective: "1200px" }}
          className="cursor-pointer mb-6"
        >
          <div
            className="relative transition-transform duration-500"
            style={{
              transformStyle: "preserve-3d",
              transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
              minHeight: "220px",
            }}
          >
            {/* Front */}
            <div
              className="absolute inset-0 rounded-2xl border border-white/5 bg-white/[0.03] p-8 flex flex-col justify-between min-h-[220px]"
              style={{ backfaceVisibility: "hidden" }}
            >
              <span className="text-xs font-medium text-violet-400 uppercase tracking-wider">Pregunta</span>
              <p className="text-xl font-semibold text-white leading-snug text-center px-4">{currentCard?.question}</p>
              <span className="text-xs text-gray-600 text-center">Tocá para ver la respuesta</span>
            </div>
            {/* Back */}
            <div
              className="absolute inset-0 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-8 flex flex-col justify-between min-h-[220px]"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Respuesta</span>
              <p className="text-lg text-white leading-snug text-center px-4">{currentCard?.answer}</p>
              <span className="text-xs text-gray-600 text-center">¿Cómo te fue?</span>
            </div>
          </div>
        </div>

        {/* Rating buttons */}
        <div className={`grid grid-cols-4 gap-2 transition-all duration-300 ${flipped ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}>
          {RATINGS.map((r) => (
            <button
              key={r.value}
              onClick={() => handleRating(r.value)}
              disabled={rating}
              className={`flex flex-col items-center gap-1.5 py-3.5 rounded-xl border text-sm font-medium transition-all ${r.color} ${r.border}`}
            >
              <span className="text-xl">{r.emoji}</span>
              <span className="text-xs">{r.label}</span>
            </button>
          ))}
        </div>

        {!flipped && (
          <p className="text-center text-sm text-gray-600 mt-4">Tocá la tarjeta para revelar la respuesta</p>
        )}
      </div>
    </main>
  );
}
