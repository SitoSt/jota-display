#!/usr/bin/env bash
# Despliega jota-display al dispositivo (actualmente worker-01)
# Uso: bash deploy.sh

set -e

DEST_HOST="sito@192.168.1.109"
DEST_DIR="/home/sito/jota-display"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "→ Copiando ficheros a $DEST_HOST:$DEST_DIR"
ssh "$DEST_HOST" "mkdir -p $DEST_DIR/components $DEST_DIR/lib $DEST_DIR/hooks $DEST_DIR/server"

rsync -av --exclude='.git' --exclude='__pycache__' \
  "$REPO_DIR/" "$DEST_HOST:$DEST_DIR/"

echo "→ Reiniciando servicio"
ssh "$DEST_HOST" "systemctl --user restart kiosk-server"

echo "✓ Desplegado"
