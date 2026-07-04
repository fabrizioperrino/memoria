"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Circle, Loader2, Pause, Play, Timer, Users } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";

const FOCUS_MINUTES = 25;

interface Presence {
  user_id: string;
  name: string;
  status: "viewing" | "studying";
  focus_end?: number; // epoch ms en que termina el pomodoro
}

function mmss(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function StudyRoom({ groupId }: { groupId: string }) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Presence[]>([]);
  const [connected, setConnected] = useState(false);
  const [focusing, setFocusing] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const displayName =
    (user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || "Estudiante";
  const myId = user?.id || "anon";

  // Conexión a presencia del grupo
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const channel = supabase.channel(`presence:group:${groupId}`, {
      config: { presence: { key: myId } },
    });
    channelRef.current = channel;

    const syncMembers = () => {
      const state = channel.presenceState<Presence>();
      const list: Presence[] = [];
      for (const key of Object.keys(state)) {
        const entry = state[key][0];
        if (entry) list.push(entry as unknown as Presence);
      }
      // estudiando primero
      list.sort((a, b) => (a.status === "studying" ? -1 : 1) - (b.status === "studying" ? -1 : 1));
      setMembers(list);
    };

    channel
      .on("presence", { event: "sync" }, syncMembers)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
          await channel.track({ user_id: myId, name: displayName, status: "viewing" });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [groupId, user, myId, displayName]);

  // Tick del pomodoro
  useEffect(() => {
    if (!focusing) return;
    tickRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          stopFocus();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusing]);

  async function startFocus() {
    const end = Date.now() + FOCUS_MINUTES * 60 * 1000;
    setFocusing(true);
    setRemaining(FOCUS_MINUTES * 60);
    await channelRef.current?.track({ user_id: myId, name: displayName, status: "studying", focus_end: end });
  }

  async function stopFocus() {
    setFocusing(false);
    setRemaining(0);
    if (tickRef.current) clearInterval(tickRef.current);
    await channelRef.current?.track({ user_id: myId, name: displayName, status: "viewing" });
  }

  const studying = members.filter((m) => m.status === "studying");

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Users size={15} className="text-violet-400" />
          Sala de estudio
        </div>
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          {connected ? (
            <>
              <Circle size={8} className="fill-emerald-400 text-emerald-400" />
              en vivo
            </>
          ) : (
            <>
              <Loader2 size={11} className="animate-spin" /> conectando…
            </>
          )}
        </span>
      </div>

      {/* Pomodoro */}
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/[0.05] p-4">
        <Timer size={20} className={focusing ? "text-violet-300" : "text-gray-500"} />
        <div className="flex-1">
          {focusing ? (
            <>
              <p className="font-mono text-lg font-bold leading-none text-white">{mmss(remaining)}</p>
              <p className="mt-0.5 text-xs text-gray-500">Enfocado — el grupo te ve estudiando</p>
            </>
          ) : (
            <p className="text-sm text-gray-400">Empezá un foco de {FOCUS_MINUTES} min y sumate a la sala.</p>
          )}
        </div>
        <button
          onClick={focusing ? stopFocus : startFocus}
          disabled={!connected}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 ${
            focusing ? "border border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/20" : "bg-violet-600 text-white hover:bg-violet-500"
          }`}
        >
          {focusing ? <><Pause size={14} /> Parar</> : <><Play size={14} /> Enfocar</>}
        </button>
      </div>

      {/* Quién está */}
      {members.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-600">Nadie en la sala ahora. Sé el primero.</p>
      ) : (
        <div className="space-y-2">
          {studying.length > 0 && (
            <p className="text-xs font-medium text-emerald-400">
              Estudiando ahora ({studying.length})
            </p>
          )}
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.015] px-4 py-2.5">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${m.status === "studying" ? "bg-emerald-500/15" : "bg-white/5"}`}>
                <span className={`text-xs font-bold ${m.status === "studying" ? "text-emerald-300" : "text-gray-500"}`}>
                  {m.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="min-w-0 flex-1 truncate text-sm text-gray-300">
                {m.name}
                {m.user_id === myId && <span className="ml-1.5 text-xs text-violet-400">(vos)</span>}
              </span>
              {m.status === "studying" ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  estudiando
                </span>
              ) : (
                <span className="text-xs text-gray-600">en la sala</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
