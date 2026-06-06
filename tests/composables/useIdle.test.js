import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

async function freshIdle() {
  vi.resetModules()
  return import('../../src/composables/useIdle.js')
}

describe('useIdle', () => {
  let mod

  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn())
    vi.useFakeTimers()
    mod = await freshIdle()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('config inicia con valores por defecto', () => {
    const { config } = mod.useIdle()
    expect(config.value.mode).toBe('clock-widgets')
    expect(config.value.inactivityTimeout).toBe(60)
    expect(config.value.clockFormat).toBe('24h')
    expect(config.value.showDate).toBe(true)
    expect(config.value.showDayOfWeek).toBe(true)
    expect(config.value.showSeconds).toBe(false)
    expect(config.value.nightRule.enabled).toBe(false)
    expect(config.value.nightRule.from).toBe('23:00')
  })

  it('loadIdle fusiona datos del servidor con los defaults', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ mode: 'clock', inactivityTimeout: 300 })
    })
    await mod.loadIdle()
    const { config } = mod.useIdle()
    expect(config.value.mode).toBe('clock')
    expect(config.value.inactivityTimeout).toBe(300)
    expect(config.value.showDate).toBe(true)  // default preservado
  })

  it('loadIdle no modifica config si la respuesta falla', async () => {
    fetch.mockResolvedValueOnce({ ok: false })
    await mod.loadIdle()
    const { config } = mod.useIdle()
    expect(config.value.mode).toBe('clock-widgets')
  })

  it('loadIdle fusiona nightRule parcialmente', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ nightRule: { enabled: true } })
    })
    await mod.loadIdle()
    const { config } = mod.useIdle()
    expect(config.value.nightRule.enabled).toBe(true)
    expect(config.value.nightRule.from).toBe('23:00')  // default preservado
  })

  it('saveIdle hace POST a /config/idle.json con JSON', async () => {
    fetch.mockResolvedValueOnce({ ok: true })
    await mod.saveIdle({ mode: 'clock' })
    expect(fetch).toHaveBeenCalledWith(
      '/config/idle.json',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"mode":"clock"')
      })
    )
  })

  it('saveIdle actualiza config local antes del POST', async () => {
    fetch.mockResolvedValueOnce({ ok: true })
    const { config } = mod.useIdle()
    await mod.saveIdle({ mode: 'clock', inactivityTimeout: 300 })
    expect(config.value.mode).toBe('clock')
    expect(config.value.inactivityTimeout).toBe(300)
  })

  it('saveIdle con nightRule fusiona en lugar de reemplazar', async () => {
    fetch.mockResolvedValueOnce({ ok: true })
    const { config } = mod.useIdle()
    await mod.saveIdle({ nightRule: { enabled: true } })
    expect(config.value.nightRule.enabled).toBe(true)
    expect(config.value.nightRule.from).toBe('23:00')  // no se perdió
  })

  it('idleActive inicia en false', () => {
    const { idleActive } = mod.useIdle()
    expect(idleActive.value).toBe(false)
  })

  it('startIdleTimer activa idleActive tras inactivityTimeout segundos', async () => {
    const { idleActive } = mod.useIdle()
    mod.startIdleTimer()
    expect(idleActive.value).toBe(false)
    vi.advanceTimersByTime(60_000)
    expect(idleActive.value).toBe(true)
  })

  it('dismissIdle desactiva idleActive y reinicia el timer', async () => {
    const { idleActive } = mod.useIdle()
    mod.startIdleTimer()
    vi.advanceTimersByTime(60_000)
    expect(idleActive.value).toBe(true)
    mod.dismissIdle()
    expect(idleActive.value).toBe(false)
    vi.advanceTimersByTime(60_000)
    expect(idleActive.value).toBe(true)
  })

  it('startIdleTimer no activa idle si mode es off', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ mode: 'off' }) })
    await mod.loadIdle()
    mod.startIdleTimer()
    vi.advanceTimersByTime(120_000)
    const { idleActive } = mod.useIdle()
    expect(idleActive.value).toBe(false)
  })

  it('startIdleTimer no activa idle si inactivityTimeout es 0', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ inactivityTimeout: 0 }) })
    await mod.loadIdle()
    mod.startIdleTimer()
    vi.advanceTimersByTime(120_000)
    const { idleActive } = mod.useIdle()
    expect(idleActive.value).toBe(false)
  })
})
