"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brain, Upload, LayoutDashboard, LogOut, User, TrendingUp, Users, Play } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";

export default function NavBar() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    router.replace("/auth");
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0f0f13]/85 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-600/30">
            <Brain className="w-4.5 h-4.5 text-white" size={18} />
          </div>
          <span className="text-base sm:text-lg font-bold tracking-tight">
            memor<span className="text-violet-400">IA</span>
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-1 sm:gap-2">
          {!loading && !user && (
            <>
              <Link
                href="/auth"
                className="px-3 py-2 rounded-lg text-xs sm:text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all active:scale-95"
              >
                Ingresar
              </Link>
              <Link
                href="/auth"
                className="px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-all shadow-lg shadow-violet-600/20 active:scale-95"
              >
                Empezar gratis
              </Link>
            </>
          )}
          {!loading && user && (
            <>
              <Link
                href="/"
                className="flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all active:scale-95"
              >
                <LayoutDashboard size={15} />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>

              <Link
                href="/sesion"
                className="flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all active:scale-95"
              >
                <Play size={15} />
                <span className="hidden md:inline">Sesión</span>
              </Link>

              <Link
                href="/progreso"
                className="flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all active:scale-95"
              >
                <TrendingUp size={15} />
                <span className="hidden md:inline">Progreso</span>
              </Link>

              <Link
                href="/grupos"
                className="flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all active:scale-95"
              >
                <Users size={15} />
                <span className="hidden md:inline">Grupos</span>
              </Link>

              <Link
                href="/upload"
                className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-all shadow-lg shadow-violet-600/20 active:scale-95"
              >
                <Upload size={15} />
                <span className="hidden sm:inline">Subir material</span>
                <span className="sm:hidden">Subir</span>
              </Link>

              {/* User menu */}
              <div className="flex items-center gap-1 ml-0.5 sm:ml-1 pl-2 sm:pl-3 border-l border-white/10">
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-1.5 sm:px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:text-white hover:bg-white/5 transition-all active:scale-95"
                  title="Ver perfil"
                >
                  <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center">
                    <User size={12} className="text-violet-400" />
                  </div>
                  <span className="hidden sm:block max-w-[120px] truncate">
                    {(user.user_metadata?.full_name as string) || user.email?.split("@")[0]}
                  </span>
                </Link>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  title="Cerrar sesión"
                  className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all active:scale-95 disabled:opacity-50"
                >
                  <LogOut size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
