"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  getGroup,
  leaveGroup,
  listDocuments,
  listGroupDecks,
  shareDeck,
  unshareDeck,
  listDuels,
  createDuel,
  getGroupPulse,
  GroupDetail,
  Document,
  GroupDeck,
  DuelListItem,
  GroupPulse,
} from "@/lib/api";
import { toast, Toaster } from "sonner";
import StudyRoom from "@/components/StudyRoom";
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  Flame,
  Layers,
  Loader2,
  LogOut,
  Medal,
  Activity,
  CalendarCheck2,
  Plus,
  Radio,
  Swords,
  Trash2,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

const FEED_DOT: Record<string, string> = {
  upload: "bg-blue-400",
  quiz: "bg-violet-400",
  exam: "bg-emerald-400",
  review: "bg-amber-400",
};

type Tab = "ranking" | "sala" | "mazos" | "duelos";

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

// ── Selector de documento (para compartir mazo o crear duelo) ───────────────────
function DocPicker({
  label,
  docs,
  onPick,
  onCancel,
}: {
  label: string;
  docs: { id: string; title: string }[];
  onPick: (docId: string) => void;
  onCancel: () => void;
}) {
  if (docs.length === 0) {
    return (
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-center text-sm text-gray-500">
        No tenés documentos listos para esto.{" "}
        <button onClick={onCancel} className="text-violet-400 hover:text-violet-300">Cerrar</button>
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-xl border border-violet-500/25 bg-violet-500/[0.05] p-3">
      <p className="px-1 text-xs font-medium text-gray-400">{label}</p>
      {docs.map((d) => (
        <button
          key={d.id}
          onClick={() => onPick(d.id)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3.5 py-2.5 text-left text-sm text-gray-200 transition-colors hover:border-violet-500/40"
        >
          <span className="truncate">{d.title}</span>
          <Plus size={14} className="shrink-0 text-violet-400" />
        </button>
      ))}
      <button onClick={onCancel} className="w-full py-1 text-xs text-gray-500 hover:text-gray-300">
        Cancelar
      </button>
    </div>
  );
}

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const groupId = params.id;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [tab, setTab] = useState<Tab>("ranking");

  const [decks, setDecks] = useState<GroupDeck[]>([]);
  const [duels, setDuels] = useState<DuelListItem[]>([]);
  const [myDocs, setMyDocs] = useState<Document[]>([]);
  const [pulse, setPulse] = useState<GroupPulse | null>(null);

  const [picker, setPicker] = useState<null | "share" | "duel">(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    Promise.all([
      getGroup(groupId),
      listGroupDecks(groupId).catch(() => []),
      listDuels(groupId).catch(() => []),
      listDocuments().catch(() => []),
      getGroupPulse(groupId).catch(() => null),
    ])
      .then(([g, dk, du, docs, p]) => {
        setGroup(g);
        setDecks(dk);
        setDuels(du);
        setMyDocs(docs);
        setPulse(p);
      })
      .catch(() => toast.error("No se pudo cargar el grupo"))
      .finally(() => setLoading(false));
  }, [groupId]);

  async function refreshDecks() {
    setDecks(await listGroupDecks(groupId).catch(() => decks));
  }
  async function refreshDuels() {
    setDuels(await listDuels(groupId).catch(() => duels));
  }

  async function copyCode() {
    if (!group) return;
    try {
      await navigator.clipboard.writeText(group.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  async function handleLeave() {
    if (!group || !confirm(`¿Salir de "${group.name}"?`)) return;
    setLeaving(true);
    try {
      await leaveGroup(group.id);
      toast.success("Saliste del grupo");
      router.push("/grupos");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo salir");
      setLeaving(false);
    }
  }

  async function handleShare(docId: string) {
    setBusy(true);
    try {
      await shareDeck(groupId, docId);
      toast.success("Mazo compartido con el grupo");
      setPicker(null);
      await refreshDecks();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo compartir");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnshare(shareId: string) {
    if (!confirm("¿Quitar este mazo del grupo?")) return;
    try {
      await unshareDeck(groupId, shareId);
      await refreshDecks();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo quitar");
    }
  }

  async function handleCreateDuel(docId: string) {
    setBusy(true);
    try {
      const duel = await createDuel(groupId, docId);
      toast.success(`Duelo "${duel.title}" creado`);
      setPicker(null);
      router.push(`/duelo/${duel.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el duelo");
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="animate-spin text-violet-500" size={28} />
      </main>
    );
  }

  if (!group) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-gray-500">Grupo no encontrado.</p>
        <Link href="/grupos" className="mt-4 inline-block text-sm text-violet-400 hover:text-violet-300">
          Volver a mis grupos
        </Link>
      </main>
    );
  }

  const podiumXp = group.ranking[0]?.xp_week || 0;
  const readyDocs = myDocs.filter((d) => d.status === "ready");
  // Para crear duelo: mis docs listos + mazos compartidos (por doc_id, dedupe)
  const duelDocs = [
    ...readyDocs.map((d) => ({ id: d.id, title: d.title })),
    ...decks.filter((dk) => !readyDocs.some((d) => d.id === dk.doc_id)).map((dk) => ({ id: dk.doc_id, title: `${dk.title} (compartido)` })),
  ];

  const tabs: { key: Tab; label: string; icon: typeof Flame; count?: number }[] = [
    { key: "ranking", label: "Ranking", icon: Flame },
    { key: "sala", label: "Sala", icon: Radio },
    { key: "mazos", label: "Mazos", icon: Layers, count: decks.length },
    { key: "duelos", label: "Duelos", icon: Swords, count: duels.length },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Toaster theme="dark" position="top-center" />

      <Link
        href="/grupos"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-white"
      >
        <ArrowLeft size={15} />
        Mis grupos
      </Link>

      {/* ── Header ── */}
      <div className="mb-5 rounded-2xl border border-white/8 bg-white/[0.02] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
              <Users size={20} />
            </div>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
                {group.name}
                {group.is_owner && <Crown size={14} className="text-amber-400" />}
              </h1>
              <p className="text-xs text-gray-500">
                {group.member_count} {group.member_count === 1 ? "miembro" : "miembros"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyCode}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm transition-colors hover:border-violet-500/40"
              title="Copiar código de invitación"
            >
              <span className="font-mono tracking-widest text-violet-300">{group.code}</span>
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-gray-500" />}
            </button>
            <button
              onClick={handleLeave}
              disabled={leaving}
              className="rounded-lg p-2 text-gray-600 transition-all hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
              title="Salir del grupo"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="mb-5 flex w-fit gap-1 rounded-xl border border-white/5 bg-white/[0.03] p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPicker(null); }}
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

      {/* ── Ranking (resumen del grupo) ── */}
      {tab === "ranking" && (
        <div className="space-y-5">
          {/* Hoy + racha */}
          {pulse && (
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <CalendarCheck2 size={15} className="text-emerald-400" />
                  Hoy
                </div>
                {pulse.group_streak > 0 && (
                  <span className="flex items-center gap-1.5 rounded-full border border-orange-500/25 bg-orange-500/10 px-2.5 py-1 text-xs font-semibold text-orange-300">
                    <Flame size={12} />
                    {pulse.group_streak} {pulse.group_streak === 1 ? "día" : "días"} de racha grupal
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-300">
                <span className="font-bold text-white">{pulse.studied_today_count}</span>
                <span className="text-gray-500">/{pulse.member_count}</span> estudiaron hoy
                {!pulse.you_studied_today && <span className="text-amber-300"> — faltás vos</span>}
              </p>

              {/* Avatares de miembros: verde = ya estudió */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {pulse.today.map((m) => (
                  <div
                    key={m.user_id}
                    title={`${m.name}${m.done ? " — ya estudió hoy" : " — todavía no"}`}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      m.done ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40" : "bg-white/5 text-gray-600"
                    }`}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>

              {!pulse.you_studied_today && (
                <Link
                  href="/sesion"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-violet-500 active:scale-95"
                >
                  <Zap size={14} /> Estudiar ahora y sumar a la racha
                </Link>
              )}
            </div>
          )}

          {/* Ranking */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Flame size={15} className="text-orange-400" />
              Ranking semanal
            </div>
            <span className="text-xs text-gray-600">Por XP · últimos 7 días</span>
          </div>
          <div className="space-y-2">
            {group.ranking.map((entry, i) => (
              <div
                key={entry.user_id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  entry.is_you ? "border-violet-500/35 bg-violet-500/[0.07]" : "border-white/8 bg-white/[0.015]"
                }`}
              >
                <RankBadge position={i + 1} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {entry.display_name}
                    {entry.is_you && <span className="ml-1.5 text-xs text-violet-400">(vos)</span>}
                  </p>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400"
                      style={{ width: podiumXp > 0 ? `${Math.round((entry.xp_week / podiumXp) * 100)}%` : "0%" }}
                    />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="flex items-center justify-end gap-1 text-sm font-bold">
                    <Zap size={12} className="text-violet-400" />
                    {entry.xp_week.toLocaleString("es")}
                  </p>
                  <p className="text-[10px] text-gray-600">{entry.xp_total.toLocaleString("es")} total</p>
                </div>
              </div>
            ))}
          </div>
          </div>

          {/* Feed de actividad */}
          {pulse && pulse.feed.length > 0 && (
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Activity size={15} className="text-violet-400" />
                Actividad reciente
              </div>
              <div className="space-y-3">
                {pulse.feed.map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${FEED_DOT[f.kind] || "bg-gray-500"}`} />
                    <p className="min-w-0 flex-1 truncate text-sm text-gray-400">
                      <span className="font-medium text-gray-200">{f.is_you ? "Vos" : f.name}</span> {f.text}
                    </p>
                    <span className="shrink-0 text-xs text-gray-600">{relativeTime(f.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Sala de estudio ── */}
      {tab === "sala" && <StudyRoom groupId={groupId} />}

      {/* ── Mazos ── */}
      {tab === "mazos" && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Layers size={15} className="text-violet-400" />
              Mazos compartidos
            </div>
            <button
              onClick={() => setPicker(picker === "share" ? null : "share")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-white/20 hover:text-white"
            >
              <Plus size={13} /> Compartir mazo
            </button>
          </div>

          {picker === "share" && (
            <div className="mb-4">
              <DocPicker
                label="Elegí uno de tus documentos para compartir"
                docs={readyDocs.filter((d) => !decks.some((dk) => dk.doc_id === d.id)).map((d) => ({ id: d.id, title: d.title }))}
                onPick={handleShare}
                onCancel={() => setPicker(null)}
              />
            </div>
          )}

          {decks.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-600">
              Nadie compartió material todavía. Compartí tus apuntes para que toda la comisión estudie lo mismo.
            </p>
          ) : (
            <div className="space-y-2">
              {decks.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                    <Layers size={16} />
                  </div>
                  <Link href={`/mazo/${d.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium hover:text-violet-300">{d.title}</p>
                    <p className="text-xs text-gray-500">Compartido por {d.is_mine ? "vos" : d.shared_by_name}</p>
                  </Link>
                  {(d.is_mine || group.is_owner) && (
                    <button
                      onClick={() => handleUnshare(d.id)}
                      className="rounded-lg p-2 text-gray-600 transition-all hover:bg-red-500/10 hover:text-red-400"
                      title="Quitar del grupo"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Duelos ── */}
      {tab === "duelos" && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Swords size={15} className="text-violet-400" />
              Duelos
            </div>
            <button
              onClick={() => setPicker(picker === "duel" ? null : "duel")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-white/20 hover:text-white"
            >
              <Plus size={13} /> Crear duelo
            </button>
          </div>

          {picker === "duel" && (
            <div className="mb-4">
              <DocPicker
                label="Mismas preguntas para todo el grupo. Elegí el material:"
                docs={duelDocs}
                onPick={handleCreateDuel}
                onCancel={() => setPicker(null)}
              />
            </div>
          )}

          {busy && <div className="mb-3 flex justify-center"><Loader2 className="animate-spin text-violet-500" size={18} /></div>}

          {duels.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-600">
              Sin duelos todavía. Creá uno y competí con tu comisión sobre las mismas preguntas.
            </p>
          ) : (
            <div className="space-y-2">
              {duels.map((d) => (
                <Link
                  key={d.id}
                  href={`/duelo/${d.id}`}
                  className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 transition-colors hover:border-violet-500/30"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                    <Swords size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.title}</p>
                    <p className="text-xs text-gray-500">
                      {d.total} preguntas · {d.played_count} {d.played_count === 1 ? "jugó" : "jugaron"}
                    </p>
                  </div>
                  {d.played ? (
                    <span className="shrink-0 rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-300">
                      {d.my_score}/{d.total}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-md bg-violet-500/15 px-2 py-1 text-xs font-semibold text-violet-300">
                      Jugar
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
