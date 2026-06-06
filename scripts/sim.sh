#!/usr/bin/env bash
# Simula eventos de voz en jota-display para desarrollo.
#
# Uso:
#   ./scripts/sim.sh                  → muestra ayuda
#   ./scripts/sim.sh conversation     → ciclo completo listening→thinking→response→idle
#   ./scripts/sim.sh loop             → repite conversation indefinidamente
#   JOTA_SERVER=http://192.168.1.129:8766 ./scripts/sim.sh conversation
#
# Los escenarios usan el servidor local por defecto (:8766).
# En dev con Vite activo, puedes apuntar al :5173 también.

SERVER="${JOTA_SERVER:-http://localhost:8766}"

_state() {
  curl -sf -X POST "$SERVER/state" \
    -H 'Content-Type: application/json' \
    -d "$1" > /dev/null || echo "[sim] advertencia: servidor no responde en $SERVER"
}

_step() {
  echo "[sim] → $1"
}

case "${1:-help}" in

  # ── Estados individuales ───────────────────────────────────────────────────

  idle)
    _step "idle"
    _state '{"state":"idle","text":""}'
    ;;

  listening)
    _step "listening"
    _state '{"state":"listening","text":""}'
    ;;

  thinking)
    TEXT="${2:-qué temperatura hay en el salón}"
    _step "thinking: $TEXT"
    _state "{\"state\":\"thinking\",\"text\":\"$TEXT\"}"
    ;;

  response)
    TEXT="${2:-Ahora mismo hay 21 grados en el salón.}"
    _step "response: $TEXT"
    _state "{\"state\":\"response\",\"text\":\"$TEXT\"}"
    ;;

  # ── Escenarios compuestos ──────────────────────────────────────────────────

  conversation)
    # Ciclo realista completo
    QUERY="${2:-qué temperatura hay en el salón}"
    ANSWER="${3:-Ahora mismo hay 21 grados en el salón.}"
    _step "conversación: «$QUERY»"
    _state '{"state":"listening","text":""}'
    sleep 1.5
    _state "{\"state\":\"thinking\",\"text\":\"$QUERY\"}"
    sleep 2
    _state "{\"state\":\"response\",\"text\":\"$ANSWER\"}"
    # el servidor vuelve a idle automáticamente tras AUTO_SLEEP_SECONDS
    ;;

  quick)
    # Conversación rápida sin esperar el sleep automático
    _state '{"state":"listening","text":""}'
    sleep 0.5
    _state '{"state":"thinking","text":"prueba"}'
    sleep 0.5
    _state '{"state":"response","text":"respuesta de prueba"}'
    sleep 0.5
    _state '{"state":"idle","text":""}'
    ;;

  loop)
    # Repite conversation indefinidamente (Ctrl+C para parar)
    DELAY="${2:-12}"
    echo "[sim] Loop cada ${DELAY}s — Ctrl+C para parar"
    QUERIES=(
      "qué temperatura hay|Ahora mismo hay 21 grados en el salón."
      "pon las luces del salón al 50%|Listo, luces al 50%."
      "qué hora es|Son las $(date +%H:%M)."
      "está lloviendo|No, hoy está despejado con 18 grados."
    )
    i=0
    while true; do
      PAIR="${QUERIES[$((i % ${#QUERIES[@]}))]}"
      Q="${PAIR%%|*}"
      A="${PAIR##*|}"
      "$0" conversation "$Q" "$A"
      sleep "$DELAY"
      i=$((i + 1))
    done
    ;;

  stress)
    # Transiciones rápidas para detectar bugs visuales
    echo "[sim] Stress test — Ctrl+C para parar"
    while true; do
      for state in listening thinking response idle; do
        _state "{\"state\":\"$state\",\"text\":\"stress\"}"
        sleep 0.4
      done
    done
    ;;

  # ── Ayuda ──────────────────────────────────────────────────────────────────

  help|*)
    cat <<'EOF'
Simulador de eventos jota-display

Uso: ./scripts/sim.sh <escenario> [args]

ESTADOS INDIVIDUALES
  idle                      → vuelve a reposo
  listening                 → escuchando
  thinking  [texto]         → procesando (texto opcional)
  response  [texto]         → respondiendo (texto opcional)

ESCENARIOS
  conversation [query] [respuesta]   → ciclo completo realista
  quick                              → ciclo completo rápido (sin esperas)
  loop [segundos]                    → repite conversation cada N segundos (def: 12)
  stress                             → transiciones rápidas para test visual

VARIABLES DE ENTORNO
  JOTA_SERVER   servidor destino (defecto: http://localhost:8766)

EJEMPLOS
  ./scripts/sim.sh conversation
  ./scripts/sim.sh conversation "pon la calefacción" "Calefacción activada."
  ./scripts/sim.sh loop 8
  JOTA_SERVER=http://192.168.1.129:8766 ./scripts/sim.sh conversation
EOF
    ;;

esac
