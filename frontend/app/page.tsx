"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  listDocuments,
  deleteDocument,
  shareDocument,
  unshareDocument,
  getStatsSummary,
  Document,
  StatsSummary,
  QuizChartPoint,
} from "@/lib/api";
import { toast, Toaster } from "sonner";
import {
  FileText,
  Layers,
  BookOpen,
  Trash2,
  ChevronRight,
  Sparkles,
  Clock,
  Target,
  TrendingUp,
  Trophy,
  Brain,
  Key,
  RotateCcw,
  MessageSquare,
  Upload,
  Search,
  Share2,
  Link2,
  LinkOff,
  AlignLeft,
} from "lucide-react";

// ── Sparkline chart ────────────────────────────────────────────────────────────
function ScoreSparkline({ data }: { data: QuizChartPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-gray-600">
        Completá más quizzes para ver tu progreso
      </div>
    );
  }

  const W = 400;
  const H = 80;
  const pad = 8;
  const values = data.map((d) => d.percentage);
  const min = Math.max(0, Math.min(...values) - 10);
  const max = Math.min(100, Math.max(...values) + 10);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return { x, y, v };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${H} L ${points[0].x} ${H} Z`;

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const trend = last.v - prev.v;

  return (
    <div className="relative w-full h-20">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#sparkGrad)" />
        <path d={linePath} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#8b5cf6" />
        ))}
      </svg>
      <div className={`absolute top-0 right-0 text-xs font-semibold px-2 py-0.5 rounded-lg ${
        trend >= 0 ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"
      }`}>
        {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
      </div>
      <div className="absolute left-0 top-0 text-[10px] text-gray-600">{max}%</div>
      <div className="absolute left-0 bottom-0 text-[10px] text-gray-600">{min}%</div>
    </div>
  );
}

function scoreColor(pct: number) {
  if (pct >= 70) return "text-emerald-400";
  if (pct >= 50) return "text-amber-400";
  return "text-red-400";
}
function scoreBarColor(pct: number) {
  if (pct >= 70) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

// ── File type icon ─────────────────────────────────────────────────────────────
function DocIcon({ type }: { type: string | null }) {
  if (type === "text") return <AlignLeft className="text-gray-400" size={18} />;
  return <FileText className="text-gray-400" size={18} />;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats,     setStats]     = useState<StatsSummary | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      listDocuments(),
      getStatsSummary().catch(() => null),
    ]).then(([docs, s]) => {
      setDocuments(docs);
      setStats(s);
    }).catch(() => {
      toast.error("No se pudo conectar con la API");
    }).finally(() => setLoading(false));
  }, []);

  // ── Materias únicas ────────────────────────────────────────────────────────
  const subjects = useMemo(() => {
    const set = new Set<string>();
    documents.forEach((d) => { if (d.subject) set.add(d.subject); });
    return Array.from(set).sort();
  }, [documents]);

  // ── Filtro combinado ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return documents.filter((d) => {
      const matchSearch  = d.title.toLowerCase().includes(search.toLowerCase());
      const matchSubject = !activeSubject || d.subject === activeSubject;
      return matchSearch && matchSubject;
    });
  }, [documents, search, activeSubject]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleDelete(id: string, title: string) {
    if (!confirm(`¿Eliminar "${title}"?`)) return;
    await deleteDocument(id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    toast.success("Documento eliminado");
  }

  async function handleShare(doc: Document) {
    setSharingId(doc.id);
    try {
      if (doc.share_token) {
        // Ya tiene link → descompartir
        await unshareDocument(doc.id);
        setDocuments((prev) =>
          prev.map((d) => d.id === doc.id ? { ...d, share_token: null } : d)
        );
        toast.success("Link de compartir eliminado");
      } else {
        // Generar link
        const { share_token } = await shareDocument(doc.id);
        const url = `${window.location.origin}/share/${share_token}`;
        await navigator.clipboard.writeText(url);
        setDocuments((prev) =>
          prev.map((d) => d.id === doc.id ? { ...d, share_token } : d)
        );
        toast.success("¡Link copiado al portapapeles! 🔗");
      }
    } catch {
      toast.error("Error al compartir");
    } finally {
      setSharingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#0f0f13]">
      <Toaster richColors theme="dark" />

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">

        {/* ── Hero ── */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-1">Dashboard</h1>
            <p className="text-gray-500">Tu progreso de estudio en un vistazo.</p>
          </div>
          <Link
            href="/upload"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-medium transition-all shadow-lg shadow-violet-600/20"
          >
            <Upload size={15} /> Subir material
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-7 h-7 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Stats grid ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Documentos",    value: stats?.total_documents   ?? documents.length, icon: FileText,   color: "text-violet-400",  bg: "bg-violet-500/10" },
                { label: "Flashcards",    value: stats?.total_flashcards  ?? 0,                icon: Layers,     color: "text-blue-400",    bg: "bg-blue-500/10"   },
                { label: "Preguntas",     value: stats?.total_questions   ?? 0,                icon: BookOpen,   color: "text-cyan-400",    bg: "bg-cyan-500/10"   },
                { label: "Conceptos",     value: stats?.total_concepts    ?? 0,                icon: Key,        color: "text-pink-400",    bg: "bg-pink-500/10"   },
                { label: "Para repasar",  value: stats?.cards_due_today   ?? 0,                icon: RotateCcw,  color: "text-amber-400",   bg: "bg-amber-500/10"  },
                { label: "Quiz attempts", value: stats?.total_quiz_attempts ?? 0,              icon: Target,     color: "text-emerald-400", bg: "bg-emerald-500/10"},
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 flex flex-col gap-3">
                  <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center`}>
                    <s.icon className={s.color} size={17} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold leading-none">{s.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Chart + Activity row ── */}
            {stats && (stats.recent_quiz_chart.length > 0 || stats.recent_activity.length > 0) && (
              <div className="grid lg:grid-cols-2 gap-4">

                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        <TrendingUp size={16} className="text-violet-400" /> Evolución de scores
                      </h3>
                      <p className="text-xs text-gray-600 mt-0.5">Últimos {stats.recent_quiz_chart.length} quizzes</p>
                    </div>
                    <div className="flex gap-4 text-right">
                      <div>
                        <p className="text-lg font-bold text-violet-400">{stats.average_quiz_score}%</p>
                        <p className="text-[10px] text-gray-600">Promedio</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-emerald-400">{stats.best_quiz_score}%</p>
                        <p className="text-[10px] text-gray-600">Mejor</p>
                      </div>
                    </div>
                  </div>
                  <ScoreSparkline data={stats.recent_quiz_chart} />
                </div>

                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6">
                  <h3 className="font-semibold flex items-center gap-2 mb-5">
                    <Brain size={16} className="text-violet-400" /> Actividad reciente
                  </h3>
                  {stats.recent_activity.length === 0 ? (
                    <p className="text-sm text-gray-600 text-center py-6">Todavía no hiciste ningún quiz</p>
                  ) : (
                    <div className="space-y-3">
                      {stats.recent_activity.map((a, i) => (
                        <Link
                          key={i}
                          href={`/study/${a.doc_id}`}
                          className="flex items-center gap-3 group hover:bg-white/[0.03] rounded-xl p-2 -mx-2 transition-all"
                        >
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                            a.percentage >= 70 ? "bg-emerald-500/10 text-emerald-400" :
                            a.percentage >= 50 ? "bg-amber-500/10 text-amber-400" :
                            "bg-red-500/10 text-red-400"
                          }`}>
                            {a.percentage}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-white transition-colors">{a.doc_title}</p>
                            <p className="text-xs text-gray-600">
                              {a.score}/{a.total} correctas · {new Date(a.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                            </p>
                          </div>
                          <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden shrink-0">
                            <div className={`h-full rounded-full ${scoreBarColor(a.percentage)}`} style={{ width: `${a.percentage}%` }} />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Due cards CTA ── */}
            {stats && stats.cards_due_today > 0 && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                  <RotateCcw size={18} className="text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-amber-300">
                    Tenés {stats.cards_due_today} {stats.cards_due_today === 1 ? "tarjeta" : "tarjetas"} para repasar hoy
                  </p>
                  <p className="text-xs text-amber-500/70 mt-0.5">El repaso espaciado funciona mejor cuando lo hacés seguido</p>
                </div>
                {documents.length > 0 && (
                  <Link
                    href={`/review/${documents[0].id}`}
                    className="shrink-0 px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-sm font-medium transition-all"
                  >
                    Repasar ahora
                  </Link>
                )}
              </div>
            )}

            {/* ── Documentos ── */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Tus documentos
                </h2>
                {/* Búsqueda */}
                {documents.length > 0 && (
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar..."
                      className="pl-8 pr-4 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500/60 transition-all w-48"
                    />
                  </div>
                )}
              </div>

              {/* Filtro por materias */}
              {subjects.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => setActiveSubject(null)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      !activeSubject
                        ? "bg-violet-600 text-white"
                        : "bg-white/5 text-gray-400 hover:text-gray-200 border border-white/10"
                    }`}
                  >
                    Todas
                  </button>
                  {subjects.map((s) => (
                    <button
                      key={s}
                      onClick={() => setActiveSubject(activeSubject === s ? null : s)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        activeSubject === s
                          ? "bg-violet-600 text-white"
                          : "bg-white/5 text-gray-400 hover:text-gray-200 border border-white/10"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {documents.length === 0 ? (
                <div className="rounded-2xl border border-white/5 border-dashed bg-white/[0.02] flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
                    <Sparkles className="text-violet-400" size={28} />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">Todavía no subiste nada</h3>
                  <p className="text-gray-500 text-sm mb-6">Subí un PDF, foto de cuaderno o pegá texto para empezar</p>
                  <Link
                    href="/upload"
                    className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-medium transition-all"
                  >
                    Subir primer material
                  </Link>
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] flex flex-col items-center justify-center py-16 text-center">
                  <Search size={28} className="text-gray-600 mb-3" />
                  <p className="text-gray-500 text-sm">No hay documentos que coincidan con tu búsqueda</p>
                  <button
                    onClick={() => { setSearch(""); setActiveSubject(null); }}
                    className="mt-3 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    Limpiar filtros
                  </button>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filtered.map((doc) => (
                    <div
                      key={doc.id}
                      className="group rounded-2xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/10 transition-all p-5 flex items-center gap-4"
                    >
                      <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                        <DocIcon type={doc.file_type} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">{doc.title}</p>
                          {doc.subject && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20 shrink-0">
                              {doc.subject}
                            </span>
                          )}
                          {doc.share_token && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0 flex items-center gap-1">
                              <Link2 size={9} /> Compartido
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock size={11} />
                            {new Date(doc.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                          </span>
                          <span className="text-xs text-gray-600">•</span>
                          <span className="text-xs text-gray-500">🃏 {doc.flashcards?.length || 0} flashcards</span>
                          <span className="text-xs text-gray-600">•</span>
                          <span className="text-xs text-gray-500">📝 {doc.exam_questions?.length || 0} preguntas</span>
                          <span className="text-xs text-gray-600">•</span>
                          <span className="text-xs text-gray-500">🔑 {doc.key_concepts?.length || 0} conceptos</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/quiz/${doc.id}`}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-gray-300 hover:text-white hover:border-white/20 transition-all flex items-center gap-1"
                        >
                          <Target size={11} /> Quiz
                        </Link>
                        <Link
                          href={`/chat/${doc.id}`}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-gray-300 hover:text-white hover:border-white/20 transition-all flex items-center gap-1"
                        >
                          <MessageSquare size={11} /> Chat
                        </Link>
                        <Link
                          href={`/review/${doc.id}`}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-gray-300 hover:text-white hover:border-white/20 transition-all flex items-center gap-1"
                        >
                          <RotateCcw size={11} /> Repasar
                        </Link>
                        <button
                          onClick={() => handleShare(doc)}
                          disabled={sharingId === doc.id}
                          title={doc.share_token ? "Dejar de compartir" : "Compartir y copiar link"}
                          className={`p-1.5 rounded-lg transition-all ${
                            doc.share_token
                              ? "text-emerald-400 hover:text-red-400 hover:bg-red-500/10"
                              : "text-gray-600 hover:text-emerald-400 hover:bg-emerald-500/10"
                          } disabled:opacity-40`}
                        >
                          {doc.share_token ? <LinkOff size={14} /> : <Share2 size={14} />}
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id, doc.title)}
                          className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <Link href={`/study/${doc.id}`} className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="text-gray-500" size={18} />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </>
        )}
      </div>
    </main>
  );
}
