# Settings Config UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir campos editables en la sección "Sistema" del SettingsDrawer para configurar la URL de Home Assistant, el dispositivo (nombre, URL de Fully Kiosk, tiempo de pantalla) y la altura del strip.

**Architecture:** Tres composables nuevos (`useHAConfig`, `useDeviceConfig`, `useLayoutConfig`) siguiendo el patrón de `useIdle` — estado reactivo modular, `loadX` / `saveX` con `fetch`. El SettingsDrawer expande su sección `sistema` con dos info-cards compactas y tres grupos de campos editables usando los componentes visuales ya existentes (`s-section`, `s-list`, `s-row`, chips, stepper).

**Tech Stack:** Vue 3 Composition API, Vitest, `vi.stubGlobal` para mock de fetch, `vi.resetModules` para aislar estado modular entre tests.

---

## Mapa de ficheros

| Fichero | Acción |
|---|---|
| `src/composables/useHAConfig.js` | Crear |
| `src/composables/useDeviceConfig.js` | Crear |
| `src/composables/useLayoutConfig.js` | Crear |
| `tests/composables/useHAConfig.test.js` | Crear |
| `tests/composables/useDeviceConfig.test.js` | Crear |
| `tests/composables/useLayoutConfig.test.js` | Crear |
| `src/components/SettingsDrawer.vue` | Modificar — script setup + template sistema + CSS |

---

## Task 1: composable useHAConfig

**Files:**
- Create: `src/composables/useHAConfig.js`
- Create: `tests/composables/useHAConfig.test.js`

- [ ] **Step 1: Escribir los tests**

```js
// tests/composables/useHAConfig.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

async function freshHA() {
  vi.resetModules()
  return import('../../src/composables/useHAConfig.js')
}

describe('useHAConfig', () => {
  let mod

  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn())
    mod = await freshHA()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('url inicia vacía', () => {
    const { url } = mod.useHAConfig()
    expect(url.value).toBe('')
  })

  it('loadHAConfig carga la url desde ha.json', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'http://192.168.1.10:8123', token: 'abc', satellite: 'assist_satellite.x' }),
    })
    await mod.loadHAConfig()
    const { url } = mod.useHAConfig()
    expect(url.value).toBe('http://192.168.1.10:8123')
    expect(fetch).toHaveBeenCalledWith('/config/ha.json')
  })

  it('loadHAConfig no modifica url si la respuesta falla', async () => {
    fetch.mockResolvedValueOnce({ ok: false })
    await mod.loadHAConfig()
    const { url } = mod.useHAConfig()
    expect(url.value).toBe('')
  })

  it('saveHAConfig preserva token y satellite al actualizar url', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'http://old:8123', token: 'secret', satellite: 'assist_satellite.x' }),
    })
    fetch.mockResolvedValueOnce({ ok: true })

    await mod.loadHAConfig()
    await mod.saveHAConfig({ url: 'http://new:8123' })

    const postCall = fetch.mock.calls[1]
    expect(postCall[0]).toBe('/config/ha.json')
    expect(postCall[1].method).toBe('POST')
    const body = JSON.parse(postCall[1].body)
    expect(body.url).toBe('http://new:8123')
    expect(body.token).toBe('secret')
    expect(body.satellite).toBe('assist_satellite.x')
  })

  it('saveHAConfig actualiza url reactiva localmente', async () => {
    fetch.mockResolvedValueOnce({ ok: true })
    const { url } = mod.useHAConfig()
    await mod.saveHAConfig({ url: 'http://192.168.1.50:8123' })
    expect(url.value).toBe('http://192.168.1.50:8123')
  })
})
```

- [ ] **Step 2: Ejecutar para confirmar que fallan**

```bash
npx vitest run tests/composables/useHAConfig.test.js
```

Esperado: FAIL — módulo no existe.

- [ ] **Step 3: Implementar el composable**

```js
// src/composables/useHAConfig.js
import { ref, readonly } from 'vue'

const _raw = {}
const url = ref('')

async function loadHAConfig() {
  try {
    const res = await fetch('/config/ha.json')
    if (!res.ok) return
    const cfg = await res.json()
    Object.assign(_raw, cfg)
    url.value = cfg.url ?? ''
  } catch {}
}

async function saveHAConfig(patch) {
  const merged = { ..._raw, ...patch }
  Object.assign(_raw, merged)
  if ('url' in patch) url.value = patch.url
  try {
    await fetch('/config/ha.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_raw),
    })
  } catch {}
}

export { loadHAConfig, saveHAConfig }

export function useHAConfig() {
  return { url: readonly(url), saveHAConfig, loadHAConfig }
}
```

