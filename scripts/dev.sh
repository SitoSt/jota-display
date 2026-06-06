#!/usr/bin/env bash
# Arranca el entorno de desarrollo completo (Python server + Vite).
# No requiere .env — usa defaults de desarrollo.
#
# Uso: ./scripts/dev.sh
#
# URLs:
#   http://localhost:5173  ← UI con hot reload (Vite)
#   http://localhost:8766  ← servidor Python (SSE, /state, /config)

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Matar ambos procesos al salir (Ctrl+C o cierre de terminal)
cleanup() {
  echo ""
  echo "→ Parando servidores..."
  kill "$PY_PID" 2>/dev/null
  wait "$PY_PID" 2>/dev/null
  exit 0
}
trap cleanup INT TERM

# Liberar puertos si ya están ocupados
lsof -ti:8766 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
sleep 0.5

echo "→ Arrancando servidor Python en :8766"
JOTA_MODE="" \
JOTA_DEV=true \
JOTA_FULLY_URL=http://localhost:2323 \
JOTA_FULLY_PASSWORD=dev \
  python3 "$REPO_DIR/server/server.py" &
PY_PID=$!

# Esperar a que el servidor Python esté listo
sleep 0.5
if ! kill -0 "$PY_PID" 2>/dev/null; then
  echo "ERROR: el servidor Python no arrancó"
  exit 1
fi

echo "→ Arrancando Vite en :5173"
echo ""
echo "  UI:      http://localhost:5173"
echo "  Simular: ./scripts/sim.sh conversation"
echo ""

# Vite en foreground — cuando el usuario hace Ctrl+C, el trap lo recoge
npm --prefix "$REPO_DIR" run dev
