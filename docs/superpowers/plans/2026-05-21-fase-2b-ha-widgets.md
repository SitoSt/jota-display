# Fase 2b — HA Integration + Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisito:** Plan 2a completado (Vite + Pinia + VoicePanel funcionando).

**Goal:** Conectar la app a Home Assistant vía WebSocket, crear un Pinia store que mantenga entidades HA en tiempo real, e implementar `ToggleWidget` y `SensorWidget` como primeros widgets del panel de voz.

**Architecture:** Un nuevo Pinia store (`useHAStore`) gestiona la conexión WebSocket a HA usando `home-assistant-js-websocket`. Lee la URL y token de `config/ha.json` (servido por server.py). Los widgets son SFCs que reciben un `config` prop con `{ type, entity, label, unit?, icon? }` y se suscriben al store de HA para leer el estado. `VoicePanel.vue` lee `config/widgets.json` para saber qué widgets mostrar en la columna lateral. El store de HA reconecta automáticamente si se pierde la conexión.

**Tech Stack:** home-assistant-js-websocket (librería oficial de HA), Pinia, Vue 3 SFCs

---

## File Map

| Acción | Ruta |
|--------|------|
| CREAR | `src/stores/ha.js` |
| CREAR | `src/widgets/index.js` |
| CREAR | `src/widgets/ToggleWidget.vue` |
| CREAR | `src/widgets/SensorWidget.vue` |
| CREAR | `src/widgets/WidgetPanel.vue` |
| CREAR | `config/widgets.json` (basado en `config/widgets.example.json`) |
| MODIFICAR | `src/panels/VoicePanel.vue` (añadir `WidgetPanel` en sidebar) |
| MODIFICAR | `server/server.py` (añadir `POST /config/:name` para escritura futura, leer `config/ha.json`) |
| MODIFICAR | `vite.config.js` (sin cambios salvo confirmar proxy `/config`) |
| CREAR | `tests/stores/ha.test.js` |
| CREAR | `tests/widgets/ToggleWidget.test.js` |
| CREAR | `tests/widgets/SensorWidget.test.js` |

---

## Task 1: Instalar home-assistant-js-websocket

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Instalar el paquete**

```bash
npm install home-assistant-js-websocket
```

- [ ] **Step 2: Verificar instalación**

```bash
node -e "import('home-assistant-js-websocket').then(m => console.log(Object.keys(m).slice(0,5)))"
```

Expected: lista de exports como `['createLongLivedTokenAuth', 'createConnection', ...]` sin errores.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: añadir home-assistant-js-websocket"
```

---

## Task 2: Pinia HA Store (TDD)

**Files:**
- Create: `src/stores/ha.js`
- Create: `tests/stores/ha.test.js`

El store gestiona la conexión WebSocket a HA. En tests, se mockea `home-assistant-js-websocket` para no necesitar un HA real.

- [ ] **Step 1: Escribir el test**

```js
// tests/stores/ha.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useHAStore } from '../../src/stores/ha.js'

// Mock completo de home-assistant-js-websocket
vi.mock('home-assistant-js-websocket', () => ({
  createLongLivedTokenAuth: vi.fn((url, token) => ({ url, token })),
  createConnection:         vi.fn(),
  subscribeEntities:        vi.fn(),
  callService:              vi.fn(),
}))

import {
  createLongLivedTokenAuth,
  createConnection,
  subscribeEntities,
} from 'home-assistant-js-websocket'

