// tests/widgets/LightWidget.test.js
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

async function freshLight(entities = makeEntities(), config = { entity: 'light.salon' }, size = 'small') {
  vi.resetModules()
  mockCallService.mockReset()

  vi.doMock('../../src/composables/useHA.js', () => ({
    useHA: () => ({
      entities:    ref(entities),
      connected:   ref(true),
      callService: mockCallService,
    }),
  }))

  const { default: LightWidget } = await import(
    '../../src/widgets/packs/home-assistant/LightWidget.vue'
  )
  return mount(LightWidget, {
    props:  { config, size },
    global: { stubs: { Teleport: true } },
  })
}

afterEach(() => vi.resetModules())

// ── Etiqueta ─────────────────────────────────────────────────────────────────
describe('LightWidget — etiqueta', () => {
  it('muestra config.label cuando está definido', async () => {
    const w = await freshLight(makeEntities(), { entity: 'light.salon', label: 'Mi luz' })
    expect(w.text()).toContain('Mi luz')
  })

  it('muestra friendly_name cuando no hay config.label', async () => {
    const w = await freshLight(makeEntities('on', { friendly_name: 'Habitación' }))
    expect(w.text()).toContain('Habitación')
  })

  it('muestra entity_id cuando no hay label ni friendly_name', async () => {
    const w = await freshLight({ 'light.salon': { state: 'on', attributes: {} } })
    expect(w.text()).toContain('light.salon')
  })
})

// ── Estado visual ─────────────────────────────────────────────────────────────
describe('LightWidget — estado visual', () => {
  it('aplica light--on cuando el estado es "on"', async () => {
    const w = await freshLight(makeEntities('on'))
    expect(w.find('.light--on').exists()).toBe(true)
  })

  it('aplica light--off cuando el estado es "off"', async () => {
    const w = await freshLight(makeEntities('off'))
    expect(w.find('.light--off').exists()).toBe(true)
  })

  it('muestra porcentaje de brillo cuando está encendida', async () => {
    const w = await freshLight(makeEntities('on'))
    expect(w.text()).toContain('75%')
  })

  it('muestra "OFF" cuando está apagada', async () => {
    const w = await freshLight(makeEntities('off'))
    expect(w.text()).toContain('OFF')
  })
})

// ── Meta ─────────────────────────────────────────────────────────────────────
describe('LightWidget — meta', () => {
  it('exporta meta con pack, type, sizes y defaultSize', async () => {
    vi.resetModules()
    vi.doMock('../../src/composables/useHA.js', () => ({
      useHA: () => ({ entities: ref({}), connected: ref(false), callService: vi.fn() }),
    }))
    const { meta } = await import(
      '../../src/widgets/packs/home-assistant/LightWidget.vue'
    )
    expect(meta.pack).toBe('home-assistant')
    expect(meta.type).toBe('light')
    expect(meta.sizes).toContain('small')
    expect(meta.defaultSize).toBe('small')
  })
})

// ── Long press → slider ───────────────────────────────────────────────────────
describe('LightWidget — slider (long press)', () => {
  it('activa modo slider tras 400ms de pointerdown', async () => {
    vi.useFakeTimers()
    const w = await freshLight(makeEntities('on'))
    await w.find('.light').trigger('pointerdown')
    expect(w.find('.light--slider').exists()).toBe(false)
    vi.advanceTimersByTime(400)
    await w.vm.$nextTick()
    expect(w.find('.light--slider').exists()).toBe(true)
    vi.useRealTimers()
  })

  it('no activa slider si la entidad no tiene brightness', async () => {
    vi.useFakeTimers()
    const entities = { 'light.salon': { state: 'on', attributes: { friendly_name: 'Salón' } } }
    const w = await freshLight(entities)
    await w.find('.light').trigger('pointerdown')
    vi.advanceTimersByTime(400)
    await w.vm.$nextTick()
    expect(w.find('.light--slider').exists()).toBe(false)
    vi.useRealTimers()
  })

  it('no activa slider si la entidad no está disponible', async () => {
    vi.useFakeTimers()
    const w = await freshLight({})
    await w.find('.light').trigger('pointerdown')
    vi.advanceTimersByTime(400)
    await w.vm.$nextTick()
    expect(w.find('.light--slider').exists()).toBe(false)
    vi.useRealTimers()
  })

  it('cancela el timer si se suelta antes de 400ms', async () => {
    vi.useFakeTimers()
    const w = await freshLight(makeEntities('on'))
    await w.find('.light').trigger('pointerdown')
    vi.advanceTimersByTime(200)
    await w.find('.light').trigger('pointerup')
    vi.advanceTimersByTime(400)
    await w.vm.$nextTick()
    expect(w.find('.light--slider').exists()).toBe(false)
    vi.useRealTimers()
  })
})

// ── Tap → popover ─────────────────────────────────────────────────────────────
describe('LightWidget — popover (tap rápido)', () => {
  it('abre el popover tras tap rápido (pointerdown + pointerup antes de 400ms)', async () => {
    vi.useFakeTimers()
    const w = await freshLight(makeEntities('on'))
    await w.find('.light').trigger('pointerdown')
    vi.advanceTimersByTime(100)
    await w.find('.light').trigger('pointerup')
    await w.vm.$nextTick()
    expect(w.find('.light--popover').exists()).toBe(true)
    vi.useRealTimers()
  })

  it('abre el popover aunque la entidad no esté disponible (feedback al usuario)', async () => {
    vi.useFakeTimers()
    const w = await freshLight({})
    await w.find('.light').trigger('pointerdown')
    vi.advanceTimersByTime(100)
    await w.find('.light').trigger('pointerup')
    await w.vm.$nextTick()
    expect(w.find('.light--popover').exists()).toBe(true)
    vi.useRealTimers()
  })

  it('el popover no está abierto por defecto', async () => {
    const w = await freshLight(makeEntities('on'))
    expect(w.find('.light--popover').exists()).toBe(false)
  })

  it('"Apagar" en el popover llama a turn_off', async () => {
    vi.useFakeTimers()
    const w = await freshLight(makeEntities('on'))
    await w.find('.light').trigger('pointerdown')
    vi.advanceTimersByTime(100)
    await w.find('.light').trigger('pointerup')
    await w.vm.$nextTick()
    await w.find('[data-action="off"]').trigger('click')
    expect(mockCallService).toHaveBeenCalledWith(
      'light', 'turn_off', { entity_id: 'light.salon' }
    )
    vi.useRealTimers()
  })
})
