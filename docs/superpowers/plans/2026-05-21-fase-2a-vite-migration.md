# Fase 2a — Vite Migration + Voice Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar la UI de ESM-sin-build a Vite + Vue Router + Pinia, añadir theme system desde `config/theme.json`, botón de cancelar pipeline, y tap en orb para iniciar escucha.

**Architecture:** La app Vue 3 pasa de componentes `.js` con template strings a Single File Components (`.vue`) compilados por Vite. El servidor Python sigue gestionando SSE y sirve `dist/` en producción; en desarrollo Vite corre en `:5173` y proxea `/events`, `/state`, `/listen` y `/config` al servidor Python en `:8766`. El estado global migra de un `reactive()` manual en `app.js` a un Pinia store (`useVoiceStore`).

**Tech Stack:** Vite 6, Vue 3.5, Pinia 2, Vue Router 4, Vitest 3, @vue/test-utils 2, jsdom

**Nota:** Este plan NO incluye integración con Home Assistant ni widgets HA. Eso es el Plan 2b (depende de este plan).

---

## File Map

| Acción | Ruta |
|--------|------|
| CREAR | `package.json` |
| CREAR | `vite.config.js` |
| CREAR | `src/main.js` |
| CREAR | `src/App.vue` |
| CREAR | `src/router/index.js` |
| CREAR | `src/stores/voice.js` |
| CREAR | `src/panels/VoicePanel.vue` |
| CREAR | `src/components/Orb.vue` |
| CREAR | `src/components/UserBubble.vue` |
| CREAR | `src/components/JotaBubble.vue` |
| CREAR | `src/theme/loader.js` |
| CREAR | `src/style.css` (copia de `style.css` + estilos de cancel-btn) |
| CREAR | `config/theme.json` (copia de `config/theme.example.json`) |
| CREAR | `public/manifest.json` (mover desde `manifest.json`) |
| CREAR | `tests/stores/voice.test.js` |
| CREAR | `tests/components/UserBubble.test.js` |
| CREAR | `tests/components/JotaBubble.test.js` |
| CREAR | `tests/theme/loader.test.js` |
| MODIFICAR | `index.html` (entrada Vite: `/src/main.js`) |
| MODIFICAR | `server/server.py` (BASE_DIR → `dist/`, añadir `POST /listen`) |
| ARCHIVAR | `app.js`, `components/*.js`, `lib/vue.esm-browser.js` (al final del plan) |

---

## Task 1: Bootstrap Vite + Vitest

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `tests/smoke.test.js`

- [ ] **Step 1: Crear `package.json`**

```json
{
  "name": "jota-display",
  "version": "0.2.0",
  "type": "module",
  "scripts": {
    "dev":        "vite",
    "build":      "vite build",
    "preview":    "vite preview",
    "test":       "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "pinia":      "^2.3.0",
    "vue":        "^3.5.0",
    "vue-router": "^4.5.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2.0",
    "@vue/test-utils":   "^2.4.0",
    "jsdom":             "^25.0.0",
    "vite":              "^6.0.0",
    "vitest":            "^3.0.0"
  }
}
```

- [ ] **Step 2: Crear `vite.config.js`**

```js
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],

  server: {
    proxy: {
      '/events': 'http://localhost:8766',
      '/config': 'http://localhost:8766',
      '/state':  { target: 'http://localhost:8766', changeOrigin: false },
      '/listen': { target: 'http://localhost:8766', changeOrigin: false },
    },
  },

  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

- [ ] **Step 3: Crear `tests/smoke.test.js`**

```js
import { describe, it, expect } from 'vitest'

