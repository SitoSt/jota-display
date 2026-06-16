import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

async function freshDevice() {
  vi.resetModules()
  return import('../../src/composables/useDeviceConfig.js')
}

describe('useDeviceConfig', () => {
  let mod

  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn())
    mod = await freshDevice()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('inicia con valores por defecto', () => {
    const { name, fullyUrl, screenTimeout } = mod.useDeviceConfig()
    expect(name.value).toBe('')
    expect(fullyUrl.value).toBe('http://localhost:2323')
    expect(screenTimeout.value).toBe(8)
  })

  it('loadDeviceConfig carga los datos del servidor', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: 'Salón',
        fully: { url: 'http://192.168.1.5:2323' },
        screenTimeout: 30,
      }),
    })
    await mod.loadDeviceConfig()
    const { name, fullyUrl, screenTimeout } = mod.useDeviceConfig()
    expect(name.value).toBe('Salón')
    expect(fullyUrl.value).toBe('http://192.168.1.5:2323')
    expect(screenTimeout.value).toBe(30)
  })

  it('loadDeviceConfig mantiene defaults si el fichero no existe (404)', async () => {
    fetch.mockResolvedValueOnce({ status: 404, ok: false })
    await mod.loadDeviceConfig()
    const { name, fullyUrl, screenTimeout } = mod.useDeviceConfig()
    expect(name.value).toBe('')
    expect(fullyUrl.value).toBe('http://localhost:2323')
    expect(screenTimeout.value).toBe(8)
  })

  it('saveDeviceConfig({ name }) actualiza el nombre y hace POST', async () => {
    fetch.mockResolvedValueOnce({ ok: true })
    const { name } = mod.useDeviceConfig()
    await mod.saveDeviceConfig({ name: 'Habitación principal' })
    expect(name.value).toBe('Habitación principal')
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.name).toBe('Habitación principal')
  })

  it('saveDeviceConfig({ fully }) actualiza fullyUrl y hace POST', async () => {
    fetch.mockResolvedValueOnce({ ok: true })
    const { fullyUrl } = mod.useDeviceConfig()
    await mod.saveDeviceConfig({ fully: { url: 'http://192.168.1.5:2323' } })
    expect(fullyUrl.value).toBe('http://192.168.1.5:2323')
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.fully.url).toBe('http://192.168.1.5:2323')
  })

  it('saveDeviceConfig({ screenTimeout }) actualiza el timeout y hace POST', async () => {
    fetch.mockResolvedValueOnce({ ok: true })
    const { screenTimeout } = mod.useDeviceConfig()
    await mod.saveDeviceConfig({ screenTimeout: 60 })
    expect(screenTimeout.value).toBe(60)
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.screenTimeout).toBe(60)
  })
})