- [ ] **Step 4: Ejecutar para confirmar que pasan**

```bash
npx vitest run tests/composables/useHAConfig.test.js
```

Esperado: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useHAConfig.js tests/composables/useHAConfig.test.js
git commit -m "feat(config): composable useHAConfig — url editable, token y satellite preservados"
```

---

## Task 2: composable useDeviceConfig

**Files:**
- Create: `src/composables/useDeviceConfig.js`
- Create: `tests/composables/useDeviceConfig.test.js`

- [ ] **Step 1: Escribir los tests**

```js
// tests/composables/useDeviceConfig.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

async function freshDevice() {
  vi.resetModules()
  return import('../../src/composables/useDeviceConfig.js')
}

describe('useDeviceConfig', () => {
  let mod

  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn())
    mod = await freshDevice()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('inicia con valores por defecto', () => {
    const { name, fullyUrl, screenTimeout } = mod.useDeviceConfig()
    expect(name.value).toBe('')
    expect(fullyUrl.value).toBe('http://localhost:2323')
    expect(screenTimeout.value).toBe(8)
  })

  it('loadDeviceConfig carga los datos del servidor', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: 'Salón',
        fully: { url: 'http://192.168.1.5:2323' },
        screenTimeout: 30,
      }),
    })
    await mod.loadDeviceConfig()
    const { name, fullyUrl, screenTimeout } = mod.useDeviceConfig()
    expect(name.value).toBe('Salón')
    expect(fullyUrl.value).toBe('http://192.168.1.5:2323')
    expect(screenTimeout.value).toBe(30)
  })

  it('loadDeviceConfig mantiene defaults si el fichero no existe (404)', async () => {
    fetch.mockResolvedValueOnce({ status: 404, ok: false })
    await mod.loadDeviceConfig()
    const { name, fullyUrl, screenTimeout } = mod.useDeviceConfig()
    expect(name.value).toBe('')
    expect(fullyUrl.value).toBe('http://localhost:2323')
    expect(screenTimeout.value).toBe(8)
  })

  it('saveDeviceConfig({ name }) actualiza el nombre y hace POST', async () => {
    fetch.mockResolvedValueOnce({ ok: true })
    const { name } = mod.useDeviceConfig()
    await mod.saveDeviceConfig({ name: 'Habitación principal' })
    expect(name.value).toBe('Habitación principal')
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.name).toBe('Habitación principal')
  })

  it('saveDeviceConfig({ fully }) actualiza fullyUrl y hace POST', async () => {
    fetch.mockResolvedValueOnce({ ok: true })
    const { fullyUrl } = mod.useDeviceConfig()
    await mod.saveDeviceConfig({ fully: { url: 'http://192.168.1.5:2323' } })
    expect(fullyUrl.value).toBe('http://192.168.1.5:2323')
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.fully.url).toBe('http://192.168.1.5:2323')
  })

  it('saveDeviceConfig({ screenTimeout }) actualiza el timeout y hace POST', async () => {
    fetch.mockResolvedValueOnce({ ok: true })
    const { screenTimeout } = mod.useDeviceConfig()
    await mod.saveDeviceConfig({ screenTimeout: 60 })
    expect(screenTimeout.value).toBe(60)
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.screenTimeout).toBe(60)
  })
})
```

- [ ] **Step 2: Ejecutar para confirmar que fallan**

```bash
npx vitest run tests/composables/useDeviceConfig.test.js
```

Esperado: FAIL — módulo no existe.

- [ ] **Step 3: Implementar el composable**

```js
// src/composables/useDeviceConfig.js
import { ref, readonly } from 'vue'

const DEFAULTS = { name: '', fully: { url: 'http://localhost:2323' }, screenTimeout: 8 }

const _raw = { ...DEFAULTS, fully: { ...DEFAULTS.fully } }
const name         = ref(DEFAULTS.name)
const fullyUrl     = ref(DEFAULTS.fully.url)
const screenTimeout = ref(DEFAULTS.screenTimeout)

