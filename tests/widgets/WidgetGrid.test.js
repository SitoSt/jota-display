import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'

// ── registry ────────────────────────────────────────────────────────────────
describe('resolveWidget', () => {
  afterEach(() => vi.resetModules())

  it('devuelve null para un tipo desconocido', async () => {
    const { resolveWidget } = await import('../../src/widgets/index.js')
    expect(resolveWidget('unknown:widget')).toBeNull()
  })

  it('devuelve una función factory para home-assistant:toggle', async () => {
    const { resolveWidget } = await import('../../src/widgets/index.js')
    const factory = resolveWidget('home-assistant:toggle')
    expect(typeof factory).toBe('function')
  })

  it('devuelve una función factory para home-assistant:sensor', async () => {
    const { resolveWidget } = await import('../../src/widgets/index.js')
    const factory = resolveWidget('home-assistant:sensor')
    expect(typeof factory).toBe('function')
  })
})

// ── WidgetGrid ───────────────────────────────────────────────────────────────
const MockWidget = defineComponent({ template: '<div class="mock-widget" />' })

async function freshWidgetGrid(widgetList = [], fetchOk = true) {
  vi.resetModules()

  globalThis.fetch = fetchOk
    ? vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(widgetList) }))
    : vi.fn(() => Promise.reject(new Error('fetch error')))

  vi.doMock('../../src/composables/useHA.js', () => ({
    useHA: () => ({ entities: ref({}), connected: ref(false), callService: vi.fn() }),
  }))

  vi.doMock('../../src/widgets/index.js', () => ({
    resolveWidget: vi.fn(type =>
      type === 'ha:mock'
        ? () => Promise.resolve({ default: MockWidget })
        : null
    ),
  }))

  const { default: WidgetGrid } = await import('../../src/widgets/WidgetGrid.vue')
  return WidgetGrid
}

describe('WidgetGrid', () => {
  afterEach(() => vi.resetModules())

  it('no renderiza nada cuando widgets.json está vacío', async () => {
    const WidgetGrid = await freshWidgetGrid([])
    const w = mount(WidgetGrid)
    await flushPromises()
    expect(w.find('.widget-slot').exists()).toBe(false)
  })

  it('renderiza un slot por widget conocido', async () => {
    const WidgetGrid = await freshWidgetGrid([{ type: 'ha:mock', size: 'small' }])
    const w = mount(WidgetGrid)
    await flushPromises()
    expect(w.find('.widget-slot').exists()).toBe(true)
  })

  it('aplica clase widget-slot--small al slot de tamaño small', async () => {
    const WidgetGrid = await freshWidgetGrid([{ type: 'ha:mock', size: 'small' }])
    const w = mount(WidgetGrid)
    await flushPromises()
    expect(w.find('.widget-slot--small').exists()).toBe(true)
  })

  it('aplica clase widget-slot--medium al slot de tamaño medium', async () => {
    const WidgetGrid = await freshWidgetGrid([{ type: 'ha:mock', size: 'medium' }])
    const w = mount(WidgetGrid)
    await flushPromises()
    expect(w.find('.widget-slot--medium').exists()).toBe(true)
  })

  it('omite widgets de tipo desconocido sin lanzar error', async () => {
    const WidgetGrid = await freshWidgetGrid([{ type: 'unknown:thing', size: 'small' }])
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
