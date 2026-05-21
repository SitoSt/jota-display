# jota-display

Interfaz web de código abierto para dispositivos siempre encendidos con asistente de voz. Muestra el estado de la conversación en tiempo real y permite controlar el hogar desde la pantalla.

Diseñado para correr localmente en el propio dispositivo: teléfonos Android (via Termux), Raspberry Pi, tablets, cualquier pantalla con un navegador.

> **Estado actual:** MVP — panel de voz funcional con SSE. Ver [SPEC](docs/SPEC.md) para la hoja de ruta completa.

---

## Qué hace ahora mismo

- Muestra el estado del asistente: escuchando 🟢, pensando 🔵, respondiendo 🟣
- Muestra la transcripción de lo que dices y la respuesta de Jota
- Se enciende y apaga la pantalla automáticamente con cada conversación
- Corre completamente en local — sin dependencia de red para la UI

## Qué hará (ver [SPEC](docs/SPEC.md))

- Widgets configurables para controlar Home Assistant desde la pantalla
- Múltiples paneles (voz + dashboard domótico + más)
- Interacción táctil para cancelar el pipeline, controlar dispositivos
- Contenido enriquecido: markdown, imágenes, cámaras
- Sistema de temas configurable
- Pantalla idle configurable (reloj, clima, reglas horarias)

---

## Stack

| Capa | Tecnología |
|------|-----------|
| UI | Vue 3 + ESM (sin build por ahora; Vite en Fase 2) |
| Estado en tiempo real | Server-Sent Events (SSE) |
| Servidor | Python `http.server` (stdlib, sin dependencias) |
| Control de pantalla | WallPanel API REST (HTTP local) |
| Dispositivo Android | Termux |

---

## Instalación rápida

### En el dispositivo (Android + Termux)

```bash
# Clonar el repo
git clone https://github.com/SitoSt/jota-display ~/jota-display

# Dar permisos
chmod +x ~/jota-display/hooks/*.sh
chmod +x ~/jota-display/server/start_termux.sh

# Arrancar el servidor
JOTA_MODE=termux JOTA_ADB_PORT=32906 \
  nohup python3 ~/jota-display/server/server.py \
  >> ~/jota-display.log 2>&1 &

# Abrir en el navegador del teléfono
# → http://localhost:8766/
```

### En Linux / Raspberry Pi

```bash
git clone https://github.com/SitoSt/jota-display
cd jota-display
python3 server/server.py
# → http://localhost:8766/
```

---

## Estructura

```
jota-display/
├── index.html              # punto de entrada
├── app.js                  # raíz Vue, store reactivo, conexión SSE
├── style.css               # estilos globales
├── manifest.json           # PWA manifest
├── components/
│   ├── Orb.js              # esfera animada (estado visual)
│   ├── UserBubble.js       # burbuja con el transcript del usuario
│   └── JotaBubble.js       # burbuja con la respuesta de Jota
├── lib/
│   └── vue.esm-browser.js  # Vue 3 local (sin CDN)
├── server/
│   ├── server.py           # servidor HTTP/SSE + control WallPanel/ADB
│   └── start_termux.sh     # script de arranque para Termux
├── hooks/                  # scripts llamados por wyoming-satellite
│   ├── on_detection.sh     # wake word detectada → state: listening
│   ├── on_transcript.sh    # STT completo → state: thinking + texto
│   └── on_synthesize.sh    # respuesta lista → state: response + texto
├── config/                 # configuración del dispositivo (*.example.json de referencia)
└── docs/
    ├── SPEC.md             # especificación completa del producto
    ├── device-setup.md     # instalación y operación del dispositivo
    └── phone-patches.md    # parches manuales en wyoming-satellite / openwakeword
```

---

## API del servidor

### `GET /events` — SSE stream

El navegador se conecta aquí y recibe actualizaciones de estado en tiempo real.

```
data: {"state":"idle","text":"","ts":1716295100.0}
data: {"state":"listening","text":"","ts":1716295200.1}
data: {"state":"thinking","text":"qué tiempo hace","ts":1716295201.5}
data: {"state":"response","text":"Hoy está nublado, 18°C.","ts":1716295203.2}
```

### `POST /state` — actualizar estado

Usado por los hook scripts. Body JSON:

```json
{ "state": "listening" }
{ "state": "thinking", "text": "qué tiempo hace mañana" }
{ "state": "response", "text": "Mañana habrá sol con 22°C." }
```

Los estados válidos son: `idle` | `listening` | `thinking` | `response`

### Simular eventos (testing)

```bash
curl -X POST http://localhost:8766/state \
  -H 'Content-Type: application/json' \
  -d '{"state":"thinking","text":"qué temperatura hay"}'
```

---

## Variables de entorno del servidor

| Variable | Valores | Por defecto | Descripción |
|----------|---------|-------------|-------------|
| `JOTA_MODE` | `worker01` / `termux` | `worker01` | Modo de despliegue |
| `JOTA_ADB_PORT` | número | `32906` | Puerto TLS de Wireless Debugging |

En modo `termux`: HTTP solo en `:8766`, ADB conecta a `localhost`.  
En modo `worker01`: HTTP en `:8766` + HTTPS en `:8443`, ADB a IP remota.

---

## Hooks wyoming-satellite

Los scripts en `hooks/` deben copiarse al dispositivo y referenciarse en `start-satellite.sh`:

```sh
--detection-command  "/ruta/a/jota-display/hooks/on_detection.sh"
--transcript-command "/ruta/a/jota-display/hooks/on_transcript.sh"
--synthesize-command "/ruta/a/jota-display/hooks/on_synthesize.sh"
```

Ver `docs/device-setup.md` para la configuración completa del dispositivo.

---

## Contribuir

El proyecto es open source y está diseñado para escalar con contribuciones de la comunidad.

- Para añadir un **componente Vue**: crear `components/MiComponente.js`, importarlo en `app.js`
- Para añadir un **widget HA** (Fase 2+): crear `src/widgets/MiWidget.vue`, registrarlo en `src/widgets/index.js`
- Para proponer cambios en la SPEC: abrir un issue con la propuesta

---

## Documentación

- [SPEC completa del producto](docs/SPEC.md)
- [Configuración del dispositivo Android](docs/device-setup.md)
- [Parches manuales en el teléfono](docs/phone-patches.md)
