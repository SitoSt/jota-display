#!/usr/bin/env bash
# Despliega jota-display al teléfono (Termux).
# Uso: bash deploy.sh
#
# Requiere .env.local con PHONE_HOST, PHONE_PORT, PHONE_PASS y PHONE_DIR.
# Copia .env.local.example como .env.local y rellena los valores.

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── 1. Cargar credenciales de deploy ────────────────────────────────────────
ENV_LOCAL="$REPO_DIR/.env.local"
if [ ! -f "$ENV_LOCAL" ]; then
  echo "ERROR: no existe .env.local"
  echo "       Copia .env.local.example como .env.local y rellena los valores"
  exit 1
fi
# shellcheck disable=SC1090
set -a; . "$ENV_LOCAL"; set +a

for var in PHONE_HOST PHONE_PORT PHONE_PASS PHONE_DIR; do
  eval val=\$$var
  if [ -z "$val" ]; then
    echo "ERROR: $var no está definida en .env.local"
    exit 1
  fi
done

# ── 2. Build ────────────────────────────────────────────────────────────────
echo "→ Construyendo dist/"
npm run build

# ── 3. Deploy ───────────────────────────────────────────────────────────────
echo "→ Desplegando a $PHONE_HOST:$PHONE_DIR"

_ssh() { sshpass -p "$PHONE_PASS" ssh -p "$PHONE_PORT" "$PHONE_HOST" "$@"; }
_rsync() {
  sshpass -p "$PHONE_PASS" rsync -av \
    -e "sshpass -p '$PHONE_PASS' ssh -p $PHONE_PORT" \
    --exclude='.git' --exclude='__pycache__' --exclude='node_modules' \
    "$@"
}

_ssh "mkdir -p $PHONE_DIR/hooks $PHONE_DIR/server $PHONE_DIR/config $PHONE_DIR/dist"
_rsync "$REPO_DIR/" "$PHONE_HOST:$PHONE_DIR/"

# ── 4. Reiniciar servidor ───────────────────────────────────────────────────
echo "→ Reiniciando servidor"
_ssh "pkill -f 'python3.*server.py' 2>/dev/null || true; sleep 1; cd $PHONE_DIR && nohup sh server/start.sh </dev/null >/dev/null 2>&1 &" || true

echo "✓ Desplegado"