describe('HA store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('starts disconnected with empty entities', () => {
    const store = useHAStore()
    expect(store.connected).toBe(false)
    expect(store.entities).toEqual({})
    expect(store.error).toBeNull()
  })

  it('connect() calls createLongLivedTokenAuth and createConnection', async () => {
    const mockConn = {}
    createConnection.mockResolvedValue(mockConn)
    subscribeEntities.mockImplementation(() => {})

    const store = useHAStore()
    await store.connect('http://ha.local:8123', 'token123')

    expect(createLongLivedTokenAuth).toHaveBeenCalledWith('http://ha.local:8123', 'token123')
    expect(createConnection).toHaveBeenCalled()
    expect(store.connected).toBe(true)
    expect(store.error).toBeNull()
  })

  it('subscribeEntities callback updates entities', async () => {
    let capturedCallback
    const mockConn = {}
    createConnection.mockResolvedValue(mockConn)
    subscribeEntities.mockImplementation((_conn, cb) => { capturedCallback = cb })

    const store = useHAStore()
    await store.connect('http://ha.local:8123', 'token123')

    const fakeEntities = {
      'light.test': { state: 'on', attributes: { friendly_name: 'Test Light' } },
    }
    capturedCallback(fakeEntities)

    expect(store.entities['light.test'].state).toBe('on')
  })

  it('connect() sets error state on failure', async () => {
    createConnection.mockRejectedValue(new Error('Connection refused'))

    const store = useHAStore()
    await store.connect('http://bad-host:8123', 'bad-token')

    expect(store.connected).toBe(false)
    expect(store.error).toBe('Connection refused')
  })

  it('getEntity returns entity state or null', async () => {
    let capturedCallback
    createConnection.mockResolvedValue({})
    subscribeEntities.mockImplementation((_conn, cb) => { capturedCallback = cb })

    const store = useHAStore()
    await store.connect('http://ha.local:8123', 'token')
    capturedCallback({ 'light.salon': { state: 'off', attributes: {} } })

    expect(store.getEntity('light.salon')).toEqual({ state: 'off', attributes: {} })
    expect(store.getEntity('light.inexistente')).toBeNull()
  })
})
```

- [ ] **Step 2: Verificar que el test falla**

```bash
npm test -- tests/stores/ha.test.js
```

Expected: FAIL — `Cannot find module '../../src/stores/ha.js'`

- [ ] **Step 3: Crear `src/stores/ha.js`**

```js
import { defineStore } from 'pinia'
import {
  createLongLivedTokenAuth,
  createConnection,
  subscribeEntities,
  callService as haCallService,
} from 'home-assistant-js-websocket'

export const useHAStore = defineStore('ha', {
  state: () => ({
    connected: false,
    entities:  {},
    error:     null,
    _conn:     null,
  }),

  getters: {
    getEntity: (state) => (entityId) => state.entities[entityId] ?? null,
  },

  actions: {
    async connect(url, token) {
      this.error = null
      try {
        const auth = createLongLivedTokenAuth(url, token)
        this._conn = await createConnection({ auth })
        this.connected = true
        subscribeEntities(this._conn, entities => {
          this.entities = entities
        })
      } catch (e) {
        this.connected = false
        this.error = e.message ?? String(e)
      }
    },

    async callService(domain, service, data) {
      if (!this._conn) return
      await haCallService(this._conn, domain, service, data)
    },
  },
})
```

- [ ] **Step 4: Verificar que los tests pasan**

```bash
npm test -- tests/stores/ha.test.js
```

Expected:
```
✓ tests/stores/ha.test.js (5)

Test Files  1 passed (1)
Tests       5 passed (5)
```

- [ ] **Step 5: Commit**

```bash
git add src/stores/ha.js tests/stores/ha.test.js
git commit -m "feat: Pinia HA store — WebSocket connection + entity subscription (TDD)"
```

---

## Task 3: ToggleWidget (TDD)

**Files:**
- Create: `src/widgets/ToggleWidget.vue`
- Create: `tests/widgets/ToggleWidget.test.js`

El widget muestra el estado on/off de una entidad HA y llama a `callService` al tocarlo.

- [ ] **Step 1: Escribir el test**

```js
// tests/widgets/ToggleWidget.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useHAStore } from '../../src/stores/ha.js'
import ToggleWidget from '../../src/widgets/ToggleWidget.vue'

vi.mock('home-assistant-js-websocket', () => ({
  createLongLivedTokenAuth: vi.fn(),
  createConnection:         vi.fn(),
  subscribeEntities:        vi.fn(),
  callService:              vi.fn(),
}))

