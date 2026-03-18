"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { uploadDocument } from "@/lib/api";
import { toast, Toaster } from "sonner";
import { Upload, FileText, Image, X, Sparkles, CheckCircle2 } from "lucide-react";

const ACCEPTED = ".pdf,image/jpeg,image/png,image/webp";

export default function UploadPage() {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState<"idle" | "uploading" | "processing" | "done">("idle");
  const [slowWarning, setSlowWarning] = useState(false);

  const handleFile = (f: File) => setFile(f);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setSlowWarning(false);
    setStep("uploading");

    // Simulamos progreso visual
    setTimeout(() => setStep("processing"), 1500);
    // Si tarda más de 40s, mostramos aviso
    const slowTimer = setTimeout(() => setSlowWarning(true), 40_000);

    try {
      const doc = await uploadDocument(file);
      clearTimeout(slowTimer);
      setStep("done");
      toast.success("¡Material procesado! 🎉");
      setTimeout(() => router.push(`/study/${doc.id}`), 900);
    } catch (err: unknown) {
      clearTimeout(slowTimer);
      setStep("idle");
      setSlowWarning(false);
      const message = err instanceof Error ? err.message : "Error desconocido";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const isPdf = file?.type === "application/pdf";

  return (
    <main className="min-h-screen bg-[#0f0f13] flex items-center justify-center p-6">
      <Toaster richColors theme="dark" />

      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Subir material</h1>
          <p className="text-gray-400 text-sm">
            Subí un PDF o foto de cuaderno. Groq + Llama lo analiza y genera todo en segundos.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && document.getElementById("file-input")?.click()}
          className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden
            ${dragging ? "border-violet-500 bg-violet-500/5" : ""}
            ${file && !dragging ? "border-white/20 bg-white/[0.03]" : ""}
            ${!file && !dragging ? "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]" : ""}
          `}
        >
          <input
            id="file-input"
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />

          <div className="p-12 flex flex-col items-center text-center">
            {file ? (
              <>
                <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
                  {isPdf
                    ? <FileText className="text-violet-400" size={26} />
                    : <Image className="text-violet-400" size={26} />
                  }
                </div>
                <p className="font-semibold text-white mb-1">{file.name}</p>
                <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); setStep("idle"); }}
                  className="mt-3 flex items-center gap-1 text-xs text-gray-600 hover:text-gray-400 transition-colors"
                >
                  <X size={12} /> Cambiar archivo
                </button>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                  <Upload className="text-gray-500" size={24} />
                </div>
                <p className="font-semibold text-white mb-1">Arrastrá o hacé clic para subir</p>
                <p className="text-sm text-gray-500">PDF, JPG, PNG o WEBP · Máx. 20 MB</p>
              </>
            )}
          </div>
        </div>

        {/* Slow warning */}
        {slowWarning && (
          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-300 flex items-center gap-2">
            <span>⏳</span>
            <span>El modelo está tardando un poco más de lo usual. Podés seguir esperando, no cerrés la página.</span>
          </div>
        )}

        {/* Steps indicator */}
        {uploading && (
          <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.03] p-5">
            <div className="flex flex-col gap-3">
              {[
                { id: "uploading", label: "Subiendo archivo..." },
                { id: "processing", label: "Groq está analizando el contenido..." },
                { id: "done", label: "¡Generando material de estudio!" },
              ].map((s, i) => {
                const steps = ["uploading", "processing", "done"];
                const currentIdx = steps.indexOf(step);
                const isActive = s.id === step;
                const isDone = steps.indexOf(s.id) < currentIdx;

                return (
                  <div key={s.id} className={`flex items-center gap-3 transition-all ${!isActive && !isDone ? "opacity-30" : ""}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all
                      ${isDone ? "bg-emerald-500" : isActive ? "bg-violet-500" : "bg-white/10"}`}
                    >
                      {isDone
                        ? <CheckCircle2 size={12} className="text-white" />
                        : isActive
                          ? <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                          : <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                      }
                    </div>
                    <span className={`text-sm ${isActive ? "text-white font-medium" : isDone ? "text-emerald-400" : "text-gray-600"}`}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Botón */}
        <button
          disabled={!file || uploading}
          onClick={handleUpload}
          className={`w-full mt-4 h-13 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2
            ${file && !uploading
              ? "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/20 cursor-pointer"
              : "bg-white/5 text-gray-600 cursor-not-allowed"
            }`}
        >
          {uploading ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Generar material de estudio
            </>
          )}
        </button>

        {/* Info chips */}
        <div className="mt-5 flex flex-wrap gap-2 justify-center">
          {["📄 Resumen automático", "🃏 Flashcards", "📝 Preguntas de examen", "🔑 Conceptos clave"].map((chip) => (
            <span key={chip} className="px-3 py-1 rounded-full text-xs text-gray-500 border border-white/5 bg-white/[0.02]">
              {chip}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
