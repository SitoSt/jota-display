import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

async function freshLayout() {
  vi.resetModules()
  return import('../../src/composables/useLayoutConfig.js')
}

describe('useLayoutConfig', () => {
  let mod

  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn())
    mod = await freshLayout()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('stripHeight inicia en 54', () => {
    const { stripHeight } = mod.useLayoutConfig()
    expect(stripHeight.value).toBe(54)
  })

  it('loadLayoutConfig carga la altura del strip', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ strip: { height: 72 } }),
    })
    await mod.loadLayoutConfig()
    const { stripHeight } = mod.useLayoutConfig()
    expect(stripHeight.value).toBe(72)
  })

  it('loadLayoutConfig mantiene el default si la respuesta falla', async () => {
    fetch.mockResolvedValueOnce({ ok: false })
    await mod.loadLayoutConfig()
    const { stripHeight } = mod.useLayoutConfig()
    expect(stripHeight.value).toBe(54)
  })

  it('saveLayoutConfig escribe strip.height en el JSON correcto', async () => {
    fetch.mockResolvedValueOnce({ ok: true })
    await mod.saveLayoutConfig({ stripHeight: 64 })
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body).toEqual({ strip: { height: 64 } })
  })

  it('saveLayoutConfig actualiza stripHeight reactivo localmente', async () => {
    fetch.mockResolvedValueOnce({ ok: true })
    const { stripHeight } = mod.useLayoutConfig()
    await mod.saveLayoutConfig({ stripHeight: 80 })
    expect(stripHeight.value).toBe(80)
  })
})