describe('ToggleWidget', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const config = { entity: 'light.dormitorio', label: 'Luz dormitorio' }

  it('renders the label', () => {
    const wrapper = mount(ToggleWidget, { props: { config } })
    expect(wrapper.text()).toContain('Luz dormitorio')
  })

  it('shows "off" when entity state is off', () => {
    const ha = useHAStore()
    ha.entities['light.dormitorio'] = { state: 'off', attributes: {} }
    const wrapper = mount(ToggleWidget, { props: { config } })
    expect(wrapper.find('[data-testid="toggle-btn"]').classes()).not.toContain('active')
  })

  it('shows "on" when entity state is on', () => {
    const ha = useHAStore()
    ha.entities['light.dormitorio'] = { state: 'on', attributes: {} }
    const wrapper = mount(ToggleWidget, { props: { config } })
    expect(wrapper.find('[data-testid="toggle-btn"]').classes()).toContain('active')
  })

  it('calls light.toggle when clicked', async () => {
    const ha = useHAStore()
    ha.entities['light.dormitorio'] = { state: 'on', attributes: {} }
    ha.callService = vi.fn()
    const wrapper = mount(ToggleWidget, { props: { config } })
    await wrapper.find('[data-testid="toggle-btn"]').trigger('click')
    expect(ha.callService).toHaveBeenCalledWith('light', 'toggle', { entity_id: 'light.dormitorio' })
  })

  it('shows unavailable state when entity does not exist in store', () => {
    const wrapper = mount(ToggleWidget, { props: { config } })
    expect(wrapper.find('[data-testid="toggle-btn"]').attributes('disabled')).toBeDefined()
  })
})
```

- [ ] **Step 2: Verificar que el test falla**

```bash
npm test -- tests/widgets/ToggleWidget.test.js
```

Expected: FAIL — `Cannot find module '../../src/widgets/ToggleWidget.vue'`

- [ ] **Step 3: Crear `src/widgets/ToggleWidget.vue`**

```vue
<script setup>
import { computed } from 'vue'
import { useHAStore } from '../stores/ha.js'

const props = defineProps({
  config: { type: Object, required: true },
})

const ha     = useHAStore()
const entity = computed(() => ha.getEntity(props.config.entity))
const isOn   = computed(() => entity.value?.state === 'on')

function toggle() {
  const domain = props.config.entity.split('.')[0]
  ha.callService(domain, 'toggle', { entity_id: props.config.entity })
}
</script>

<template>
  <div class="widget widget-toggle">
    <button
      data-testid="toggle-btn"
      class="toggle-btn"
      :class="{ active: isOn }"
      :disabled="!entity"
      @click="toggle"
    >
      <span class="toggle-label">{{ config.label }}</span>
      <span class="toggle-state">{{ isOn ? 'on' : 'off' }}</span>
    </button>
  </div>
</template>
```

- [ ] **Step 4: Verificar que los tests pasan**

```bash
npm test -- tests/widgets/ToggleWidget.test.js
```

Expected:
```
✓ tests/widgets/ToggleWidget.test.js (5)

Test Files  1 passed (1)
Tests       5 passed (5)
```

- [ ] **Step 5: Commit**

```bash
git add src/widgets/ToggleWidget.vue tests/widgets/ToggleWidget.test.js
git commit -m "feat: ToggleWidget — on/off para entidades HA (TDD)"
```

---

## Task 4: SensorWidget (TDD)

**Files:**
- Create: `src/widgets/SensorWidget.vue`
- Create: `tests/widgets/SensorWidget.test.js`

El widget muestra el valor actual de un sensor HA (solo lectura).

- [ ] **Step 1: Escribir el test**

```js
// tests/widgets/SensorWidget.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useHAStore } from '../../src/stores/ha.js'
import SensorWidget from '../../src/widgets/SensorWidget.vue'

vi.mock('home-assistant-js-websocket', () => ({
  createLongLivedTokenAuth: vi.fn(),
  createConnection:         vi.fn(),
  subscribeEntities:        vi.fn(),
  callService:              vi.fn(),
}))

describe('SensorWidget', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const config = { entity: 'sensor.temperatura', label: 'Temperatura', unit: '°C' }

  it('renders the label', () => {
    const wrapper = mount(SensorWidget, { props: { config } })
    expect(wrapper.text()).toContain('Temperatura')
  })

  it('displays sensor value with unit', () => {
    const ha = useHAStore()
    ha.entities['sensor.temperatura'] = { state: '22.5', attributes: {} }
    const wrapper = mount(SensorWidget, { props: { config } })
    expect(wrapper.find('[data-testid="sensor-value"]').text()).toContain('22.5')
    expect(wrapper.find('[data-testid="sensor-value"]').text()).toContain('°C')
  })

  it('shows "—" when entity does not exist', () => {
    const wrapper = mount(SensorWidget, { props: { config } })
    expect(wrapper.find('[data-testid="sensor-value"]').text()).toContain('—')
  })

  it('shows "—" when state is unavailable', () => {
    const ha = useHAStore()
    ha.entities['sensor.temperatura'] = { state: 'unavailable', attributes: {} }
    const wrapper = mount(SensorWidget, { props: { config } })
    expect(wrapper.find('[data-testid="sensor-value"]').text()).toContain('—')
  })
})
```

- [ ] **Step 2: Verificar que el test falla**

```bash
npm test -- tests/widgets/SensorWidget.test.js
```

Expected: FAIL — `Cannot find module '../../src/widgets/SensorWidget.vue'`

- [ ] **Step 3: Crear `src/widgets/SensorWidget.vue`**

```vue
<script setup>
import { computed } from 'vue'
import { useHAStore } from '../stores/ha.js'

