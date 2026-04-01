"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSharedDocument, Document } from "@/lib/api";
import { Brain, BookOpen, Layers, Key, ChevronDown, ChevronUp, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";

export default function SharedDocPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [doc,     setDoc]     = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Flashcards expandidas
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    getSharedDocument(token)
      .then(setDoc)
      .catch(() => setError("Link inválido o el documento fue eliminado."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f0f13] flex items-center justify-center">
        <Loader2 size={28} className="text-violet-400 animate-spin" />
      </main>
    );
  }

  if (error || !doc) {
    return (
      <main className="min-h-screen bg-[#0f0f13] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-2">
          <Brain size={28} className="text-red-400" />
        </div>
        <h1 className="text-xl font-bold">Link inválido</h1>
        <p className="text-gray-500 text-sm max-w-sm">{error || "Este link no existe o el documento fue eliminado."}</p>
        <Link href="/auth" className="mt-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-medium transition-all">
          Ir a memorIA
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f0f13]">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-col items-center text-center mb-4">
          <div className="w-12 h-12 rounded-2xl bg-violet-600 flex items-center justify-center shadow-2xl shadow-violet-600/40 mb-4">
            <Brain size={22} className="text-white" />
          </div>
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-2">Material compartido en</p>
          <h1 className="text-3xl font-bold mb-1">
            memor<span className="text-violet-400">IA</span>
          </h1>
        </div>

        {/* ── Título del doc ── */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{doc.title}</h2>
              {doc.subject && (
                <span className="inline-block mt-2 text-xs px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20">
                  {doc.subject}
                </span>
              )}
            </div>
            <div className="flex gap-3 text-center shrink-0">
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-blue-400">{doc.flashcards?.length || 0}</span>
                <span className="text-[10px] text-gray-600">Flashcards</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-cyan-400">{doc.exam_questions?.length || 0}</span>
                <span className="text-[10px] text-gray-600">Preguntas</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-pink-400">{doc.key_concepts?.length || 0}</span>
                <span className="text-[10px] text-gray-600">Conceptos</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Resumen ── */}
        {doc.summary && (
          <section>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <BookOpen size={14} /> Resumen
            </h3>
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6 text-sm text-gray-300 leading-relaxed whitespace-pre-line">
              {doc.summary}
            </div>
          </section>
        )}

        {/* ── Conceptos clave ── */}
        {doc.key_concepts && doc.key_concepts.length > 0 && (
          <section>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Key size={14} /> Conceptos clave
            </h3>
            <div className="grid gap-2">
              {doc.key_concepts.map((kc, i) => (
                <div key={i} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                  <p className="text-sm font-semibold text-violet-300 mb-1">{kc.concept}</p>
                  <p className="text-sm text-gray-400 leading-relaxed">{kc.definition}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Flashcards ── */}
        {doc.flashcards && doc.flashcards.length > 0 && (
          <section>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Layers size={14} /> Flashcards
            </h3>
            <div className="grid gap-2">
              {doc.flashcards.map((fc, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/5 bg-white/[0.03] overflow-hidden cursor-pointer"
                  onClick={() => setExpandedCard(expandedCard === i ? null : i)}
                >
                  <div className="flex items-center justify-between p-4 gap-3">
                    <p className="text-sm font-medium flex-1">{fc.question}</p>
                    {expandedCard === i
                      ? <ChevronUp size={15} className="text-gray-500 shrink-0" />
                      : <ChevronDown size={15} className="text-gray-500 shrink-0" />
                    }
                  </div>
                  {expandedCard === i && (
                    <div className="px-4 pb-4 pt-0 border-t border-white/5">
                      <p className="text-sm text-violet-300 leading-relaxed pt-3">{fc.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── CTA ── */}
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-violet-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-600/30">
            <Brain size={22} className="text-white" />
          </div>
          <h3 className="text-lg font-bold mb-1">Estudia este material de forma interactiva</h3>
          <p className="text-sm text-gray-400 mb-5">
            Creá tu cuenta gratis en memorIA y podés hacer quizzes, repasar con flashcards y chatear con el documento.
          </p>
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-semibold transition-all shadow-lg shadow-violet-600/20"
          >
            Crear cuenta gratis <ArrowRight size={15} />
          </Link>
        </div>

      </div>
    </main>
  );
}
