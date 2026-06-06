# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the server

```bash
# Desarrollo local (Vite + servidor Python en paralelo)
npm run dev                    # Vite en :5173 (con proxy a :8766)
python3 server/server.py       # servidor SSE en :8766

# Modo Termux (Android) — en el teléfono
JOTA_MODE=termux JOTA_FULLY_PASSWORD=<pass> python3 server/server.py
```

El servidor no tiene dependencias externas — solo Python stdlib.

## Simular eventos SSE (testing manual)

```bash
curl -X POST http://localhost:8766/state \
  -H 'Content-Type: application/json' \
  -d '{"state":"thinking","text":"qué temperatura hay"}'
```

Estados válidos: `idle` | `listening` | `thinking` | `response`

## Deploy

```bash
bash deploy.sh          # → teléfono (Termux, por SSH/sshpass)
bash deploy.sh worker01 # → worker-01 (Linux, por rsync + systemctl)
```

## Arquitectura

### Fase actual (Vite + SFCs)

La app usa Vite 6 con Vue 3 Single File Components. El servidor Python sirve `dist/` en producción. En desarrollo, Vite corre en `:5173` y proxea `/events`, `/state`, `/listen` y `/config` al servidor Python en `:8766`.

El estado global se gestiona con composables Vue (`src/composables/`), sin Pinia ni Vue Router.

### Flujo de datos

Hay dos canales **completamente independientes**:

1. **Estado de voz (solo lectura):** `wyoming-satellite` llama a los scripts `hooks/on_*.sh` → `POST /state` → `server.py` emite SSE → Vue actualiza UI. jota-display no controla el pipeline de voz.

2. **Control del hogar (Fase 2+):** el navegador habla directamente con HA vía WebSocket. Independiente del canal de voz.

### Máquina de estados

`src/composables/useVoice.js` es la única fuente de verdad. El estado fluye en un solo sentido: SSE event → `useVoice` → componentes reactivos. Los estados se limpian al volver a `idle`.

### Modos de despliegue (`server.py`)

| Variable `JOTA_MODE` | Base dir | Fully Kiosk URL por defecto |
|---|---|---|
| `""` (defecto) | `dist/` relativo al repo | `http://localhost:2323` |
| `termux` | `~/jota-display/dist` | `http://localhost:2323` |

### Control de pantalla

Vía Fully Kiosk Browser REST API:
- `GET localhost:2323/?cmd=screenOn&password=<pass>` — enciende pantalla
- `GET localhost:2323/?cmd=screenOff&password=<pass>` — apaga pantalla

Variables de entorno relevantes:
- `JOTA_FULLY_URL` — URL base (defecto: `http://localhost:2323`)
- `JOTA_FULLY_PASSWORD` — contraseña del Remote Admin de Fully Kiosk

Ver `server/start_termux.sh` para los valores configurados en el dispositivo.

### Hooks wyoming-satellite

Los scripts en `hooks/` se llaman desde `start-satellite.sh` con los flags `--detection-command`, `--transcript-command`, `--synthesize-command`. Hacen `curl POST /state` al servidor. La ruta IP en los hooks apunta a `192.168.1.109` (worker-01, donde corre el servidor en modo `worker01`).

## Configuración

`config/*.json` — no versionados con datos reales. Los `*.example.json` son la referencia. `config/ha.json` (contiene token HA) debe permanecer en `.gitignore`.

## Roadmap de fases

- **Fase 0** ✅ — MVP (ESM sin build, ADB, SSE)
- **Plan 1** ✅ — Migración a Vite, componente Vapor, layout configurable, Conversation, ConfigPanel
- **Fase 1** 🔄 — Fully Kiosk Browser en lugar de ADB para control de pantalla (código listo, pendiente instalar app en dispositivo)
- **Fase 2** — Widgets Home Assistant (WebSocket directo a HA)
- **Fase 3+** — Multi-panel, markdown, streaming, idle configurable
