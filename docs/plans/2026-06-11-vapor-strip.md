# VaporStrip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar `Vapor.vue` (orbe blob con posición configurable) por `VaporStrip.vue` — franja Canvas 2D fija en el borde superior con efecto de luz atmosférica.

**Architecture:** `VaporStrip.vue` es un canvas de ancho 100% × `var(--strip-h)` que dibuja 5 manchas de luz solapadas con blend mode `screen`. La animación principal es el color (hue oscilante), con micro-movimiento de forma via simplex noise. `useLayout.js` se simplifica a inyectar `--strip-h` desde `config/layout.json`. El layout de `MainView` pasa de grid a flex column.

**Tech Stack:** Vue 3 Composition API, Canvas 2D, simplex noise 2D inline (sin dependencias), CSS custom properties.

---

## Mapa de archivos

| Archivo | Acción |
|---|---|
| `src/components/VaporStrip.vue` | **Crear** — componente canvas nuevo |
| `src/components/Vapor.vue` | **Eliminar** |
| `src/composables/useLayout.js` | **Modificar** — solo inyecta `--strip-h` |
| `src/views/MainView.vue` | **Modificar** — usa VaporStrip, layout flex |
| `src/style.css` | **Modificar** — nuevo layout, eliminar vapor-* |
| `src/components/SettingsDrawer.vue` | **Modificar** — elimina controles de posición |
| `config/layout.json` | **Modificar** — nuevo schema |
| `config/layout.example.json` | **Modificar** — nuevo schema |

---

## Task 1: Simplificar useLayout.js

**Files:**
- Modify: `src/composables/useLayout.js`

- [ ] **Reemplazar el contenido completo de `src/composables/useLayout.js`**

```js
async function loadLayout() {
  const res = await fetch('/config/layout.json').catch(() => null)
  if (!res?.ok) return
  const cfg = await res.json().catch(() => null)
  if (!cfg) return
  const h = cfg.strip?.height
  if (typeof h === 'number' && h > 0) {
    document.documentElement.style.setProperty('--strip-h', `${h}px`)
  }
}

export function useLayout() {
  return { loadLayout }
}
```

- [ ] **Actualizar `config/layout.json`**

```json
{
  "strip": {
    "height": 54
  }
}
```

- [ ] **Actualizar `config/layout.example.json`** con el mismo contenido.

- [ ] **Arrancar el servidor de desarrollo y verificar que no hay errores en consola**

```bash
npm run dev
```

Abre http://localhost:5173 — la app debe cargar (aunque Vapor.vue sigue existiendo, useLayout ya no exporta `layoutClass` ni `saveLayout`; los errores por esas referencias se arreglan en tareas siguientes).

- [ ] **Commit**

```bash
git add src/composables/useLayout.js config/layout.json config/layout.example.json
git commit -m "refactor(layout): simplificar useLayout — solo altura del strip"
```

---

## Task 2: Crear VaporStrip.vue

**Files:**
- Create: `src/components/VaporStrip.vue`

- [ ] **Crear `src/components/VaporStrip.vue` con el siguiente contenido completo**

