# jota-display

UI web para el asistente de voz Jota. Se ejecuta en el dispositivo que actúa como
terminal de voz (actualmente un Huawei P8 Lite). Muestra el estado del pipeline de
voz en tiempo real: escuchando, pensando, respondiendo.

## Stack

| Capa | Tecnología |
|------|-----------|
| UI | Vue 3 ESM (sin build step) |
| Comunicación | Server-Sent Events (SSE) |
| Servidor | Python `http.server` |
| Control pantalla | ADB (Android Debug Bridge) |

Vue 3 se incluye como fichero local en `lib/vue.esm-browser.js` — no hay CDN ni
dependencias externas. No se necesita `npm`, `node`, ni ninguna herramienta de build.

---

## Estructura

```
jota-display/
├── index.html              # punto de entrada
├── app.js                  # raíz Vue, store reactivo, conexión SSE
├── style.css               # todos los estilos
├── manifest.json           # PWA manifest
├── components/
│   ├── Orb.js              # esfera animada (estado visual)
│   ├── UserBubble.js       # burbuja con el transcript del usuario
│   └── JotaBubble.js       # burbuja con la respuesta de Jota
├── lib/
│   └── vue.esm-browser.js  # Vue 3 local (no modificar)
├── server/
│   └── server.py           # servidor HTTP/SSE + control ADB
├── hooks/                  # scripts llamados por wyoming-satellite
│   ├── on_detection.sh     # wake word detectada
│   ├── on_transcript.sh    # STT completado
│   └── on_synthesize.sh    # respuesta lista para TTS
└── deploy.sh               # despliega al dispositivo vía SCP+ADB
```

---

## Estados de la UI

El sistema tiene cuatro estados. El servidor mantiene el estado actual y lo difunde
a todos los clientes SSE conectados.

| Estado | Orb | Burbuja usuario | Burbuja Jota | Pantalla |
|--------|-----|-----------------|--------------|---------|
| `idle` | Oscuro, quieto | oculta | oculta | apagada |
| `listening` | Verde, barras animadas | oculta | oculta | encendida |
| `thinking` | Azul, pulso | visible (transcript) | oculta | encendida |
| `response` | Violeta | visible (transcript) | visible (respuesta) | encendida → apaga en 8s |

El estado vive en `app.js` como `store` reactivo de Vue. Todos los componentes lo
leen directamente — no hay props que pasar entre componentes.

---

## API del servidor

### `GET /events`

Stream SSE. El navegador se conecta aquí y recibe actualizaciones de estado en
tiempo real. Cada mensaje es un JSON en el campo `data`.

**Formato del mensaje:**
```json
{
  "state": "listening",
  "text": "",
  "ts": 1716295200.123
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `state` | string | Estado actual: `idle` \| `listening` \| `thinking` \| `response` |
| `text` | string | Texto asociado al estado. En `thinking`: transcript del usuario. En `response`: respuesta de Jota. |
| `ts` | float | Unix timestamp del último cambio de estado |

El servidor envía un ping de keepalive (`": ping"`) cada 25 segundos para mantener
la conexión abierta.

**Ejemplo de secuencia de eventos en una interacción:**
```
data: {"state":"idle","text":"","ts":1716295100.0}
data: {"state":"listening","text":"","ts":1716295200.1}
data: {"state":"thinking","text":"qué tiempo hace","ts":1716295201.5}
data: {"state":"response","text":"Hoy en Madrid está nublado, 18°C.","ts":1716295203.2}
data: {"state":"idle","text":"","ts":1716295211.2}   ← automático tras 8s
```

---

### `POST /state`

Usado por los hook scripts del dispositivo para notificar cambios de estado.
No requiere autenticación (sólo accesible desde la LAN interna por el puerto HTTP).

**Body JSON:**
```json
{ "state": "listening" }
```
```json
{ "state": "thinking", "text": "qué tiempo hace mañana" }
```
```json
{ "state": "response", "text": "Mañana habrá sol con 22°C." }
```

**Efectos secundarios en el servidor:**
- `listening` → ADB `KEYCODE_WAKEUP` (enciende la pantalla)
- `response` → programa ADB `KEYCODE_SLEEP` con 8 segundos de retardo

**Respuesta:** `200 OK` con body `ok`

---

## Hook scripts

Los scripts en `hooks/` son llamados por `wyoming-satellite` en el dispositivo.
Hacen POST a `/state` en el servidor y terminan inmediatamente (no bloquean el pipeline).

### `on_detection.sh`
Disparado cuando se detecta la wake word ("Ok Nabu").

```sh
POST /state  {"state": "listening"}
```

Acción en servidor: enciende la pantalla vía ADB.

### `on_transcript.sh "$1"`
Disparado cuando el STT devuelve el transcript. `$1` contiene el texto transcrito.

```sh
POST /state  {"state": "thinking", "text": "<transcript>"}
```

### `on_synthesize.sh "$1"`
Disparado cuando el pipeline tiene lista la respuesta para TTS. `$1` contiene
el texto de la respuesta de Jota.

```sh
POST /state  {"state": "response", "text": "<respuesta>"}
```

Acción en servidor: programa apagado de pantalla en 8 segundos.

**Configuración en `start-satellite.sh` del dispositivo:**
```sh
--detection-command  "/data/data/com.termux/files/home/jota-display/hooks/on_detection.sh"
--transcript-command "/data/data/com.termux/files/home/jota-display/hooks/on_transcript.sh"
--synthesize-command "/data/data/com.termux/files/home/jota-display/hooks/on_synthesize.sh"
```

---

## Desarrollo local

No se necesita ninguna herramienta. Abre `index.html` directamente en el navegador
**o** levanta el servidor Python para tener SSE y probar la UI en vivo:

```bash
cd server
python3 server.py
# → http://localhost:8766  (hooks)
# → https://localhost:8443 (navegador, requiere aceptar cert autofirmado)
```

Para simular eventos sin hablar:
```bash
curl -X POST http://localhost:8766/state \
  -H 'Content-Type: application/json' \
  -d '{"state":"listening"}'

curl -X POST http://localhost:8766/state \
  -H 'Content-Type: application/json' \
  -d '{"state":"thinking","text":"qué tiempo hace"}'

curl -X POST http://localhost:8766/state \
  -H 'Content-Type: application/json' \
  -d '{"state":"response","text":"Hoy está nublado con 18 grados."}'
```

---

## Despliegue

```bash
bash deploy.sh
```

El script copia los ficheros al dispositivo vía SCP y reinicia el servicio.
Ver `deploy.sh` para los detalles de destino y configuración.

---

## Añadir un componente nuevo

1. Crea `components/MiComponente.js`:
```js
import { defineComponent } from '/lib/vue.esm-browser.js'
import { store } from '/app.js'

export default defineComponent({
  name: 'MiComponente',
  setup() {
    return { store }
  },
  template: `<div>{{ store.current }}</div>`
})
```

2. Impórtalo en `app.js`:
```js
import MiComponente from '/components/MiComponente.js'
// añádelo a components: { ..., MiComponente }
// úsalo en el template: <MiComponente />
```

No hay build step — los cambios se ven al recargar el navegador.