describe('vitest', () => {
  it('works', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 4: Instalar dependencias**

```bash
cd /home/sito/jota-display
npm install
```

Expected: `node_modules/` creado, sin errores.

- [ ] **Step 5: Verificar que los tests corren**

```bash
npm test
```

Expected:
```
✓ tests/smoke.test.js (1)
  ✓ vitest > works

Test Files  1 passed (1)
Tests       1 passed (1)
```

- [ ] **Step 6: Commit**

```bash
git add package.json vite.config.js tests/smoke.test.js
git commit -m "feat: bootstrap Vite 6 + Vitest — fase 2a"
```

---

## Task 2: Pinia Voice Store (TDD)

**Files:**
- Create: `src/stores/voice.js`
- Create: `tests/stores/voice.test.js`

- [ ] **Step 1: Escribir el test**

```js
// tests/stores/voice.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useVoiceStore } from '../../src/stores/voice.js'

describe('voice store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts idle with empty text', () => {
    const store = useVoiceStore()
    expect(store.current).toBe('idle')
    expect(store.transcript).toBe('')
    expect(store.response).toBe('')
  })

  it('transitions to listening', () => {
    const store = useVoiceStore()
    store.applyEvent({ state: 'listening' })
    expect(store.current).toBe('listening')
  })

  it('transitions to thinking and captures transcript', () => {
    const store = useVoiceStore()
    store.applyEvent({ state: 'thinking', text: 'qué hora es' })
    expect(store.current).toBe('thinking')
    expect(store.transcript).toBe('qué hora es')
    expect(store.response).toBe('')
  })

  it('clears response when entering thinking', () => {
    const store = useVoiceStore()
    store.applyEvent({ state: 'response', text: 'respuesta vieja' })
    store.applyEvent({ state: 'thinking', text: 'nueva pregunta' })
    expect(store.response).toBe('')
  })

  it('transitions to response and captures text', () => {
    const store = useVoiceStore()
    store.applyEvent({ state: 'thinking', text: 'qué hora es' })
    store.applyEvent({ state: 'response', text: 'Son las 3 de la tarde.' })
    expect(store.current).toBe('response')
    expect(store.transcript).toBe('qué hora es')
    expect(store.response).toBe('Son las 3 de la tarde.')
  })

  it('clears all text on idle', () => {
    const store = useVoiceStore()
    store.applyEvent({ state: 'thinking', text: 'test' })
    store.applyEvent({ state: 'idle' })
    expect(store.current).toBe('idle')
    expect(store.transcript).toBe('')
    expect(store.response).toBe('')
  })

  it('ignores unknown state', () => {
    const store = useVoiceStore()
    store.applyEvent({ state: 'unknown-gibberish' })
    expect(store.current).toBe('idle')
  })
})
```

- [ ] **Step 2: Verificar que el test falla**

```bash
npm test -- tests/stores/voice.test.js
```

Expected: FAIL — `Cannot find module '../../src/stores/voice.js'`

- [ ] **Step 3: Crear `src/stores/voice.js`**

```js
import { defineStore } from 'pinia'

export const useVoiceStore = defineStore('voice', {
  state: () => ({
    current:    'idle',  // 'idle' | 'listening' | 'thinking' | 'response'
    transcript: '',
    response:   '',
  }),

  actions: {
    applyEvent(data) {
      const s = data.state || 'idle'

      if (s === 'idle') {
        this.current    = 'idle'
        this.transcript = ''
        this.response   = ''
        return
      }
      if (s === 'listening') {
        this.current = 'listening'
        return
      }
      if (s === 'thinking') {
        this.current  = 'thinking'
        this.response = ''
        if (data.text) this.transcript = data.text
        return
      }
      if (s === 'response') {
        this.current = 'response'
        if (data.text) this.response = data.text
        return
      }
    },

    connectSSE() {
      const es = new EventSource('/events')
      es.onmessage = e => {
        try { this.applyEvent(JSON.parse(e.data)) } catch {}
      }
      es.onerror = () => { es.close(); setTimeout(() => this.connectSSE(), 2000) }
    },

    async cancel() {
      await fetch('/state', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ state: 'idle', text: '' }),
      }).catch(() => {})
    },

    async startListening() {
      await fetch('/listen', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    '{}',
      }).catch(() => {})
    },
  },
})
```

- [ ] **Step 4: Verificar que los tests pasan**

```bash
npm test -- tests/stores/voice.test.js
```

Expected:
```
✓ tests/stores/voice.test.js (7)
  ✓ voice store > starts idle with empty text
  ✓ voice store > transitions to listening
  ✓ voice store > transitions to thinking and captures transcript
  ✓ voice store > clears response when entering thinking
  ✓ voice store > transitions to response and captures text
  ✓ voice store > clears all text on idle
  ✓ voice store > ignores unknown state

Test Files  1 passed (1)
```

- [ ] **Step 5: Commit**

```bash
git add src/stores/voice.js tests/stores/voice.test.js
git commit -m "feat: Pinia voice store con transiciones de estado (TDD)"
```

---

## Task 3: Migrar componentes a SFCs (TDD)

**Files:**
- Create: `src/components/Orb.vue`
- Create: `src/components/UserBubble.vue`
- Create: `src/components/JotaBubble.vue`
- Create: `tests/components/UserBubble.test.js`
- Create: `tests/components/JotaBubble.test.js`

- [ ] **Step 1: Escribir test para UserBubble**

```js
// tests/components/UserBubble.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useVoiceStore } from '../../src/stores/voice.js'
import UserBubble from '../../src/components/UserBubble.vue'

describe('UserBubble', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('is hidden when idle', () => {
    const wrapper = mount(UserBubble)
    expect(wrapper.find('.bubble').classes()).not.toContain('show')
  })

  it('is hidden when thinking but transcript is empty', () => {
    const store = useVoiceStore()
    store.applyEvent({ state: 'thinking' })
    const wrapper = mount(UserBubble)
    expect(wrapper.find('.bubble').classes()).not.toContain('show')
  })

  it('is visible during thinking with transcript', () => {
    const store = useVoiceStore()
    store.applyEvent({ state: 'thinking', text: 'qué tiempo hace' })
    const wrapper = mount(UserBubble)
    expect(wrapper.find('.bubble').classes()).toContain('show')
    expect(wrapper.find('.bubble-text').text()).toBe('qué tiempo hace')
  })

  it('stays visible during response state', () => {
    const store = useVoiceStore()
    store.applyEvent({ state: 'thinking', text: 'hola' })
    store.applyEvent({ state: 'response', text: 'hola a ti' })
    const wrapper = mount(UserBubble)
    expect(wrapper.find('.bubble').classes()).toContain('show')
  })
})
```

- [ ] **Step 2: Escribir test para JotaBubble**

```js
// tests/components/JotaBubble.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useVoiceStore } from '../../src/stores/voice.js'
import JotaBubble from '../../src/components/JotaBubble.vue'

describe('JotaBubble', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('is hidden when idle', () => {
    const wrapper = mount(JotaBubble)
    expect(wrapper.find('.bubble').classes()).not.toContain('show')
  })

  it('is hidden when response state but text is empty', () => {
    const store = useVoiceStore()
    store.applyEvent({ state: 'response' })
    const wrapper = mount(JotaBubble)
    expect(wrapper.find('.bubble').classes()).not.toContain('show')
  })

  it('is visible in response state with text', () => {
    const store = useVoiceStore()
    store.applyEvent({ state: 'response', text: 'Hoy está nublado.' })
    const wrapper = mount(JotaBubble)
    expect(wrapper.find('.bubble').classes()).toContain('show')
    expect(wrapper.find('.bubble-text').text()).toBe('Hoy está nublado.')
  })

  it('is hidden during thinking even if response has previous text', () => {
    const store = useVoiceStore()
    store.applyEvent({ state: 'response', text: 'respuesta anterior' })
    store.applyEvent({ state: 'thinking', text: 'nueva pregunta' })
    const wrapper = mount(JotaBubble)
    expect(wrapper.find('.bubble').classes()).not.toContain('show')
  })
})
```

- [ ] **Step 3: Verificar que los tests fallan**

```bash
npm test -- tests/components/
```

Expected: FAIL — `Cannot find module '../../src/components/UserBubble.vue'`

- [ ] **Step 4: Crear `src/components/Orb.vue`**

```vue
<script setup>
import { useVoiceStore } from '../stores/voice.js'

const voice = useVoiceStore()
</script>

<template>
  <div id="orb-wrap">
    <div id="orb" @click="voice.startListening">
      <div id="bars">
        <div class="bar"></div>
        <div class="bar"></div>
        <div class="bar"></div>
        <div class="bar"></div>
        <div class="bar"></div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 5: Crear `src/components/UserBubble.vue`**

```vue
<script setup>
import { computed } from 'vue'
import { useVoiceStore } from '../stores/voice.js'

const voice = useVoiceStore()
const visible = computed(() =>
  !!voice.transcript && (voice.current === 'thinking' || voice.current === 'response')
)
</script>

<template>
  <div id="user-bubble" class="bubble" :class="{ show: visible }">
    <div class="bubble-label">tú</div>
    <div class="bubble-text">{{ voice.transcript }}</div>
  </div>
</template>
```

- [ ] **Step 6: Crear `src/components/JotaBubble.vue`**

```vue
<script setup>
import { computed } from 'vue'
import { useVoiceStore } from '../stores/voice.js'

const voice = useVoiceStore()
const visible = computed(() =>
  !!voice.response && voice.current === 'response'
)
</script>

<template>
  <div id="jota-bubble" class="bubble" :class="{ show: visible }">
    <div class="bubble-label">jota</div>
    <div class="bubble-text">{{ voice.response }}</div>
  </div>
</template>
```

- [ ] **Step 7: Verificar que los tests pasan**

```bash
npm test -- tests/components/
```

Expected:
```
✓ tests/components/UserBubble.test.js (4)
✓ tests/components/JotaBubble.test.js (4)

Test Files  2 passed (2)
Tests       8 passed (8)
```

- [ ] **Step 8: Commit**

```bash
git add src/components/ tests/components/
git commit -m "feat: migrar componentes a SFCs Vue 3 — Orb, UserBubble, JotaBubble"
```

---

## Task 4: Theme Loader (TDD)

**Files:**
- Create: `src/theme/loader.js`
- Create: `tests/theme/loader.test.js`
- Create: `config/theme.json`

- [ ] **Step 1: Escribir el test**

```js
// tests/theme/loader.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyTheme } from '../../src/theme/loader.js'

describe('applyTheme', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    document.documentElement.style.cssText = ''
  })

  it('sets CSS color variables from theme.json', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({
        colors: { bg: '#111', fg: '#eee', green: '#00ff00', blue: '#0000ff', violet: '#9000ff', fgDim: '#888' },
      }),
    })
    await applyTheme()
    const s = document.documentElement.style
    expect(s.getPropertyValue('--bg')).toBe('#111')
    expect(s.getPropertyValue('--fg')).toBe('#eee')
    expect(s.getPropertyValue('--green')).toBe('#00ff00')
    expect(s.getPropertyValue('--blue')).toBe('#0000ff')
    expect(s.getPropertyValue('--violet')).toBe('#9000ff')
    expect(s.getPropertyValue('--fg-dim')).toBe('#888')
  })

  it('sets font CSS variables', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({
        font: { family: 'Inter, sans-serif', weightLight: 200, weightNormal: 500 },
      }),
    })
    await applyTheme()
    const s = document.documentElement.style
    expect(s.getPropertyValue('--font-family')).toBe('Inter, sans-serif')
    expect(s.getPropertyValue('--font-weight-light')).toBe('200')
    expect(s.getPropertyValue('--font-weight-normal')).toBe('500')
  })

  it('does nothing silently when theme.json is not found', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false })
    await expect(applyTheme()).resolves.toBeUndefined()
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('')
  })

  it('only sets properties that are present in theme.json', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({ colors: { bg: '#000' } }),
    })
    await applyTheme()
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#000')
    expect(document.documentElement.style.getPropertyValue('--fg')).toBe('')
  })
})
```

- [ ] **Step 2: Verificar que el test falla**

```bash
npm test -- tests/theme/loader.test.js
```

Expected: FAIL — `Cannot find module '../../src/theme/loader.js'`

- [ ] **Step 3: Crear `src/theme/loader.js`**

```js
export async function applyTheme() {
  const res = await fetch('/config/theme.json')
  if (!res.ok) return

  const { colors = {}, font = {} } = await res.json()
  const root = document.documentElement

  if (colors.bg)     root.style.setProperty('--bg',                colors.bg)
  if (colors.fg)     root.style.setProperty('--fg',                colors.fg)
  if (colors.fgDim)  root.style.setProperty('--fg-dim',            colors.fgDim)
  if (colors.green)  root.style.setProperty('--green',             colors.green)
  if (colors.blue)   root.style.setProperty('--blue',              colors.blue)
  if (colors.violet) root.style.setProperty('--violet',            colors.violet)

  if (font.family)  root.style.setProperty('--font-family',        font.family)
  if (typeof font.weightLight  === 'number') root.style.setProperty('--font-weight-light',  String(font.weightLight))
  if (typeof font.weightNormal === 'number') root.style.setProperty('--font-weight-normal', String(font.weightNormal))
}
```

- [ ] **Step 4: Verificar que los tests pasan**

```bash
npm test -- tests/theme/loader.test.js
```

Expected:
```
✓ tests/theme/loader.test.js (4)

