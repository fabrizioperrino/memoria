"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brain, Upload, LayoutDashboard, LogOut, User } from "lucide-react";
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
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0f0f13]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-600/30">
            <Brain className="w-4.5 h-4.5 text-white" size={18} />
          </div>
          <span className="text-lg font-bold tracking-tight">
            memor<span className="text-violet-400">IA</span>
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {!loading && user && (
            <>
              <Link
                href="/"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <LayoutDashboard size={15} />
                Dashboard
              </Link>

              <Link
                href="/upload"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-all shadow-lg shadow-violet-600/20"
              >
                <Upload size={15} />
                Subir material
              </Link>

              {/* User menu */}
              <div className="flex items-center gap-1 ml-1 pl-3 border-l border-white/10">
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:text-white hover:bg-white/5 transition-all"
                  title="Ver perfil"
                >
                  <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center">
                    <User size={12} className="text-violet-400" />
                  </div>
                  <span className="hidden sm:block max-w-[120px] truncate">
                    {user.email?.split("@")[0]}
                  </span>
                </Link>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  title="Cerrar sesión"
                  className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
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
