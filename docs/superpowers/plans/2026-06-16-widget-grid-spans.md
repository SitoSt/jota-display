# Widget Grid — Sistema de Spans Libres — Plan de Implementación

> **Para workers agénticos:** REQUIRED SUB-SKILL: Usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea a tarea. Los pasos usan sintaxis de checkbox (`- [ ]`) para tracking.

**Goal:** Reemplazar el sistema de 4 tamaños fijos (`small`/`horizontal`/`medium`/`large`) por un grid de 12 columnas con `cols` y `rows` libres por widget, editor con sliders y mini-preview en el sheet.

**Architecture:** CSS Grid con `repeat(totalCols, 1fr)` y `grid-auto-rows: rowHeightpx`; el orden del array determina auto-placement; `WidgetGrid` mide su ancho con `ResizeObserver` y computa `widthPx`/`heightPx` para que cada widget haga renderizado adaptativo.

**Tech Stack:** Vue 3 Composition API, Vitest, @vue/test-utils, CSS Grid, ResizeObserver

---

## Archivos que cambian

| Archivo | Tipo |
|---------|------|
| `src/composables/useGridConfig.js` | Modificar |
| `src/composables/useWidgets.js` | Modificar |
| `src/widgets/WidgetGrid.vue` | Modificar |
| `src/widgets/WidgetShell.vue` | Modificar |
| `src/widgets/packs/home-assistant/sensor/index.js` | Modificar |
| `src/widgets/packs/home-assistant/light/index.js` | Modificar |
| `src/widgets/packs/home-assistant/sensor/SensorWidget.vue` | Modificar |
| `src/widgets/packs/home-assistant/light/LightWidget.vue` | Modificar |
| `src/components/WidgetCatalog.vue` | Modificar |
| `src/components/SettingsDrawer.vue` | Modificar |
| `tests/composables/useGridConfig.test.js` | Crear |
| `tests/composables/useWidgets.test.js` | Modificar |
| `tests/widgets/WidgetGrid.test.js` | Modificar |
| `tests/widgets/SensorWidget.test.js` | Modificar |
| `tests/widgets/LightWidget.test.js` | Modificar |

---

## Task 1: `useGridConfig` — nuevos campos

**Files:**
- Modify: `src/composables/useGridConfig.js`
- Create: `tests/composables/useGridConfig.test.js`

- [ ] **Paso 1: Escribir el test que falla**

```javascript
// tests/composables/useGridConfig.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'

const store = {}
const localStorageMock = {
  getItem:  (k) => store[k] ?? null,
  setItem:  (k, v) => { store[k] = v },
}
vi.stubGlobal('localStorage', localStorageMock)

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k])
  vi.resetModules()
  global.fetch = vi.fn().mockResolvedValue({ ok: false })
})
afterEach(() => vi.resetModules())

async function fresh() {
  const { useGridConfig } = await import('../../src/composables/useGridConfig.js')
  return useGridConfig()
}

describe('useGridConfig — valores por defecto', () => {
  it('expone totalCols con defecto 12', async () => {
    const { totalCols } = await fresh()
    expect(totalCols.value).toBe(12)
  })

  it('expone rowHeight con defecto 60', async () => {
    const { rowHeight } = await fresh()
    expect(rowHeight.value).toBe(60)
  })

  it('expone gridGap con defecto 8', async () => {
    const { gridGap } = await fresh()
    expect(gridGap.value).toBe(8)
  })

  it('NO expone cellPx ni gridCols', async () => {
    const cfg = await fresh()
    expect(cfg.cellPx).toBeUndefined()
    expect(cfg.gridCols).toBeUndefined()
  })
})

describe('useGridConfig — setters', () => {
  it('setTotalCols actualiza el valor y persiste en localStorage', async () => {
    const { totalCols, setTotalCols } = await fresh()
    await setTotalCols(16)
    expect(totalCols.value).toBe(16)
    expect(JSON.parse(store['jota.grid']).totalCols).toBe(16)
  })

  it('setRowHeight clampea a [40, 200]', async () => {
    const { rowHeight, setRowHeight } = await fresh()
    await setRowHeight(5)
    expect(rowHeight.value).toBe(40)
    await setRowHeight(999)
    expect(rowHeight.value).toBe(200)
  })

  it('setTotalCols clampea a [4, 24]', async () => {
    const { totalCols, setTotalCols } = await fresh()
    await setTotalCols(1)
    expect(totalCols.value).toBe(4)
    await setTotalCols(100)
    expect(totalCols.value).toBe(24)
  })
})

describe('useGridConfig — carga desde localStorage', () => {
  it('carga totalCols y rowHeight guardados', async () => {
    store['jota.grid'] = JSON.stringify({ totalCols: 8, rowHeight: 80, gap: 12 })
    const { totalCols, rowHeight, gridGap } = await fresh()
    expect(totalCols.value).toBe(8)
    expect(rowHeight.value).toBe(80)
    expect(gridGap.value).toBe(12)
  })
})
```

- [ ] **Paso 2: Ejecutar y confirmar que falla**

```bash
cd /Users/alfonsogarre/Workspace/jota-display && npx vitest run tests/composables/useGridConfig.test.js
```

Esperado: varios tests FAIL porque el módulo aún exporta `cellPx`/`gridCols`.

- [ ] **Paso 3: Reescribir `useGridConfig.js`**

```javascript
// src/composables/useGridConfig.js
import { ref, readonly } from 'vue'

const STORAGE_KEY = 'jota.grid'

const _totalCols = ref(12)
const _rowHeight  = ref(60)
const _gap        = ref(8)

let _init = false

function _load(cfg) {
  if (cfg.totalCols != null) _totalCols.value = cfg.totalCols
  if (cfg.rowHeight  != null) _rowHeight.value  = cfg.rowHeight
  if (cfg.gap        != null) _gap.value        = cfg.gap
}

async function _persist() {
  const body = { totalCols: _totalCols.value, rowHeight: _rowHeight.value, gap: _gap.value }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(body))
  try {
    await fetch('/config/grid.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {}
}

export function useGridConfig() {
  if (!_init) {
    _init = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) _load(JSON.parse(raw))
    } catch {}
    fetch('/config/grid.json')
      .then(r => r.ok ? r.json() : null)
      .then(cfg => { if (cfg) _load(cfg) })
      .catch(() => {})
  }

  async function setTotalCols(v) {
    _totalCols.value = Math.max(4, Math.min(24, v))
    await _persist()
  }

  async function setRowHeight(v) {
    _rowHeight.value = Math.max(40, Math.min(200, v))
    await _persist()
  }

  async function setGap(v) {
    _gap.value = Math.max(0, Math.min(32, v))
    await _persist()
  }

  return {
    totalCols: readonly(_totalCols),
    rowHeight:  readonly(_rowHeight),
    gridGap:    readonly(_gap),
    setTotalCols,
    setRowHeight,
    setGap,
  }
}
```

