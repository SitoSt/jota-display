#!/usr/bin/env bash
# Walkthrough visual interactivo de jota-display.
# Muestra cada estado durante unos segundos para inspección visual.
#
# Uso:
#   ./scripts/test-visual.sh               → walkthrough completo automático
#   ./scripts/test-visual.sh --step        → pausa y espera Enter entre estados
#   JOTA_SERVER=http://192.168.1.129:8766 ./scripts/test-visual.sh

SERVER="${JOTA_SERVER:-http://localhost:8766}"
STEP_MODE=false
[ "$1" = "--step" ] && STEP_MODE=true

SIM="$(dirname "$0")/sim.sh"

_state() { bash "$SIM" "$@"; }

_show() {
  local label="$1"
  local duration="$2"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Estado: $label"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  if [ "$STEP_MODE" = "true" ]; then
    read -r -p "  [Enter para continuar]" _
  else
    echo "  (duracion: ${duration}s)"
    sleep "$duration"
  fi
}

echo ""
echo "jota-display — Test visual de estados"
echo "Servidor: $SERVER"
echo ""
echo "Abre http://localhost:5173 (o la URL del dispositivo) para verlo."
[ "$STEP_MODE" = "true" ] && echo "Modo: paso a paso (--step)" || echo "Modo: automático"
echo ""
read -r -p "Pulsa Enter para empezar..." _

# ── idle ──────────────────────────────────────────────────────────────────────
JOTA_SERVER=$SERVER _state idle
_show "IDLE — blobs verdes muy tenues, sin texto" 4

# ── listening ─────────────────────────────────────────────────────────────────
JOTA_SERVER=$SERVER _state listening
_show "LISTENING — verde vivo, animación rápida" 4

# ── thinking ──────────────────────────────────────────────────────────────────
JOTA_SERVER=$SERVER _state thinking "qué temperatura hay en el salón"
_show "THINKING — azul pulsante, muestra transcripción" 4

# ── response ──────────────────────────────────────────────────────────────────
JOTA_SERVER=$SERVER _state response "Ahora mismo hay 21 grados en el salón."
_show "RESPONSE — lavanda y rosa, muestra respuesta" 6

# ── vuelta a idle ─────────────────────────────────────────────────────────────
JOTA_SERVER=$SERVER _state idle
_show "IDLE — de vuelta al reposo" 2

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Test de transición rápida (stress visual)..."
sleep 1

for _ in 1 2 3; do
  JOTA_SERVER=$SERVER _state listening;  sleep 0.8
  JOTA_SERVER=$SERVER _state thinking "prueba"; sleep 0.8
  JOTA_SERVER=$SERVER _state response "ok"; sleep 0.8
  JOTA_SERVER=$SERVER _state idle;       sleep 0.8
done

echo ""
echo "✓ Walkthrough completo. Servidor en http://localhost:5173"
echo ""
