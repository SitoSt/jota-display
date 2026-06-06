import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

function makeEntity(state = '21.3', unitAttr = '°C', friendlyName = 'Temperatura') {
  return {
    'sensor.temp': {
      state,
      attributes: { friendly_name: friendlyName, unit_of_measurement: unitAttr },
    },
  }
}

async function freshSensor(entities = makeEntity(), config = { entity: 'sensor.temp' }, size = 'small') {
  vi.resetModules()

  vi.doMock('../../src/composables/useHA.js', () => ({
    useHA: () => ({
      entities:    ref(entities),
      connected:   ref(true),
      callService: vi.fn(),
    }),
  }))

  const { default: SensorWidget } = await import(
    '../../src/widgets/packs/home-assistant/SensorWidget.vue'
  )
  return mount(SensorWidget, { props: { config, size } })
}

afterEach(() => vi.resetModules())

describe('SensorWidget — etiqueta', () => {
  it('muestra config.label cuando está definido', async () => {
    const w = await freshSensor(makeEntity(), { entity: 'sensor.temp', label: 'Exterior' })
    expect(w.text()).toContain('Exterior')
  })

  it('muestra friendly_name cuando no hay config.label', async () => {
    const w = await freshSensor(makeEntity('21.3', '°C', 'Cocina'))
    expect(w.text()).toContain('Cocina')
  })

  it('muestra el entity_id cuando no hay label ni friendly_name', async () => {
    const w = await freshSensor({ 'sensor.temp': { state: '21.3', attributes: {} } })
    expect(w.text()).toContain('sensor.temp')
  })
})

describe('SensorWidget — valor', () => {
  it('muestra el estado de la entidad', async () => {
    const w = await freshSensor(makeEntity('18.7'))
    expect(w.text()).toContain('18.7')
  })

  it('muestra la unidad de config.unit (tiene prioridad sobre HA)', async () => {
    const w = await freshSensor(makeEntity('21.3', '°C'), { entity: 'sensor.temp', unit: 'K' })
    expect(w.text()).toContain('K')
    expect(w.text()).not.toContain('°C')
  })

  it('muestra la unidad de HA cuando no hay config.unit', async () => {
    const w = await freshSensor(makeEntity('21.3', '°C'))
    expect(w.text()).toContain('°C')
  })

  it('muestra "—" cuando la entidad no existe', async () => {
    const w = await freshSensor({})
    expect(w.text()).toContain('—')
  })

  it('muestra "—" cuando state es "unavailable"', async () => {
    const w = await freshSensor(makeEntity('unavailable'))
    expect(w.text()).toContain('—')
  })
})

describe('SensorWidget — meta', () => {
  it('exporta meta con pack, type, sizes y defaultSize', async () => {
    vi.resetModules()
    vi.doMock('../../src/composables/useHA.js', () => ({
      useHA: () => ({ entities: ref({}), connected: ref(false), callService: vi.fn() }),
    }))
    const { meta } = await import(
      '../../src/widgets/packs/home-assistant/SensorWidget.vue'
    )
    expect(meta.pack).toBe('home-assistant')
    expect(meta.type).toBe('sensor')
    expect(meta.sizes).toContain('small')
    expect(meta.sizes).toContain('medium')
    expect(meta.defaultSize).toBe('small')
  })
})
