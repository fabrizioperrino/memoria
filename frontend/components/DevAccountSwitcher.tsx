"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { FlaskConical, Loader2, Check, ChevronUp, ChevronDown } from "lucide-react";

// ⚠️ SOLO DESARROLLO — este componente se renderiza únicamente en localhost.
// Nunca aparece en producción (ver `isDevEnv`).
const TEST_ACCOUNTS: { email: string; password: string; name: string; color: string }[] = [
  { email: "fabrizio@memoria.local", password: "memoria123", name: "Fabrizio (vos)", color: "bg-violet-500" },
  { email: "ana@test.local", password: "test123456", name: "Ana Gómez", color: "bg-pink-500" },
  { email: "beto@test.local", password: "test123456", name: "Beto Ríos", color: "bg-blue-500" },
  { email: "lucia@test.local", password: "test123456", name: "Lucía Paz", color: "bg-emerald-500" },
  { email: "mateo@test.local", password: "test123456", name: "Mateo Sosa", color: "bg-amber-500" },
  { email: "sofia@test.local", password: "test123456", name: "Sofía Luna", color: "bg-teal-500" },
];

function isDevEnv() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || process.env.NEXT_PUBLIC_DEV_MODE === "true";
}

export default function DevAccountSwitcher() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    setShow(isDevEnv());
  }, []);

  if (!show) return null;

  const currentEmail = user?.email ?? "";
  const current = TEST_ACCOUNTS.find((a) => a.email === currentEmail);

  async function switchTo(acc: (typeof TEST_ACCOUNTS)[number]) {
    if (acc.email === currentEmail) {
      setOpen(false);
      return;
    }
    setSwitching(acc.email);
    const supabase = createClient();
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithPassword({
      email: acc.email,
      password: acc.password,
    });
    if (error) {
      setSwitching(null);
      alert(`No se pudo entrar como ${acc.name}: ${error.message}`);
      return;
    }
    // Reload duro para que middleware + AuthContext tomen la sesión nueva
    window.location.href = "/";
  }

  return (
    <div className="fixed bottom-3 left-1/2 z-[100] -translate-x-1/2">
      {/* Lista expandida */}
      {open && (
        <div className="mb-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-[#16161c]/95 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <div className="border-b border-white/5 px-3 py-2 text-[10px] font-medium uppercase tracking-widest text-gray-500">
            Cambiar de cuenta (dev)
          </div>
          {TEST_ACCOUNTS.map((acc) => {
            const active = acc.email === currentEmail;
            return (
              <button
                key={acc.email}
                onClick={() => switchTo(acc)}
                disabled={switching !== null}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-50 ${
                  active ? "bg-violet-500/10" : "hover:bg-white/5"
                }`}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${acc.color}`}>
                  {acc.name.charAt(0)}
                </span>
                <span className={`flex-1 truncate ${active ? "text-white" : "text-gray-300"}`}>{acc.name}</span>
                {switching === acc.email ? (
                  <Loader2 size={14} className="animate-spin text-violet-400" />
                ) : active ? (
                  <Check size={14} className="text-violet-400" />
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {/* Pill */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-[#16161c]/95 px-3.5 py-2 text-xs text-gray-300 shadow-2xl shadow-black/50 backdrop-blur-xl transition-colors hover:border-violet-500/40"
      >
        <FlaskConical size={13} className="text-violet-400" />
        <span className="font-medium">{current?.name || currentEmail.split("@")[0] || "sin sesión"}</span>
        {open ? <ChevronDown size={13} className="text-gray-500" /> : <ChevronUp size={13} className="text-gray-500" />}
      </button>
    </div>
  );
}