- [ ] **Paso 4: Confirmar que los tests pasan**

```bash
npx vitest run tests/composables/useGridConfig.test.js
```

Esperado: todos PASS.

- [ ] **Paso 5: Commit**

```bash
git add src/composables/useGridConfig.js tests/composables/useGridConfig.test.js
git commit -m "feat: useGridConfig — totalCols + rowHeight reemplazan cellPx + cols"
```

---

## Task 2: `useWidgets` — migración automática de `size`

**Files:**
- Modify: `src/composables/useWidgets.js`
- Modify: `tests/composables/useWidgets.test.js`

- [ ] **Paso 1: Añadir tests de migración al final del archivo de test existente**

Abre `tests/composables/useWidgets.test.js` y añade al final (antes del último `}`):

```javascript
// ── migración de size ────────────────────────────────────────────────────────
describe('useWidgets — migración de size', () => {
  it('convierte size:small a cols:4, rows:2', async () => {
    store['jota.widgets'] = JSON.stringify([makeWidget({ size: 'small' })])
    const { widgets } = await freshComposable()
    expect(widgets.value[0].cols).toBe(4)
    expect(widgets.value[0].rows).toBe(2)
    expect(widgets.value[0].size).toBeUndefined()
  })

  it('convierte size:horizontal a cols:4, rows:1', async () => {
    store['jota.widgets'] = JSON.stringify([makeWidget({ size: 'horizontal' })])
    const { widgets } = await freshComposable()
    expect(widgets.value[0].cols).toBe(4)
    expect(widgets.value[0].rows).toBe(1)
  })

  it('convierte size:medium a cols:8, rows:2', async () => {
    store['jota.widgets'] = JSON.stringify([makeWidget({ size: 'medium' })])
    const { widgets } = await freshComposable()
    expect(widgets.value[0].cols).toBe(8)
    expect(widgets.value[0].rows).toBe(2)
  })

  it('convierte size:large a cols:12, rows:2', async () => {
    store['jota.widgets'] = JSON.stringify([makeWidget({ size: 'large' })])
    const { widgets } = await freshComposable()
    expect(widgets.value[0].cols).toBe(12)
    expect(widgets.value[0].rows).toBe(2)
  })

  it('no toca widgets que ya tienen cols y rows', async () => {
    store['jota.widgets'] = JSON.stringify([makeWidget({ cols: 6, rows: 3 })])
    const { widgets } = await freshComposable()
    expect(widgets.value[0].cols).toBe(6)
    expect(widgets.value[0].rows).toBe(3)
  })

  it('size desconocido cae a cols:4, rows:2', async () => {
    store['jota.widgets'] = JSON.stringify([makeWidget({ size: 'unknown' })])
    const { widgets } = await freshComposable()
    expect(widgets.value[0].cols).toBe(4)
    expect(widgets.value[0].rows).toBe(2)
  })
})
```

- [ ] **Paso 2: Ejecutar y confirmar que los tests nuevos fallan**

```bash
npx vitest run tests/composables/useWidgets.test.js
```

Esperado: los 6 nuevos tests FAIL, los anteriores PASS.

- [ ] **Paso 3: Añadir la migración a `useWidgets.js`**

Abre `src/composables/useWidgets.js` y añade antes de `const widgets = ref([])`:

```javascript
const _SIZE_MAP = {
  small:      { cols: 4,  rows: 2 },
  horizontal: { cols: 4,  rows: 1 },
  medium:     { cols: 8,  rows: 2 },
  large:      { cols: 12, rows: 2 },
}

function _migrateWidget(w) {
  if (!w.cols && !w.rows) {
    const { cols, rows } = _SIZE_MAP[w.size] ?? _SIZE_MAP.small
    const { size: _dropped, ...rest } = w
    return { ...rest, cols, rows }
  }
  return w
}
```

Luego modifica `_ensureIds` para que también migre:

```javascript
function _ensureIds(items) {
  return items.map(w => {
    const withId = w.id ? w : { ...w, id: crypto.randomUUID() }
    return _migrateWidget(withId)
  })
}
```

- [ ] **Paso 4: Confirmar que todos los tests pasan**

```bash
npx vitest run tests/composables/useWidgets.test.js
```

Esperado: todos PASS.

- [ ] **Paso 5: Commit**

```bash
git add src/composables/useWidgets.js tests/composables/useWidgets.test.js
git commit -m "feat: useWidgets — migración automática de size a cols/rows"
```

---

## Task 3: `WidgetGrid.vue` — nuevo CSS Grid con ResizeObserver

**Files:**
- Modify: `src/widgets/WidgetGrid.vue`
- Modify: `tests/widgets/WidgetGrid.test.js`

- [ ] **Paso 1: Actualizar los tests de WidgetGrid**

Reemplaza el contenido de `tests/widgets/WidgetGrid.test.js` con:

```javascript
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'

// ResizeObserver no existe en jsdom
const mockRO = { observe: vi.fn(), disconnect: vi.fn() }
vi.stubGlobal('ResizeObserver', vi.fn(() => mockRO))

const MockWidget = defineComponent({ template: '<div class="mock-widget" />' })

async function freshWidgetGrid(widgetList = [], fetchOk = true) {
  vi.resetModules()

  globalThis.fetch = fetchOk
    ? vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(widgetList) }))
    : vi.fn(() => Promise.reject(new Error('fetch error')))

  vi.doMock('../../src/composables/useHA.js', () => ({
    useHA: () => ({
      entities:    ref({}),
      connected:   ref(false),
      loading:     ref(false),
      callService: vi.fn(),
    }),
  }))

  const mockDefinition = {
    type:        'ha:mock',
    defaultCols: 4,
    defaultRows: 2,
    fields:      { value: () => 'val', label: () => 'lbl' },
    component:   undefined,
  }

  vi.doMock('../../src/widgets/index.js', () => ({
    resolveWidget:     vi.fn(type => type === 'ha:mock' ? () => Promise.resolve({ default: MockWidget }) : null),
    resolveDefinition: vi.fn(type => type === 'ha:mock' ? mockDefinition : null),
  }))

  const { default: WidgetGrid } = await import('../../src/widgets/WidgetGrid.vue')
  return WidgetGrid
}

// ── resolveWidget/Definition ─────────────────────────────────────────────────
describe('resolveWidget', () => {
  afterEach(() => vi.resetModules())

  it('devuelve null para un tipo desconocido', async () => {
    const { resolveWidget } = await import('../../src/widgets/index.js')
    expect(resolveWidget('unknown:widget')).toBeNull()
  })

  it('devuelve una función factory para home-assistant:light', async () => {
    const { resolveWidget } = await import('../../src/widgets/index.js')
    expect(typeof resolveWidget('home-assistant:light')).toBe('function')
  })
})

describe('resolveDefinition', () => {
  afterEach(() => vi.resetModules())

  it('devuelve null para un tipo desconocido', async () => {
    const { resolveDefinition } = await import('../../src/widgets/index.js')
    expect(resolveDefinition('unknown:type')).toBeNull()
  })

  it('devuelve definición con minCols para home-assistant:light', async () => {
    const { resolveDefinition } = await import('../../src/widgets/index.js')
    const def = resolveDefinition('home-assistant:light')
    expect(def.minCols).toBeDefined()
    expect(def.defaultCols).toBeDefined()
  })
})

// ── WidgetGrid ───────────────────────────────────────────────────────────────
describe('WidgetGrid', () => {
  afterEach(() => vi.resetModules())

  it('no renderiza nada cuando widgets.json está vacío', async () => {
    const WidgetGrid = await freshWidgetGrid([])
    const w = mount(WidgetGrid)
    await flushPromises()
    expect(w.find('.widget-slot').exists()).toBe(false)
  })

  it('renderiza un slot por widget conocido', async () => {
    const WidgetGrid = await freshWidgetGrid([{ type: 'ha:mock', cols: 4, rows: 2 }])
    const w = mount(WidgetGrid)
    await flushPromises()
    expect(w.find('.widget-slot').exists()).toBe(true)
  })

  it('aplica gridColumn: span cols al slot', async () => {
    const WidgetGrid = await freshWidgetGrid([{ type: 'ha:mock', cols: 3, rows: 2 }])
    const w = mount(WidgetGrid)
    await flushPromises()
    expect(w.find('.widget-slot').element.style.gridColumn).toBe('span 3')
  })

  it('aplica gridRow: span rows al slot', async () => {
    const WidgetGrid = await freshWidgetGrid([{ type: 'ha:mock', cols: 4, rows: 5 }])
    const w = mount(WidgetGrid)
    await flushPromises()
    expect(w.find('.widget-slot').element.style.gridRow).toBe('span 5')
  })

  it('usa defaultCols de la definición si el widget no tiene cols', async () => {
    const WidgetGrid = await freshWidgetGrid([{ type: 'ha:mock' }])
    const w = mount(WidgetGrid)
    await flushPromises()
    // defaultCols del mockDefinition es 4
    expect(w.find('.widget-slot').element.style.gridColumn).toBe('span 4')
  })

  it('omite widgets de tipo desconocido sin lanzar error', async () => {
    const WidgetGrid = await freshWidgetGrid([{ type: 'unknown:thing', cols: 4, rows: 2 }])
    const w = mount(WidgetGrid)
    await flushPromises()
    expect(w.find('.widget-slot').exists()).toBe(false)
  })

  it('no lanza si fetch falla', async () => {
    const WidgetGrid = await freshWidgetGrid([], false)
    await expect(async () => {
      const w = mount(WidgetGrid)
      await flushPromises()
    }).not.toThrow()
  })
})
```

- [ ] **Paso 2: Ejecutar y confirmar que los tests nuevos fallan**

```bash
npx vitest run tests/widgets/WidgetGrid.test.js
```

Esperado: los tests de `gridColumn`/`gridRow` por cols/rows fallan porque el código aún usa SPANS.

- [ ] **Paso 3: Reescribir `WidgetGrid.vue`**

```vue
<!-- src/widgets/WidgetGrid.vue -->
<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { resolveDefinition } from './index.js'
import { useWidgets } from '../composables/useWidgets.js'
import { useGridConfig } from '../composables/useGridConfig.js'
import WidgetShell from './WidgetShell.vue'

const { widgets } = useWidgets()
const { totalCols, rowHeight, gridGap } = useGridConfig()

const gridEl = ref(null)
const containerWidth = ref(0)
let _ro = null

onMounted(() => {
  _ro = new ResizeObserver(entries => {
    containerWidth.value = entries[0].contentRect.width
  })
  if (gridEl.value) _ro.observe(gridEl.value)
})
onUnmounted(() => _ro?.disconnect())

const columnWidth = computed(() => {
  const cols = totalCols.value
  const gap  = gridGap.value
  const w    = containerWidth.value
  if (!w || !cols) return 60
  return (w - (cols - 1) * gap) / cols
})

const slots = computed(() =>
  widgets.value
    .map(w => {
      const def = resolveDefinition(w.type)
      if (!def) return null
      const cols = w.cols ?? def.defaultCols ?? 4
      const rows = w.rows ?? def.defaultRows ?? 2
      const widthPx  = cols * columnWidth.value + (cols - 1) * gridGap.value
      const heightPx = rows * rowHeight.value  + (rows - 1) * gridGap.value
      return { config: w, def, cols, rows, widthPx, heightPx }
    })
    .filter(Boolean)
)

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${totalCols.value}, 1fr)`,
  gridAutoRows:        `${rowHeight.value}px`,
  gap:                 `${gridGap.value}px`,
}))
</script>

<template>
  <div v-if="slots.length" ref="gridEl" class="widget-grid" :style="gridStyle">
    <div
      v-for="(slot, i) in slots"
      :key="slot.config.id ?? i"
      class="widget-slot"
      :style="{
        gridColumn: `span ${slot.cols}`,
        gridRow:    `span ${slot.rows}`,
      }"
    >
      <WidgetShell
        :config="slot.config"
        :definition="slot.def"
        :width-px="slot.widthPx"
        :height-px="slot.heightPx"
      />
    </div>
  </div>
</template>

<style scoped>
.widget-grid {
  display: grid;
  align-content: start;
  flex-shrink: 0;
  padding: 10px 12px 16px;
}