async function loadDeviceConfig() {
  try {
    const res = await fetch('/config/device.json')
    if (!res.ok) return
    const cfg = await res.json()
    Object.assign(_raw, { ...DEFAULTS, ...cfg, fully: { ...DEFAULTS.fully, ...cfg.fully } })
    name.value          = _raw.name
    fullyUrl.value      = _raw.fully.url
    screenTimeout.value = _raw.screenTimeout
  } catch {}
}

async function saveDeviceConfig(patch) {
  if ('name' in patch)         { _raw.name = patch.name; name.value = patch.name }
  if ('screenTimeout' in patch) { _raw.screenTimeout = patch.screenTimeout; screenTimeout.value = patch.screenTimeout }
  if ('fully' in patch) {
    _raw.fully = { ..._raw.fully, ...patch.fully }
    if ('url' in patch.fully) fullyUrl.value = patch.fully.url
  }
  try {
    await fetch('/config/device.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_raw),
    })
  } catch {}
}

export { loadDeviceConfig, saveDeviceConfig }

export function useDeviceConfig() {
  return { name: readonly(name), fullyUrl: readonly(fullyUrl), screenTimeout: readonly(screenTimeout), saveDeviceConfig, loadDeviceConfig }
}
```

- [ ] **Step 4: Ejecutar para confirmar que pasan**

```bash
npx vitest run tests/composables/useDeviceConfig.test.js
```

Esperado: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useDeviceConfig.js tests/composables/useDeviceConfig.test.js
git commit -m "feat(config): composable useDeviceConfig — nombre, URL Fully, screenTimeout"
```

---

## Task 3: composable useLayoutConfig

**Files:**
- Create: `src/composables/useLayoutConfig.js`
- Create: `tests/composables/useLayoutConfig.test.js`

- [ ] **Step 1: Escribir los tests**

```js
// tests/composables/useLayoutConfig.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

async function freshLayout() {
  vi.resetModules()
  return import('../../src/composables/useLayoutConfig.js')
}

describe('useLayoutConfig', () => {
  let mod

  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn())
    mod = await freshLayout()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('stripHeight inicia en 54', () => {
    const { stripHeight } = mod.useLayoutConfig()
    expect(stripHeight.value).toBe(54)
  })

  it('loadLayoutConfig carga la altura del strip', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ strip: { height: 72 } }),
    })
    await mod.loadLayoutConfig()
    const { stripHeight } = mod.useLayoutConfig()
    expect(stripHeight.value).toBe(72)
  })

  it('loadLayoutConfig mantiene el default si la respuesta falla', async () => {
    fetch.mockResolvedValueOnce({ ok: false })
    await mod.loadLayoutConfig()
    const { stripHeight } = mod.useLayoutConfig()
    expect(stripHeight.value).toBe(54)
  })

  it('saveLayoutConfig escribe strip.height en el JSON correcto', async () => {
    fetch.mockResolvedValueOnce({ ok: true })
    await mod.saveLayoutConfig({ stripHeight: 64 })
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body).toEqual({ strip: { height: 64 } })
  })

  it('saveLayoutConfig actualiza stripHeight reactivo localmente', async () => {
    fetch.mockResolvedValueOnce({ ok: true })
    const { stripHeight } = mod.useLayoutConfig()
    await mod.saveLayoutConfig({ stripHeight: 80 })
    expect(stripHeight.value).toBe(80)
  })
})
```

- [ ] **Step 2: Ejecutar para confirmar que fallan**

```bash
npx vitest run tests/composables/useLayoutConfig.test.js
```

Esperado: FAIL — módulo no existe.

- [ ] **Step 3: Implementar el composable**

```js
// src/composables/useLayoutConfig.js
import { ref, readonly } from 'vue'

const DEFAULTS = { strip: { height: 54 } }

const _raw       = { strip: { ...DEFAULTS.strip } }
const stripHeight = ref(DEFAULTS.strip.height)

async function loadLayoutConfig() {
  try {
    const res = await fetch('/config/layout.json')
    if (!res.ok) return
    const cfg = await res.json()
    Object.assign(_raw, cfg)
    stripHeight.value = cfg.strip?.height ?? DEFAULTS.strip.height
  } catch {}
}

async function saveLayoutConfig(patch) {
  if ('stripHeight' in patch) {
    _raw.strip = { ..._raw.strip, height: patch.stripHeight }
    stripHeight.value = patch.stripHeight
  }
  try {
    await fetch('/config/layout.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_raw),
    })
  } catch {}
}

export { loadLayoutConfig, saveLayoutConfig }

export function useLayoutConfig() {
  return { stripHeight: readonly(stripHeight), saveLayoutConfig, loadLayoutConfig }
}
```

