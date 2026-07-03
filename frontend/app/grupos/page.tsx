"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listGroups, createGroup, joinGroup, Group } from "@/lib/api";
import { toast, Toaster } from "sonner";
import {
  ChevronRight,
  Crown,
  Loader2,
  Plus,
  Ticket,
  Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function GroupsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  const displayName =
    (user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || "";

  useEffect(() => {
    listGroups()
      .then(setGroups)
      .catch(() => toast.error("No se pudieron cargar los grupos"))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (newName.trim().length < 2) {
      toast.error("Poné un nombre de al menos 2 caracteres");
      return;
    }
    setCreating(true);
    try {
      const group = await createGroup(newName.trim(), displayName);
      toast.success(`Grupo "${group.name}" creado`);
      router.push(`/grupos/${group.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error creando el grupo");
      setCreating(false);
    }
  }

  async function handleJoin() {
    if (joinCode.trim().length < 4) {
      toast.error("El código tiene 6 caracteres");
      return;
    }
    setJoining(true);
    try {
      const group = await joinGroup(joinCode.trim(), displayName);
      toast.success(
        group.already_member ? "Ya eras parte de este grupo" : `Te uniste a "${group.name}"`
      );
      router.push(`/grupos/${group.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Código inválido");
      setJoining(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Toaster theme="dark" position="top-center" />

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Grupos de estudio</h1>
        <p className="mt-1 text-sm text-gray-500">
          Estudiá con tu comisión. El ranking semanal se arma con el XP de cada uno.
        </p>
      </div>

      {/* ── Unirse con código ── */}
      <div className="mb-5 rounded-2xl border border-white/8 bg-white/[0.02] p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Ticket size={15} className="text-violet-400" />
          Unite con un código
        </div>
        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            placeholder="Ej: XK4M2P"
            maxLength={12}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 font-mono text-sm uppercase tracking-widest text-white placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none"
          />
          <button
            onClick={handleJoin}
            disabled={joining || joinCode.trim().length < 4}
            className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-violet-500 active:scale-[0.98] disabled:opacity-40"
          >
            {joining ? <Loader2 size={16} className="animate-spin" /> : "Unirme"}
          </button>
        </div>
      </div>

      {/* ── Mis grupos ── */}
      <div className="mb-5 rounded-2xl border border-white/8 bg-white/[0.02] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Users size={15} className="text-violet-400" />
            Mis grupos
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-white/20 hover:text-white"
          >
            <Plus size={13} />
            Crear grupo
          </button>
        </div>

        {showCreate && (
          <div className="mb-4 flex gap-2 rounded-xl border border-violet-500/25 bg-violet-500/[0.05] p-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Nombre del grupo (ej: Anato — Comisión 4)"
              maxLength={60}
              autoFocus
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm text-white placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none"
            />
            <button
              onClick={handleCreate}
              disabled={creating || newName.trim().length < 2}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-violet-500 active:scale-[0.98] disabled:opacity-40"
            >
              {creating ? <Loader2 size={15} className="animate-spin" /> : "Crear"}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-violet-500" size={22} />
          </div>
        ) : groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-600">
            Todavía no estás en ningún grupo. Creá uno y pasale el código a tu comisión.
          </p>
        ) : (
          <div className="space-y-2">
            {groups.map((g) => (
              <Link
                key={g.id}
                href={`/grupos/${g.id}`}
                className="group flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3.5 transition-colors hover:border-violet-500/30 hover:bg-white/[0.04]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                    <Users size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                      {g.name}
                      {g.is_owner && <Crown size={12} className="shrink-0 text-amber-400" />}
                    </p>
                    <p className="text-xs text-gray-500">
                      {g.member_count} {g.member_count === 1 ? "miembro" : "miembros"} · código{" "}
                      <span className="font-mono tracking-wider text-gray-400">{g.code}</span>
                    </p>
                  </div>
                </div>
                <ChevronRight size={16} className="shrink-0 text-gray-600 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
