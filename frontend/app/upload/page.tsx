"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { uploadDocument, uploadText, importFromUrl } from "@/lib/api";
import { toast, Toaster } from "sonner";
import { Upload, FileText, Image, X, Sparkles, CheckCircle2, AlignLeft, Paperclip, Globe, Link } from "lucide-react";

const ACCEPTED = ".pdf,image/jpeg,image/png,image/webp";

type Tab = "file" | "text" | "url";

export default function UploadPage() {
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("file");

  // ── Estado modo archivo ──────────────────────────────────────────────────
  const [file, setFile]       = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  // ── Estado modo texto ────────────────────────────────────────────────────
  const [textTitle,   setTextTitle]   = useState("");
  const [textContent, setTextContent] = useState("");

  // ── Estado modo URL ───────────────────────────────────────────────────────
  const [urlValue, setUrlValue] = useState("");

  // ── Compartido ───────────────────────────────────────────────────────────
  const [subject,   setSubject]   = useState("");
  const [uploading, setUploading] = useState(false);
  const [step,      setStep]      = useState<"idle" | "uploading" | "processing" | "done">("idle");
  const [slowWarning, setSlowWarning] = useState(false);

  // ── Handlers archivo ─────────────────────────────────────────────────────
  const handleFile = (f: File) => setFile(f);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (tab === "file" && !file) return;
    if (tab === "text" && (!textTitle.trim() || !textContent.trim())) return;
    if (tab === "url"  && !urlValue.trim()) return;

    setUploading(true);
    setSlowWarning(false);
    setStep("uploading");
    setTimeout(() => setStep("processing"), 1500);
    const slowTimer = setTimeout(() => setSlowWarning(true), 40_000);

    try {
      let doc;
      if (tab === "file") {
        doc = await uploadDocument(file!, subject);
      } else if (tab === "text") {
        doc = await uploadText(textTitle.trim(), textContent.trim(), subject);
      } else {
        doc = await importFromUrl(urlValue.trim(), subject);
      }
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
  const canSubmit = !uploading && (
    (tab === "file" && !!file) ||
    (tab === "text" && !!textTitle.trim() && !!textContent.trim()) ||
    (tab === "url"  && !!urlValue.trim())
  );

  return (
    <main className="min-h-screen bg-[#0f0f13] flex items-center justify-center p-6">
      <Toaster richColors theme="dark" />

      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Subir material</h1>
          <p className="text-gray-400 text-sm">
            Subí un archivo o pegá texto directamente. La IA genera todo el material de estudio.
          </p>
        </div>

        {/* Tab toggle */}
        <div className="flex rounded-xl bg-white/[0.04] p-1 mb-6 gap-1">
          {([
            { id: "file", label: "Archivo",     icon: Paperclip },
            { id: "text", label: "Pegar texto", icon: AlignLeft  },
            { id: "url",  label: "Desde URL",   icon: Globe       },
          ] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setTab(id); setStep("idle"); }}
              disabled={uploading}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                tab === id
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* ── Modo Archivo ── */}
        {tab === "file" && (
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
        )}

        {/* ── Modo Texto ── */}
        {tab === "text" && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Título *</label>
              <input
                type="text"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                placeholder="Ej: Revolución Francesa, Fotosíntesis..."
                disabled={uploading}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500/60 focus:bg-white/[0.07] transition-all disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Contenido * <span className="text-gray-600">({textContent.length.toLocaleString()} caracteres)</span>
              </label>
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Pegá acá tus apuntes, texto del libro, artículo o cualquier contenido que quieras estudiar..."
                disabled={uploading}
                rows={10}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500/60 focus:bg-white/[0.07] transition-all resize-none disabled:opacity-50"
              />
            </div>
          </div>
        )}

        {/* ── Modo URL ── */}
        {tab === "url" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                  <Globe className="text-violet-400" size={18} />
                </div>
                <div>
                  <p className="text-sm font-medium text-white mb-0.5">Importar desde URL</p>
                  <p className="text-xs text-gray-500">
                    Pegá el link de un artículo, Wikipedia, apunte online u otra página. Extraemos el texto y generamos el material de estudio.
                  </p>
                </div>
              </div>
              <div className="relative">
                <Link size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
                <input
                  type="url"
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  placeholder="https://es.wikipedia.org/wiki/..."
                  disabled={uploading}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500/60 focus:bg-white/[0.07] transition-all disabled:opacity-50"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  "es.wikipedia.org",
                  "Artículo web",
                  "Apunte online",
                ].map((eg) => (
                  <span key={eg} className="text-[11px] px-2 py-1 rounded-full bg-white/5 text-gray-600 border border-white/5">
                    {eg}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Materia (compartido) ── */}
        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Materia <span className="text-gray-600">(opcional)</span></label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ej: Historia, Biología, Derecho..."
            disabled={uploading}
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500/60 focus:bg-white/[0.07] transition-all disabled:opacity-50"
          />
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
                { id: "uploading",  label: tab === "file" ? "Subiendo archivo..." : tab === "url" ? "Accediendo a la URL..." : "Enviando texto..." },
                { id: "processing", label: "Groq está analizando el contenido..." },
                { id: "done",       label: "¡Generando material de estudio!" },
              ].map((s) => {
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
          disabled={!canSubmit}
          onClick={handleUpload}
          className={`w-full mt-4 h-13 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2
            ${canSubmit
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
