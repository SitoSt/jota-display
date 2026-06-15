# Spec: Panel de configuración en ajustes (Sistema)

**Fecha:** 2026-06-15
**Estado:** Aprobado

---

## Contexto

jota-display gestiona su configuración mediante archivos JSON en `config/`. Hasta ahora, cambiar parámetros como la URL de Home Assistant o el nombre del dispositivo requería editar los ficheros a mano. El objetivo es exponer los campos más relevantes en el SettingsDrawer existente para agilizar la configuración, especialmente en entornos de prueba.

---

## Alcance

### Incluido

| Fichero | Campos editables desde UI |
|---|---|
| `ha.json` | `url` |
| `device.json` | `name`, `fully.url`, `screenTimeout` |
| `layout.json` | `strip.height` |

### Excluido explícitamente

- **Token de HA** (`ha.json → token`): gestionado manualmente o por variable de entorno. Fase futura.
- **Satellite** (`ha.json → satellite`): ya no se usa wyoming-satellite; el pipeline de voz es jota-voice. No necesita UI.
- **Password de Fully Kiosk** (`device.json → fully.password`): excluida igual que el token de HA. Fase futura.
- **`theme.json`** (colores y fuentes): fuera de esta iteración.

---

## Arquitectura

### Composables nuevos

Tres composables en `src/composables/`, siguiendo el patrón existente de `useIdle`, `useWidgets` y `useGridConfig`.

#### `useHAConfig.js`

- Carga `ha.json` al inicializarse.
- Expone solo `url` como ref reactivo.
- `saveHAConfig(patch)`: antes de escribir, hace GET del fichero actual para recuperar `token` y `satellite` (campos que la UI no gestiona) y los preserva en el objeto que escribe. Nunca machaca datos fuera del alcance.

#### `useDeviceConfig.js`

- Carga `device.json`. Si no existe, usa defaults: `{ name: '', fully: { url: 'http://localhost:2323' }, screenTimeout: 8 }`.
- Expone: `name`, `fullyUrl`, `screenTimeout`.
- `saveDeviceConfig(patch)`: escribe `device.json` con el estado actual mergeado con el patch.

#### `useLayoutConfig.js`

- Carga `layout.json`. Default si no existe: `{ strip: { height: 54 } }`.
- Expone: `stripHeight`.
- `saveLayoutConfig(patch)`: escribe `layout.json`.

### Infraestructura de servidor

No requiere cambios. `server.py` ya soporta:
- `GET /config/*.json` — sirve el fichero
- `POST /config/*.json` — escribe el fichero completo

---

## UI: sección Sistema en SettingsDrawer

La sección `sistema` del SettingsDrawer se rediseña con dos bloques dentro de un contenedor con scroll.

### Bloque 1 — Info compacta (solo lectura)

Los cuatro info-cards actuales se reducen a dos cards más pequeñas en una fila:
- **Estado HA**: dot de color (verde/gris) + texto de conexión + nº de entidades.
- **Dispositivo**: nombre del dispositivo + Fully Kiosk activo/inactivo.

### Bloque 2 — Configuración editable

Tres grupos usando los componentes visuales existentes (`s-section`, `s-list`, `s-row`):

```
● HOME ASSISTANT
  ┌──────────────────────────────────────────┐
  │ URL del servidor   [http://192.168.1.X…] │  ← input + dot de estado HA
  └──────────────────────────────────────────┘

● DISPOSITIVO
  ┌──────────────────────────────────────────┐
  │ Nombre             [Habitación princ.  ] │
  │ URL Fully Kiosk    [http://localhost…  ] │
  │ Tiempo de pantalla  [30s][1m][2m][5m]…  │  ← chips
  └──────────────────────────────────────────┘

● PANTALLA
  ┌──────────────────────────────────────────┐
  │ Altura del strip   [−]  54px  [+]        │  ← stepper
  └──────────────────────────────────────────┘
```

### Comportamiento de guardado

- **Inputs de texto** (`url`, `name`, `fullyUrl`): guardan al perder el foco (`@blur`). No guardan en cada keystroke.
- **Chips** (`screenTimeout`) y **stepper** (`stripHeight`): guardan inmediatamente al pulsar, igual que el resto del drawer (Reposo, Widgets).

---

## Ficheros afectados

| Fichero | Acción |
|---|---|
| `src/composables/useHAConfig.js` | Crear |
| `src/composables/useDeviceConfig.js` | Crear |
| `src/composables/useLayoutConfig.js` | Crear |
| `src/components/SettingsDrawer.vue` | Modificar sección `sistema` |

---

## Lo que NO cambia

- `server.py` — sin modificaciones.
- Los composables existentes (`useHA`, `useIdle`, `useWidgets`, `useGridConfig`) — sin modificaciones.
- La estructura de los ficheros JSON en disco — sin modificaciones.
- El token de HA y la password de Fully siguen en `ha.json` / `device.json` como hasta ahora; la UI simplemente no los toca.
