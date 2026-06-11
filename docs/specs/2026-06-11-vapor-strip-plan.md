# VaporStrip — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el componente `Vapor.vue` (orbe blob con posición configurable) por `VaporStrip.vue` — una franja Canvas 2D fija en el borde superior que muestra el estado del asistente mediante manchas de luz animadas.

**Architecture:** `VaporStrip.vue` corre un loop Canvas 2D con 5 blobs de gradiente radial en blend mode `screen`. El layout pasa de un CSS Grid con vapor-area posicionable a un layout simple con la franja fija arriba y el contenido debajo. `useLayout.js` se simplifica para solo inyectar la altura del strip en `--strip-h`.

**Tech Stack:** Vue 3 Composition API (`<script setup>`), Canvas 2D API, Simplex noise, CSS custom properties, ResizeObserver.

---

## Archivos afectados

| Acción | Archivo |
|---|---|
| **Crear** | `src/components/VaporStrip.vue` |
| **Eliminar** | `src/components/Vapor.vue` |
| **Modificar** | `src/composables/useLayout.js` |
| **Modificar** | `src/views/MainView.vue` |
| **Modificar** | `src/style.css` |
| **Modificar** | `src/components/SettingsDrawer.vue` |
| **Modificar** | `config/layout.json` |
| **Modificar** | `config/layout.example.json` |

---

## Task 1: Simplificar `useLayout.js`

**Files:**
- Modify: `src/composables/useLayout.js`

El composable deja de gestionar la posición del vapor. Solo lee la altura del strip de `layout.json` y la inyecta como `--strip-h` en `:root`. Eliminar `layoutClass`, `saveLayout`.

- [ ] **Reemplazar el contenido completo de `useLayout.js`:**

```js
// src/composables/useLayout.js
async function loadLayout() {
  const res = await fetch('/config/layout.json').catch(() => null)
  if (!res?.ok) return
  const cfg = await res.json().catch(() => null)
  if (!cfg) return
  const h = cfg.strip?.height
  if (typeof h === 'number' && h > 0)
    document.documentElement.style.setProperty('--strip-h', `${h}px`)
}

export function useLayout() {
  return { loadLayout }
}
```

- [ ] **Verificar que el servidor de desarrollo arranca sin errores:**

```bash
npm run dev
```

Esperado: sin errores de consola relacionados con `useLayout`.

- [ ] **Commit:**

```bash
git add src/composables/useLayout.js
git commit -m "refactor(layout): simplificar useLayout — solo altura del strip"
```

---

## Task 2: Actualizar `config/layout.json` y `layout.example.json`

**Files:**
- Modify: `config/layout.json`
- Modify: `config/layout.example.json`

- [ ] **Reemplazar `config/layout.json`:**

```json
{
  "strip": {
    "height": 54
  }
}
```

- [ ] **Reemplazar `config/layout.example.json`:**

```json
{
  "strip": {
    "height": 54
  }
}
```

- [ ] **Commit:**

```bash
git add config/layout.json config/layout.example.json
git commit -m "config: nuevo schema layout — strip.height reemplaza vapor.position"
```

---

## Task 3: Crear `VaporStrip.vue`

**Files:**
- Create: `src/components/VaporStrip.vue`

Componente Canvas 2D con las 5 manchas de luz, simplex noise, blend `screen`, throttle de fps y pausa en visibilitychange.

- [ ] **Crear `src/components/VaporStrip.vue` con el siguiente contenido completo:**

