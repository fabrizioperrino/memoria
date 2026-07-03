"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  CalendarDays,
  Camera,
  Check,
  FileText,
  GraduationCap,
  Layers,
  Link2,
  MessageSquare,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";

/* ── Scroll reveal ─────────────────────────────────────────────────────────── */

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`reveal ${visible ? "reveal-in" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

/* ── Flashcard interactiva del hero ────────────────────────────────────────── */

const DEMO_CARDS = [
  {
    tag: "Fisiología",
    q: "¿Cuál es la función principal de las mitocondrias?",
    a: "Producir ATP mediante la respiración celular: la energía que usa toda la célula.",
  },
  {
    tag: "Derecho Constitucional",
    q: "¿Qué protege el hábeas corpus?",
    a: "La libertad física de las personas frente a detenciones ilegales o arbitrarias.",
  },
  {
    tag: "Química",
    q: "¿Qué establece el segundo principio de la termodinámica?",
    a: "La entropía de un sistema aislado nunca disminuye: los procesos naturales son irreversibles.",
  },
];

const DEMO_RATINGS = [
  { label: "No supe", next: "en 10 min", cls: "hover:border-red-500/60 hover:text-red-300" },
  { label: "Difícil", next: "mañana", cls: "hover:border-amber-500/60 hover:text-amber-300" },
  { label: "Bien", next: "en 3 días", cls: "hover:border-violet-500/60 hover:text-violet-300" },
  { label: "Fácil", next: "en 6 días", cls: "hover:border-emerald-500/60 hover:text-emerald-300" },
];

function DemoFlashcard() {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [scheduled, setScheduled] = useState<string | null>(null);
  const card = DEMO_CARDS[index];

  function rate(next: string) {
    if (scheduled) return;
    setScheduled(next);
    setTimeout(() => {
      setFlipped(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % DEMO_CARDS.length);
        setScheduled(null);
      }, 400);
    }, 1100);
  }

  return (
    <div className="relative w-full max-w-md mx-auto select-none">
      {/* Cartas de fondo (pila) */}
      <div className="absolute inset-x-4 -bottom-3 h-full rounded-2xl border border-white/5 bg-white/[0.02] rotate-[2deg]" />
      <div className="absolute inset-x-8 -bottom-6 h-full rounded-2xl border border-white/5 bg-white/[0.01] rotate-[-1.5deg]" />

      <div
        className={`card3d relative ${flipped ? "flipped" : ""}`}
        role="button"
        tabIndex={0}
        aria-label="Flashcard de demostración, tocá para dar vuelta"
        onClick={() => !flipped && setFlipped(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setFlipped((f) => !f);
        }}
      >
        <div className="card3d-inner relative min-h-[290px]">
          {/* Frente */}
          <div className="card3d-face absolute inset-0 flex flex-col rounded-2xl border border-white/10 bg-[#16161c] p-6 shadow-2xl shadow-black/50 cursor-pointer">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-widest text-violet-400">
                {card.tag}
              </span>
              <span className="text-[11px] text-gray-600">
                {index + 1} / {DEMO_CARDS.length}
              </span>
            </div>
            <p className="flex-1 flex items-center text-xl sm:text-2xl font-semibold leading-snug tracking-tight text-white">
              {card.q}
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <RotateCcw size={13} />
              Tocá la carta para ver la respuesta
            </div>
          </div>

          {/* Dorso */}
          <div className="card3d-back card3d-face absolute inset-0 flex flex-col rounded-2xl border border-violet-500/25 bg-[#16161c] p-6 shadow-2xl shadow-violet-950/40">
            <span className="text-[11px] font-medium uppercase tracking-widest text-gray-500">
              Respuesta
            </span>
            <p className="flex-1 flex items-center text-base sm:text-lg leading-relaxed text-gray-200">
              {card.a}
            </p>
            {scheduled ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-300">
                <Check size={15} />
                Próximo repaso: {scheduled}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {DEMO_RATINGS.map((r) => (
                  <button
                    key={r.label}
                    onClick={(e) => {
                      e.stopPropagation();
                      rate(r.next);
                    }}
                    className={`rounded-lg border border-white/10 bg-white/[0.03] px-1 py-2 text-[11px] sm:text-xs text-gray-400 transition-colors ${r.cls}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-gray-600">
        Así funciona el repaso espaciado: cada respuesta decide cuándo volvés a ver la carta.
      </p>
    </div>
  );
}

