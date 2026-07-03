#!/usr/bin/env bash
# Levanta el entorno de desarrollo completo de memorIA:
#   Supabase local (Docker) + backend FastAPI + frontend Next.js
# Uso: ./dev.sh

set -e
cd "$(dirname "$0")"

echo "── Supabase local ──"
supabase start
supabase status

echo ""
echo "── Backend (FastAPI en :8000) ──"
if [ ! -d backend/.venv ]; then
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install -q -r backend/requirements.txt
fi
(cd backend && .venv/bin/python run_api.py) &
BACKEND_PID=$!

echo ""
echo "── Frontend (Next.js en :3000) ──"
if [ ! -d frontend/node_modules ]; then
  (cd frontend && npm install)
fi
(cd frontend && npm run dev) &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Backend y frontend detenidos. (supabase stop para frenar la base)'" EXIT
wait
