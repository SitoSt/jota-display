import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

async function freshHA() {
  vi.resetModules()
  return import('../../src/composables/useHAConfig.js')
}

describe('useHAConfig', () => {
  let mod

  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn())
    mod = await freshHA()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('url inicia vacía', () => {
    const { url } = mod.useHAConfig()
    expect(url.value).toBe('')
  })

  it('loadHAConfig carga la url desde ha.json', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'http://192.168.1.10:8123', token: 'abc', satellite: 'assist_satellite.x' }),
    })
    await mod.loadHAConfig()
    const { url } = mod.useHAConfig()
    expect(url.value).toBe('http://192.168.1.10:8123')
    expect(fetch).toHaveBeenCalledWith('/config/ha.json')
  })

  it('loadHAConfig no modifica url si la respuesta falla', async () => {
    fetch.mockResolvedValueOnce({ ok: false })
    await mod.loadHAConfig()
    const { url } = mod.useHAConfig()
    expect(url.value).toBe('')
  })

  it('saveHAConfig preserva token y satellite al actualizar url', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'http://old:8123', token: 'secret', satellite: 'assist_satellite.x' }),
    })
    fetch.mockResolvedValueOnce({ ok: true })

    await mod.loadHAConfig()
    await mod.saveHAConfig({ url: 'http://new:8123' })

    const postCall = fetch.mock.calls[1]
    expect(postCall[0]).toBe('/config/ha.json')
    expect(postCall[1].method).toBe('POST')
    const body = JSON.parse(postCall[1].body)
    expect(body.url).toBe('http://new:8123')
    expect(body.token).toBe('secret')
    expect(body.satellite).toBe('assist_satellite.x')
  })

  it('saveHAConfig actualiza url reactiva localmente', async () => {
    fetch.mockResolvedValueOnce({ ok: true })
    const { url } = mod.useHAConfig()
    await mod.saveHAConfig({ url: 'http://192.168.1.50:8123' })
    expect(url.value).toBe('http://192.168.1.50:8123')
  })
})