.widget-slot {
  position: relative;
  min-width: 0;
  min-height: 0;
}
</style>
```

- [ ] **Paso 4: Confirmar que todos los tests pasan**

```bash
npx vitest run tests/widgets/WidgetGrid.test.js
```

Esperado: todos PASS.

- [ ] **Paso 5: Commit**

```bash
git add src/widgets/WidgetGrid.vue tests/widgets/WidgetGrid.test.js
git commit -m "feat: WidgetGrid — grid con 1fr cols, rowHeight y widthPx/heightPx por slot"
```

---

## Task 4: `WidgetShell.vue` — aceptar y pasar `widthPx`/`heightPx`

**Files:**
- Modify: `src/widgets/WidgetShell.vue`
- Modify: `tests/widgets/WidgetShell.test.js`

- [ ] **Paso 1: Añadir tests al archivo existente de WidgetShell**

Añade estos casos al final de `tests/widgets/WidgetShell.test.js`:

```javascript
// ── widthPx / heightPx ───────────────────────────────────────────────────────
describe('WidgetShell — props widthPx/heightPx', () => {
  it('pasa widthPx y heightPx al componente dinámico', async () => {
    vi.resetModules()

    let receivedProps = null
    const SpyComponent = defineComponent({
      props: ['config', 'widthPx', 'heightPx', 'mockState'],
      setup(p) { receivedProps = p },
      template: '<div />',
    })

    vi.doMock('../../src/composables/useHA.js', () => ({
      useHA: () => ({ entities: ref({}), connected: ref(false), loading: ref(false) }),
    }))

    const def = {
      component: () => Promise.resolve({ default: SpyComponent }),
      fields: undefined,
    }

    const { default: WidgetShell } = await import('../../src/widgets/WidgetShell.vue')
    mount(WidgetShell, {
      props: {
        config:     { entity: 'light.test' },
        definition: def,
        widthPx:    240,
        heightPx:   120,
      },
    })
    await flushPromises()

    expect(receivedProps.widthPx).toBe(240)
    expect(receivedProps.heightPx).toBe(120)
  })

  it('NO pasa prop size al componente dinámico', async () => {
    vi.resetModules()

    let receivedProps = null
    const SpyComponent = defineComponent({
      props: { config: Object, widthPx: Number, heightPx: Number, mockState: Object },
      setup(p) { receivedProps = p },
      template: '<div />',
    })

    vi.doMock('../../src/composables/useHA.js', () => ({
      useHA: () => ({ entities: ref({}), connected: ref(false), loading: ref(false) }),
    }))

    const def = {
      component: () => Promise.resolve({ default: SpyComponent }),
      fields: undefined,
    }

    const { default: WidgetShell } = await import('../../src/widgets/WidgetShell.vue')
    mount(WidgetShell, {
      props: { config: { entity: 'light.test' }, definition: def },
    })
    await flushPromises()

    expect(receivedProps.size).toBeUndefined()
  })
})
```

- [ ] **Paso 2: Ejecutar y confirmar que los tests nuevos fallan**

```bash
npx vitest run tests/widgets/WidgetShell.test.js
```

Esperado: los 2 tests nuevos FAIL.

- [ ] **Paso 3: Modificar `WidgetShell.vue`**

En `src/widgets/WidgetShell.vue`, reemplaza el bloque `<script setup>` con:

```javascript
<script setup>
import { computed, shallowRef } from 'vue'
import { useHA } from '../composables/useHA.js'
import WidgetRenderer from './WidgetRenderer.vue'

const props = defineProps({
  config:     { type: Object, required: true },
  definition: { type: Object, required: true },
  mockState:  { type: Object, default: null },
  widthPx:    { type: Number, default: 0 },
  heightPx:   { type: Number, default: 0 },
})

const { entities, connected, loading } = useHA()

const entityState = computed(() => entities.value[props.config.entity] ?? null)
const isLoading   = computed(() => loading.value)
const isConnected = computed(() => connected.value)
const isAvailable = computed(() =>
  entityState.value !== null && entityState.value.state !== 'unavailable'
)

const fields = computed(() => {
  if (!entityState.value || !props.definition.fields) return null
  return Object.fromEntries(
    Object.entries(props.definition.fields).map(([key, fn]) => [
      key, fn(entityState.value, props.config)
    ])
  )
})

const resolvedComponent = shallowRef(null)
if (props.definition.component) {
  props.definition.component().then(m => { resolvedComponent.value = m.default })
}
</script>
```

Y en el template, reemplaza el bloque `<component>` con:

```html
    <component
      v-else-if="resolvedComponent"
      :is="resolvedComponent"
      :config="config"
      :width-px="widthPx"
      :height-px="heightPx"
      :mock-state="mockState"
    />