/* ── Curva del olvido ──────────────────────────────────────────────────────── */

function ForgettingCurve() {
  return (
    <svg viewBox="0 0 640 300" className="w-full h-auto" aria-hidden="true">
      {/* Ejes */}
      <line x1="40" y1="260" x2="620" y2="260" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <line x1="40" y1="20" x2="40" y2="260" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <text x="44" y="34" fill="rgba(255,255,255,0.35)" fontSize="12">
        Lo que recordás
      </text>
      <text x="560" y="284" fill="rgba(255,255,255,0.35)" fontSize="12">
        Días
      </text>

      {/* Sin repaso: caída exponencial */}
      <path
        className="lp-draw"
        d="M 40 40 C 120 150, 200 210, 340 235 S 560 252, 620 254"
        fill="none"
        stroke="rgba(248,113,113,0.65)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <text x="330" y="215" fill="rgba(248,113,113,0.8)" fontSize="13" fontWeight="600">
        Sin repaso
      </text>

      {/* Con repaso espaciado: sierra ascendente */}
      <path
        className="lp-draw lp-draw-2"
        d="M 40 40 C 80 90, 100 120, 120 140 L 120 44 C 170 90, 210 110, 240 122 L 240 46 C 310 84, 360 96, 400 102 L 400 48 C 490 72, 560 78, 620 80"
        fill="none"
        stroke="#8b5cf6"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Marcas de repaso */}
      {[120, 240, 400].map((x) => (
        <g key={x}>
          <circle cx={x} cy={44 + (x === 240 ? 2 : x === 400 ? 4 : 0)} r="4" fill="#8b5cf6" />
          <line
            x1={x}
            y1="52"
            x2={x}
            y2="260"
            stroke="rgba(139,92,246,0.15)"
            strokeWidth="1"
            strokeDasharray="3 5"
          />
        </g>
      ))}
      <text x="470" y="60" fill="#a78bfa" fontSize="13" fontWeight="600">
        Con repaso espaciado
      </text>
      <text x="104" y="278" fill="rgba(167,139,250,0.6)" fontSize="11">
        repaso 1
      </text>
      <text x="224" y="278" fill="rgba(167,139,250,0.6)" fontSize="11">
        repaso 2
      </text>
      <text x="384" y="278" fill="rgba(167,139,250,0.6)" fontSize="11">
        repaso 3
      </text>
    </svg>
  );
}

/* ── Mini-mockups de features ──────────────────────────────────────────────── */

function MockReview() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5">
        <span className="text-sm text-gray-300">Hoy</span>
        <span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-xs font-semibold text-violet-300">
          12 cartas
        </span>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2.5 opacity-70">
        <span className="text-sm text-gray-400">Mañana</span>
        <span className="text-xs text-gray-500">5 cartas</span>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2.5 opacity-50">
        <span className="text-sm text-gray-400">Viernes</span>
        <span className="text-xs text-gray-500">8 cartas</span>
      </div>
    </div>
  );
}

function MockExam() {
  return (
    <div className="space-y-2.5">
      <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5">
        <p className="text-xs text-gray-500 mb-1">Tu respuesta</p>
        <p className="text-sm text-gray-300 leading-snug">
          &ldquo;La entropía mide el desorden de un sistema y siempre aumenta…&rdquo;
        </p>
      </div>
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3.5 py-2.5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-emerald-400 font-semibold">Corrección</p>
          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-300">
            8 / 10
          </span>
        </div>
        <p className="text-sm text-gray-300 leading-snug">
          Bien planteado. Te faltó aclarar que aplica a sistemas aislados.
        </p>
      </div>
    </div>
  );
}

