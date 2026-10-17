# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the server

```bash
# Modo worker01 (Linux, defecto)
python3 server/server.py

# Modo Termux (Android)
JOTA_MODE=termux JOTA_ADB_PORT=32906 python3 server/server.py

# → http://localhost:8766/
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

### Fase actual (MVP — sin build)

No hay Vite ni npm. Vue 3 se carga desde `lib/vue.esm-browser.js` como módulo ESM nativo. Los componentes en `components/` son ficheros `.js` que usan `defineComponent` + template strings. El servidor (`server.py`) sirve los ficheros estáticos directamente desde `BASE_DIR`.

**Los componentes importan el store global así:**
```js
import { store } from '/app.js'   // ruta absoluta del servidor, no relativa
```

### Flujo de datos

Hay dos canales **completamente independientes**:

1. **Estado de voz (solo lectura):** `wyoming-satellite` llama a los scripts `hooks/on_*.sh` → `POST /state` → `server.py` emite SSE → Vue actualiza UI. jota-display no controla el pipeline de voz.

2. **Control del hogar (Fase 2+):** el navegador habla directamente con HA vía WebSocket. Independiente del canal de voz.

### Máquina de estados

`app.js` es la única fuente de verdad. El estado fluye en un solo sentido: SSE event → `applyEvent()` → `store` reactivo → componentes. Los estados se limpian al volver a `idle`.

### Modos de despliegue (`server.py`)

| Variable `JOTA_MODE` | ADB target | HTTPS |
|---|---|---|
| `worker01` (defecto) | `192.168.1.129:<port>` | `:8443` con cert local |
| `termux` | `localhost:<port>` | Desactivado |

En `worker01`, el servidor levanta HTTP (`:8766`) + HTTPS (`:8443`). Los certificados SSL se esperan en `/home/sito/kiosk_cert.pem` y `kiosk_key.pem`.

### Control de pantalla

Actualmente vía ADB (`KEYCODE_WAKEUP` / `KEYCODE_SLEEP`). **Fase 1** reemplaza esto por la API REST de WallPanel en `localhost:2971` — la lógica ADB en `server.py` está destinada a eliminarse.

### Hooks wyoming-satellite

Los scripts en `hooks/` se llaman desde `start-satellite.sh` con los flags `--detection-command`, `--transcript-command`, `--synthesize-command`. Hacen `curl POST /state` al servidor. La ruta IP en los hooks apunta a `192.168.1.109` (worker-01, donde corre el servidor en modo `worker01`).

## Configuración

`config/*.json` — no versionados con datos reales. Los `*.example.json` son la referencia. `config/ha.json` (contiene token HA) debe permanecer en `.gitignore`.

## Roadmap de fases

- **Fase 0** ✅ — MVP actual (ESM sin build, ADB, SSE)
- **Fase 1** — WallPanel en lugar de ADB para control de pantalla
- **Fase 2** — Migración a Vite + Vue Router + Pinia, widgets HA básicos
- **Fase 3+** — Multi-panel, markdown, streaming, idle configurable