- [ ] **Step 4: Ejecutar para confirmar que pasan**

```bash
npx vitest run tests/composables/useLayoutConfig.test.js
```

Esperado: 5 tests PASS.

- [ ] **Step 5: Ejecutar todos los tests para detectar regresiones**

```bash
npx vitest run
```

Esperado: todos los tests existentes siguen en PASS.

- [ ] **Step 6: Commit**

```bash
git add src/composables/useLayoutConfig.js tests/composables/useLayoutConfig.test.js
git commit -m "feat(config): composable useLayoutConfig — altura del strip"
```

---

## Task 4: Sección Sistema en SettingsDrawer

**Files:**
- Modify: `src/components/SettingsDrawer.vue`

### 4a — Actualizar `<script setup>`

- [ ] **Step 1: Añadir imports** (después de `import { useHA } from '../composables/useHA.js'`, línea ~8)

```js
import { useHAConfig }     from '../composables/useHAConfig.js'
import { useDeviceConfig } from '../composables/useDeviceConfig.js'
import { useLayoutConfig } from '../composables/useLayoutConfig.js'
```

- [ ] **Step 2: Añadir destructuring y handlers** (después de `const { connected, entities } = useHA()`, línea ~23)

```js
const { url: haUrl, saveHAConfig, loadHAConfig }                                    = useHAConfig()
const { name: deviceName, fullyUrl: deviceFullyUrl, screenTimeout: deviceScreenTimeout,
        saveDeviceConfig, loadDeviceConfig }                                          = useDeviceConfig()
const { stripHeight, saveLayoutConfig, loadLayoutConfig }                             = useLayoutConfig()

function onHAUrlBlur(e) {
  const val = e.target.value.trim()
  if (val !== haUrl.value) saveHAConfig({ url: val })
}
function onDeviceNameBlur(e) {
  const val = e.target.value.trim()
  if (val !== deviceName.value) saveDeviceConfig({ name: val })
}
function onDeviceFullyUrlBlur(e) {
  const val = e.target.value.trim()
  if (val !== deviceFullyUrl.value) saveDeviceConfig({ fully: { url: val } })
}
```

- [ ] **Step 3: Actualizar el `watch(open, ...)`** — añadir las tres llamadas a load (el watch está en línea ~75)

Reemplazar:
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

Por:
```js
watch(open, async (v) => {
  if (v) {
    currentSection.value   = null
    showCatalog.value      = false
    widgetTab.value        = 'tablero'
    isEditing.value        = false
    selectedWidgetId.value = null
    await loadIdle()
    await loadHAConfig()
    await loadDeviceConfig()
    await loadLayoutConfig()
  }
})
```

### 4b — Reemplazar template de la sección `sistema`

- [ ] **Step 4: Reemplazar la sección sistema** — localizar `<template v-else-if="currentSection === 'sistema'">` (línea ~587) y sustituir todo su bloque hasta su `</template>` por:

