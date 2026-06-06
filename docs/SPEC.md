# jota-display — Especificación de producto

> Versión 0.1 — borrador inicial  
> Estado: en revisión  

---

## 1. Visión

**jota-display** es una interfaz web de código abierto para dispositivos siempre encendidos. Muestra el estado del asistente de voz Jota en tiempo real y permite controlar el hogar directamente desde la pantalla. Diseñado para funcionar en cualquier dispositivo con pantalla: teléfonos, tablets, Raspberry Pi, televisores.

No es una app nativa. Es una **Progressive Web App** (PWA) servida localmente desde el propio dispositivo.

---

## 2. Dos flujos completamente separados

Es fundamental entender que jota-display gestiona **dos canales de datos independientes**:

```
┌─────────────────────────────────────────────────────────────────┐
│ FLUJO 1 — Estado del asistente de voz (solo lectura)            │
│                                                                  │
│ wyoming-satellite → hook scripts → POST /state                   │
│     → server.py (SSE) → navegador → Vue actualiza UI            │
│                                                                  │
│ jota-display NO controla el pipeline de voz.                     │
│ Solo observa y muestra su estado.                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ FLUJO 2 — Control del hogar (lectura + escritura)               │
│                                                                  │
│ Navegador ←→ HA WebSocket API (ws://HA_IP:8123)                 │
│                                                                  │
│ Solo se activa cuando el usuario toca un widget.                 │
│ El asistente de voz Jota controla HA por su propio canal        │
│ (OpenClaw + tools). Ambos canales son independientes.           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Arquitectura completa

```
Dispositivo (teléfono / Raspberry Pi / tablet)
│
├── Fully Kiosk Browser (app Android)
│     ├── Carga http://localhost:8766/
│     ├── Pantalla completa, sin chrome de navegador
│     └── API REST :2323 → recibe comandos de screen_wake/sleep
│
├── jota-display SPA (Vue 3 + Vite)
│     ├── Panel de voz    → consume SSE /events
│     ├── Panel widgets   → consume HA WebSocket
│     ├── Panel dashboard → consume HA WebSocket
│     └── Config UI       → lee/escribe config/*.json
│
├── server.py (Python, Termux / systemd)
│     ├── GET  /          → sirve el dist/ compilado
│     ├── GET  /events    → SSE stream del estado de voz
│     ├── POST /state     → recibe hooks de wyoming-satellite
│     └── GET a Fully Kiosk :2323 para encender/apagar pantalla
│
└── Termux (en Android) o servicio systemd (en Linux)
      ├── wyoming-satellite  :10700
      ├── wyoming-openwakeword :10401
      └── jota-display server  :8766

Red local
├── Home Assistant  :8123
│     ├── ← WebSocket desde navegador (widgets, dashboard)
│     └── ← OpenClaw tools (voz, independiente)
└── green-house (OpenClaw, STT, etc.) — no interactúa con jota-display
```

---

## 4. Compatibilidad — Fully Kiosk Browser

### Requisitos en el dispositivo

| Requisito | Valor necesario | Estado |
|-----------|----------------|--------|
| Android mínimo | Android 5.0 | ✅ P8 Lite tiene Android 6.0 |
| API REST local | Puerto 2323 | ✅ Confirmada (feature PLUS) |
| Orientación landscape | Configurable en la app | ✅ |
| WebView moderno | Chromium integrado | ✅ |

**App:** Fully Kiosk Browser — Google Play ID `de.ozerov.fully`  
Licencia PLUS recomendada (~7€ por dispositivo) para API REST sin aviso.

### API REST de Fully Kiosk

```
GET http://localhost:2323/?cmd=screenOn&type=json&password=<pass>   → encender pantalla
GET http://localhost:2323/?cmd=screenOff&type=json&password=<pass>  → apagar pantalla
GET http://localhost:2323/?cmd=deviceInfo&type=json&password=<pass> → estado del dispositivo
GET http://localhost:2323/?cmd=setStringSetting&key=screenBrightness&value=200&password=<pass>
```

Requiere autenticación (contraseña configurada en Remote Administration).

---

## 5. Stack tecnológico

### Frontend
| Tecnología | Rol | Justificación |
|-----------|-----|---------------|
| **Vue 3** | Framework UI | Conocido, bien documentado, reactivo |
| **Vite** | Build tool | Hot reload instantáneo en dev, bundle optimizado en prod |
| **Vue Router** | Navegación entre paneles | Oficial Vue, sin overhead |
| **Pinia** | Estado global | Sucesor oficial de Vuex, más simple |
| **home-assistant-js-websocket** | Cliente HA | Librería oficial de HA, mantiene reconexión |
| **markdown-it** | Render markdown | Ligera, extensible |

### Backend (server.py)
Python stdlib. Sin dependencias externas. Sirve el `dist/` compilado y gestiona el SSE de voz.

### Build
```bash
npm run dev     # desarrollo con hot reload
npm run build   # genera dist/ para producción
```

El `dist/` generado es HTML+CSS+JS estático. Lo sirve `server.py` directamente. Los usuarios finales descargan el `dist/` ya compilado — no necesitan Node.js.

---

## 6. Sistema de configuración

Toda la configuración vive en `config/` como JSON. Editable manualmente O desde la **UI de configuración** integrada en la app (que lee y escribe estos mismos ficheros vía API del servidor).

```
config/
├── device.json      # identidad y comportamiento del dispositivo
├── ha.json          # conexión a Home Assistant
├── panels.json      # qué paneles existen y en qué orden
├── widgets.json     # widgets disponibles y su configuración
├── idle.json        # comportamiento del idle (reglas por hora, día, etc.)
└── theme.json       # colores, fuentes, animaciones
```

### device.json
```json
{
  "name": "Habitación principal",
  "type": "phone",
  "orientation": "landscape",
  "screenTimeout": 8,
  "fully": {
    "url": "http://localhost:2323",
    "password": "..."
  }
}
```

### ha.json
```json
{
  "url": "http://192.168.1.109:8123",
  "token": "eyJ...",
  "autoDiscover": true
}
```

### idle.json
```json
{
  "default": "clock",
  "rules": [
    { "from": "23:00", "to": "07:00", "show": "off" },
    { "from": "07:00", "to": "23:00", "show": "clock" }
  ],
  "options": {
    "clock": { "format": "HH:mm", "showDate": true, "showWeather": true },
    "off": {}
  }
}
```

### theme.json
```json
{
  "colors": {
    "bg": "#000000",
    "fg": "#f1f5f9",
    "fgDim": "#475569",
    "accent1": "#4ade80",
    "accent2": "#60a5fa",
    "accent3": "#c4b5fd"
  },
  "font": {
    "family": "system-ui",
    "weightLight": 300,
    "weightNormal": 400
  },
  "animations": {
    "enabled": true,
    "speed": "normal"
  }
}
```

### widgets.json
```json
{
  "panels": {
    "voice": {
      "widgets": ["light-dormitorio", "temperature-sensor"]
    }
  },
  "definitions": {
    "light-dormitorio": {
      "type": "toggle",
      "label": "Luz dormitorio",
      "entity": "light.dormitorio_principal",
      "icon": "mdi:lightbulb"
    },
    "temperature-sensor": {
      "type": "sensor",
      "label": "Temperatura",
      "entity": "sensor.temperatura_dormitorio",
      "unit": "°C"
    }
  }
}
```

---

## 7. Paneles

### Panel 1 — Voz (MVP, estado actual)
La interacción con el asistente. Estados: idle, listening, thinking, response.
Transcript actual + respuesta actual. Se borra tras N segundos de idle.
Widgets opcionales superpuestos (columna lateral o barra inferior).

### Panel 2 — Dashboard (Fase 3)
Vista simplificada del hogar. Entidades agrupadas por habitación.
**Decisión pendiente**: Vue nativo vs iframe de Lovelace.
- *iframe*: más rápido de implementar, depende de HA online
- *nativo*: más control de diseño, sin dependencia

### Panel 3+ — Extensibles (Fase 4+)
La arquitectura de paneles es abierta. Cualquier panel es un componente Vue registrado.

### Navegación entre paneles
**Decisión pendiente** hasta tener el MVP funcionando. Opciones documentadas:
- Swipe horizontal (más natural en móvil)
- Barra de navegación inferior con iconos
- Comando de voz ("Jota, muéstrame el dashboard")
- Botón flotante configurable

---

## 8. Sistema de widgets

Un widget es un componente Vue que:
1. Recibe una `entity` de HA como prop
2. Se suscribe al estado en tiempo real via Pinia store
3. Envía comandos a HA cuando el usuario interactúa

### Tipos de widget (catálogo)

| Tipo | Descripción | Fase |
|------|-------------|------|
| `toggle` | Botón on/off para luces, interruptores | 2 |
| `sensor` | Valor de sensor en modo lectura | 2 |
| `slider` | Control de intensidad / volumen | 3 |
| `camera` | Feed MJPEG de cámara de seguridad | 3 |
| `media` | Control básico media player (play/pausa/artista) | 3 |
| `script` | Botón que ejecuta un script o automatización | 3 |
| `weather` | Widget de tiempo (para idle o panel) | 4 |
| `custom` | Componente Vue custom completo | siempre |

### Arquitectura del widget registry

```
src/
└── widgets/
    ├── index.js          ← registry: { tipo: Componente }
    ├── ToggleWidget.vue
    ├── SensorWidget.vue
    ├── SliderWidget.vue
    └── ...
```

Para añadir un widget nuevo: crear `MiWidget.vue` y registrarlo en `index.js`. Sin tocar nada más.

---

## 9. Integración con Home Assistant

### Conexión WebSocket (browser → HA)

La app usa [`home-assistant-js-websocket`](https://github.com/home-assistant/home-assistant-js-websocket), la misma librería que usa el frontend oficial de HA.

```js
// store/ha.js (Pinia)
import { createConnection, subscribeEntities } from 'home-assistant-js-websocket'

const conn = await createConnection({ auth })
subscribeEntities(conn, entities => {
  haStore.entities = entities  // actualización en tiempo real
})
```

### Token de autenticación

Generado en HA → Perfil → Long-lived access tokens.
Se guarda en `config/ha.json`. La config UI tiene un campo para pegarlo.

### Auto-discovery (Fase 4)

Objetivo: que el usuario no tenga que escribir el token ni la IP a mano.  
Opciones a explorar:
- **HA custom integration**: aparece en HACS, proporciona token automáticamente
- **mDNS discovery**: busca `homeassistant.local` en la red
- **Manual en config UI**: fallback siempre disponible

---

## 10. Idle — pantalla en reposo

Cuando no hay actividad de voz, la pantalla puede mostrar:

| Modo | Descripción |
|------|-------------|
| `off` | Pantalla apagada (Fully Kiosk screen sleep) |
| `clock` | Reloj + fecha (configurable formato) |
| `clock-weather` | Reloj + tiempo exterior |
| `screensaver` | Animación generativa / imagen aleatoria |
| `custom` | URL alternativa (ej: panel de HA) |

Las reglas son configurables por franjas horarias en `idle.json`. Ejemplos:
- De 23:00 a 7:00 → pantalla apagada
- De 7:00 a 23:00 → reloj con temperatura
- Al recibir estado `listening` → cancelar cualquier idle inmediatamente

---

## 11. Contenido enriquecido en respuestas

Las respuestas de Jota pueden contener:

| Tipo | Soporte | Implementación |
|------|---------|----------------|
| Markdown | ✅ Fase 2 | `markdown-it` |
| Imágenes | ✅ Fase 2 | `![alt](url)` en markdown |
| Listas | ✅ Fase 2 | markdown nativo |
| Código | ✅ Fase 2 | highlight con `highlight.js` |
| Tablas | ✅ Fase 3 | markdown-it plugin |
| Vídeo | 🔲 Fase 4 | embed `<video>` |
| Streaming (carácter a carácter) | 🔲 Fase 3 | requiere cambio en el hook `on_synthesize.sh` y protocolo SSE |

---

## 12. Interacción táctil

| Gesto | Acción | Fase |
|-------|--------|------|
| Tap orb | Iniciar escucha manualmente | 2 |
| Tap respuesta Jota | Releer en voz alta (TTS) | 3 |
| Tap widget toggle | Encender/apagar entidad HA | 2 |
| Swipe en panel de voz | Navegar a siguiente panel | 3 |
| Long press | Menú contextual / opciones | 4 |
| Cancelar pipeline | Botón visible durante listening/thinking | 2 |

---

## 13. Estructura del repositorio (Fase 2+)

```
jota-display/
├── src/
│   ├── main.js              ← punto de entrada Vite
│   ├── App.vue              ← raíz Vue + router-view
│   ├── router/
│   │   └── index.js         ← Vue Router (paneles)
│   ├── stores/
│   │   ├── voice.js         ← Pinia: estado del asistente de voz
│   │   └── ha.js            ← Pinia: conexión HA + entidades
│   ├── panels/
│   │   ├── VoicePanel.vue   ← Panel 1: asistente de voz
│   │   ├── DashPanel.vue    ← Panel 2: dashboard HA
│   │   └── ...
│   ├── components/
│   │   ├── Orb.vue
│   │   ├── Bubble.vue
│   │   ├── NavBar.vue
│   │   └── IdleScreen.vue
│   ├── widgets/
│   │   ├── index.js         ← widget registry
│   │   ├── ToggleWidget.vue
│   │   └── SensorWidget.vue
│   ├── config/
│   │   └── loader.js        ← lee config/*.json en runtime
│   └── theme/
│       └── loader.js        ← aplica theme.json como CSS variables
│
├── config/                  ← JSONs de configuración (no versionados con datos reales)
│   ├── device.json
│   ├── ha.json              ← IGNORADO en git (contiene token)
│   ├── widgets.json
│   ├── idle.json
│   └── theme.json
│
├── public/
│   ├── manifest.json
│   └── icon.png
│
├── server/
│   └── server.py            ← sirve dist/, gestiona SSE, controla Fully Kiosk
│
├── hooks/                   ← scripts wyoming-satellite
│   ├── on_detection.sh
│   ├── on_transcript.sh
│   └── on_synthesize.sh
│
├── dist/                    ← generado por `npm run build` (no versionado)
├── docs/
│   └── SPEC.md              ← este documento
├── .gitignore
├── package.json
├── vite.config.js
└── README.md
```

---

## 14. Fases de implementación

### Fase 0 — Estado actual ✅
- UI Vue 3 sin build (ESM directo)
- server.py con SSE
- Hooks wyoming-satellite
- Servidor en Termux (teléfono)
- ADB para control de pantalla

### Fase 1 — Fully Kiosk Browser
- Instalar Fully Kiosk Browser (Google Play: de.ozerov.fully)
- Control de pantalla via REST API local (puerto 2323)
- Orientacion landscape forzada desde la app

### Fase 2 — Migración a Vite + funcionalidades base
- Migrar proyecto a Vite + Vue Router + Pinia
- Sistema de configuración (`config/*.json`)
- Theming via CSS variables desde `theme.json`
- Widget: `ToggleWidget` (luz on/off via HA WebSocket)
- Widget: `SensorWidget` (lectura de sensor)
- Cancelar pipeline táctilmente
- Tap en orb → iniciar escucha

### Fase 3 — Paneles y contenido enriquecido
- Panel Dashboard (decisión iframe vs nativo)
- Navegación entre paneles (decisión de UX)
- Markdown + imágenes en respuestas de Jota
- Streaming de texto (carácter a carácter)
- Widget: Slider, Camera, Media

### Fase 4 — Idle configurable y config UI
- IdleScreen con reglas horarias
- UI de configuración (ventana de settings)
- Config UI escribe `config/*.json` en el servidor
- Auto-discovery HA (exploración)

### Fase 5 — Open source y distribución
- README completo para instalación
- Docker Compose para Raspberry Pi / Linux
- Documentación de la API del servidor
- Guía de creación de widgets custom
- GitHub Actions: build automático en cada release

---

## 15. Decisiones pendientes

| Decisión | Opciones | Bloquea |
|----------|----------|---------|
| Navegación entre paneles | Swipe / NavBar / Voz / Botón flotante | Fase 3 |
| Dashboard Panel | Vue nativo vs iframe Lovelace | Fase 3 |
| Auto-discovery HA | HACS integration / mDNS / manual | Fase 4 |
| Diseño visual final | Rediseño completo pendiente | Fase 4 |
| Streaming de texto | Cambios en hooks + protocolo SSE | Fase 3 |

---

## 16. Lo que NO es jota-display

- No es el orquestador de IA (eso es OpenClaw)
- No controla el pipeline de voz directamente
- No reemplaza Home Assistant
- No requiere nube ni internet para funcionar
- No es una app nativa (es PWA)
