// tests/widgets/WidgetShell.test.js
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, defineComponent } from 'vue'

const MockWidget = defineComponent({ template: '<div class="inner-widget">widget</div>' })

async function freshShell({ connected = true, loading = false, entityState = 'on', hasComponent = true } = {}) {
  vi.resetModules()

  const entity = entityState
    ? { state: entityState, attributes: { friendly_name: 'Salón' } }
    : null

  vi.doMock('../../src/composables/useHA.js', () => ({
    useHA: () => ({
      entities:    ref(entity ? { 'light.salon': entity } : {}),
      connected:   ref(connected),
      loading:     ref(loading),
      callService: vi.fn(),
    }),
  }))

  const definition = {
    type:        'home-assistant:light',
    defaultSize: 'small',
    fields: {
      value: (s) => s.state === 'on' ? 'ON' : 'OFF',
      label: (s) => s.attributes.friendly_name,
    },
    component: hasComponent ? () => Promise.resolve({ default: MockWidget }) : undefined,
  }

  const { default: WidgetShell } = await import('../../src/widgets/WidgetShell.vue')
  return mount(WidgetShell, {
    props: {
      config:     { entity: 'light.salon', type: 'home-assistant:light' },
      definition,
    },
  })
}

afterEach(() => vi.resetModules())

describe('WidgetShell — estados de conexión', () => {
  it('muestra skeleton mientras carga', async () => {
    const w = await freshShell({ loading: true })
    await flushPromises()
    expect(w.find('.widget-shell__skeleton').exists()).toBe(true)
  })

  it('muestra mensaje sin conexión cuando HA no está conectada', async () => {
    const w = await freshShell({ connected: false, loading: false })
    await flushPromises()
    expect(w.find('.widget-shell__offline').exists()).toBe(true)
  })

  it('muestra mensaje no disponible cuando la entidad es unavailable', async () => {
    const w = await freshShell({ connected: true, entityState: 'unavailable' })
    await flushPromises()
    expect(w.find('.widget-shell__unavailable').exists()).toBe(true)
  })

  it('muestra mensaje no disponible cuando la entidad no existe en HA', async () => {
    const w = await freshShell({ connected: true, entityState: null })
    await flushPromises()
    expect(w.find('.widget-shell__unavailable').exists()).toBe(true)
  })

  it('renderiza el componente del widget cuando todo está disponible', async () => {
    const w = await freshShell({ connected: true, entityState: 'on' })
    await flushPromises()
    expect(w.find('.inner-widget').exists()).toBe(true)
  })
})
