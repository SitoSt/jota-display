import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'

// ResizeObserver no existe en jsdom
const mockRO = { observe: vi.fn(), disconnect: vi.fn() }
class MockResizeObserver {
  constructor() { return mockRO }
}
vi.stubGlobal('ResizeObserver', MockResizeObserver)

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
