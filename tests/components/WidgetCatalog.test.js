// tests/components/WidgetCatalog.test.js
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'

const mockAddWidgets = vi.fn()

const mockRegistry = {
  'home-assistant:light': {
    type:        'home-assistant:light',
    label:       'Luz',
    defaultSize: 'small',
    configSchema: {
      entity: { type: 'ha-entity', domain: 'light', required: true },
    },
  },
}

const mockEntities = {
  'light.salon': { entity_id: 'light.salon', state: 'on', attributes: { friendly_name: 'Salón' } },
  'sensor.temp': { entity_id: 'sensor.temp', state: '21', attributes: { friendly_name: 'Temperatura' } },
}

async function freshCatalog() {
  vi.resetModules()

  vi.doMock('../../src/composables/useHA.js', () => ({
    useHA: () => ({ entities: ref(mockEntities), connected: ref(true), callService: vi.fn() }),
  }))

  vi.doMock('../../src/composables/useWidgets.js', () => ({
    useWidgets: () => ({ addWidgets: mockAddWidgets, widgets: ref([]) }),
  }))

  vi.doMock('../../src/widgets/index.js', () => ({
    registry: mockRegistry,
  }))

  const { default: WidgetCatalog } = await import('../../src/components/WidgetCatalog.vue')
  return mount(WidgetCatalog)
}

afterEach(() => {
  vi.resetModules()
  mockAddWidgets.mockReset()
})

describe('WidgetCatalog — paso 1: catálogo de tipos', () => {
  it('muestra los tipos de widget disponibles', async () => {
    const w = await freshCatalog()
    await flushPromises()
    expect(w.text()).toContain('Luz')
  })

  it('avanza al paso 2 al seleccionar un tipo', async () => {
    const w = await freshCatalog()
    await flushPromises()
    await w.find('[data-type="home-assistant:light"]').trigger('click')
    expect(w.find('[data-step="2"]').exists()).toBe(true)
  })
})

describe('WidgetCatalog — paso 2: picker de entidad', () => {
  it('solo muestra entidades del dominio correcto', async () => {
    const w = await freshCatalog()
    await flushPromises()
    await w.find('[data-type="home-assistant:light"]').trigger('click')
    expect(w.text()).toContain('Salón')
    expect(w.text()).not.toContain('Temperatura')
  })

  it('avanza al paso 3 al seleccionar una entidad', async () => {
    const w = await freshCatalog()
    await flushPromises()
    await w.find('[data-type="home-assistant:light"]').trigger('click')
    await w.find('[data-entity="light.salon"]').trigger('click')
    expect(w.find('[data-step="3"]').exists()).toBe(true)
  })
})

describe('WidgetCatalog — paso 3: confirmar', () => {
  it('llama a addWidgets con los datos correctos al confirmar', async () => {
    const w = await freshCatalog()
    await flushPromises()
    await w.find('[data-type="home-assistant:light"]').trigger('click')
    await w.find('[data-entity="light.salon"]').trigger('click')
    await w.find('[data-action="confirm"]').trigger('click')
    expect(mockAddWidgets).toHaveBeenCalledWith([
      expect.objectContaining({
        type:   'home-assistant:light',
        entity: 'light.salon',
        size:   'small',
      }),
    ])
  })

  it('emite "done" tras confirmar', async () => {
    const w = await freshCatalog()
    await flushPromises()
    await w.find('[data-type="home-assistant:light"]').trigger('click')
    await w.find('[data-entity="light.salon"]').trigger('click')
    await w.find('[data-action="confirm"]').trigger('click')
    expect(w.emitted('done')).toBeTruthy()
  })
})