```vue
<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useVoice } from '../composables/useVoice.js'

const { current, startListening, cancel } = useVoice()

function handleTap() {
  if (current.value === 'listening' || current.value === 'thinking') cancel()
  else startListening()
}

// ── Simplex noise 2D (Stefan Gustavson, dominio público) ──────────────
const sn = (() => {
  const F=.5*(Math.sqrt(3)-1),G=(3-Math.sqrt(3))/6
  const gv=[[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]]
  const perm=Array.from({length:256},(_,i)=>i)
  for(let i=255;i>0;i--){const j=0|Math.random()*(i+1);[perm[i],perm[j]]=[perm[j],perm[i]]}
  const pm=new Uint8Array(512);for(let i=0;i<512;i++)pm[i]=perm[i&255]
  const dot=([a,b],x,y)=>a*x+b*y
  const contrib=(g,x,y)=>{let v=.5-x*x-y*y;return v<0?0:(v*=v,v*v*dot(g,x,y))}
  return(x,y)=>{
    const s=(x+y)*F,i=0|x+s,j=0|y+s,tt=(i+j)*G
    const x0=x-(i-tt),y0=y-(j-tt),[i1,j1]=x0>y0?[1,0]:[0,1]
    const g0=pm[(i+pm[j&255])&255]&7,g1=pm[(i+i1+pm[(j+j1)&255])&255]&7,g2=pm[(i+1+pm[(j+1)&255])&255]&7
    return 70*(contrib(gv[g0],x0,y0)+contrib(gv[g1],x0-i1+G,y0-j1+G)+contrib(gv[g2],x0-1+2*G,y0-1+2*G))
  }
})()

// ── Paletas HSL [hue, sat, lit] por estado ────────────────────────────
const PALETTES = {
  idle:      [[140,68,55],[160,60,50],[190,50,45]],
  listening: [[130,80,60],[155,75,58],[80,70,58]],
  thinking:  [[215,80,62],[240,65,68],[195,85,65]],
  response:  [[270,70,72],[315,65,72],[245,60,68]],
}
const HUE_DRIFT = { idle:18, listening:30, thinking:22, response:25 }
const COLOR_SPD = { idle:.3,  listening:.9,  thinking:.55, response:.45 }
const SHAPE_SPD = { idle:.04, listening:.12, thinking:.07, response:.06 }
const INTENSITY = { idle:.55, listening:1.0, thinking:.82, response:.88 }
const TARGET_FPS = { idle:24, listening:30,  thinking:30,  response:30  }

// ── 5 blobs: posición normalizada (nx, ny), radios fraccionarios, paleta
const BLOBS = [
  { nx:.12, ny:-.15, rx:.38, ry:.65, palIdx:0 },
  { nx:.50, ny:-.05, rx:.45, ry:.72, palIdx:1 },
  { nx:.82, ny:-.10, rx:.38, ry:.65, palIdx:2 },
  { nx:.30, ny:-.08, rx:.32, ry:.55, palIdx:1 },
  { nx:.68, ny:-.12, rx:.32, ry:.55, palIdx:0 },
]

// ── Canvas state ──────────────────────────────────────────────────────
const canvasEl = ref(null)
const DRAW_DPR = Math.min(window.devicePixelRatio || 1, 1.5)

let W = 0, H = 0
let rafId = null, ro = null
let toSt = 'idle', fromSt = 'idle', transT = 1.0
let t = 0, lastTs = 0, lastFrameTs = 0
let visible = true
const TRANS_DUR = 1.4

function resize() {
  const c = canvasEl.value
  if (!c) return
  const r = c.getBoundingClientRect()
  W = r.width; H = r.height
  c.width  = Math.round(W * DRAW_DPR)
  c.height = Math.round(H * DRAW_DPR)
  c.getContext('2d').setTransform(DRAW_DPR, 0, 0, DRAW_DPR, 0, 0)
}

function lerp(a, b, t) { return a + (b - a) * t }
function smooth(t) { const c = Math.max(0, Math.min(1, t)); return c*c*(3-2*c) }
function hsl(h, s, l, a) { return `hsla(${h|0},${s|0}%,${l|0}%,${a.toFixed(3)})` }

function frame(ts) {
  if (!visible) return

  const interval = 1000 / TARGET_FPS[toSt]
  if (ts - lastFrameTs < interval * .92) {
    rafId = requestAnimationFrame(frame)
    return
  }

  const c = canvasEl.value
  if (!c || !W || !H) { rafId = requestAnimationFrame(frame); return }

  const dt = Math.min((ts - (lastTs || ts)) / 1000, .06)
  lastTs = lastFrameTs = ts
  if (transT < 1) transT = Math.min(1, transT + dt / TRANS_DUR)
  t += dt

  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, W, H)

  const e = smooth(transT)
  const colorSpd  = lerp(COLOR_SPD[fromSt],  COLOR_SPD[toSt],  e)
  const shapeSpd  = lerp(SHAPE_SPD[fromSt],  SHAPE_SPD[toSt],  e)
  const intensity = lerp(INTENSITY[fromSt],  INTENSITY[toSt],  e)
  const hueDrift  = lerp(HUE_DRIFT[fromSt],  HUE_DRIFT[toSt],  e)

  // Dibujar los 5 blobs
  for (let i = 0; i < BLOBS.length; i++) {
    const b = BLOBS[i]
    const pFrom = PALETTES[fromSt][b.palIdx % 3]
    const pTo   = PALETTES[toSt  ][b.palIdx % 3]

    const hueTime = t * colorSpd * .4 + i * 1.7
    const hh = lerp(pFrom[0], pTo[0], e) + Math.sin(hueTime) * hueDrift
    const ss = lerp(pFrom[1], pTo[1], e)
    const ll = lerp(pFrom[2], pTo[2], e)

    const shapeNx = sn(i*3.1,    t*shapeSpd)
    const shapeNy = sn(i*5.7+10, t*shapeSpd*.7)
    const shapeNr = sn(i*7.3+20, t*shapeSpd*.5)

    const cx = (b.nx + shapeNx*.06) * W
    const cy = (b.ny + shapeNy*.04) * H
    const rx = (b.rx + shapeNr*.04) * W
    const ry = (b.ry + shapeNr*.03) * H

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.translate(cx, cy)
    ctx.scale(1, ry / rx)

    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
    const a0 = intensity * (i < 3 ? .65 : .35)
    grd.addColorStop(0,   hsl(hh, ss,     ll,     a0))
    grd.addColorStop(.35, hsl(hh, ss,     ll,     a0 * .55))
    grd.addColorStop(.70, hsl(hh, ss*.8,  ll*.8,  a0 * .18))
    grd.addColorStop(1,   hsl(hh, ss,     ll,     0))

    ctx.fillStyle = grd
    ctx.beginPath()
    ctx.arc(0, 0, rx, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Shimmer — línea luminosa en el borde absoluto superior
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  const pal = PALETTES[toSt]
  for (let x = 0; x < W; x += 3) {
    const nn  = sn(x * .018, t * colorSpd * .6)
    const hue = pal[0][0] + nn * hueDrift * .5 + Math.sin(t * colorSpd + x * .05) * hueDrift * .3
    const al  = (.15 + (nn + 1) * .5 * .2) * intensity
    ctx.fillStyle = hsl(hue, pal[0][1], pal[0][2] + 15, al)
    ctx.fillRect(x, 0, 3, 1.5)
  }
  ctx.restore()

  // Fade mask: desvanece a negro en el borde inferior del strip
  const fadeMask = ctx.createLinearGradient(0, 0, 0, H)
  fadeMask.addColorStop(0,   'rgba(0,0,0,0)')
  fadeMask.addColorStop(.55, 'rgba(0,0,0,0)')
  fadeMask.addColorStop(1,   'rgba(10,10,12,1)')
  ctx.fillStyle = fadeMask
  ctx.fillRect(0, 0, W, H)

  rafId = requestAnimationFrame(frame)
}

function onVisibility() {
  visible = document.visibilityState === 'visible'
  if (visible) rafId = requestAnimationFrame(frame)
}

onMounted(() => {
  ro = new ResizeObserver(resize)
  ro.observe(canvasEl.value)
  resize()
  document.addEventListener('visibilitychange', onVisibility)
  rafId = requestAnimationFrame(frame)
})

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
  if (ro) ro.disconnect()
  document.removeEventListener('visibilitychange', onVisibility)
})

watch(current, (newSt, oldSt) => {
  fromSt = oldSt || 'idle'
  toSt   = newSt
  transT = 0
})
</script>

<template>
  <div class="vapor-strip" @click="handleTap">
    <canvas ref="canvasEl" class="vapor-strip__canvas" />
  </div>
</template>

<style scoped>
.vapor-strip {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: var(--strip-h, 54px);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  z-index: 2;
}

.vapor-strip__canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
```

