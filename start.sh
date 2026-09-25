#!/usr/bin/env bash
# Starts the backend (port 8000) and the frontend (port 3000) together. Ctrl+C stops both.
# First run installs anything missing.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

if [ ! -d "$ROOT/backend/.venv" ]; then
  echo "Setting up Python environment..."
  python3 -m venv "$ROOT/backend/.venv"
  "$ROOT/backend/.venv/bin/pip" install -q -r "$ROOT/backend/requirements.txt"
fi
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "Installing frontend packages..."
  (cd "$ROOT/frontend" && npm install)
fi
[ -f "$ROOT/frontend/.env.local" ] || cp "$ROOT/frontend/.env.local.example" "$ROOT/frontend/.env.local"

for port in 8000 3000; do
  if lsof -nP -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is already in use (is the app already running?). Stop it first, then run this again."
    exit 1
  fi
done

(cd "$ROOT/backend" && .venv/bin/uvicorn app.main:app --reload --port 8000) &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null' EXIT

echo ""
echo "  Open http://localhost:3000  (Ctrl+C to stop)"
echo ""
cd "$ROOT/frontend" && npm run dev
