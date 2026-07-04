import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import NavBar from "@/components/NavBar";
import DevAccountSwitcher from "@/components/DevAccountSwitcher";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "memorIA — Estudiá con memoria",
  description:
    "Subí tus apuntes y convertilos en flashcards, exámenes y un plan de estudio que sabe qué aprendiste — y qué estás por olvidar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${geist.className} bg-[#0f0f13] text-white min-h-screen`}>
        <AuthProvider>
          <NavBar />
          <div className="pt-16">
            {children}
          </div>
          <DevAccountSwitcher />
        </AuthProvider>
      </body>
    </html>
  );
}