```

(Elimina la línea `:size="size"` y la computed `size`.)

- [ ] **Paso 4: Confirmar que todos los tests pasan**

```bash
npx vitest run tests/widgets/WidgetShell.test.js
```

Esperado: todos PASS.

- [ ] **Paso 5: Commit**

```bash
git add src/widgets/WidgetShell.vue tests/widgets/WidgetShell.test.js
git commit -m "feat: WidgetShell — widthPx/heightPx reemplazan size en props hacia widgets"
```

---

## Task 5: Definiciones de widget — `minCols`, `minRows`, `defaultCols`, `defaultRows`

**Files:**
- Modify: `src/widgets/packs/home-assistant/sensor/index.js`
- Modify: `src/widgets/packs/home-assistant/light/index.js`

- [ ] **Paso 1: Test inline en WidgetGrid.test.js — verificar que las definiciones tienen los nuevos campos**

Añade al final de `tests/widgets/WidgetGrid.test.js`:

```javascript
describe('definiciones de widget', () => {
  afterEach(() => vi.resetModules())

  it('sensor tiene minCols, minRows, defaultCols, defaultRows', async () => {
    const { resolveDefinition } = await import('../../src/widgets/index.js')
    const def = resolveDefinition('home-assistant:sensor')
    expect(def.minCols).toBe(2)
    expect(def.minRows).toBe(2)
    expect(def.defaultCols).toBe(4)
    expect(def.defaultRows).toBe(3)
    expect(def.sizes).toBeUndefined()
    expect(def.defaultSize).toBeUndefined()
  })

  it('light tiene minCols, minRows, defaultCols, defaultRows', async () => {
    const { resolveDefinition } = await import('../../src/widgets/index.js')
    const def = resolveDefinition('home-assistant:light')
    expect(def.minCols).toBe(2)
    expect(def.minRows).toBe(2)
    expect(def.defaultCols).toBe(4)
    expect(def.defaultRows).toBe(3)
    expect(def.sizes).toBeUndefined()
    expect(def.defaultSize).toBeUndefined()
  })
})
```

- [ ] **Paso 2: Ejecutar y confirmar que fallan**

```bash
npx vitest run tests/widgets/WidgetGrid.test.js
```

Esperado: 2 tests nuevos FAIL.

- [ ] **Paso 3: Actualizar `sensor/index.js`**

```javascript
// src/widgets/packs/home-assistant/sensor/index.js
export default {
  type:        'home-assistant:sensor',
  label:       'Sensor',
  minCols:     2,
  minRows:     2,
  defaultCols: 4,
  defaultRows: 3,

  configSchema: {
    entity: { type: 'ha-entity', domain: 'sensor', required: true },
    label:  { type: 'string', optional: true },
    unit:   { type: 'string', optional: true },
  },

  fields: {
    value: (state, config) => {
      const unit = config.unit ?? state.attributes.unit_of_measurement ?? ''
      return unit ? `${state.state} ${unit}` : state.state
    },
    label: (state, config) =>
      config.label ?? state.attributes.friendly_name ?? config.entity,
  },

  previewState: {
    state: '21.5',
    attributes: { unit_of_measurement: '°C', friendly_name: 'Temperatura' },
  },

  component: () => import('./SensorWidget.vue'),
}
```

- [ ] **Paso 4: Actualizar `light/index.js`**

```javascript
// src/widgets/packs/home-assistant/light/index.js
export default {
  type:        'home-assistant:light',
  label:       'Luz',
  minCols:     2,
  minRows:     2,
  defaultCols: 4,
  defaultRows: 3,

  configSchema: {
    entity: { type: 'ha-entity', domain: 'light', required: true },
    label:  { type: 'string', optional: true },
  },

  fields: {
    value: (state, config) =>
      state.state === 'on'
        ? Math.round((state.attributes.brightness ?? 0) / 2.55) + '%'
        : 'OFF',
    label: (state, config) =>
      config.label ?? state.attributes.friendly_name ?? config.entity,
  },

  actions: {
    toggle:    { service: 'light.toggle',   data: (c)       => ({ entity_id: c.entity }) },
    turnOff:   { service: 'light.turn_off', data: (c)       => ({ entity_id: c.entity }) },
    setBright: { service: 'light.turn_on',  data: (c, xtra) => ({ entity_id: c.entity, brightness_pct: xtra.pct }) },
    setColor:  { service: 'light.turn_on',  data: (c, xtra) => ({ entity_id: c.entity, rgb_color: xtra.rgb }) },
  },

  previewState: {
    state: 'on',
    attributes: { friendly_name: 'Ejemplo', brightness: 191, rgb_color: [255, 200, 80] },
  },

  component: () => import('./LightWidget.vue'),
}
```

- [ ] **Paso 5: Confirmar que todos los tests pasan**

```bash
npx vitest run tests/widgets/WidgetGrid.test.js
```

Esperado: todos PASS.

- [ ] **Paso 6: Commit**

```bash
git add src/widgets/packs/home-assistant/sensor/index.js src/widgets/packs/home-assistant/light/index.js tests/widgets/WidgetGrid.test.js
git commit -m "feat: definiciones de widget — minCols/minRows/defaultCols/defaultRows"
```

---

## Task 6: `SensorWidget.vue` — renderizado adaptativo

**Files:**
- Modify: `src/widgets/packs/home-assistant/sensor/SensorWidget.vue`
- Modify: `tests/widgets/SensorWidget.test.js`

- [ ] **Paso 1: Actualizar los tests de SensorWidget**

En `tests/widgets/SensorWidget.test.js`, reemplaza la función `freshSensor` y añade los tests de adaptive rendering:

```javascript
// Reemplaza la firma de freshSensor — elimina el param `size`, añade widthPx/heightPx
async function freshSensor(
  entities = makeEntity(),
  config = { entity: 'sensor.temp' },
  widthPx = 240,
  heightPx = 180
) {
  vi.resetModules()

  vi.doMock('../../src/composables/useHA.js', () => ({
    useHA: () => ({
      entities:    ref(entities),
      connected:   ref(true),
      loading:     ref(false),
      callService: vi.fn(),
    }),
  }))

  const { default: SensorWidget } = await import(
    '../../src/widgets/packs/home-assistant/sensor/SensorWidget.vue'
  )
  return mount(SensorWidget, { props: { config, widthPx, heightPx } })
}
```

Añade al final del archivo (antes del último `}`):

```javascript
describe('SensorWidget — renderizado adaptativo', () => {
  it('oculta el label cuando heightPx < 100', async () => {
    const w = await freshSensor(makeEntity(), { entity: 'sensor.temp' }, 240, 80)
    expect(w.find('.sensor__label').exists()).toBe(false)
  })

  it('muestra el label cuando heightPx >= 100', async () => {
    const w = await freshSensor(makeEntity(), { entity: 'sensor.temp' }, 240, 100)
    expect(w.find('.sensor__label').exists()).toBe(true)
  })

  it('oculta el icono cuando heightPx < 80', async () => {
    const w = await freshSensor(makeEntity(), { entity: 'sensor.temp' }, 240, 60)
    expect(w.find('.sensor__icon').exists()).toBe(false)
  })

  it('muestra el icono cuando heightPx >= 80', async () => {
    const w = await freshSensor(makeEntity(), { entity: 'sensor.temp' }, 240, 80)
    expect(w.find('.sensor__icon').exists()).toBe(true)
  })
})
```

- [ ] **Paso 2: Ejecutar y confirmar que los tests nuevos fallan**

```bash
npx vitest run tests/widgets/SensorWidget.test.js
```

Esperado: tests de adaptive rendering FAIL, los demás PASS.

- [ ] **Paso 3: Actualizar `SensorWidget.vue`**

Reemplaza el bloque `<script setup>` con:

```javascript
<script setup>
import { computed } from 'vue'
import { useWidget } from '../../../../composables/useWidget.js'

const props = defineProps({
  config:    { type: Object, required: true },
  widthPx:   { type: Number, default: 0 },
  heightPx:  { type: Number, default: 0 },
  mockState: { type: Object, default: null },
})

const { state: haState, isAvailable: haIsAvail } = useWidget(props)
const state       = computed(() => props.mockState ?? haState.value)
const isAvailable = computed(() => props.mockState !== null ? true : haIsAvail.value)

const isUnavail = computed(() => !isAvailable.value)
const label = computed(() =>
  props.config.label ??
  state.value?.attributes?.friendly_name ??
  props.config.entity
)
const unit = computed(() =>
  props.config.unit ??
  state.value?.attributes?.unit_of_measurement ??
  ''
)

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

const displayValue = computed(() => {
  if (isUnavail.value) return '—'
  const raw = state.value?.state ?? '—'
  if (ISO_RE.test(raw)) {
    const d = new Date(raw)
    if (!isNaN(d)) return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }
  return raw
})

const displayUnit  = computed(() => ISO_RE.test(state.value?.state ?? '') ? '' : unit.value)
const showIcon     = computed(() => props.heightPx >= 80)
const showLabel    = computed(() => props.heightPx >= 100)
</script>
```

Y en el template, añade `v-if` a icono y label:

```html
<template>
  <div class="sensor" :class="{ 'sensor--unavailable': isUnavail }">
    <div v-if="showIcon" class="sensor__icon">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path
          d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"
          :fill="isUnavail ? 'rgba(255,255,255,0.04)' : 'rgba(96,165,250,0.14)'"
          :stroke="isUnavail ? 'rgba(255,255,255,0.2)' : 'rgba(96,165,250,0.7)'"
          stroke-width="1.4"
        />
      </svg>
    </div>
    <div class="sensor__value">
      {{ displayValue }}<span v-if="displayUnit && !isUnavail" class="sensor__unit">{{ displayUnit }}</span>
    </div>
    <div v-if="showLabel" class="sensor__label">{{ label }}</div>
  </div>
