"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getDocument } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft, Send, Bot, User, MessageSquare } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Message {
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
}

const SUGGESTIONS = [
  "¿Cuáles son los conceptos más importantes de este tema?",
  "Explicame el tema principal como si fuera simple",
  "¿Qué diferencias hay entre los conceptos clave?",
  "Dame un ejemplo práctico del tema",
  "¿Qué preguntas podrían entrar en un examen?",
];

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const [docTitle, setDocTitle] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getDocument(id).then((doc) => setDocTitle(doc.title));
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const assistantMsg: Message = { role: "assistant", content: "", loading: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setLoading(true);

    // Historial para contexto (sin el último mensaje loading)
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${API_URL}/chat/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question: text, history }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Error en el servidor");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (!reader) throw new Error("No stream");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.token) {
              fullText += parsed.token;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: fullText,
                  loading: false,
                };
                return updated;
              });
            }
            if (parsed.error) throw new Error(parsed.error);
          } catch {}
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `Error: ${message}`,
          loading: false,
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#0f0f13]">

      {/* Header */}
      <div className="border-b border-white/5 px-6 py-4 flex items-center gap-4 bg-[#0f0f13]/80 backdrop-blur-xl">
        <Link href={`/study/${id}`} className="text-gray-500 hover:text-gray-300 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
            <Bot className="text-violet-400" size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Chat con tus apuntes</p>
            <p className="text-xs text-gray-500 truncate max-w-64">{docTitle}</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-600">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Asistente IA
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">

        {/* Estado vacío */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-6 pb-10">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center">
              <MessageSquare className="text-violet-400" size={28} />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-1">Preguntale a tus apuntes</h3>
              <p className="text-sm text-gray-500 max-w-sm">
                Las respuestas salen solo de tu documento. Si algo no está en el apunte, te lo dice.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="px-3 py-2 rounded-xl text-xs text-gray-400 border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:text-white hover:border-white/10 transition-all text-left"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mensajes */}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 max-w-3xl mx-auto w-full ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {/* Avatar */}
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5
              ${msg.role === "user" ? "bg-violet-600" : "bg-white/5"}`}
            >
              {msg.role === "user"
                ? <User size={14} className="text-white" />
                : <Bot size={14} className="text-gray-400" />
              }
            </div>

            {/* Bubble */}
            <div className={`rounded-2xl px-4 py-3 max-w-[85%] text-sm leading-relaxed
              ${msg.role === "user"
                ? "bg-violet-600 text-white rounded-tr-sm"
                : "bg-white/[0.04] border border-white/5 text-gray-200 rounded-tl-sm"
              }`}
            >
              {msg.loading ? (
                <div className="flex gap-1 items-center py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/5 p-4 bg-[#0f0f13]">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3 items-end rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 focus-within:border-violet-500/40 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Preguntale algo al documento..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 resize-none outline-none max-h-32"
              style={{ height: "auto" }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all
                ${input.trim() && !loading
                  ? "bg-violet-600 hover:bg-violet-500 text-white"
                  : "bg-white/5 text-gray-600 cursor-not-allowed"
                }`}
            >
              <Send size={14} />
            </button>
          </div>
          <p className="text-xs text-gray-700 mt-2 text-center">Enter para enviar · Shift+Enter para nueva línea</p>
        </div>
      </div>
    </div>
  );
}
