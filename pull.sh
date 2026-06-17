#!/usr/bin/env bash
# Actualiza jota-display en el teléfono (Termux).
# Ejecutar desde el directorio del repositorio: sh pull.sh
set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

echo "→ Pull"
git pull origin main

echo "→ Reiniciando servidor"
pkill -f 'python3.*server.py' 2>/dev/null || true
sleep 1
nohup sh server/start.sh </dev/null >>"$HOME/jota-display.log" 2>&1 &

echo "✓ Actualizado y reiniciado"
