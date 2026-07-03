"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getSharedDeck, SharedDeckMaterial } from "@/lib/api";
import { toast, Toaster } from "sonner";
import { ArrowLeft, BookOpen, Key, Layers, Loader2, RotateCcw, Users } from "lucide-react";

type Tab = "summary" | "flashcards" | "concepts";

function FlipCard({ front, back }: { front: string; back: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      onClick={() => setFlipped((f) => !f)}
      className="flex min-h-[120px] w-full flex-col justify-center rounded-xl border border-white/8 bg-white/[0.02] p-5 text-left transition-colors hover:border-white/15"
    >
      <span className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-gray-600">
        {flipped ? "Respuesta" : "Pregunta"}
      </span>
      <p className={`text-sm leading-relaxed ${flipped ? "text-gray-300" : "font-semibold text-white"}`}>
        {flipped ? back : front}
      </p>
      {!flipped && (
        <span className="mt-3 flex items-center gap-1.5 text-xs text-gray-600">
          <RotateCcw size={11} /> Tocá para ver la respuesta
        </span>
      )}
    </button>
  );
}

export default function SharedDeckPage() {
  const params = useParams<{ id: string }>();
  const [deck, setDeck] = useState<SharedDeckMaterial | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("summary");

  useEffect(() => {
    if (!params.id) return;
    getSharedDeck(params.id)
      .then(setDeck)
      .catch(() => toast.error("No se pudo cargar el mazo"))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="animate-spin text-violet-500" size={28} />
      </main>
    );
  }

  if (!deck) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-gray-500">Mazo no encontrado.</p>
        <Link href="/grupos" className="mt-4 inline-block text-sm text-violet-400 hover:text-violet-300">
          Volver a mis grupos
        </Link>
      </main>
    );
  }

  const flashcards = deck.flashcards ?? [];
  const concepts = deck.key_concepts ?? [];
  const tabs: { key: Tab; label: string; icon: typeof BookOpen; count?: number }[] = [
    { key: "summary", label: "Resumen", icon: BookOpen },
    { key: "flashcards", label: "Flashcards", icon: Layers, count: flashcards.length },
    { key: "concepts", label: "Conceptos", icon: Key, count: concepts.length },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Toaster theme="dark" position="top-center" />

      <div className="mb-6 flex items-center justify-between">
        <Link
          href={`/grupos/${deck.group_id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-white"
        >
          <ArrowLeft size={15} /> Grupo
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
          <Users size={12} /> Mazo compartido
        </span>
      </div>

      <h1 className="mb-1 text-2xl font-bold tracking-tight">{deck.title}</h1>
      <p className="mb-6 text-sm text-gray-500">Material compartido con tu grupo — solo lectura.</p>

      <div className="mb-6 flex w-fit gap-1 rounded-xl border border-white/5 bg-white/[0.03] p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? "bg-violet-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            <t.icon size={15} />
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`rounded-md px-1.5 text-xs ${tab === t.key ? "bg-white/20" : "bg-white/10 text-gray-500"}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-300">
            {deck.summary || "Este mazo no tiene resumen."}
          </p>
        </div>
      )}

      {tab === "flashcards" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {flashcards.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-600 sm:col-span-2">Sin flashcards.</p>
          ) : (
            flashcards.map((fc, i) => <FlipCard key={i} front={fc.question} back={fc.answer} />)
          )}
        </div>
      )}

      {tab === "concepts" && (
        <div className="space-y-2.5">
          {concepts.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-600">Sin conceptos clave.</p>
          ) : (
            concepts.map((c, i) => (
              <div key={i} className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3.5">
                <p className="text-sm font-semibold text-violet-300">{c.concept}</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-400">{c.definition}</p>
              </div>
            ))
          )}
        </div>
      )}
    </main>
  );
}