</template>
```

- [ ] **Paso 4: Confirmar que todos los tests pasan**

```bash
npx vitest run tests/widgets/SensorWidget.test.js
```

Esperado: todos PASS.

- [ ] **Paso 5: Commit**

```bash
git add src/widgets/packs/home-assistant/sensor/SensorWidget.vue tests/widgets/SensorWidget.test.js
git commit -m "feat: SensorWidget — widthPx/heightPx y renderizado adaptativo"
```

---

## Task 7: `LightWidget.vue` — renderizado adaptativo

**Files:**
- Modify: `src/widgets/packs/home-assistant/light/LightWidget.vue`
- Modify: `tests/widgets/LightWidget.test.js`

- [ ] **Paso 1: Actualizar la función `freshLight` y añadir tests adaptativos**

En `tests/widgets/LightWidget.test.js`, reemplaza la firma de `freshLight`:

```javascript
async function freshLight(
  entities = makeEntities(),
  config = { entity: 'light.salon', type: 'home-assistant:light' },
  widthPx = 240,
  heightPx = 180
) {
  vi.resetModules()
  mockCallService.mockReset()

  vi.doMock('../../src/composables/useHA.js', () => ({
    useHA: () => ({
      entities:    ref(entities),
      connected:   ref(true),
      loading:     ref(false),
      callService: mockCallService,
    }),
  }))

  const { default: LightWidget } = await import(
    '../../src/widgets/packs/home-assistant/light/LightWidget.vue'
  )
  return mount(LightWidget, {
    props:  { config, widthPx, heightPx },
    global: { stubs: { Teleport: true } },
  })
}
```

Añade al final del archivo:

```javascript
describe('LightWidget — renderizado adaptativo', () => {
  it('oculta el label cuando heightPx < 100', async () => {
    const w = await freshLight(makeEntities(), undefined, 240, 80)
    expect(w.find('.light__label').exists()).toBe(false)
  })

  it('muestra el label cuando heightPx >= 100', async () => {
    const w = await freshLight(makeEntities(), undefined, 240, 100)
    expect(w.find('.light__label').exists()).toBe(true)
  })
})
```

- [ ] **Paso 2: Ejecutar y confirmar que los tests nuevos fallan**

```bash
npx vitest run tests/widgets/LightWidget.test.js
```

Esperado: tests de adaptive rendering FAIL, los demás PASS.

- [ ] **Paso 3: Modificar `LightWidget.vue` — reemplazar prop `size` por `widthPx`/`heightPx`**

En `src/widgets/packs/home-assistant/light/LightWidget.vue`, en el bloque `defineProps`, reemplaza:

```javascript
// ANTES:
const props = defineProps({
  config:    { type: Object, required: true },
  size:      { type: String, default: 'small' },
  mockState: { type: Object, default: null },
})
```

por:

```javascript
// DESPUÉS:
const props = defineProps({
  config:    { type: Object, required: true },
  widthPx:   { type: Number, default: 0 },
  heightPx:  { type: Number, default: 0 },
  mockState: { type: Object, default: null },
})
```

Añade justo debajo del bloque `defineProps`, después de las computeds existentes:

```javascript
const showLabel = computed(() => props.heightPx >= 100)
```

En el template, localiza el elemento que muestra el label del widget (busca `.light__label` o similar — el elemento que muestra `label`). Si no tiene clase `light__label`, añádela. Añade `v-if="showLabel"` a ese elemento.

> **Nota:** En `LightWidget.vue` el label puede estar en un elemento `<span>` o `<div>` dentro del template principal del widget (fuera del expand/popover). Localiza el elemento que muestra `{{ label }}` en el área principal y añade `v-if="showLabel"` y clase `light__label` si no la tiene.

- [ ] **Paso 4: Confirmar que todos los tests pasan**

```bash
npx vitest run tests/widgets/LightWidget.test.js
```

Esperado: todos PASS.

- [ ] **Paso 5: Commit**

```bash
git add src/widgets/packs/home-assistant/light/LightWidget.vue tests/widgets/LightWidget.test.js
git commit -m "feat: LightWidget — widthPx/heightPx y renderizado adaptativo"
```

---

## Task 8: `WidgetCatalog.vue` — usar `defaultCols`/`defaultRows`

**Files:**
- Modify: `src/components/WidgetCatalog.vue`

- [ ] **Paso 1: Localizar y modificar la línea que usa `defaultSize`**

En `src/components/WidgetCatalog.vue`, línea ~48, reemplaza:

```javascript
// ANTES:
size:   selectedType.value.defaultSize,
```

por:

```javascript
// DESPUÉS:
cols: selectedType.value.defaultCols ?? 4,
rows: selectedType.value.defaultRows ?? 3,
```

- [ ] **Paso 2: Verificar que los tests existentes pasan**

```bash
npx vitest run tests/components/WidgetCatalog.test.js
```

Esperado: todos PASS.

- [ ] **Paso 3: Commit**

```bash
git add src/components/WidgetCatalog.vue
git commit -m "feat: WidgetCatalog — usa defaultCols/defaultRows al añadir widgets"
```

---

## Task 9: `SettingsDrawer.vue` — Parte 1: tablero preview y grid config UI

**Files:**
- Modify: `src/components/SettingsDrawer.vue`

Esta tarea actualiza el tablero preview de la sección Widgets y el panel de configuración del grid.

- [ ] **Paso 1: Actualizar imports de `useGridConfig` en SettingsDrawer**

En el bloque `<script setup>`, reemplaza:

```javascript
// ANTES:
const { cellPx, gridCols, gridGap, setCellPx, setCols, setGap } = useGridConfig()
```

por:

```javascript
// DESPUÉS:
const { totalCols, rowHeight, gridGap, setTotalCols, setRowHeight, setGap } = useGridConfig()
```

- [ ] **Paso 2: Eliminar `SPANS`, `spanStyle` y actualizar `tableroGridStyle`**

Elimina estas líneas:

```javascript
// Eliminar:
const SPANS = { small: [2,2], horizontal: [2,1], medium: [4,2], large: [99,2] }
function spanStyle(size) {
  const [col, row] = SPANS[size] ?? [2,2]
  return { gridColumn: `span ${Math.min(col, gridCols.value)}`, gridRow: `span ${row}` }
}
```

Reemplaza con:

```javascript
function spanStyle(widget) {
  return {
    gridColumn: `span ${Math.min(widget.cols ?? 4, totalCols.value)}`,
    gridRow:    `span ${widget.rows ?? 2}`,
  }
}
```

Reemplaza `tableroGridStyle`:

```javascript
// ANTES:
const tableroGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${gridCols.value}, ${cellPx.value}px)`,
  gridAutoRows:        `${cellPx.value}px`,
  gap:                 `${gridGap.value}px`,
}))
```

