"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getStatsSummary, StatsSummary } from "@/lib/api";
import {
  User,
  Mail,
  Calendar,
  FileText,
  Layers,
  HelpCircle,
  BarChart2,
  Star,
  LogOut,
} from "lucide-react";
import { useRouter } from "next/navigation";

function StatCard({
  icon,
  label,
  value,
  color = "violet",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
}) {
  const colors: Record<string, string> = {
    violet: "bg-violet-500/10 text-violet-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
    blue:   "bg-blue-500/10   text-blue-400",
    amber:  "bg-amber-500/10  text-amber-400",
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

export default function ProfilePage() {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const joinedAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("es-AR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  const initials = (user?.email ?? "?")
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">

      {/* Avatar + Info */}
      <div className="flex items-center gap-6 mb-10">
        <div className="w-20 h-20 rounded-2xl bg-violet-500/20 flex items-center justify-center text-2xl font-bold text-violet-400 select-none">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Mi perfil</h1>
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

      {/* Stats */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Estadísticas
        </h2>

        {statsLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-[72px] rounded-xl bg-white/[0.02] border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<FileText size={18} />}
              label="Documentos subidos"
              value={stats.total_documents}
              color="violet"
            />
            <StatCard
              icon={<Layers size={18} />}
              label="Flashcards generadas"
              value={stats.total_flashcards}
              color="blue"
            />
            <StatCard
              icon={<HelpCircle size={18} />}
              label="Quizzes completados"
              value={stats.total_quiz_attempts}
              color="emerald"
            />
            <StatCard
              icon={<Star size={18} />}
              label="Mejor quiz"
              value={stats.best_quiz_score > 0 ? `${stats.best_quiz_score}%` : "—"}
              color="amber"
            />
            <StatCard
              icon={<BarChart2 size={18} />}
              label="Promedio de quizzes"
              value={stats.average_quiz_score > 0 ? `${stats.average_quiz_score}%` : "—"}
              color="violet"
            />
            <StatCard
              icon={<User size={18} />}
              label="Conceptos aprendidos"
              value={stats.total_concepts}
              color="emerald"
            />
          </div>
        ) : (
          <p className="text-sm text-gray-600">No se pudieron cargar las estadísticas.</p>
        )}
      </div>

      {/* Cerrar sesión */}
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
