"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getStatsSummary, StatsSummary } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import {
  User, Mail, Calendar, FileText, Layers, HelpCircle,
  BarChart2, Star, LogOut, Flame, BookOpen, GraduationCap,
  Building2, Pencil, Check, X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "sonner";

function StatCard({
  icon, label, value, color = "violet",
}: {
  icon: React.ReactNode; label: string; value: string | number; color?: string;
}) {
  const colors: Record<string, string> = {
    violet:  "bg-violet-500/10 text-violet-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
    blue:    "bg-blue-500/10   text-blue-400",
    amber:   "bg-amber-500/10  text-amber-400",
    orange:  "bg-orange-500/10 text-orange-400",
  };
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}

function EditableField({
  icon, label, value, placeholder, onSave,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  placeholder: string;
  onSave: (v: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);
  const [saving,  setSaving]  = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(draft.trim());
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/5">
      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-gray-500">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-600 mb-0.5">{label}</p>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
            placeholder={placeholder}
            className="w-full bg-transparent text-sm text-white outline-none border-b border-violet-500/60 pb-0.5"
          />
        ) : (
          <p className={`text-sm truncate ${value ? "text-white" : "text-gray-600"}`}>
            {value || placeholder}
          </p>
        )}
      </div>
      {editing ? (
        <div className="flex items-center gap-1">
          <button onClick={handleSave} disabled={saving}
            className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-all disabled:opacity-50">
            <Check size={14} />
          </button>
          <button onClick={() => { setEditing(false); setDraft(value); }}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-white/5 transition-all">
            <X size={14} />
          </button>
        </div>
      ) : (
        <button onClick={() => { setDraft(value); setEditing(true); }}
          className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-all">
          <Pencil size={13} />
        </button>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();

  const [stats,        setStats]        = useState<StatsSummary | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Campos de perfil
  const [fullName,    setFullName]    = useState("");
  const [faculty,     setFaculty]     = useState("");
  const [university,  setUniversity]  = useState("");

  useEffect(() => {
    if (user) {
      setFullName(   (user.user_metadata?.full_name   as string) || "");
      setFaculty(    (user.user_metadata?.faculty      as string) || "");
      setUniversity( (user.user_metadata?.university   as string) || "");
    }
  }, [user]);

  useEffect(() => {
    getStatsSummary()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

  async function handleSignOut() {
    await signOut();
    router.replace("/auth");
  }

  async function saveField(field: string, value: string) {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: { [field]: value },
      });
      if (error) {
        toast.error("No se pudo guardar");
      } else {
        toast.success("Guardado ✓");
        if (field === "full_name")  setFullName(value);
        if (field === "faculty")    setFaculty(value);
        if (field === "university") setUniversity(value);
      }
    } catch {
      toast.error("Error al guardar. Intentá de nuevo.");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const joinedAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  const displayName = fullName || user?.email?.split("@")[0] || "?";
  const initials    = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <Toaster richColors theme="dark" />

      {/* ── Avatar + Info ── */}
      <div className="flex items-center gap-6 mb-10">
        <div className="w-20 h-20 rounded-2xl bg-violet-500/20 flex items-center justify-center text-2xl font-bold text-violet-400 select-none shrink-0">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">
            {displayName}
          </h1>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Mail size={13} />
            <span>{user?.email}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
            <Calendar size={13} />
            <span>Se unió el {joinedAt}</span>
          </div>
        </div>
      </div>

      {/* ── Streak banner ── */}
      {stats && (stats.study_streak ?? 0) > 0 && (
        <div className="mb-8 rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/15 flex items-center justify-center shrink-0">
            <Flame size={22} className="text-orange-400" />
          </div>
          <div>
            <p className="font-bold text-orange-300 text-lg">
              🔥 {stats.study_streak} {stats.study_streak === 1 ? "día" : "días"} seguidos estudiando
            </p>
            <p className="text-xs text-orange-500/70 mt-0.5">¡Seguí así! La constancia es la clave.</p>
          </div>
        </div>
      )}

      {/* ── Información personal ── */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Mi información
        </h2>
        <div className="space-y-2">
          <EditableField
            icon={<User size={15} />}
            label="Nombre completo"
            value={fullName}
            placeholder="Ingresá tu nombre"
            onSave={(v) => saveField("full_name", v)}
          />
          <EditableField
            icon={<GraduationCap size={15} />}
            label="Facultad / Carrera"
            value={faculty}
            placeholder="Ej: Ingeniería en Sistemas"
            onSave={(v) => saveField("faculty", v)}
          />
          <EditableField
            icon={<Building2 size={15} />}
            label="Universidad"
            value={university}
            placeholder="Ej: Universidad de Buenos Aires"
            onSave={(v) => saveField("university", v)}
          />
        </div>
      </div>

      {/* ── Materias ── */}
      {stats && (stats.top_subjects?.length ?? 0) > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Mis materias
          </h2>
          <div className="flex flex-wrap gap-2">
            {(stats.top_subjects ?? []).map(({ subject, count }) => (
              <div key={subject}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20">
                <BookOpen size={12} className="text-violet-400" />
                <span className="text-sm text-violet-300">{subject}</span>
                <span className="text-xs text-violet-500">{count} doc{count !== 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Estadísticas
        </h2>

        {statsLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-[72px] rounded-xl bg-white/[0.02] border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={<FileText size={18} />}   label="Documentos subidos"   value={stats.total_documents}    color="violet" />
            <StatCard icon={<Layers size={18} />}     label="Flashcards generadas" value={stats.total_flashcards}   color="blue"   />
            <StatCard icon={<HelpCircle size={18} />} label="Quizzes completados"  value={stats.total_quiz_attempts} color="emerald" />
            <StatCard icon={<Star size={18} />}       label="Mejor quiz"           value={stats.best_quiz_score > 0 ? `${stats.best_quiz_score}%` : "—"} color="amber" />
            <StatCard icon={<BarChart2 size={18} />}  label="Promedio de quizzes"  value={stats.average_quiz_score > 0 ? `${stats.average_quiz_score}%` : "—"} color="violet" />
            <StatCard icon={<Flame size={18} />}      label="Racha actual"         value={`${stats.study_streak ?? 0} ${(stats.study_streak ?? 0) === 1 ? "día" : "días"}`} color="orange" />
          </div>
        ) : (
          <p className="text-sm text-gray-600">No se pudieron cargar las estadísticas.</p>
        )}
      </div>

      {/* ── Cerrar sesión ── */}
      <div className="pt-6 border-t border-white/5">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/30 transition-all"
        >
          <LogOut size={15} />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