```javascript
// DESPUÉS:
const tableroGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${totalCols.value}, 1fr)`,
  gridAutoRows:        `${rowHeight.value}px`,
  gap:                 `${gridGap.value}px`,
}))
```

- [ ] **Paso 3: Actualizar la llamada a `spanStyle` en el template del tablero**

En el template, dentro de la sección `v-else-if="currentSection === 'widgets'"`, localiza:

```html
<!-- ANTES: -->
:style="spanStyle(widget.size || def.defaultSize || 'small')"
```

Reemplaza con:

```html
<!-- DESPUÉS: -->
:style="spanStyle(widget)"
```

- [ ] **Paso 4: Reemplazar el bloque `grid-cfg` en el template**

Localiza el bloque `<div class="grid-cfg">` (sección Widgets, arriba de las tabs) y reemplaza su contenido:

```html
<!-- ANTES: bloque con "Por fila" + pills + "Tamaño" + stepper + "Espacio" + stepper -->
<div class="grid-cfg">
  <div class="grid-cfg-row">
    <span class="grid-cfg__label">Por fila</span>
    <div class="grid-cfg__pills">
      <button v-for="n in [2, 3, 4]" :key="n"
        class="grid-pill"
        :class="{ 'grid-pill--on': gridCols === n * 2 }"
        @click="setCols(n * 2)">{{ n }}</button>
    </div>
  </div>
  <div class="grid-cfg-row">
    <span class="grid-cfg__label">Tamaño</span>
    <div class="grid-stepper">
      <button class="grid-stepper__btn" @click="setCellPx(cellPx - 5)">−</button>
      <span class="grid-stepper__val">{{ cellPx }}px</span>
      <button class="grid-stepper__btn" @click="setCellPx(cellPx + 5)">+</button>
    </div>
  </div>
  <div class="grid-cfg-row">
    <span class="grid-cfg__label">Espacio</span>
    <div class="grid-stepper">
      <button class="grid-stepper__btn" @click="setGap(gridGap - 2)">−</button>
      <span class="grid-stepper__val">{{ gridGap }}px</span>
      <button class="grid-stepper__btn" @click="setGap(gridGap + 2)">+</button>
    </div>
  </div>
</div>
```

Con:

```html
<!-- DESPUÉS: -->
<div class="grid-cfg">
  <div class="grid-cfg-row">
    <span class="grid-cfg__label">Columnas</span>
    <div class="grid-stepper">
      <button class="grid-stepper__btn" @click="setTotalCols(totalCols - 1)">−</button>
      <span class="grid-stepper__val">{{ totalCols }}</span>
      <button class="grid-stepper__btn" @click="setTotalCols(totalCols + 1)">+</button>
    </div>
  </div>
  <div class="grid-cfg-row">
    <span class="grid-cfg__label">Alto fila</span>
    <div class="grid-stepper">
      <button class="grid-stepper__btn" @click="setRowHeight(rowHeight - 5)">−</button>
      <span class="grid-stepper__val">{{ rowHeight }}px</span>
      <button class="grid-stepper__btn" @click="setRowHeight(rowHeight + 5)">+</button>
    </div>
  </div>
  <div class="grid-cfg-row">
    <span class="grid-cfg__label">Espacio</span>
    <div class="grid-stepper">
      <button class="grid-stepper__btn" @click="setGap(gridGap - 2)">−</button>
      <span class="grid-stepper__val">{{ gridGap }}px</span>
      <button class="grid-stepper__btn" @click="setGap(gridGap + 2)">+</button>
    </div>
  </div>
</div>
```

- [ ] **Paso 5: Eliminar referencias obsoletas: `SIZE_LABELS`, `selectedDef.sizes`**

Elimina:

```javascript
// Eliminar:
const SIZE_LABELS = { small: 'Compact.', horizontal: 'Horiz.' }
```

En el template, dentro de `widget-cfg-sheet__body`, localiza y elimina el bloque de size-pills:

```html
<!-- Eliminar este bloque completo: -->
<div v-if="selectedDef?.sizes?.length > 1" class="widget-cfg-row">
  <span class="widget-cfg-label">Tamaño</span>
  <div class="size-pills">
    <button
      v-for="sz in selectedDef.sizes"
      :key="sz"
      class="size-pill"
      :class="{ 'size-pill--on': selectedWidget.size === sz }"
      @click="updateWidget(selectedWidget.id, { size: sz })"
    >{{ SIZE_LABELS[sz] ?? sz }}</button>
  </div>
</div>
```

- [ ] **Paso 6: Verificar que el servidor de desarrollo levanta sin errores**

```bash
npx vitest run
```

Esperado: todos los tests pasan. Verifica manualmente en el navegador que el tablero preview sigue funcionando y el panel grid-cfg muestra "Columnas" y "Alto fila".

- [ ] **Paso 7: Commit**

```bash
git add src/components/SettingsDrawer.vue
git commit -m "feat: SettingsDrawer — tablero preview y grid-cfg actualizados a totalCols/rowHeight"
```

---

## Task 10: `SettingsDrawer.vue` — Parte 2: sheet expandido con mini-preview y sliders

**Files:**
- Modify: `src/components/SettingsDrawer.vue`

- [ ] **Paso 1: Añadir computed para presets y mini-preview en `<script setup>`**

Añade al final del bloque `<script setup>` (antes del cierre `</script>`):

```javascript
// ── Sheet de tamaño de widget ──────────────────────────────────────────────
const PREVIEW_ROW_H = 10  // px por fila en el mini-preview

const previewGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${totalCols.value}, 1fr)`,
  gridAutoRows:        `${PREVIEW_ROW_H}px`,
  gap:                 '2px',
}))

const selectedWidgetCols = computed(() => selectedWidget.value?.cols ?? 4)
const selectedWidgetRows = computed(() => selectedWidget.value?.rows ?? 2)

const selectedDef = computed(() =>
  selectedWidget.value ? resolveDefinition(selectedWidget.value.type) : null
)

const minCols = computed(() => selectedDef.value?.minCols ?? 2)
const minRows = computed(() => selectedDef.value?.minRows ?? 2)

function setWidgetCols(v) {
  if (!selectedWidget.value) return
  const clamped = Math.max(minCols.value, Math.min(totalCols.value, v))
  updateWidget(selectedWidget.value.id, { cols: clamped })
}

function setWidgetRows(v) {
  if (!selectedWidget.value) return
  const clamped = Math.max(minRows.value, Math.min(8, v))
  updateWidget(selectedWidget.value.id, { rows: clamped })
}

const sizePresets = computed(() => {
  if (!selectedDef.value) return []
  const { minCols: mc, minRows: mr, defaultCols: dc, defaultRows: dr } = selectedDef.value
  return [
    { label: 'S',  cols: mc,                       rows: mr },
    { label: 'M',  cols: dc ?? 4,                  rows: dr ?? 2 },
    { label: 'L',  cols: Math.round((dc ?? 4) * 1.5), rows: (dr ?? 2) + 1 },
    { label: 'XL', cols: totalCols.value,           rows: (dr ?? 2) + 2 },
  ]
})

function isActivePreset(p) {
  return selectedWidgetCols.value === p.cols && selectedWidgetRows.value === p.rows
}
```