```vue
<!-- src/components/VaporStrip.vue -->
<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useVoice } from '../composables/useVoice.js'

const { current, startListening, cancel } = useVoice()
const canvasEl = ref(null)

function handleTap() {
  if (current.value === 'listening' || current.value === 'thinking') cancel()
  else startListening()
}

// ── Simplex noise 2D (Stefan Gustavson, dominio público) ───────────────
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
    const g0=pm[(i+pm[j&255])&255]&7
    const g1=pm[(i+i1+pm[(j+j1)&255])&255]&7
    const g2=pm[(i+1+pm[(j+1)&255])&255]&7
    return 70*(contrib(gv[g0],x0,y0)+contrib(gv[g1],x0-i1+G,y0-j1+G)+contrib(gv[g2],x0-1+2*G,y0-1+2*G))
  }
})()

// ── Paletas HSL por estado ─────────────────────────────────────────────
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

// Cinco blobs: tres primarios (opacidad mayor) + dos de mezcla
const BLOBS = [
  { nx:.12, ny:-.15, rx:.38, ry:.65, palIdx:0 },
  { nx:.50, ny:-.05, rx:.45, ry:.72, palIdx:1 },
  { nx:.82, ny:-.10, rx:.38, ry:.65, palIdx:2 },
  { nx:.30, ny:-.08, rx:.32, ry:.55, palIdx:1 },
  { nx:.68, ny:-.12, rx:.32, ry:.55, palIdx:0 },
]

// ── Variables de render ────────────────────────────────────────────────
// DPR capeado a 1.5 para reducir carga en pantallas de alta densidad
const DRAW_DPR = Math.min(window.devicePixelRatio || 1, 1.5)
let W = 0, H = 0
let rafId = null, ro = null
let t = 0, lastTs = 0, lastFrameTs = 0
let toSt = 'idle', fromSt = 'idle', transT = 1.0
const TRANS_DUR = 1.4
let visible = true

function resize() {
  const canvas = canvasEl.value
  if (!canvas) return
  const r = canvas.getBoundingClientRect()
  W = r.width; H = r.height
  canvas.width  = Math.round(W * DRAW_DPR)
  canvas.height = Math.round(H * DRAW_DPR)
  canvas.getContext('2d').setTransform(DRAW_DPR, 0, 0, DRAW_DPR, 0, 0)
}

function lerp(a, b, t) { return a + (b - a) * t }
function smooth(t) { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c) }
function hsl(h, s, l, a) { return `hsla(${h|0},${s|0}%,${l|0}%,${a.toFixed(3)})` }

function frame(ts) {
  if (!visible) return

  // Throttle: saltar frames hasta cumplir el intervalo objetivo
  const interval = 1000 / TARGET_FPS[toSt]
  if (ts - lastFrameTs < interval * .92) {
    rafId = requestAnimationFrame(frame)
    return
  }

  const dt = Math.min((ts - (lastTs || ts)) / 1000, .06)
  lastTs = lastFrameTs = ts
  if (transT < 1) transT = Math.min(1, transT + dt / TRANS_DUR)
  t += dt

  const canvas = canvasEl.value
  if (!canvas || !W || !H) { rafId = requestAnimationFrame(frame); return }
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, W, H)

  const e        = smooth(transT)
  const colorSpd = lerp(COLOR_SPD[fromSt], COLOR_SPD[toSt], e)
  const shapeSpd = lerp(SHAPE_SPD[fromSt], SHAPE_SPD[toSt], e)
  const intensity= lerp(INTENSITY[fromSt], INTENSITY[toSt], e)
  const hueDrift = lerp(HUE_DRIFT[fromSt], HUE_DRIFT[toSt], e)

  // ── Dibujar los 5 blobs ──────────────────────────────────────────────
  for (let i = 0; i < BLOBS.length; i++) {
    const b     = BLOBS[i]
    const pFrom = PALETTES[fromSt][b.palIdx % 3]
    const pTo   = PALETTES[toSt  ][b.palIdx % 3]

    const hueTime = t * colorSpd * .4 + i * 1.7
    const hh = lerp(pFrom[0], pTo[0], e) + Math.sin(hueTime) * hueDrift
    const ss = lerp(pFrom[1], pTo[1], e)
    const ll = lerp(pFrom[2], pTo[2], e)

    const shapeNx = sn(i * 3.1,     t * shapeSpd)
    const shapeNy = sn(i * 5.7 + 10, t * shapeSpd * .7)
    const shapeNr = sn(i * 7.3 + 20, t * shapeSpd * .5)

    const cx = (b.nx + shapeNx * .06) * W
    const cy = (b.ny + shapeNy * .04) * H
    const rx = (b.rx + shapeNr * .04) * W
    const ry = (b.ry + shapeNr * .03) * H

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.translate(cx, cy)
    ctx.scale(1, ry / rx)

    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
    const a0 = intensity * (i < 3 ? .65 : .35)
    grd.addColorStop(0,    hsl(hh, ss,      ll,      a0))
    grd.addColorStop(.35,  hsl(hh, ss,      ll,      a0 * .55))
    grd.addColorStop(.70,  hsl(hh, ss * .8, ll * .8, a0 * .18))
    grd.addColorStop(1,    hsl(hh, ss,      ll,      0))

    ctx.fillStyle = grd
    ctx.beginPath()
    ctx.arc(0, 0, rx, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // ── Shimmer: línea luminosa de 1.5px en el borde superior ───────────
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

  // ── Fade mask: esfuma hacia negro en el borde inferior ──────────────
  const fadeMask = ctx.createLinearGradient(0, 0, 0, H)
  fadeMask.addColorStop(0,    'rgba(0,0,0,0)')
  fadeMask.addColorStop(.55,  'rgba(0,0,0,0)')
  fadeMask.addColorStop(1,    'rgba(6,6,8,1)')
  ctx.fillStyle = fadeMask
  ctx.fillRect(0, 0, W, H)

  rafId = requestAnimationFrame(frame)
}

function onVisibilityChange() {
  visible = document.visibilityState === 'visible'
  if (visible) rafId = requestAnimationFrame(frame)
}

onMounted(() => {
  resize()
  ro = new ResizeObserver(resize)
  ro.observe(canvasEl.value)
  document.addEventListener('visibilitychange', onVisibilityChange)
  rafId = requestAnimationFrame(frame)
})

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
  if (ro) ro.disconnect()
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

watch(current, (newSt, oldSt) => {
  fromSt = oldSt ?? 'idle'
  toSt   = newSt
  transT = 0
})
</script>

<template>
  <div class="vapor-strip" @click="handleTap">
    <canvas ref="canvasEl" />
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
  overflow: hidden;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
```

