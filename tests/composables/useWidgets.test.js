import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'

// Helpers para simular localStorage
const store = {}
const localStorageMock = {
  getItem:    (k) => store[k] ?? null,
  setItem:    (k, v) => { store[k] = v },
  removeItem: (k) => { delete store[k] },
}
vi.stubGlobal('localStorage', localStorageMock)

// Helper para simular crypto.randomUUID
vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'uuid-test-1') })

function makeWidget(overrides = {}) {
  return {
    id: 'uuid-test-1',
    type: 'home-assistant:light',
    entity: 'light.salon',
    label: 'Salón',
    size: 'small',
    panel: 'bottom-bar',
    ...overrides,
  }
}

// Widget ya migrado (sin size, con cols/rows)
function makeMigratedWidget(overrides = {}) {
  const { size: _dropped, ...base } = makeWidget(overrides)
  return { ...base, cols: 4, rows: 2 }
}

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k])
  vi.resetModules()
  vi.clearAllMocks()
  global.fetch = vi.fn().mockResolvedValue({ ok: false })
})

afterEach(() => vi.resetModules())

async function freshComposable() {
  const { useWidgets } = await import('../../src/composables/useWidgets.js')
  return useWidgets()
}

// ── init ────────────────────────────────────────────────────────────────────
describe('useWidgets — init', () => {
  it('devuelve array vacío si no hay nada en localStorage ni en servidor', async () => {
    const { widgets } = await freshComposable()
    await nextTick()
    expect(widgets.value).toEqual([])
  })

  it('carga widgets de localStorage al arrancar', async () => {
    const saved = [makeWidget()]
    store['jota.widgets'] = JSON.stringify(saved)
    const { widgets } = await freshComposable()
    expect(widgets.value).toEqual([makeMigratedWidget()])
  })

  it('si el servidor devuelve un array, reemplaza localStorage', async () => {
    const serverWidgets = [makeWidget({ id: 'server-id', label: 'Del servidor' })]
    const migratedServer = [makeMigratedWidget({ id: 'server-id', label: 'Del servidor' })]
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(serverWidgets),
      })
    const { widgets } = await freshComposable()
    await nextTick()
    await nextTick()
    expect(widgets.value).toEqual(migratedServer)
    expect(JSON.parse(store['jota.widgets'])).toEqual(migratedServer)
  })

  it('si el servidor devuelve array vacío, no reemplaza localStorage', async () => {
    const local = [makeWidget()]
    store['jota.widgets'] = JSON.stringify(local)
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    })
    const { widgets } = await freshComposable()
    await nextTick()
    await nextTick()
    expect(widgets.value).toEqual([makeMigratedWidget()])
  })
})

// ── addWidgets ───────────────────────────────────────────────────────────────
describe('useWidgets — addWidgets', () => {
  it('añade widgets al array y persiste en localStorage', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
    const { widgets, addWidgets } = await freshComposable()
    await nextTick()
    const items = [{ type: 'home-assistant:light', entity: 'light.salon', label: 'Salón', size: 'small', panel: 'bottom-bar' }]
    addWidgets(items)
    expect(widgets.value).toHaveLength(1)
    expect(widgets.value[0].entity).toBe('light.salon')
    expect(JSON.parse(store['jota.widgets'])).toHaveLength(1)
  })

  it('genera id UUID para cada widget añadido', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
    const { widgets, addWidgets } = await freshComposable()
    await nextTick()
    addWidgets([{ type: 'home-assistant:light', entity: 'light.salon', label: 'Salón', size: 'small', panel: 'bottom-bar' }])
    expect(widgets.value[0].id).toBe('uuid-test-1')
  })
})

// ── removeWidget ─────────────────────────────────────────────────────────────
describe('useWidgets — removeWidget', () => {
  it('elimina un widget por id', async () => {
    store['jota.widgets'] = JSON.stringify([makeWidget()])
    const { widgets, removeWidget } = await freshComposable()
    expect(widgets.value).toHaveLength(1)
    removeWidget('uuid-test-1')
    expect(widgets.value).toHaveLength(0)
    expect(JSON.parse(store['jota.widgets'])).toHaveLength(0)
  })
})

// ── updateWidget ─────────────────────────────────────────────────────────────
describe('useWidgets — updateWidget', () => {
  it('aplica un patch parcial a un widget existente', async () => {
    store['jota.widgets'] = JSON.stringify([makeWidget()])
    const { widgets, updateWidget } = await freshComposable()
    updateWidget('uuid-test-1', { label: 'Nuevo nombre' })
    expect(widgets.value[0].label).toBe('Nuevo nombre')
    expect(widgets.value[0].entity).toBe('light.salon')
  })
})

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