- [ ] **Paso 2: Reemplazar el cuerpo del `widget-cfg-sheet` en el template**

Localiza el bloque `<div class="widget-cfg-sheet">` en el template y reemplaza `widget-cfg-sheet__body` con:

```html
    <!-- Mini-preview del grid -->
    <div class="wcfg-preview">
      <div class="wcfg-preview__grid" :style="previewGridStyle">
        <div
          v-for="w in widgets"
          :key="w.id"
          class="wcfg-preview__cell"
          :class="{ 'wcfg-preview__cell--active': w.id === selectedWidgetId }"
          :style="{
            gridColumn: `span ${Math.min(w.cols ?? 4, totalCols)}`,
            gridRow:    `span ${w.rows ?? 2}`,
          }"
        />
      </div>
    </div>

    <!-- Sliders de tamaño -->
    <div class="wcfg-sliders">
      <div class="wcfg-slider-row">
        <span class="wcfg-slider-label">Ancho</span>
        <input
          type="range"
          class="wcfg-range"
          :min="minCols"
          :max="totalCols"
          :value="selectedWidgetCols"
          @input="setWidgetCols(+$event.target.value)"
        />
        <span class="wcfg-slider-val">{{ selectedWidgetCols }} col</span>
      </div>
      <div class="wcfg-slider-row">
        <span class="wcfg-slider-label">Alto</span>
        <input
          type="range"
          class="wcfg-range"
          :min="minRows"
          :max="8"
          :value="selectedWidgetRows"
          @input="setWidgetRows(+$event.target.value)"
        />
        <span class="wcfg-slider-val">{{ selectedWidgetRows }} fil</span>
      </div>
    </div>

    <!-- Presets -->
    <div class="wcfg-presets">
      <button
        v-for="p in sizePresets"
        :key="p.label"
        class="wcfg-preset"
        :class="{ 'wcfg-preset--active': isActivePreset(p) }"
        @click="setWidgetCols(p.cols); setWidgetRows(p.rows)"
      >{{ p.label }}</button>
    </div>

    <!-- Eliminar -->
    <button class="remove-widget-btn" @click="removeSelected">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
      </svg>
      Eliminar widget
    </button>
```

- [ ] **Paso 3: Añadir los estilos CSS del sheet expandido**

Al final del bloque `<style scoped>`, añade:

```css
/* ── Widget cfg sheet — mini-preview ───────────────── */
.wcfg-preview {
  background: rgba(255,255,255,.025);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 12px;
  padding: 10px;
  overflow: hidden;
}

.wcfg-preview__grid {
  display: grid;
  width: 100%;
}

.wcfg-preview__cell {
  background: rgba(255,255,255,.06);
  border-radius: 3px;
}

.wcfg-preview__cell--active {
  background: var(--ui-accent, rgba(237,232,225,.55));
  border-radius: 3px;
}

/* ── Sliders ────────────────────────────────────────── */
.wcfg-sliders {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.wcfg-slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.wcfg-slider-label {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: .09em;
  color: rgba(255,255,255,.3);
  min-width: 40px;
}

.wcfg-range {
  flex: 1;
  appearance: none;
  -webkit-appearance: none;
  height: 4px;
  border-radius: 2px;
  background: rgba(255,255,255,.12);
  outline: none;
  cursor: pointer;
}
.wcfg-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--ui-accent, rgba(237,232,225,.9));
  cursor: pointer;
}
.wcfg-range::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--ui-accent, rgba(237,232,225,.9));
  border: none;
  cursor: pointer;
}

.wcfg-slider-val {
  font-size: var(--text-xs);
  color: rgba(255,255,255,.55);
  min-width: 38px;
  text-align: right;
}

/* ── Presets ────────────────────────────────────────── */
.wcfg-presets {
  display: flex;
  gap: 8px;
}

.wcfg-preset {
  flex: 1;
  padding: 6px 0;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 8px;
  color: rgba(255,255,255,.4);
  font-size: var(--text-xs);
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  transition: background .15s, border-color .15s, color .15s;
  -webkit-tap-highlight-color: transparent;
}
.wcfg-preset:hover { background: rgba(255,255,255,.08); color: rgba(255,255,255,.7); }
.wcfg-preset--active {
  background: rgba(237,232,225,.1);
  border-color: rgba(237,232,225,.35);
  color: var(--ui-accent);
}
```

- [ ] **Paso 4: Eliminar estilos CSS obsoletos**

En el bloque `<style scoped>`, elimina los bloques `.size-pill`, `.size-pills`, `.size-pill--on`, `.grid-pill`, `.grid-pill--on` y las referencias a `.widget-cfg-row` / `.widget-cfg-label` si ya no se usan.

- [ ] **Paso 5: Ejecutar todos los tests**

```bash
npx vitest run
```

Esperado: todos los tests pasan.

- [ ] **Paso 6: Commit final**

```bash
git add src/components/SettingsDrawer.vue
git commit -m "feat: SettingsDrawer — sheet expandido con mini-preview de grid y sliders de tamaño"
```

---

## Self-Review

**Cobertura del spec:**
- ✅ `totalCols`, `rowHeight`, `gap` en `useGridConfig` → Task 1
- ✅ Migración `size` → `cols`/`rows` → Task 2
- ✅ CSS Grid `repeat(totalCols, 1fr)` + `grid-auto-rows` → Task 3
- ✅ `widthPx`/`heightPx` computados y pasados al widget → Tasks 3 + 4
- ✅ `minCols`, `minRows`, `defaultCols`, `defaultRows` en definiciones → Task 5
- ✅ Renderizado adaptativo sensor → Task 6
- ✅ Renderizado adaptativo light → Task 7
- ✅ `WidgetCatalog` usa `defaultCols`/`defaultRows` → Task 8
- ✅ Grid config UI actualizada → Task 9
- ✅ Mini-preview + sliders + presets → Task 10

**Sin placeholders:** Cada paso tiene código completo.

**Consistencia de tipos:**
- `totalCols`, `rowHeight`, `gridGap` — readonly refs, usados en Tasks 1, 3, 9, 10
- `cols`, `rows` en widget config — Numbers, usados en Tasks 2, 3, 6, 7, 8, 9, 10
- `widthPx`, `heightPx` — Numbers, definidos en Task 3, aceptados en Tasks 4, 6, 7
- `minCols`, `minRows`, `defaultCols`, `defaultRows` — definidos en Task 5, usados en Tasks 8, 10
- `spanStyle(widget)` — acepta objeto widget completo desde Task 9