- [ ] **Arrancar el dev server y comprobar que el strip aparece en pantalla:**

```bash
npm run dev
# Abrir http://localhost:5173
```

Esperado: franja de color en el borde superior. Hacer click en ella debe disparar `startListening` (verificar en consola con `POST /state` o en el estado SSE).

- [ ] **Simular estados para verificar las transiciones de color:**

```bash
curl -X POST http://localhost:8766/state -H 'Content-Type: application/json' -d '{"state":"listening"}'
curl -X POST http://localhost:8766/state -H 'Content-Type: application/json' -d '{"state":"thinking","text":"test"}'
curl -X POST http://localhost:8766/state -H 'Content-Type: application/json' -d '{"state":"response","text":"respuesta"}'
curl -X POST http://localhost:8766/state -H 'Content-Type: application/json' -d '{"state":"idle"}'
```

Esperado: el strip cambia de colores suavemente en ~1.4s por transición.

- [ ] **Commit:**

```bash
git add src/components/VaporStrip.vue
git commit -m "feat(strip): VaporStrip — canvas con blobs de luz animados"
```

---

## Task 4: Actualizar `MainView.vue` y `style.css`

**Files:**
- Modify: `src/views/MainView.vue`
- Modify: `src/style.css`

### 4a — `MainView.vue`

- [ ] **Reemplazar el contenido completo de `src/views/MainView.vue`:**

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
  if (state !== 'idle') dismissIdle()
  else startIdleTimer()
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

### 4b — `style.css`: layout

- [ ] **En `src/style.css`, añadir `--strip-h` al bloque `:root` (después de `--blur`):**

```css
  --strip-h: 54px;
```

- [ ] **En `src/style.css`, reemplazar el bloque completo del layout home (desde el comentario `/* Home screen: Vapor siempre visible + área de contenido */` hasta el final de `.conversation-area__transcript`) con:**

```css
/* Home screen: strip en el borde superior + área de contenido */
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
}
```

- [ ] **Verificar en el navegador que el layout se ve correctamente:** el strip ocupa ~54px arriba, el contenido (widgets + conversación) ocupa el resto.

- [ ] **Commit:**

```bash
git add src/views/MainView.vue src/style.css
git commit -m "feat(layout): VaporStrip fijo arriba, content-area debajo"
```

---

## Task 5: Limpiar `SettingsDrawer.vue`

**Files:**
- Modify: `src/components/SettingsDrawer.vue`

Eliminar todas las referencias al vapor posicionable: imports, refs, funciones y el bloque de UI de la sección "Pantalla".

- [ ] **En el `<script setup>`, realizar los siguientes cambios:**

Eliminar la línea:
```js
const { layoutClass, saveLayout } = useLayout()
```

Eliminar la línea de import (si `useLayout` ya no se usa en este componente):
```js
import { useLayout } from '../composables/useLayout.js'
```

Eliminar el `ref`:
```js
const vaporPos = ref(layoutClass.value.replace('vapor-', ''))
```

Eliminar dentro del `watch(open, ...)`:
```js
vaporPos.value = layoutClass.value.replace('vapor-', '')
```

Eliminar las funciones y computeds:
```js
async function setVaporPos(pos) {
  vaporPos.value = pos
  await saveLayout(pos)
}

const vaporPosLabel = computed(() => ({
  left: 'izquierda', right: 'derecha', top: 'arriba', bottom: 'abajo',
}[vaporPos.value] ?? vaporPos.value))
```

- [ ] **Actualizar el subtitle del tile "Pantalla"** (línea ~223 del template):