Test Files  1 passed (1)
Tests       4 passed (4)
```

- [ ] **Step 5: Crear `config/theme.json`** (copia real del example, sin adb en device)

```json
{
  "colors": {
    "bg":      "#000000",
    "fg":      "#f1f5f9",
    "fgDim":   "#475569",
    "green":   "#4ade80",
    "blue":    "#60a5fa",
    "violet":  "#c4b5fd"
  },
  "font": {
    "family": "system-ui, -apple-system, sans-serif",
    "weightLight": 300,
    "weightNormal": 400
  },
  "animations": {
    "enabled": true,
    "speed":   "normal"
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/theme/loader.js tests/theme/loader.test.js
git commit -m "feat: theme loader — aplica theme.json como CSS variables (TDD)"
```

---

## Task 5: VoicePanel + cancel button + estilos

**Files:**
- Create: `src/panels/VoicePanel.vue`
- Create: `src/style.css` (copy de `style.css` raíz + cancel-btn)

- [ ] **Step 1: Crear `src/style.css`**

Copiar el `style.css` de la raíz y añadir los estilos del botón cancelar:

```bash
cp style.css src/style.css
```

Luego añadir al final de `src/style.css`:

```css
/* botón cancelar pipeline */
#cancel-btn {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.13);
  color: var(--fg-dim);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background .2s;
  -webkit-tap-highlight-color: transparent;
}
#cancel-btn:active {
  background: rgba(255, 255, 255, 0.18);
}
```

> Nota: el archivo completo debe comenzar con las reglas del `style.css` original (reset, variables CSS, layout `#root`, sidebar, orb, burbujas, etc.) y terminar con los estilos de `#cancel-btn`.

