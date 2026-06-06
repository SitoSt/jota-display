import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/views/MainView.vue', () => ({ default: { template: '<div/>' } }))
vi.mock('../src/views/WidgetsView.vue', () => ({ default: { template: '<div/>' } }))
vi.mock('../src/views/ConfigView.vue', () => ({ default: { template: '<div/>' } }))
vi.mock('../src/components/EntityBrowser.vue', () => ({ default: { template: '<div/>' } }))

describe('router', () => {
  it('tiene rutas /, /widgets, /config y /widgets/browser', async () => {
    const { router } = await import('../src/router.js')
    const paths = router.getRoutes().map(r => r.path)
    expect(paths).toContain('/')
    expect(paths).toContain('/widgets')
    expect(paths).toContain('/config')
    expect(paths).toContain('/widgets/browser')
  })
})
