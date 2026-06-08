import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/views/MainView.vue', () => ({ default: { template: '<div/>' } }))

describe('router', () => {
  it('tiene la ruta raíz /', async () => {
    const { router } = await import('../src/router.js')
    const paths = router.getRoutes().map(r => r.path)
    expect(paths).toContain('/')
  })

  it('no tiene rutas /widgets, /config ni /widgets/browser', async () => {
    const { router } = await import('../src/router.js')
    const paths = router.getRoutes().map(r => r.path)
    expect(paths).not.toContain('/widgets')
    expect(paths).not.toContain('/config')
    expect(paths).not.toContain('/widgets/browser')
  })
})