- [ ] **Step 2: Crear `src/panels/VoicePanel.vue`**

```vue
<script setup>
import { computed } from 'vue'
import { useVoiceStore } from '../stores/voice.js'
import Orb        from '../components/Orb.vue'
import UserBubble from '../components/UserBubble.vue'
import JotaBubble from '../components/JotaBubble.vue'

const voice      = useVoiceStore()
const showCancel = computed(() =>
  voice.current === 'listening' || voice.current === 'thinking'
)
</script>

<template>
  <div id="root" :class="'s-' + voice.current">

    <div id="sidebar">
      <Orb />
    </div>

    <div id="main">
      <UserBubble />

      <div id="dots">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>

      <div id="divider"></div>

      <JotaBubble />
    </div>

    <button
      v-if="showCancel"
      id="cancel-btn"
      @click="voice.cancel"
      aria-label="Cancelar"
    >✕</button>

  </div>
</template>
```

- [ ] **Step 3: Commit**

```bash
git add src/panels/VoicePanel.vue src/style.css
git commit -m "feat: VoicePanel con botón de cancelar pipeline"
```

---

## Task 6: App.vue + Router + Entry Point

**Files:**
- Create: `src/router/index.js`
- Create: `src/App.vue`
- Create: `src/main.js`
- Create: `public/manifest.json` (mover desde raíz)
- Modify: `index.html`

