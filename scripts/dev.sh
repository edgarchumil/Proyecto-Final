#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
cd "$ROOT_DIR"

backend() {
  if [[ -x Backend/.venv/bin/python ]]; then
    ( cd Backend && exec ./.venv/bin/python manage.py runserver 0.0.0.0:8000 )
  else
    echo "[backend] No se encontró Backend/.venv/bin/python. Crea el venv o ajusta el script." >&2
    return 1
  fi
}

frontend() {
  if [[ -x Frontend/node_modules/.bin/ng ]]; then
    ( cd Frontend && exec ./node_modules/.bin/ng serve --host 0.0.0.0 --port 4200 )
  else
    echo "[frontend] No se encontró Frontend/node_modules/.bin/ng. Ejecuta 'npm ci' o 'npm install' en Frontend." >&2
    return 1
  fi
}

echo "Iniciando servicios: backend (8000) y frontend (4200)"

backend &
PID_BACKEND=$!

frontend &
PID_FRONTEND=$!

cleanup() {
  echo
  echo "Deteniendo servicios..."
  kill ${PID_BACKEND} ${PID_FRONTEND} 2>/dev/null || true
  wait ${PID_BACKEND} ${PID_FRONTEND} 2>/dev/null || true
}

trap cleanup INT TERM EXIT

echo "Backend PID: ${PID_BACKEND} | Frontend PID: ${PID_FRONTEND}"
echo "Presiona Ctrl+C para detener ambos."

wait