```vue
<template v-else-if="currentSection === 'sistema'">
  <header class="s-header s-header--inner">
    <button class="s-back" @click="back">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
      Ajustes
    </button>
    <span class="s-header__title-sm">Sistema</span>
    <button class="s-close" @click="open = false" aria-label="Cerrar">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>
  </header>

  <div class="s-body">
    <!-- Info compacta -->
    <div class="sistema-info">
      <div class="info-card info-card--sm">
        <span class="info-card__label">ESTADO</span>
        <span class="info-card__title" :class="{ 'info-card__title--ok': connected }">
          {{ connected ? 'HA conectado' : 'HA desconectado' }}
        </span>
        <span class="info-card__sub">{{ entityCount }} entidades activas</span>
      </div>
      <div class="info-card info-card--sm">
        <span class="info-card__label">DISPOSITIVO</span>
        <span class="info-card__title">{{ deviceName || 'Sin configurar' }}</span>
        <span class="info-card__sub">jota-display v0.2.0</span>
      </div>
    </div>

    <!-- Home Assistant -->
    <div class="s-section">
      <span class="s-label">Home Assistant</span>
      <div class="s-list">
        <div class="s-row">
          <span class="s-row__dot" :class="{ 's-row__dot--ha': connected }"/>
          <span class="s-row__text">URL del servidor</span>
          <input
            class="s-input"
            type="url"
            placeholder="http://192.168.1.X:8123"
            :value="haUrl"
            @blur="onHAUrlBlur"
          />
        </div>
      </div>
    </div>

    <!-- Dispositivo -->
    <div class="s-section">
      <span class="s-label">Dispositivo</span>
      <div class="s-list">
        <div class="s-row">
          <span class="s-row__text">Nombre</span>
          <input class="s-input" type="text" placeholder="Habitación principal"
            :value="deviceName"
            @blur="onDeviceNameBlur" />
        </div>
        <div class="s-row">
          <span class="s-row__text">URL Fully Kiosk</span>
          <input class="s-input" type="url" placeholder="http://localhost:2323"
            :value="deviceFullyUrl"
            @blur="onDeviceFullyUrlBlur" />
        </div>
        <div class="s-row s-row--col">
          <span class="s-row__text">Tiempo de pantalla</span>
          <div class="chips">
            <button
              v-for="t in timeoutOptions" :key="t.value"
              class="chip"
              :class="{ 'chip--on': deviceScreenTimeout === t.value }"
              @click="saveDeviceConfig({ screenTimeout: t.value })"
            >{{ t.label }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Pantalla -->
    <div class="s-section">
      <span class="s-label">Pantalla</span>
      <div class="s-list">
        <div class="s-row">
          <span class="s-row__text">Altura del strip</span>
          <div class="grid-stepper">
            <button class="grid-stepper__btn" @click="saveLayoutConfig({ stripHeight: stripHeight - 2 })">−</button>
            <span class="grid-stepper__val">{{ stripHeight }}px</span>
            <button class="grid-stepper__btn" @click="saveLayoutConfig({ stripHeight: stripHeight + 2 })">+</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

### 4c — Añadir CSS

- [ ] **Step 5: Añadir nuevas clases al final de `<style scoped>`** (antes del último `</style>`)

```css
/* ── Sistema — info compacta ───────────────────────── */
.sistema-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.info-card--sm {
  padding: 18px 22px;
}
.info-card--sm .info-card__title {
  font-size: 18px;
}

/* ── Input de configuración ────────────────────────── */
.s-input {
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 8px;
  color: rgba(255,255,255,.82);
  font-size: var(--text-sm);
  font-family: var(--font);
  padding: 0.4rem 0.75rem;
  width: 200px;
  text-align: right;
  flex-shrink: 0;
  transition: border-color var(--dur-fast);
}
.s-input::placeholder { color: rgba(255,255,255,.18); }
.s-input:focus { outline: none; border-color: rgba(255,255,255,.22); }

/* ── Fila en columna (label + chips apilados) ──────── */
.s-row--col {
  flex-direction: column;
  align-items: flex-start;
  padding-top: 14px;
  padding-bottom: 14px;
  min-height: auto;
  gap: 10px;
}
```

### 4d — Verificación manual

- [ ] **Step 6: Arrancar el servidor de desarrollo**

```bash
npm run dev
```

Abrir `http://localhost:5173`, pulsar "Ajustes" → "Sistema" y verificar:
- Los dos info-cards compactos muestran estado de HA y dispositivo
- El campo "URL del servidor" muestra la URL actual de `ha.json`, se puede editar y al salir del campo el cambio se persiste (verificar con `cat config/ha.json`)
- El campo "Nombre" y "URL Fully Kiosk" funcionan igual al perder el foco
- Los chips de "Tiempo de pantalla" se activan correctamente
- El stepper "Altura del strip" incrementa/decrementa de 2 en 2 y persiste (verificar con `cat config/layout.json`)
- El resto de secciones del drawer (Reposo, Widgets) siguen funcionando sin regresiones

- [ ] **Step 7: Commit**

```bash
git add src/components/SettingsDrawer.vue
git commit -m "feat(settings): sección Sistema con campos editables para HA, dispositivo y layout"
```