- [ ] **Step 1: Crear `src/router/index.js`**

```js
import { createRouter, createWebHashHistory } from 'vue-router'
import VoicePanel from '../panels/VoicePanel.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: VoicePanel },
  ],
})
```

- [ ] **Step 2: Crear `src/App.vue`**

```vue
<script setup>
import { onMounted } from 'vue'
import { useVoiceStore } from './stores/voice.js'

const voice = useVoiceStore()

onMounted(() => {
  voice.connectSSE()

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
  <RouterView />
</template>
```

- [ ] **Step 3: Crear `src/main.js`**

```js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router/index.js'
import { applyTheme } from './theme/loader.js'
import App from './App.vue'
import './style.css'

applyTheme().catch(() => {})
createApp(App).use(createPinia()).use(router).mount('#app')
```

- [ ] **Step 4: Mover `manifest.json` a `public/`**

```bash
mkdir -p public
git mv manifest.json public/manifest.json
```

El directorio `public/` de Vite se sirve en la raíz del build sin transformaciones. El `<link rel="manifest" href="/manifest.json">` en `index.html` no necesita cambios.

- [ ] **Step 5: Actualizar `index.html`**

Reemplazar la línea `<script type="module" src="app.js">` y el `<link rel="stylesheet">` por la entrada Vite:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="theme-color" content="#000000">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="mobile-web-app-capable" content="yes">
  <link rel="manifest" href="/manifest.json">
  <title>Jota</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 6: Verificar que Vite dev server levanta**