- [ ] **Verificar visualmente: arrancar dev server, abrir http://localhost:5173**

El strip aún no se ve en la app porque MainView todavía usa Vapor. La verificación aquí es solo que el archivo compila sin errores. Revisa la consola del navegador — no debe haber errores de importación.

- [ ] **Commit**

```bash
git add src/components/VaporStrip.vue
git commit -m "feat(vapor): añadir VaporStrip — franja Canvas superior"
```

---

## Task 3: Actualizar MainView.vue y style.css

**Files:**
- Modify: `src/views/MainView.vue`
- Modify: `src/style.css`

- [ ] **Añadir `--strip-h: 54px` a `:root` en `src/style.css`**

Dentro del bloque `:root { ... }` existente, añadir al principio del bloque (después de la primera llave):

```css
  /* Vapor strip */
  --strip-h: 54px;
```

- [ ] **Reemplazar el bloque de layout en `src/style.css`**

Eliminar las siguientes reglas completas (líneas 96–158):
- `.home-layout` (la regla base con `display: grid`)
- `.home-layout.vapor-left`
- `.home-layout.vapor-right`
- `.home-layout.vapor-top`
- `.home-layout.vapor-bottom`
- `.home-layout.vapor-center`
- `.vapor-area`
- `.conversation-area`
- `.conversation-area__transcript`

