// tests/composables/useWidget.test.js
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'

const mockCallService = vi.fn()

function mockHA({ entities = {}, connected = true, loading = false } = {}) {
  return {
    entities:    ref(entities),
    connected:   ref(connected),
    loading:     ref(loading),
    callService: mockCallService,
  }
}

async function freshUseWidget(haOptions = {}, config = { entity: 'light.salon', type: 'home-assistant:light' }) {
  vi.resetModules()
  mockCallService.mockReset()
  vi.doMock('../../src/composables/useHA.js', () => ({
    useHA: () => mockHA(haOptions),
  }))
  const { useWidget } = await import('../../src/composables/useWidget.js')
  return useWidget({ config })
}

afterEach(() => vi.resetModules())

describe('useWidget — state', () => {
  it('devuelve null cuando la entidad no existe en HA', async () => {
    const w = await freshUseWidget({ entities: {} })
    expect(w.state.value).toBeNull()
  })

  it('devuelve el objeto entidad cuando existe', async () => {
    const entity = { state: 'on', attributes: { friendly_name: 'Salón' } }
    const w = await freshUseWidget({ entities: { 'light.salon': entity } })
    expect(w.state.value).toEqual(entity)
  })
})

describe('useWidget — isConnected / isLoading', () => {
  it('isConnected refleja el estado de useHA', async () => {
    const w = await freshUseWidget({ connected: false })
    expect(w.isConnected.value).toBe(false)
  })

  it('isLoading refleja el estado de useHA', async () => {
    const w = await freshUseWidget({ loading: true })
    expect(w.isLoading.value).toBe(true)
  })
})

describe('useWidget — isAvailable', () => {
  it('false cuando la entidad no existe', async () => {
    const w = await freshUseWidget({ entities: {} })
    expect(w.isAvailable.value).toBe(false)
  })

  it('false cuando el estado es "unavailable"', async () => {
    const w = await freshUseWidget({
      entities: { 'light.salon': { state: 'unavailable', attributes: {} } },
    })
    expect(w.isAvailable.value).toBe(false)
  })

  it('true cuando la entidad existe y no está unavailable', async () => {
    const w = await freshUseWidget({
      entities: { 'light.salon': { state: 'on', attributes: {} } },
    })
    expect(w.isAvailable.value).toBe(true)
  })
})

describe('useWidget — dispatch', () => {
  it('llama a callService con dominio, servicio y entity_id', async () => {
    const entity = { state: 'on', attributes: {} }
    const w = await freshUseWidget({ entities: { 'light.salon': entity }, connected: true })
    w.dispatch('light.turn_off')
    expect(mockCallService).toHaveBeenCalledWith('light', 'turn_off', { entity_id: 'light.salon' })
  })

  it('combina entity_id con extraData en el payload', async () => {
    const entity = { state: 'on', attributes: {} }
    const w = await freshUseWidget({ entities: { 'light.salon': entity }, connected: true })
    w.dispatch('light.turn_on', { brightness_pct: 80 })
    expect(mockCallService).toHaveBeenCalledWith('light', 'turn_on', {
      entity_id:      'light.salon',
      brightness_pct: 80,
    })
  })
})