Arrancar el servidor Python en una terminal y Vite en otra:

```bash
# Terminal 1
python3 server/server.py

# Terminal 2
npm run dev
```

Abrir `http://localhost:5173/`. La app debe mostrar el panel de voz.

Simular un evento:
```bash
curl -X POST http://localhost:8766/state \
  -H 'Content-Type: application/json' \
  -d '{"state":"thinking","text":"qué temperatura hay"}'
```

Expected: la UI en `localhost:5173` muestra el transcript y el orb en azul.

- [ ] **Step 7: Commit**

```bash
git add src/router/index.js src/App.vue src/main.js public/manifest.json index.html
git commit -m "feat: App.vue + Vue Router + entry point Vite — app completa"
```

---

## Task 7: Actualizar server.py para producción

**Files:**
- Modify: `server/server.py`

server.py necesita dos cambios:
1. `BASE_DIR` debe apuntar a `dist/` (la build de Vite)
2. Añadir endpoint `POST /listen` para "tap orb → listening"

- [ ] **Step 1: Actualizar BASE_DIR en `server/server.py`**

Localizar el bloque de configuración y cambiar las líneas de `BASE_DIR`:

```python
# ANTES:
if TERMUX_MODE:
    BASE_DIR      = Path.home() / "jota-display"
    ...
else:
    BASE_DIR      = Path(__file__).parent.parent
    ...

# DESPUÉS:
if TERMUX_MODE:
    BASE_DIR      = Path.home() / "jota-display" / "dist"
    ...
else:
    BASE_DIR      = Path(__file__).parent.parent / "dist"
    ...
```

- [ ] **Step 2: Añadir `POST /listen` en `do_POST`**

En el método `do_POST`, añadir un bloque `elif` antes del `else` final:

```python
elif self.path == "/listen":
    broadcast({"state": "listening", "text": ""})
    threading.Thread(target=screen_wake, daemon=True).start()
    self.send_response(200)
    self.send_header("Content-Length", "2")
    self.end_headers()
    self.wfile.write(b"ok")
```

- [ ] **Step 3: Build de producción y smoke test**

```bash
npm run build
python3 server/server.py
```

Abrir `http://localhost:8766/`. La app debe cargar desde `dist/`.

Simular listening:
```bash
curl -X POST http://localhost:8766/state \
  -H 'Content-Type: application/json' \
  -d '{"state":"listening"}'
```

Expected: el orb se pone verde en el navegador.

