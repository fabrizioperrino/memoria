# Deploy a producción — memorIA

Stack: **Supabase cloud** (base) + **Railway** (backend FastAPI) + **Vercel** (frontend Next.js).
El orden importa: cada pieza necesita la URL de la anterior.

> 🔒 **Regla de secretos:** el `service_role key` y el `JWT secret` de Supabase, y la
> `GROQ_API_KEY`, son secretos. Pegalos **directo en los dashboards** de Railway/Vercel,
> nunca en el chat. El `anon key` sí es público (va en el frontend).

---

## 0. Rotar la key de Groq (antes de todo)

La key actual quedó en el historial del chat. En [console.groq.com](https://console.groq.com)
→ API Keys → borrá la vieja y creá una nueva. La vas a usar en Railway (paso 2).

---

## 1. Supabase cloud (base de datos)

1. En [supabase.com/dashboard](https://supabase.com/dashboard) (cuenta nueva) → **New project**.
   Anotá la **database password** que elegís.
2. Cuando esté listo, en **Project Settings → API** vas a tener:
   - `Project URL` → `https://xxxx.supabase.co`
   - `anon public key`
   - `service_role key` (secreto)
   - En **Project Settings → API → JWT Settings**: el `JWT Secret` (secreto)
3. Aplicar las 7 migraciones. Dos opciones:
   - **CLI (recomendado):** desde `~/memoria`:
     ```bash
     supabase login              # abre el navegador
     supabase link --project-ref <TU_PROJECT_REF>
     supabase db push            # aplica supabase/migrations/*
     ```
   - **Manual:** pegar cada archivo de `supabase/migrations/` en el SQL Editor, en orden.
4. **Auth → Providers → Email**: dejar habilitado. Para probar rápido, desactivá
   "Confirm email" (Auth → Providers → Email → Confirm email = off) así los registros
   entran sin confirmar mail.

---

## 2. Backend en Railway (FastAPI)

1. En [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo** →
   elegí `fabrizioperrino/memoria`.
2. **Settings → Root Directory:** `backend`
   (Railway detecta `railway.toml` y `Procfile`; el start ya es `uvicorn api.main:app`.)
3. **Variables** (Settings → Variables):
   | Variable | Valor |
   |---|---|
   | `GROQ_API_KEY` | la key NUEVA de Groq |
   | `GROQ_MODEL` | `llama-3.3-70b-versatile` |
   | `WHISPER_MODEL` | `whisper-large-v3-turbo` |
   | `SUPABASE_URL` | Project URL de Supabase |
   | `SUPABASE_KEY` | `service_role key` de Supabase |
   | `SUPABASE_JWT_SECRET` | `JWT Secret` de Supabase |
   | `ALLOWED_ORIGINS` | (por ahora) `https://localhost` — lo actualizamos en el paso 4 |
4. Deploy → en **Settings → Networking → Generate Domain** obtenés la URL pública
   (ej. `https://memoria-production.up.railway.app`). Probá que `<URL>/health` devuelva ok.

---

## 3. Frontend en Vercel (Next.js)

1. En [vercel.com](https://vercel.com) → **Add New → Project** → importá `fabrizioperrino/memoria`.
2. **Root Directory:** `frontend`  (Framework: Next.js, autodetectado)
3. **Environment Variables:**
   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | la URL de Railway del paso 2 |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL de Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon public key` de Supabase |
4. **Deploy** → obtenés el dominio (ej. `https://memoria.vercel.app`).

---

## 4. Conectar las puntas (importante)

1. **Railway → Variables → `ALLOWED_ORIGINS`** = el dominio de Vercel
   (ej. `https://memoria.vercel.app`). Redeploy del backend.
2. **Supabase → Authentication → URL Configuration:**
   - `Site URL` = dominio de Vercel
   - `Redirect URLs` = `https://memoria.vercel.app/**`
3. **Verificar en producción** (el test plan, pero contra el dominio real):
   - Registro + login
   - Subir un documento → que procese a "listo"
   - Un oral con micrófono
   - Crear un grupo
   - Que la sala en vivo (Realtime) conecte

---

## Notas

- El `DevAccountSwitcher` está gateado a `localhost` → no aparece en producción. ✅
- El backend usa background tasks para procesar documentos: por eso va en Railway
  (servidor continuo) y no en Vercel (serverless con timeout). ✅
- Si el registro no llega por mail, revisá el paso 1.4 (Confirm email).
- Costos: Supabase free, Vercel free (hobby), Railway ~US$5 de crédito gratis/mes,
  Groq free tier. Suficiente para los primeros usuarios.
