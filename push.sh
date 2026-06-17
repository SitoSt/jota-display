#!/usr/bin/env bash
# Construye y publica jota-display a GitHub.
# En el teléfono ejecuta después: sh pull.sh
set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

echo "→ Build"
npm run build

echo "→ Staging"
git add dist/ src/ tests/ public/ server/ hooks/ index.html package.json \
        package-lock.json vite.config.js .gitignore .env.example \
        .env.local.example README.md CLAUDE.md 2>/dev/null || true

if git diff --cached --quiet; then
  echo "  (sin cambios que commitear)"
else
  git commit -m "deploy: build $(date '+%Y-%m-%d %H:%M')"
fi

echo "→ Push"
git push origin main

echo "✓ Listo — ejecuta 'sh pull.sh' en el teléfono"