const props = defineProps({
  config: { type: Object, required: true },
})

const ha         = useHAStore()
const entity     = computed(() => ha.getEntity(props.config.entity))
const stateValue = computed(() => {
  const s = entity.value?.state
  if (!s || s === 'unavailable' || s === 'unknown') return '—'
  return s
})
const displayValue = computed(() =>
  stateValue.value === '—' ? '—' : `${stateValue.value}${props.config.unit ?? ''}`
)
</script>

<template>
  <div class="widget widget-sensor">
    <span class="sensor-label">{{ config.label }}</span>
    <span class="sensor-value" data-testid="sensor-value">{{ displayValue }}</span>
  </div>
</template>
```

- [ ] **Step 4: Verificar que los tests pasan**

```bash
npm test -- tests/widgets/SensorWidget.test.js
```

Expected:
```
✓ tests/widgets/SensorWidget.test.js (4)

Test Files  1 passed (1)
Tests       4 passed (4)
```

- [ ] **Step 5: Commit**

```bash
git add src/widgets/SensorWidget.vue tests/widgets/SensorWidget.test.js
git commit -m "feat: SensorWidget — valor en tiempo real de sensores HA (TDD)"
```

---

## Task 5: Widget Registry + WidgetPanel

**Files:**
- Create: `src/widgets/index.js`
- Create: `src/widgets/WidgetPanel.vue`
- Create: `config/widgets.json`

- [ ] **Step 1: Crear `src/widgets/index.js`**

```js
import ToggleWidget from './ToggleWidget.vue'
import SensorWidget from './SensorWidget.vue'

export const WIDGETS = {
  toggle: ToggleWidget,
  sensor: SensorWidget,
}
```

- [ ] **Step 2: Crear `config/widgets.json`**

Basado en `config/widgets.example.json`, adaptar a las entidades reales disponibles.

```json
{
  "panels": {
    "voice": {
      "widgets": ["luz-salon", "temperatura-salon"]
    }
  },
  "definitions": {
    "luz-salon": {
      "type":   "toggle",
      "label":  "Luz salón",
      "entity": "light.salon"
    },
    "temperatura-salon": {
      "type":   "sensor",
      "label":  "Temperatura",
      "entity": "sensor.temperatura_salon",
      "unit":   "°C"
    }
  }
}
```

> Sustituir los `entity` IDs por los de tu HA real. Puedes encontrarlos en HA → Developer Tools → States.

- [ ] **Step 3: Crear `src/widgets/WidgetPanel.vue`**

```vue
<script setup>
import { ref, onMounted } from 'vue'
import { WIDGETS } from './index.js'

const widgetConfigs = ref([])

onMounted(async () => {
  try {
    const res  = await fetch('/config/widgets.json')
    if (!res.ok) return
    const data = await res.json()
    const ids  = data.panels?.voice?.widgets ?? []
    widgetConfigs.value = ids
      .map(id => data.definitions?.[id])
      .filter(Boolean)
  } catch {}
})
</script>

<template>
  <div id="widget-panel" v-if="widgetConfigs.length">
    <component
      v-for="(cfg, i) in widgetConfigs"
      :key="i"
      :is="WIDGETS[cfg.type]"
      :config="cfg"
    />
  </div>
</template>
```

- [ ] **Step 4: Commit**

```bash
git add src/widgets/index.js src/widgets/WidgetPanel.vue config/widgets.json
git commit -m "feat: widget registry + WidgetPanel que carga widgets desde config"
```

---

## Task 6: Conectar HA store al arranque + WidgetPanel en VoicePanel

**Files:**
- Modify: `src/App.vue`
- Modify: `src/panels/VoicePanel.vue`
- Modify: `src/style.css`

- [ ] **Step 1: Cargar `ha.json` y conectar al arranque en `src/App.vue`**

```vue
<script setup>
import { onMounted } from 'vue'
import { useVoiceStore } from './stores/voice.js'
import { useHAStore }    from './stores/ha.js'

const voice = useVoiceStore()
const ha    = useHAStore()

