#!/usr/bin/env sh
# Arranca jota-display en el dispositivo.
# Para autoarranque en Termux: crea ~/.termux/boot/start-jota.sh con:
#   exec sh /data/data/com.termux/files/home/jota-display/server/start.sh

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# ── 1. Cargar .env ───────────────────────────────────────────────────────────
ENV_FILE="$REPO_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "[jota] ERROR: no existe $ENV_FILE"
  echo "[jota]        Copia .env.example como .env y rellena los valores"
  exit 1
fi
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

# ── 2. Validar variables requeridas ──────────────────────────────────────────
_missing=0
for var in JOTA_MODE JOTA_FULLY_PASSWORD; do
  eval val=\$$var
  if [ -z "$val" ]; then
    echo "[jota] ERROR: $var no está definida en .env"
    _missing=1
  fi
done
[ "$_missing" = "1" ] && exit 1

# ── 3. Validar archivos de configuración ────────────────────────────────────
for f in layout.json; do
  if [ ! -f "$REPO_DIR/config/$f" ]; then
    echo "[jota] ERROR: falta config/$f"
    echo "[jota]        Copia config/$f.example como config/$f"
    exit 1
  fi
done

# ── 4. Validar que dist/ existe ──────────────────────────────────────────────
if [ ! -f "$REPO_DIR/dist/index.html" ]; then
  echo "[jota] ERROR: dist/ no existe — ejecuta: npm run build"
  exit 1
fi

# ── 5. Arrancar ──────────────────────────────────────────────────────────────
echo "[jota] Arrancando servidor (modo=$JOTA_MODE)"
cd "$REPO_DIR"
exec python3 server/server.py >> "$HOME/jota-display.log" 2>&1
