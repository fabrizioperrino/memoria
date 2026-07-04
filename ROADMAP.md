# memorIA — Roadmap técnico

> Visión y decisiones de producto: página "memorIA — Roadmap" en Notion.
> Este archivo es el espejo técnico, versionado con el código.

## Sprint 1 — Valor inmediato (en curso)

### Índice "¿Estoy listo?"
- `GET /progress/readiness` — por materia y por documento:
  - **retención** = madurez SM-2 promedio (`min(interval/21, 1)` por carta repasada)
  - **precisión** = promedio de los últimos 5 quizzes del documento
  - **cobertura** = % de cartas repasadas alguna vez + señal de quizzes hechos
  - `readiness = 45% retención + 35% precisión + 20% cobertura`
- Sin IA, sin tokens. UI en `/progreso`.

### Modo "Rindo mañana"
- `/cram/[id]` — triage client-side con datos existentes:
  1. Peores cartas (menor ease_factor / menos repasos)
  2. Conceptos clave
  3. Mini quiz con preguntas antes falladas (de `quiz_results.answers`)
- No toca el schedule SM-2 (cram no distorsiona intervalos).

## Sprint 2 — Simulacro oral por voz ✅
- `/oral/[id]`: mesa de examen. Profesor pregunta por voz (SpeechSynthesis, gratis),
  estudiante responde hablando (MediaRecorder), Whisper transcribe, exam_service corrige.
- `POST /exam/{id}/oral/transcribe` → `oral_service.transcribe_audio` (Whisper turbo, $0.04/h)
- Flujo: intro → pregunta hablada → grabar → transcribir → revisar → evaluar → repregunta/siguiente → promedio final
- Reusa `evaluate_answer` (nota + feedback + follow-ups) y otorga XP de examen.
- Costo ~US$0.02 por simulacro de 15 min. **Requiere GROQ_API_KEY real para funcionar.**

## Sprint 3 — Activar lo social ✅
- **Mazos compartidos** (`group_shares`): un miembro comparte su documento con el grupo;
  el resto lo estudia en `/mazo/[shareId]` (resumen/flashcards/conceptos, solo lectura).
- **Duelos** (`duels` + `duel_attempts`): mismas preguntas para todo el grupo, congeladas
  al crear. Cada uno juega una vez (`/duelo/[id]`), corrección server-side (sin filtrar
  la respuesta correcta), tabla de posiciones. Migración 004.
- Detalle de grupo (`/grupos/[id]`) con pestañas Ranking / Mazos / Duelos.
- Verificado E2E (2 usuarios) + navegador: compartir, crear duelo, jugar, leaderboard.

## Sprint 4 — Hábito diario ✅
- **Sesión guiada** (`/sesion`): form (tiempo + materia) → `GET /progress/session-plan`
  arma bloques determinísticos (vencidas → quiz del tema flojo → oral si sobra tiempo).
  Checklist persistido en localStorage; cierre muestra el delta del índice.
- **Sala de estudio** (`StudyRoom` en pestaña de `/grupos/[id]`): presencia en vivo con
  Supabase Realtime Presence (quién está, quién estudia) + pomodoro de 25 min compartido.
  Requiere `[realtime] enabled = true` en config.toml.
- Entrada "Sesión" en el NavBar.

## Backlog
- Grabá la clase (Whisper, ~10¢/clase) · PWA offline · WhatsApp deep-link · Ligas
- Deuda: rate limiting (/chat, /exam), flashcards con UUID, middleware→proxy (Next 16)

## Entorno

`./dev.sh` levanta todo. Supabase :54321 · backend :8000 · frontend :3000 · Studio :54323.
Cuentas de prueba: `fabrizio@memoria.local` / `memoria123` (+ `fabri.test` y `compa.test` @memoria.local / `test123456`).
