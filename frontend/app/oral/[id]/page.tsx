"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getDocument,
  transcribeOralAnswer,
  evaluateAnswer,
  AnswerEvaluation,
  ExamQuestion,
  Document,
} from "@/lib/api";
import { toast, Toaster } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GraduationCap,
  Loader2,
  Mic,
  RotateCcw,
  Square,
  Volume2,
} from "lucide-react";

const MAX_QUESTIONS = 4; // preguntas principales por mesa

// ── Voz del profesor (SpeechSynthesis, gratis, corre en el dispositivo) ─────────
function useProfessorVoice() {
  const [speaking, setSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!supported) return;
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      voiceRef.current =
        voices.find((v) => v.lang.startsWith("es") && /Google|Paulina|Mónica|Jorge/i.test(v.name)) ||
        voices.find((v) => v.lang.startsWith("es")) ||
        null;
    };
    pick();
    window.speechSynthesis.onvoiceschanged = pick;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (voiceRef.current) u.voice = voiceRef.current;
      u.lang = voiceRef.current?.lang || "es-ES";
      u.rate = 1.0;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    },
    [supported]
  );

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  return { speak, stop, speaking, supported };
}

// ── Grabador de audio (MediaRecorder) ───────────────────────────────────────────
function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
    rec.start();
    recorderRef.current = rec;
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }, []);

  const stop = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (timerRef.current) clearInterval(timerRef.current);
      if (!rec) return resolve(new Blob());
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setRecording(false);
        resolve(blob);
      };
      rec.stop();
    });
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  return { recording, seconds, start, stop };
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8 ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" :
    score >= 6 ? "bg-violet-500/15 text-violet-300 border-violet-500/30" :
    score >= 4 ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                 "bg-red-500/15 text-red-400 border-red-500/30";
  return (
    <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-sm font-bold ${color}`}>
      {score}/10
    </span>
  );
}

type Step = "asking" | "recording" | "transcribing" | "review" | "evaluating" | "feedback";

interface Turn {
  question: string;
  isFollowUp: boolean;
  transcript: string;
  evaluation: AnswerEvaluation | null;
}

export default function OralExamPage() {
  const params = useParams<{ id: string }>();
  const { speak, stop: stopVoice, speaking, supported: voiceSupported } = useProfessorVoice();
  const { recording, seconds, start: startRec, stop: stopRec } = useRecorder();

  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<"intro" | "session" | "done">("intro");

  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([]); // turnos completados de la pregunta actual
  const [current, setCurrent] = useState<Turn | null>(null);
  const [step, setStep] = useState<Step>("asking");
  const [allResults, setAllResults] = useState<{ score: number }[]>([]);

  useEffect(() => {
    if (!params.id) return;
    getDocument(params.id)
      .then((d) => {
        setDoc(d);
        const qs = [...(d.exam_questions ?? [])].sort(() => Math.random() - 0.5).slice(0, MAX_QUESTIONS);
        setQuestions(qs);
      })
      .catch(() => toast.error("No se pudo cargar el documento"))
      .finally(() => setLoading(false));
  }, [params.id]);

  const askQuestion = useCallback(
    (question: string, isFollowUp: boolean) => {
      setCurrent({ question, isFollowUp, transcript: "", evaluation: null });
      setStep("asking");
      speak(question);
    },
    [speak]
  );

  function startSession() {
    if (questions.length === 0) return;
    setPhase("session");
    setQIndex(0);
    setTurns([]);
    setAllResults([]);
    askQuestion(questions[0].question, false);
  }

  async function handleStartRecording() {
    stopVoice();
    try {
      await startRec();
      setStep("recording");
    } catch {
      toast.error("No pudimos acceder al micrófono. Revisá los permisos del navegador.");
    }
  }

  async function handleStopRecording() {
    const blob = await stopRec();
    setStep("transcribing");
    try {
      const transcript = await transcribeOralAnswer(params.id, blob);
      setCurrent((c) => (c ? { ...c, transcript } : c));
      setStep("review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error transcribiendo");
      setStep("asking");
    }
  }

  async function handleEvaluate() {
    if (!current || !doc) return;
    setStep("evaluating");
    const expected =
      !current.isFollowUp
        ? questions[qIndex]?.correct_answer ?? ""
        : "";
    try {
      const evaluation = await evaluateAnswer(params.id, current.question, current.transcript, expected);
      const done: Turn = { ...current, evaluation };
      setCurrent(done);
      setStep("feedback");
      setAllResults((r) => [...r, { score: evaluation.score }]);
      speak(`${evaluation.score} de 10. ${evaluation.feedback}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error evaluando");
      setStep("review");
    }
  }

  function askFollowUp() {
    if (!current?.evaluation) return;
    stopVoice();
    setTurns((t) => [...t, current]);
    const fu = current.evaluation.follow_up_questions[0];
    askQuestion(fu, true);
  }

  function nextQuestion() {
    stopVoice();
    if (current) setTurns((t) => [...t, current]);
    const next = qIndex + 1;
    if (next < questions.length) {
      setQIndex(next);
      setTurns([]);
      askQuestion(questions[next].question, false);
    } else {
      setPhase("done");
      setCurrent(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="animate-spin text-violet-500" size={28} />
      </main>
    );
  }

  if (!doc || questions.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-gray-500">Este documento todavía no tiene preguntas para un oral.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-violet-400 hover:text-violet-300">
          Volver al dashboard
        </Link>
      </main>
    );
  }

  const avg =
    allResults.length > 0
      ? Math.round((allResults.reduce((s, r) => s + r.score, 0) / allResults.length) * 10) / 10
      : 0;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Toaster theme="dark" position="top-center" />

      <div className="mb-6 flex items-center justify-between">
        <Link
          href={`/study/${doc.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-white"
        >
          <ArrowLeft size={15} />
          {doc.title}
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
          <GraduationCap size={12} />
          Mesa de examen
        </span>
      </div>

      {/* ── Intro ── */}
      {phase === "intro" && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10">
            <GraduationCap className="text-violet-400" size={26} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Simulacro de final oral</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-400">
            Un profesor te va a hacer {questions.length} preguntas de este material. Las escuchás,
            respondés <strong className="text-gray-200">hablando en voz alta</strong> — como en la mesa
            real — y recibís nota, correcciones y repreguntas.
          </p>
          <div className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm text-gray-400">
            <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
              <Volume2 size={16} className="shrink-0 text-violet-400" /> El profesor pregunta en voz alta
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
              <Mic size={16} className="shrink-0 text-violet-400" /> Grabás tu respuesta hablando
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
              <Check size={16} className="shrink-0 text-violet-400" /> Recibís nota y repregunta
            </div>
          </div>
          {!voiceSupported && (
            <p className="mt-4 text-xs text-amber-400/80">
              Tu navegador no puede reproducir la voz del profesor, pero vas a ver la pregunta escrita.
            </p>
          )}
          <button
            onClick={startSession}
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-violet-600/25 transition-all hover:bg-violet-500 active:scale-[0.98]"
          >
            Pasar al frente
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* ── Sesión ── */}
      {phase === "session" && current && (
        <div>
          <div className="mb-4 flex items-center justify-between text-xs text-gray-500">
            <span>Pregunta {qIndex + 1} de {questions.length}</span>
            {allResults.length > 0 && <span>Promedio parcial: {avg}/10</span>}
          </div>

          {/* Profesor + pregunta */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300 ${speaking ? "animate-pulse" : ""}`}>
                <GraduationCap size={18} />
              </div>
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">
                    {current.isFollowUp ? "Repregunta del profesor" : "El profesor pregunta"}
                  </span>
                  {voiceSupported && (
                    <button
                      onClick={() => speak(current.question)}
                      className="text-gray-600 transition-colors hover:text-violet-400"
                      title="Escuchar otra vez"
                    >
                      <Volume2 size={13} />
                    </button>
                  )}
                </div>
                <p className="text-base font-semibold leading-relaxed text-white">{current.question}</p>
              </div>
            </div>
          </div>

          {/* Zona de respuesta según el paso */}
          <div className="mt-4">
            {(step === "asking" || step === "recording") && (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-8">
                {!recording ? (
                  <>
                    <button
                      onClick={handleStartRecording}
                      className="flex h-20 w-20 items-center justify-center rounded-full bg-violet-600 text-white shadow-xl shadow-violet-600/30 transition-all hover:bg-violet-500 active:scale-95"
                    >
                      <Mic size={30} />
                    </button>
                    <span className="text-sm text-gray-400">Tocá para responder hablando</span>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleStopRecording}
                      className="flex h-20 w-20 items-center justify-center rounded-full bg-red-600 text-white shadow-xl shadow-red-600/30 transition-all hover:bg-red-500 active:scale-95"
                    >
                      <Square size={26} fill="currentColor" />
                    </button>
                    <span className="flex items-center gap-2 text-sm text-red-300">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                      Grabando · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
                    </span>
                    <span className="text-xs text-gray-600">Tocá el cuadrado cuando termines</span>
                  </>
                )}
              </div>
            )}

            {step === "transcribing" && (
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-10 text-sm text-gray-400">
                <Loader2 className="animate-spin text-violet-500" size={18} />
                Transcribiendo tu respuesta…
              </div>
            )}

            {step === "review" && current.transcript && (
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                <p className="mb-2 text-xs font-medium text-gray-500">Esto es lo que entendimos:</p>
                <p className="text-sm leading-relaxed text-gray-200">“{current.transcript}”</p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleEvaluate}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition-all hover:bg-violet-500 active:scale-[0.99]"
                  >
                    Entregar respuesta
                    <ArrowRight size={15} />
                  </button>
                  <button
                    onClick={handleStartRecording}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-300 transition-colors hover:border-white/20"
                    title="Grabar de nuevo"
                  >
                    <RotateCcw size={15} />
                  </button>
                </div>
              </div>
            )}

            {step === "evaluating" && (
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-10 text-sm text-gray-400">
                <Loader2 className="animate-spin text-violet-500" size={18} />
                El profesor está evaluando…
              </div>
            )}

            {step === "feedback" && current.evaluation && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                  <p className="mb-2 text-xs text-gray-500">Tu respuesta</p>
                  <p className="text-sm leading-relaxed text-gray-300">“{current.transcript}”</p>
                </div>
                <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.05] p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-violet-300">Devolución</span>
                    <ScoreBadge score={current.evaluation.score} />
                  </div>
                  <p className="text-sm leading-relaxed text-gray-300">{current.evaluation.feedback}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {current.evaluation.follow_up_questions.length > 0 && (
                    <button
                      onClick={askFollowUp}
                      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-300 transition-colors hover:border-violet-500/40"
                    >
                      <Volume2 size={15} /> Aceptar repregunta
                    </button>
                  )}
                  <button
                    onClick={nextQuestion}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition-all hover:bg-violet-500 active:scale-[0.99]"
                  >
                    {qIndex + 1 < questions.length ? "Siguiente pregunta" : "Terminar el oral"}
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Resultado final ── */}
      {phase === "done" && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center">
          <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${avg >= 6 ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
            <GraduationCap className={avg >= 6 ? "text-emerald-400" : "text-amber-400"} size={30} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Oral terminado</h2>
          <p className="mt-2 text-sm text-gray-400">Tu promedio en la mesa</p>
          <div className="my-4">
            <span className={`text-5xl font-bold ${avg >= 6 ? "text-emerald-400" : "text-amber-400"}`}>{avg}</span>
            <span className="text-2xl text-gray-600">/10</span>
          </div>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-gray-400">
            {avg >= 8
              ? "Excelente. Manejás el tema con soltura para rendir."
              : avg >= 6
              ? "Bien encaminado. Reforzá los puntos donde el profesor te marcó omisiones."
              : "Todavía hay lagunas. Repasá el material y volvé a intentarlo — para eso es el simulacro."}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              onClick={startSession}
              className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-violet-500"
            >
              Otra mesa
            </button>
            <Link
              href="/progreso"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3 text-sm text-gray-300 transition-colors hover:border-white/20"
            >
              Ver mi preparación
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