Y reemplazarlas por:

```css
.home-layout {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.content-area {
  position: absolute;
  top: var(--strip-h, 54px);
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 2rem;
  overflow: hidden;
  gap: 1rem;
}

.content-area__transcript {
  flex: 1;
  min-height: 0;
}
```

- [ ] **Reemplazar el contenido completo de `src/views/MainView.vue`**

```vue
<script setup>
import { computed, watch, onMounted } from 'vue'
import { useVoice } from '../composables/useVoice.js'
import { useIdle } from '../composables/useIdle.js'
import { useLayout } from '../composables/useLayout.js'
import { applyTheme } from '../composables/useTheme.js'
import IdleScreen from '../components/IdleScreen.vue'
import VaporStrip from '../components/VaporStrip.vue'
import Conversation from '../components/Conversation.vue'
import WidgetGrid from '../widgets/WidgetGrid.vue'

const { connectSSE, connectHA, current } = useVoice()
const { loadIdle, idleActive, startIdleTimer, dismissIdle } = useIdle()
const { loadLayout } = useLayout()

const voiceActive = computed(() => current.value !== 'idle')

watch(current, (state) => {
  if (state !== 'idle') {
    dismissIdle()
  } else {
    startIdleTimer()
  }
})

onMounted(async () => {
  connectSSE()
  connectHA()
  await Promise.all([loadLayout(), loadIdle(), applyTheme()])
  if ('wakeLock' in navigator) {
    const req = () => navigator.wakeLock.request('screen').catch(() => {})
    req()
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') req()
    })
  }
})
</script>

<template>
  <div class="main-view">
    <Transition name="screen-fade">
      <IdleScreen v-if="idleActive" @click="dismissIdle" />
    </Transition>

    <Transition name="screen-fade">
      <div v-if="!idleActive" class="home-layout">
        <VaporStrip />
        <div class="content-area">
          <Transition name="content-fade">
            <Conversation v-if="voiceActive" class="content-area__transcript" />
          </Transition>
          <WidgetGrid />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.main-view {
  position: absolute;
  inset: 0;
}
</style>
```

- [ ] **Verificar visualmente en http://localhost:5173**

Debes ver:
1. El strip de color en el borde superior (verde en idle)
2. Los widgets / conversación en el área de abajo
3. El strip reacciona al cambiar de estado vía: `curl -X POST http://localhost:8766/state -H 'Content-Type: application/json' -d '{"state":"listening","text":""}'`
4. Sin errores en consola

- [ ] **Commit**

```bash
git add src/views/MainView.vue src/style.css
git commit -m "feat(layout): strip fijo arriba, content-area debajo"
```

---

## Task 4: Eliminar Vapor.vue y limpiar SettingsDrawer

**Files:**
- Delete: `src/components/Vapor.vue`
- Modify: `src/components/SettingsDrawer.vue`

- [ ] **Eliminar `src/components/Vapor.vue`**

```bash
git rm src/components/Vapor.vue
```

- [ ] **Limpiar el `<script setup>` de `SettingsDrawer.vue`**

