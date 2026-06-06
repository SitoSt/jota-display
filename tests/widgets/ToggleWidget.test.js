// tests/widgets/ToggleWidget.test.js
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

const mockCallService = vi.fn()

function makeEntities(state = 'on', extras = {}) {
  return {
    'light.salon': {
      state,
      attributes: {
        friendly_name: 'Salón',
        brightness: 191,             // ~75%
        rgb_color: [255, 168, 50],
        ...extras,
      },
    },
  }
}

async function freshToggle(entities = makeEntities(), config = { entity: 'light.salon' }, size = 'small') {
  vi.resetModules()
  mockCallService.mockReset()

  vi.doMock('../../src/composables/useHA.js', () => ({
    useHA: () => ({
      entities:    ref(entities),
      connected:   ref(true),
      callService: mockCallService,
    }),
  }))

  const { default: ToggleWidget } = await import(
    '../../src/widgets/packs/home-assistant/ToggleWidget.vue'
  )
  return mount(ToggleWidget, {
    props:  { config, size },
    global: { stubs: { Teleport: true } },
  })
}

afterEach(() => vi.resetModules())

// ── Etiqueta ─────────────────────────────────────────────────────────────────
describe('ToggleWidget — etiqueta', () => {
  it('muestra config.label cuando está definido', async () => {
    const w = await freshToggle(makeEntities(), { entity: 'light.salon', label: 'Mi luz' })
    expect(w.text()).toContain('Mi luz')
  })

  it('muestra friendly_name cuando no hay config.label', async () => {
    const w = await freshToggle(makeEntities('on', { friendly_name: 'Habitación' }))
    expect(w.text()).toContain('Habitación')
  })

  it('muestra entity_id cuando no hay label ni friendly_name', async () => {
    const w = await freshToggle({ 'light.salon': { state: 'on', attributes: {} } })
    expect(w.text()).toContain('light.salon')
  })
})

// ── Estado visual ─────────────────────────────────────────────────────────────
describe('ToggleWidget — estado visual', () => {
  it('aplica toggle--on cuando el estado es "on"', async () => {
    const w = await freshToggle(makeEntities('on'))
    expect(w.find('.toggle--on').exists()).toBe(true)
  })

  it('aplica toggle--off cuando el estado es "off"', async () => {
    const w = await freshToggle(makeEntities('off'))
    expect(w.find('.toggle--off').exists()).toBe(true)
  })

  it('aplica toggle--unavailable cuando la entidad no existe', async () => {
    const w = await freshToggle({})
    expect(w.find('.toggle--unavailable').exists()).toBe(true)
  })

  it('aplica toggle--unavailable cuando state es "unavailable"', async () => {
    const w = await freshToggle(makeEntities('unavailable'))
    expect(w.find('.toggle--unavailable').exists()).toBe(true)
  })

  it('muestra porcentaje de brillo cuando está encendida', async () => {
    const w = await freshToggle(makeEntities('on'))
    expect(w.text()).toContain('75%')
  })

  it('muestra "OFF" cuando está apagada', async () => {
    const w = await freshToggle(makeEntities('off'))
    expect(w.text()).toContain('OFF')
  })
})

// ── Meta ─────────────────────────────────────────────────────────────────────
describe('ToggleWidget — meta', () => {
  it('exporta meta con pack, type, sizes y defaultSize', async () => {
    vi.resetModules()
    vi.doMock('../../src/composables/useHA.js', () => ({
      useHA: () => ({ entities: ref({}), connected: ref(false), callService: vi.fn() }),
    }))
    const { meta } = await import(
      '../../src/widgets/packs/home-assistant/ToggleWidget.vue'
    )
    expect(meta.pack).toBe('home-assistant')
    expect(meta.type).toBe('toggle')
    expect(meta.sizes).toContain('small')
    expect(meta.defaultSize).toBe('small')
  })
})

// ── Long press → slider ───────────────────────────────────────────────────────
describe('ToggleWidget — slider (long press)', () => {
  it('activa modo slider tras 400ms de pointerdown', async () => {
    vi.useFakeTimers()
    const w = await freshToggle(makeEntities('on'))
    await w.find('.toggle').trigger('pointerdown')
    expect(w.find('.toggle--slider').exists()).toBe(false)
    vi.advanceTimersByTime(400)
    await w.vm.$nextTick()
    expect(w.find('.toggle--slider').exists()).toBe(true)
    vi.useRealTimers()
  })

  it('no activa slider si la entidad no tiene brightness', async () => {
    vi.useFakeTimers()
    const entities = { 'light.salon': { state: 'on', attributes: { friendly_name: 'Salón' } } }
    const w = await freshToggle(entities)
    await w.find('.toggle').trigger('pointerdown')
    vi.advanceTimersByTime(400)
    await w.vm.$nextTick()
    expect(w.find('.toggle--slider').exists()).toBe(false)
    vi.useRealTimers()
  })

  it('no activa slider si la entidad no está disponible', async () => {
    vi.useFakeTimers()
    const w = await freshToggle({})
    await w.find('.toggle').trigger('pointerdown')
    vi.advanceTimersByTime(400)
    await w.vm.$nextTick()
    expect(w.find('.toggle--slider').exists()).toBe(false)
    vi.useRealTimers()
  })

  it('cancela el timer si se suelta antes de 400ms', async () => {
    vi.useFakeTimers()
    const w = await freshToggle(makeEntities('on'))
    await w.find('.toggle').trigger('pointerdown')
    vi.advanceTimersByTime(200)
    await w.find('.toggle').trigger('pointerup')
    vi.advanceTimersByTime(400)
    await w.vm.$nextTick()
    expect(w.find('.toggle--slider').exists()).toBe(false)
    vi.useRealTimers()
  })
})

// ── Tap → popover ─────────────────────────────────────────────────────────────
describe('ToggleWidget — popover (tap rápido)', () => {
  it('abre el popover tras tap rápido (pointerdown + pointerup antes de 400ms)', async () => {
    vi.useFakeTimers()
    const w = await freshToggle(makeEntities('on'))
    await w.find('.toggle').trigger('pointerdown')
    vi.advanceTimersByTime(100)
    await w.find('.toggle').trigger('pointerup')
    await w.vm.$nextTick()
    expect(w.find('.toggle--popover').exists()).toBe(true)
    vi.useRealTimers()
  })

  it('abre el popover aunque la entidad no esté disponible (feedback al usuario)', async () => {
    vi.useFakeTimers()
    const w = await freshToggle({})
    await w.find('.toggle').trigger('pointerdown')
    vi.advanceTimersByTime(100)
    await w.find('.toggle').trigger('pointerup')
    await w.vm.$nextTick()
    expect(w.find('.toggle--popover').exists()).toBe(true)
    vi.useRealTimers()
  })

  it('el popover no está abierto por defecto', async () => {
    const w = await freshToggle(makeEntities('on'))
    expect(w.find('.toggle--popover').exists()).toBe(false)
  })

  it('"Apagar" en el popover llama a turn_off', async () => {
    vi.useFakeTimers()
    const w = await freshToggle(makeEntities('on'))
    await w.find('.toggle').trigger('pointerdown')
    vi.advanceTimersByTime(100)
    await w.find('.toggle').trigger('pointerup')
    await w.vm.$nextTick()
    await w.find('[data-action="off"]').trigger('click')
    expect(mockCallService).toHaveBeenCalledWith(
      'light', 'turn_off', { entity_id: 'light.salon' }
    )
    vi.useRealTimers()
  })
})
