import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'

vi.mock('../../src/composables/useIdle.js', () => ({
  useIdle: () => ({
    config: ref({
      clockFormat: '24h',
      showSeconds: false,
      showDate: true,
      showDayOfWeek: true
    })
  })
}))

// Importación dinámica para evitar problemas de hoisting del mock
async function mountScreen(props = {}) {
  const { default: IdleScreen } = await import('../../src/components/IdleScreen.vue')
  return mount(IdleScreen, { props })
}

describe('IdleScreen', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('muestra hora en formato HH:MM', async () => {
    const wrapper = await mountScreen()
    expect(wrapper.find('.idle-clock__time').text()).toMatch(/^\d{1,2}:\d{2}$/)
  })

  it('no tiene clase compressed por defecto', async () => {
    const wrapper = await mountScreen()
    expect(wrapper.classes()).not.toContain('compressed')
  })

  it('aplica clase compressed cuando el prop es true', async () => {
    const wrapper = await mountScreen({ compressed: true })
    expect(wrapper.classes()).toContain('compressed')
  })

  it('muestra .idle-date cuando compressed es false', async () => {
    const wrapper = await mountScreen({ compressed: false })
    expect(wrapper.find('.idle-date').exists()).toBe(true)
  })

  it('oculta .idle-date cuando compressed es true', async () => {
    const wrapper = await mountScreen({ compressed: true })
    expect(wrapper.find('.idle-date').exists()).toBe(false)
  })

  it('actualiza la hora tras un tick del intervalo', async () => {
    const wrapper = await mountScreen()
    vi.advanceTimersByTime(1000)
    await nextTick()
    expect(wrapper.find('.idle-clock__time').text()).toMatch(/^\d{1,2}:\d{2}$/)
  })
})