Eliminar estas líneas del `<script setup>`:

```js
// Eliminar esta línea:
const { layoutClass, saveLayout } = useLayout()

// Eliminar esta ref:
const vaporPos = ref(layoutClass.value.replace('vapor-', ''))

// Eliminar estas funciones:
async function setVaporPos(pos) { ... }
const vaporPosLabel = computed(() => ({ ... }))
```

Sustituir la línea de `useLayout` por (solo `loadLayout` ya no se usa en el drawer, se puede eliminar el import completo):

```js
// Eliminar el import de useLayout del SettingsDrawer
```

Y en el `watch(open, ...)` eliminar la línea:
```js
vaporPos.value = layoutClass.value.replace('vapor-', '')
```

El watch queda así:
```js
watch(open, async (v) => {
  if (v) {
    currentSection.value   = null
    showCatalog.value      = false
    widgetTab.value        = 'tablero'
    isEditing.value        = false
    selectedWidgetId.value = null
    await loadIdle()
  }
})
```

- [ ] **Reemplazar el template de la sección "Pantalla" en `SettingsDrawer.vue`**

Localizar el bloque `<template v-else-if="currentSection === 'pantalla'">` (líneas 386–434) y reemplazarlo por:

```html
<template v-else-if="currentSection === 'pantalla'">
  <header class="s-header s-header--inner">
    <button class="s-back" @click="back">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
      Ajustes
    </button>
    <span class="s-header__title-sm">Pantalla</span>
    <button class="s-close" @click="open = false" aria-label="Cerrar">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>
  </header>

  <div class="layout-placeholder">
    <span class="layout-placeholder__badge">PRÓXIMAMENTE</span>
    <span class="layout-placeholder__title">Editor de layout</span>
    <span class="layout-placeholder__sub">Arrastra zonas para colocar widgets, reloj, tiempo o el vapor donde quieras en la pantalla</span>
  </div>
</template>
```

- [ ] **Actualizar el subtítulo del tile "Pantalla"** (línea ~222 del template):

```html
<!-- Antes: -->
<div class="tile__sub">Posición del vapor,<br>distribución en pantalla</div>

<!-- Después: -->
<div class="tile__sub">Distribución en pantalla,<br>editor de layout</div>
```

- [ ] **Eliminar del `<style scoped>` de SettingsDrawer las reglas huérfanas** de la sección Pantalla eliminada. Buscar y eliminar:

- `.vapor-row` y todos sus selectores hijos (`.vapor-row__icon`, `.vapor-row__label`, `.vapor-btns`, `.vapor-btn`, `.vapor-btn--on`)
- `.layout-preview` y todos sus selectores (`.layout-preview--left`, `.layout-preview--right`, etc.)
- `.layout-preview__vapor`, `.layout-preview__vapor-label`, `.layout-preview__orb`
- `.layout-preview__content`, `.layout-preview__widget-mock`

Mantener `.layout-placeholder`, `.layout-placeholder__badge`, `.layout-placeholder__title`, `.layout-placeholder__sub` — se siguen usando.

- [ ] **Verificar en http://localhost:5173**

1. La app carga sin errores de consola
2. El strip se ve en el borde superior
3. Abrir Ajustes → Pantalla: solo el placeholder "PRÓXIMAMENTE", sin controles de posición
4. Simular estados y verificar las transiciones de color del strip:

```bash
curl -X POST http://localhost:8766/state -H 'Content-Type: application/json' -d '{"state":"listening","text":"¿qué temperatura hay?"}'
curl -X POST http://localhost:8766/state -H 'Content-Type: application/json' -d '{"state":"thinking","text":"qué temperatura hay"}'
curl -X POST http://localhost:8766/state -H 'Content-Type: application/json' -d '{"state":"response","text":"Ahora mismo hay 22 grados"}'
curl -X POST http://localhost:8766/state -H 'Content-Type: application/json' -d '{"state":"idle","text":""}'
```

- [ ] **Commit final**

```bash
git add src/components/SettingsDrawer.vue
git commit -m "feat(vapor-strip): reemplazar Vapor blob, limpiar layout y settings"
```
