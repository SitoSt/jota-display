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
    expect(widgets.value).toEqual(saved)
  })

  it('si el servidor devuelve un array, reemplaza localStorage', async () => {
    const serverWidgets = [makeWidget({ id: 'server-id', label: 'Del servidor' })]
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(serverWidgets),
      })
    const { widgets } = await freshComposable()
    await nextTick()
    await nextTick()
    expect(widgets.value).toEqual(serverWidgets)
    expect(JSON.parse(store['jota.widgets'])).toEqual(serverWidgets)
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
    expect(widgets.value).toEqual(local)
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