onMounted(async () => {
  voice.connectSSE()

  try {
    const res = await fetch('/config/ha.json')
    if (res.ok) {
      const { url, token } = await res.json()
      if (url && token) await ha.connect(url, token)
    }
  } catch {}

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

- [ ] **Step 2: Añadir `WidgetPanel` al sidebar de `VoicePanel.vue`**

```vue
<script setup>
import { computed }    from 'vue'
import { useVoiceStore } from '../stores/voice.js'
import Orb             from '../components/Orb.vue'
import UserBubble      from '../components/UserBubble.vue'
import JotaBubble      from '../components/JotaBubble.vue'
import WidgetPanel     from '../widgets/WidgetPanel.vue'

const voice      = useVoiceStore()
const showCancel = computed(() =>
  voice.current === 'listening' || voice.current === 'thinking'
)
</script>

<template>
  <div id="root" :class="'s-' + voice.current">

    <div id="sidebar">
      <Orb />
      <WidgetPanel />
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

- [ ] **Step 3: Añadir estilos de widgets al final de `src/style.css`**

```css
/* ── widgets ── */
#widget-panel {
  display: flex;
  flex-direction: column;
  gap: .75rem;
  padding-top: 1.5rem;
  width: 100%;
}

.widget {
  width: 100%;
}

/* toggle widget */
.toggle-btn {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: .25rem;
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 12px;
  padding: .75rem .5rem;
  cursor: pointer;
  transition: background .2s, border-color .2s;
  -webkit-tap-highlight-color: transparent;
}
.toggle-btn.active {
  background: rgba(74,222,128,.12);
  border-color: rgba(74,222,128,.35);
}
.toggle-btn:disabled {
  opacity: .35;
  cursor: default;
}
.toggle-label {
  font-size: .6rem;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: var(--fg-dim);
}
.toggle-state {
  font-size: .85rem;
  font-weight: 300;
  color: var(--fg);
}
.toggle-btn.active .toggle-state { color: var(--green); }

/* sensor widget */
.widget-sensor {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: .2rem;
  padding: .5rem;
}
.sensor-label {
  font-size: .55rem;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: var(--fg-dim);
}
.sensor-value {
  font-size: 1.1rem;
  font-weight: 300;
  color: var(--fg);
}
```

- [ ] **Step 4: Crear `config/ha.json`** (no versionado — solo en el dispositivo)

```json
{
  "url":   "http://192.168.1.109:8123",
  "token": "eyJ..."
}
```

> Generar el token en HA → Perfil de usuario → Tokens de acceso de larga duración. Este fichero no se hace commit (está en `.gitignore`).

- [ ] **Step 5: Commit**

```bash
git add src/App.vue src/panels/VoicePanel.vue src/style.css
git commit -m "feat: conectar HA al arranque + widgets en VoicePanel sidebar"
```

---

## Task 7: Build + verificación end-to-end

- [ ] **Step 1: Correr todos los tests**

```bash
npm test
```

Expected: todos los tests en verde (smoke + voice store + HA store + componentes + widgets + theme).

- [ ] **Step 2: Build de producción**

```bash
npm run build
```

Expected: `dist/` generado sin errores.

- [ ] **Step 3: Verificar con servidor real**

```bash
python3 server/server.py
```

Abrir `http://localhost:8766/`. Verificar:
- Los widgets aparecen en el sidebar
- El estado de las entidades HA se actualiza en tiempo real
- Tocar un ToggleWidget cambia el estado en HA

- [ ] **Step 4: Deploy al dispositivo**

```bash
bash deploy.sh          # teléfono
# o
bash deploy.sh worker01 # Linux
```

- [ ] **Step 5: Commit de release**

```bash
git tag v0.3.0
git push origin main --tags
```

---

## Self-Review

### Spec coverage (Fase 2 — subsistema 2b)

| Requisito SPEC | Cubierto en |
|---|---|
| Widget ToggleWidget (luz on/off via HA WebSocket) | Tasks 3, 5, 6 |
| Widget SensorWidget (lectura de sensor) | Tasks 4, 5, 6 |
| home-assistant-js-websocket (librería oficial HA) | Tasks 1, 2 |
| config/ha.json para URL + token | Task 6 |
| config/widgets.json para definición de widgets | Task 5 |
| Reconexión automática | Integrado en store (subscribeEntities reconecta) |

### Pendiente post-2b

- Tap widget toggle → feedback visual optimista (actualizar antes de que HA confirme)
- `config/ha.json` actualmente solo se lee al arranque — si cambia hay que recargar
- Auto-discovery de HA (Fase 4)
