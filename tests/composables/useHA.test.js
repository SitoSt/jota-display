import { describe, it, expect, vi, afterEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'

async function freshUseHA(mockConfig = { url: 'http://ha:8123', token: 'tok' }) {
  vi.resetModules()

  const mockConn = {}
  const mockHaCallService = vi.fn(() => Promise.resolve())
  let entitiesCallback = null

  globalThis.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(mockConfig) })
  )

  vi.doMock('home-assistant-js-websocket', () => ({
    createLongLivedTokenAuth: vi.fn((url, token) => ({ url, token })),
    createConnection:         vi.fn(() => Promise.resolve(mockConn)),
    subscribeEntities:        vi.fn((conn, cb) => { entitiesCallback = cb }),
    callService:              mockHaCallService,
  }))

  const { useHA } = await import('../../src/composables/useHA.js')
  return { useHA, mockConn, mockHaCallService, getEntitiesCallback: () => entitiesCallback }
}

afterEach(() => vi.resetModules())

describe('useHA — estado inicial', () => {
  it('entities empieza vacío', async () => {
    const { useHA } = await freshUseHA()
    const { entities } = useHA()
    expect(entities.value).toEqual({})
  })

  it('connected empieza en false', async () => {
    const { useHA } = await freshUseHA()
    const { connected } = useHA()
    expect(connected.value).toBe(false)
  })
})

describe('useHA — conexión', () => {
  it('se conecta automáticamente al llamar useHA()', async () => {
    const { useHA } = await freshUseHA()
    useHA()
    await flushPromises()
    expect(globalThis.fetch).toHaveBeenCalledWith('/config/ha.json')
  })

  it('connected pasa a true tras conectarse', async () => {
    const { useHA } = await freshUseHA()
    const { connected } = useHA()
    await flushPromises()
    expect(connected.value).toBe(true)
  })

  it('entities se actualiza cuando llega la suscripción', async () => {
    const { useHA, getEntitiesCallback } = await freshUseHA()
    const { entities } = useHA()
    await flushPromises()
    getEntitiesCallback()({ 'light.salon': { state: 'on', attributes: {} } })
    expect(entities.value['light.salon'].state).toBe('on')
  })

  it('si fetch falla, no lanza — connected queda false', async () => {
    const { useHA } = await freshUseHA()
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('404')))
    vi.resetModules()
    vi.doMock('home-assistant-js-websocket', () => ({
      createLongLivedTokenAuth: vi.fn(),
      createConnection: vi.fn(),
      subscribeEntities: vi.fn(),
      callService: vi.fn(),
    }))
    const { useHA: freshFn } = await import('../../src/composables/useHA.js')
    const { connected } = freshFn()
    await flushPromises()
    expect(connected.value).toBe(false)
  })
})

describe('useHA — callService', () => {
  it('delega a haCallService con conn, domain, service, data', async () => {
    const { useHA, mockConn, mockHaCallService } = await freshUseHA()
    const { callService } = useHA()
    await flushPromises()
    await callService('light', 'turn_on', { entity_id: 'light.salon' })
    expect(mockHaCallService).toHaveBeenCalledWith(
      mockConn, 'light', 'turn_on', { entity_id: 'light.salon' }
    )
  })

  it('no lanza si no hay conexión', async () => {
    const { useHA } = await freshUseHA()
    // Resetear para que no conecte
    vi.resetModules()
    vi.doMock('home-assistant-js-websocket', () => ({
      createLongLivedTokenAuth: vi.fn(),
      createConnection: vi.fn(() => Promise.reject(new Error('conn fail'))),
      subscribeEntities: vi.fn(),
      callService: vi.fn(),
    }))
    const { useHA: freshFn } = await import('../../src/composables/useHA.js')
    const { callService } = freshFn()
    await flushPromises()
    await expect(callService('light', 'turn_on', {})).resolves.toBeUndefined()
  })
})