Cambiar:
```html
<div class="tile__sub">Posición del vapor,<br>distribución en pantalla</div>
```
Por:
```html
<div class="tile__sub">Distribución en pantalla</div>
```

- [ ] **Reemplazar toda la sección `v-else-if="currentSection === 'pantalla'"` del template** con:

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
    <div class="layout-preview layout-preview--strip">
      <div class="layout-preview__strip-bar"></div>
      <div class="layout-preview__content">
        <div class="layout-preview__widget-mock"/>
        <div class="layout-preview__widget-mock"/>
      </div>
    </div>
    <span class="layout-placeholder__badge">PRÓXIMAMENTE</span>
    <span class="layout-placeholder__title">Editor de layout</span>
    <span class="layout-placeholder__sub">Arrastra zonas para colocar widgets, reloj, tiempo o el vapor donde quieras en la pantalla</span>
  </div>
</template>
```

- [ ] **En el bloque `<style scoped>`, eliminar los siguientes bloques CSS** (ya no se usan):

```
.vapor-row { ... }
.vapor-row__icon { ... }
.vapor-row__label { ... }
.vapor-row__label strong { ... }
.vapor-btns { ... }
.vapor-btn { ... }
.vapor-btn:hover { ... }
.vapor-btn--on { ... }
.layout-preview--left { ... }
.layout-preview--right { ... }
.layout-preview--top { ... }
.layout-preview--bottom { ... }
.layout-preview__vapor { ... }
.layout-preview--left .layout-preview__vapor, ...
.layout-preview--right .layout-preview__vapor { ... }
.layout-preview--top .layout-preview__vapor, ...
.layout-preview--bottom .layout-preview__vapor { ... }
.layout-preview--bottom .layout-preview__vapor { ... }
.layout-preview__orb { ... }
.layout-preview__vapor-label { ... }
```

- [ ] **Añadir al bloque `<style scoped>` los estilos para el nuevo preview del strip:**

```css
.layout-preview--strip {
  flex-direction: column;
}

.layout-preview__strip-bar {
  height: 12px;
  flex-shrink: 0;
  background: linear-gradient(90deg,
    rgba(74,222,128,.35),
    rgba(96,165,250,.35),
    rgba(196,181,253,.35));
  border-bottom: 1px solid rgba(255,255,255,.06);
}
```

- [ ] **Verificar en el navegador:** abrir el drawer de ajustes → sección "Pantalla" → debe mostrar solo el placeholder con el preview del strip, sin botones de posición.

- [ ] **Commit:**

```bash
git add src/components/SettingsDrawer.vue
git commit -m "refactor(settings): eliminar controles de posición del vapor"
```

---

## Task 6: Eliminar `Vapor.vue`

**Files:**
- Delete: `src/components/Vapor.vue`

- [ ] **Verificar que ningún archivo importa ya `Vapor.vue`:**

```bash
grep -r "Vapor" src/ --include="*.vue" --include="*.js"
```

Esperado: solo aparece `VaporStrip` en `MainView.vue`. Si aparece alguna otra referencia a `Vapor.vue`, eliminarla antes de continuar.

- [ ] **Eliminar el archivo:**

```bash
rm src/components/Vapor.vue
```

- [ ] **Verificar que el dev server sigue funcionando sin errores:**

```bash
npm run dev
```

- [ ] **Commit final:**

```bash
git add -A
git commit -m "feat(vapor-strip): eliminar Vapor.vue — sustituido por VaporStrip"
```

---

## Verificación final

- [ ] Abrir `http://localhost:5173` y comprobar que la franja aparece en el borde superior con los colores de idle.
- [ ] Simular los 4 estados y verificar que las transiciones de color son suaves:

```bash
curl -X POST http://localhost:8766/state -H 'Content-Type: application/json' -d '{"state":"listening"}'
curl -X POST http://localhost:8766/state -H 'Content-Type: application/json' -d '{"state":"thinking","text":"pensando"}'
curl -X POST http://localhost:8766/state -H 'Content-Type: application/json' -d '{"state":"response","text":"aquí la respuesta"}'
curl -X POST http://localhost:8766/state -H 'Content-Type: application/json' -d '{"state":"idle"}'
```

- [ ] Comprobar que hacer click en el strip dispara el evento de escucha (se ve en el estado SSE).
- [ ] Abrir Ajustes → Pantalla → comprobar que no hay controles de posición del vapor.
- [ ] Cambiar `config/layout.json` a `{ "strip": { "height": 40 } }`, recargar, comprobar que la franja cambia de altura.