function MockChat() {
  return (
    <div className="space-y-2.5">
      <div className="ml-8 rounded-xl rounded-br-sm bg-violet-600/85 px-3.5 py-2.5">
        <p className="text-sm text-white leading-snug">¿Esto entra en el segundo parcial?</p>
      </div>
      <div className="mr-8 rounded-xl rounded-bl-sm border border-white/8 bg-white/[0.03] px-3.5 py-2.5">
        <p className="text-sm text-gray-300 leading-snug">
          Sí. Según tu apunte, la unidad 4 completa entra en el segundo parcial, incluida la
          respiración celular.
        </p>
      </div>
    </div>
  );
}

function MockPlan() {
  return (
    <div className="space-y-2">
      {[
        { day: "Lun", task: "Repasar 12 cartas + quiz unidad 3", done: true },
        { day: "Mar", task: "Examen oral con IA: unidad 4", done: true },
        { day: "Mié", task: "Repaso final + conceptos débiles", done: false },
      ].map((t) => (
        <div
          key={t.day}
          className={`flex items-center gap-3 rounded-xl border border-white/8 px-3.5 py-2.5 ${
            t.done ? "bg-white/[0.02]" : "bg-violet-500/8 border-violet-500/25"
          }`}
        >
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
              t.done ? "bg-emerald-500/20 text-emerald-400" : "bg-violet-500/20 text-violet-300"
            }`}
          >
            {t.done ? <Check size={12} /> : t.day[0]}
          </span>
          <div className="min-w-0">
            <p className="text-xs text-gray-500">{t.day}</p>
            <p className={`truncate text-sm ${t.done ? "text-gray-500" : "text-gray-200"}`}>
              {t.task}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Datos de secciones ────────────────────────────────────────────────────── */

const SUBJECTS = [
  "Anatomía I",
  "Derecho Constitucional",
  "Cálculo II",
  "Microbiología",
  "Historia Moderna",
  "Química Orgánica",
  "Psicología General",
  "Macroeconomía",
  "Algoritmos y Estructuras de Datos",
  "Fisiología",
  "Derecho Romano",
  "Estadística",
];

const STEPS = [
  {
    n: "01",
    title: "Subí lo que tengas",
    body: "Un PDF de cátedra, la foto del cuaderno de tu compañero, un texto pegado o el link de un artículo. Todo sirve.",
    icons: [FileText, Camera, Link2],
  },
  {
    n: "02",
    title: "memorIA lo convierte en material",
    body: "Resumen, flashcards, preguntas de examen y conceptos clave, generados desde tu propio material — no de internet.",
    icons: [Layers],
  },
  {
    n: "03",
    title: "Practicá hasta que quede",
    body: "Quizzes, exámenes orales corregidos por IA y repaso espaciado que programa cada carta justo antes de que la olvides.",
    icons: [GraduationCap],
  },
];

const FEATURES = [
  {
    icon: CalendarDays,
    title: "Repaso que sabe cuándo",
    body: "El mismo algoritmo que Anki (SM-2) decide qué carta ves hoy y cuál puede esperar. Estudiás menos y retenés más.",
    mock: <MockReview />,
  },
  {
    icon: GraduationCap,
    title: "Exámenes que corrigen de verdad",
    body: "Respondés con tus palabras y la IA te devuelve nota, correcciones y repreguntas — como un profesor en el oral.",
    mock: <MockExam />,
  },
  {
    icon: MessageSquare,
    title: "Preguntale a tus apuntes",
    body: "Chat que responde solo con tu material. Si no está en el apunte, te lo dice — no inventa.",
    mock: <MockChat />,
  },
  {
    icon: CalendarDays,
    title: "Un plan hasta el examen",
    body: "Le decís cuándo rendís y cuánto tiempo tenés por día. memorIA arma el cronograma priorizando tus temas débiles.",
    mock: <MockPlan />,
  },
];

const COMPARISON = {
  generic: [
    "Te explica el documento hoy",
    "No sabe qué aprendiste ni qué olvidaste",
    "Cada sesión empieza de cero",
    "Termina cuando cerrás la pestaña",
  ],
  memoria: [
    "Te prepara para el examen",
    "Registra qué sabés y programa cada repaso",
    "Tu progreso se acumula: rachas, historial, temas débiles",
    "Te acompaña todos los días hasta que rendís",
  ],
};

/* ── Landing ───────────────────────────────────────────────────────────────── */

export default function Landing() {
  return (
    <main className="relative -mt-16 overflow-hidden bg-[#0f0f13] text-white">
      {/* ── Hero ── */}
      <section className="relative flex min-h-screen items-center pt-16">
        {/* Fondo: grilla + orbes */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 90% 70% at 50% 35%, black 30%, transparent 75%)",
          }}
        />
        <div
          aria-hidden="true"
          className="lp-orb-a pointer-events-none absolute -top-32 left-1/4 h-105 w-105 rounded-full bg-violet-600/14 blur-[130px]"
        />
        <div
          aria-hidden="true"
          className="lp-orb-b pointer-events-none absolute top-1/3 right-0 h-80 w-80 rounded-full bg-indigo-500/10 blur-[110px]"
        />

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-5 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          <div>
            <Reveal>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-gray-400">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                Repaso espaciado · Exámenes con IA · Plan de estudio
              </div>
            </Reveal>

            <Reveal delay={100}>
              <h1 className="text-[2.75rem] leading-[1.05] font-bold tracking-tight sm:text-6xl lg:text-[4.25rem]">
                Estudiá con
                <br />
                <span className="text-violet-400">memoria.</span>
              </h1>
            </Reveal>

            <Reveal delay={200}>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-gray-400 sm:text-lg">
                Subí tus apuntes y memorIA los convierte en flashcards, exámenes y un plan de
                estudio que sabe qué aprendiste — y qué estás por olvidar.
              </p>
            </Reveal>

            <Reveal delay={300}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/auth"
                  className="group inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-violet-600/25 transition-all hover:bg-violet-500 active:scale-[0.98]"
                >
                  Empezar gratis
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
                <a
                  href="#como-funciona"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3.5 text-sm font-medium text-gray-300 transition-colors hover:border-white/20 hover:text-white"
                >
                  Ver cómo funciona
                </a>
              </div>
            </Reveal>

            <Reveal delay={400}>
              <p className="mt-6 text-xs text-gray-600">
                Gratis. Sin tarjeta. Tu material queda solo para vos.
              </p>
            </Reveal>
          </div>

          <Reveal delay={250} className="lg:pl-4">
            <DemoFlashcard />
          </Reveal>
        </div>
      </section>

      {/* ── Marquee de materias ── */}
      <section className="border-y border-white/5 bg-white/[0.015] py-5">
        <div
          className="overflow-hidden"
          style={{
            maskImage: "linear-gradient(90deg, transparent, black 12%, black 88%, transparent)",
          }}
        >
          <div className="lp-marquee flex w-max items-center gap-10">
            {[...SUBJECTS, ...SUBJECTS].map((s, i) => (
              <span key={i} className="flex items-center gap-10 whitespace-nowrap text-sm text-gray-600">
                {s}
                <span className="h-1 w-1 rounded-full bg-gray-700" />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cómo funciona ── */}
      <section id="como-funciona" className="mx-auto max-w-6xl px-5 py-28 sm:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
            Cómo funciona
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Del apunte crudo al tema sabido, en tres pasos.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 120}>
              <div className="group h-full rounded-2xl border border-white/8 bg-white/[0.02] p-7 transition-colors hover:border-violet-500/30 hover:bg-white/[0.035]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono text-gray-600">{step.n}</span>
                  <div className="flex gap-1.5">
                    {step.icons.map((Icon, j) => (
                      <div
                        key={j}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03] text-gray-500 transition-colors group-hover:border-violet-500/30 group-hover:text-violet-400"
                      >
                        <Icon size={15} />
                      </div>
                    ))}
                  </div>
                </div>
                <h3 className="mt-6 text-lg font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-gray-500">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Curva del olvido ── */}
      <section className="border-y border-white/5 bg-white/[0.015]">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-28 sm:px-6 lg:grid-cols-2">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
              La ciencia detrás
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Olvidar es humano.
              <br />
              Repasar a tiempo es método.
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-gray-400">
              A las 48 horas de estudiar, ya perdiste la mayor parte de lo que leíste. Es la curva
              del olvido, y le pasa a todos.
            </p>
            <p className="mt-4 max-w-md text-base leading-relaxed text-gray-400">
              memorIA usa repetición espaciada — el mismo algoritmo que Anki — para mostrarte cada
              carta justo antes de que la olvides. Cada repaso llega en el momento exacto en que más
              refuerza.
            </p>
          </Reveal>

          <Reveal delay={150}>
            <div className="rounded-2xl border border-white/8 bg-[#131318] p-6 sm:p-8">
              <ForgettingCurve />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="mx-auto max-w-6xl px-5 py-28 sm:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
            Qué hace
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Todo lo que pasa después de subir el apunte.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 2) * 120}>
              <div className="h-full rounded-2xl border border-white/8 bg-white/[0.02] p-7 transition-colors hover:border-violet-500/25">
                <div className="mb-6">{f.mock}</div>
                <div className="flex items-center gap-2.5">
                  <f.icon size={17} className="text-violet-400" />
                  <h3 className="text-lg font-semibold tracking-tight">{f.title}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Diferenciador ── */}
      <section className="border-y border-white/5 bg-white/[0.015]">
        <div className="mx-auto max-w-6xl px-5 py-28 sm:px-6">
          <Reveal>
            <h2 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
              No es otro chat con tus PDFs.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-gray-400">
              Chatear con un documento te sirve hoy. Aprobar depende de lo que hacés todos los días
              hasta el examen.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <Reveal delay={100}>
              <div className="h-full rounded-2xl border border-white/8 bg-white/[0.02] p-7">
                <p className="text-sm font-semibold text-gray-500">
                  Un asistente de documentos
                </p>
                <ul className="mt-5 space-y-3.5">
                  {COMPARISON.generic.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-gray-500">
                      <X size={15} className="mt-0.5 shrink-0 text-gray-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={220}>
              <div className="h-full rounded-2xl border border-violet-500/30 bg-violet-500/[0.06] p-7 shadow-xl shadow-violet-950/20">
                <p className="flex items-center gap-2 text-sm font-semibold text-violet-300">
                  <Brain size={15} />
                  memorIA
                </p>
                <ul className="mt-5 space-y-3.5">
                  {COMPARISON.memoria.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-gray-200">
                      <Check size={15} className="mt-0.5 shrink-0 text-violet-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-125 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/12 blur-[120px]"
        />
        <div className="relative mx-auto max-w-3xl px-5 py-32 text-center sm:px-6">
          <Reveal>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Tu próximo final
              <br />
              se estudia distinto.
            </h2>
          </Reveal>
          <Reveal delay={150}>
            <div className="mt-10 flex flex-col items-center gap-4">
              <Link
                href="/auth"
                className="group inline-flex items-center gap-2 rounded-xl bg-violet-600 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-violet-600/25 transition-all hover:bg-violet-500 active:scale-[0.98]"
              >
                <Upload size={17} />
                Subir mi primer apunte
                <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <p className="text-xs text-gray-600">Menos de un minuto para tener tu material listo.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600">
              <Brain size={14} className="text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight">
              memor<span className="text-violet-400">IA</span>
            </span>
          </div>
          <p className="text-xs text-gray-600">
            Hecho para estudiantes que rinden. © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </main>
  );
}
