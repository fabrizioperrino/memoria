"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getGroup, leaveGroup, GroupDetail } from "@/lib/api";
import { toast, Toaster } from "sonner";
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  Flame,
  Loader2,
  LogOut,
  Medal,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

function RankBadge({ position }: { position: number }) {
  if (position === 1) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
        <Trophy size={15} />
      </div>
    );
  }
  if (position === 2) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-400/15 text-gray-300">
        <Medal size={15} />
      </div>
    );
  }
  if (position === 3) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-700/20 text-orange-400">
        <Medal size={15} />
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-sm font-semibold text-gray-500">
      {position}
    </div>
  );
}

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    getGroup(params.id)
      .then(setGroup)
      .catch(() => toast.error("No se pudo cargar el grupo"))
      .finally(() => setLoading(false));
  }, [params.id]);

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
    if (!group) return;
    if (!confirm(`¿Salir de "${group.name}"?`)) return;
    setLeaving(true);
    try {
      await leaveGroup(group.id);
      toast.success("Saliste del grupo");
      router.push("/grupos");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo salir del grupo");
      setLeaving(false);
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

      {/* ── Header del grupo ── */}
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
        <p className="mt-3 text-xs text-gray-600">
          Compartí el código con tu comisión para que se sumen al ranking.
        </p>
      </div>

      {/* ── Ranking ── */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Flame size={15} className="text-orange-400" />
            Ranking semanal
          </div>
          <span className="text-xs text-gray-600">Últimos 7 días</span>
        </div>

        <div className="space-y-2">
          {group.ranking.map((entry, i) => (
            <div
              key={entry.user_id}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                entry.is_you
                  ? "border-violet-500/35 bg-violet-500/[0.07]"
                  : "border-white/8 bg-white/[0.015]"
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

        {group.ranking.length === 1 && (
          <p className="mt-4 text-center text-xs text-gray-600">
            Por ahora sos vos solo. Pasá el código <span className="font-mono text-gray-400">{group.code}</span> y
            que empiece la competencia.
          </p>
        )}
      </div>
    </main>
  );
}
