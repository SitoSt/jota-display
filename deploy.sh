#!/usr/bin/env bash
# Despliega jota-display al teléfono (Termux) o a worker-01.
# Uso:
#   bash deploy.sh          → teléfono (defecto)
#   bash deploy.sh worker01 → worker-01

set -e

TARGET="${1:-phone}"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ "$TARGET" = "worker01" ]; then
  DEST_HOST="sito@192.168.1.109"
  DEST_DIR="/home/sito/jota-display"
  SSH_PORT=22
  echo "→ Desplegando a worker-01 ($DEST_HOST:$DEST_DIR)"
  ssh -p "$SSH_PORT" "$DEST_HOST" "mkdir -p $DEST_DIR/components $DEST_DIR/lib $DEST_DIR/hooks $DEST_DIR/server"
  rsync -av -e "ssh -p $SSH_PORT" --exclude='.git' --exclude='__pycache__' \
    "$REPO_DIR/" "$DEST_HOST:$DEST_DIR/"
  ssh -p "$SSH_PORT" "$DEST_HOST" "systemctl --user restart kiosk-server"
else
  DEST_HOST="u0_a161@192.168.1.129"
  DEST_DIR="/data/data/com.termux/files/home/jota-display"
  SSH_PORT=8022
  echo "→ Desplegando al teléfono ($DEST_HOST:$DEST_DIR)"
  sshpass -p 'cacatua420' ssh -p "$SSH_PORT" "$DEST_HOST" \
    "mkdir -p $DEST_DIR/components $DEST_DIR/lib $DEST_DIR/hooks $DEST_DIR/server"
  sshpass -p 'cacatua420' rsync -av -e "sshpass -p 'cacatua420' ssh -p $SSH_PORT" \
    --exclude='.git' --exclude='__pycache__' \
    "$REPO_DIR/" "$DEST_HOST:$DEST_DIR/"
  echo "→ Matando servidor anterior (si existe)"
  sshpass -p 'cacatua420' ssh -p "$SSH_PORT" "$DEST_HOST" \
    "pkill -f 'python3.*server.py' 2>/dev/null || true"
  echo "→ Arrancando servidor en Termux"
  sshpass -p 'cacatua420' ssh -p "$SSH_PORT" "$DEST_HOST" \
    "nohup sh ~/jota-display/server/start_termux.sh </dev/null >/dev/null 2>&1 &"
fi

echo "✓ Desplegado ($TARGET)"