Probar tap-to-listen endpoint:
```bash
curl -X POST http://localhost:8766/listen \
  -H 'Content-Type: application/json' \
  -d '{}'
```

Expected: `ok`, UI pasa a `listening`.

- [ ] **Step 4: Verificar todos los tests siguen pasando**

```bash
npm test
```

Expected: todos los tests en verde (smoke + voice store + componentes + theme).

- [ ] **Step 5: Commit**

```bash
git add server/server.py
git commit -m "feat: server.py sirve dist/ + endpoint POST /listen para tap-to-listen"
```

---

## Task 8: Archivar archivos legacy

Una vez confirmado que la app funciona con Vite, los archivos del setup original (Fase 0) pueden eliminarse.

**Files to delete:**
- `app.js`
- `components/Orb.js`
- `components/UserBubble.js`
- `components/JotaBubble.js`
- `lib/vue.esm-browser.js`
- `style.css` (raíz — reemplazado por `src/style.css`)
- `manifest.json` (raíz — reemplazado por `public/manifest.json`)

- [ ] **Step 1: Eliminar archivos legacy**

```bash
git rm app.js components/Orb.js components/UserBubble.js components/JotaBubble.js
git rm lib/vue.esm-browser.js style.css manifest.json
```

- [ ] **Step 2: Verificar build y tests tras limpieza**

```bash
npm run build && npm test
```

Expected: build sin errores, todos los tests en verde.

- [ ] **Step 3: Commit final**

```bash
git commit -m "chore: eliminar archivos legacy fase-0 (ESM sin build)"
```

---

## Task 9: Deploy al dispositivo

- [ ] **Step 1: Build de producción final**

```bash
npm run build
```

Expected: `dist/` generado con assets minificados.

- [ ] **Step 2: Deploy**

```bash
bash deploy.sh          # → teléfono (Termux)
# o
bash deploy.sh worker01 # → worker-01 (Linux)
```

- [ ] **Step 3: Verificar en el dispositivo**

```bash
# En el teléfono (Termux):
curl http://localhost:8766/

# Simular conversación:
curl -X POST http://localhost:8766/state -H 'Content-Type: application/json' -d '{"state":"listening"}'
curl -X POST http://localhost:8766/state -H 'Content-Type: application/json' -d '{"state":"thinking","text":"qué hora es"}'
curl -X POST http://localhost:8766/state -H 'Content-Type: application/json' -d '{"state":"response","text":"Son las 3 de la tarde."}'
```

Expected: la UI en WallPanel refleja cada cambio de estado en tiempo real.

- [ ] **Step 4: Commit de release**

```bash
git add dist/   # solo si dist/ se versiona; si no, omitir
git tag v0.2.0
git push origin main --tags
```

---

## Self-Review

### Spec coverage (Fase 2 — subsistema 2a)

| Requisito SPEC | Cubierto en |
|---|---|
| Migrar a Vite + Vue Router + Pinia | Tasks 1, 5, 6 |
| Sistema de configuración config/*.json (read) | Task 4 (theme.json via fetch) |
| Theming via CSS variables desde theme.json | Task 4 |
| Cancelar pipeline táctilmente | Task 5 (VoicePanel cancel-btn) |
| Tap en orb → iniciar escucha | Task 3 (Orb @click), Task 7 (POST /listen) |
| Feature parity con Fase 0 | Tasks 2, 3, 5 |

**Fuera de scope (→ Plan 2b):**
- Widget ToggleWidget (luz on/off via HA WebSocket)
- Widget SensorWidget (lectura de sensor)

### Limitaciones conocidas

- `POST /listen` solo actualiza el estado visual en jota-display; **no lanza el pipeline de voz de wyoming-satellite**. Cuando el orb se toca, la UI muestra "listening" pero el micrófono no se activa hasta que el pipeline externo lo haga. Esto es correcto para Fase 2 — el tap es una señal visual / de prueba.
- `config/device.json` y `config/ha.json` no se leen todavía en esta fase. Se añaden en Plan 2b y Fase 4 respectivamente.
