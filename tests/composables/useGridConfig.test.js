// tests/composables/useGridConfig.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'

const store = {}
const localStorageMock = {
  getItem:  (k) => store[k] ?? null,
  setItem:  (k, v) => { store[k] = v },
}
vi.stubGlobal('localStorage', localStorageMock)

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k])
  vi.resetModules()
  global.fetch = vi.fn().mockResolvedValue({ ok: false })
})
afterEach(() => vi.resetModules())

async function fresh() {
  const { useGridConfig } = await import('../../src/composables/useGridConfig.js')
  return useGridConfig()
}

describe('useGridConfig — valores por defecto', () => {
  it('expone totalCols con defecto 12', async () => {
    const { totalCols } = await fresh()
    expect(totalCols.value).toBe(12)
  })

  it('expone rowHeight con defecto 60', async () => {
    const { rowHeight } = await fresh()
    expect(rowHeight.value).toBe(60)
  })

  it('expone gridGap con defecto 8', async () => {
    const { gridGap } = await fresh()
    expect(gridGap.value).toBe(8)
  })

  it('NO expone cellPx ni gridCols', async () => {
    const cfg = await fresh()
    expect(cfg.cellPx).toBeUndefined()
    expect(cfg.gridCols).toBeUndefined()
  })
})

describe('useGridConfig — setters', () => {
  it('setTotalCols actualiza el valor y persiste en localStorage', async () => {
    const { totalCols, setTotalCols } = await fresh()
    await setTotalCols(16)
    expect(totalCols.value).toBe(16)
    expect(JSON.parse(store['jota.grid']).totalCols).toBe(16)
  })

  it('setRowHeight clampea a [40, 200]', async () => {
    const { rowHeight, setRowHeight } = await fresh()
    await setRowHeight(5)
    expect(rowHeight.value).toBe(40)
    await setRowHeight(999)
    expect(rowHeight.value).toBe(200)
  })

  it('setTotalCols clampea a [4, 24]', async () => {
    const { totalCols, setTotalCols } = await fresh()
    await setTotalCols(1)
    expect(totalCols.value).toBe(4)
    await setTotalCols(100)
    expect(totalCols.value).toBe(24)
  })
})

describe('useGridConfig — carga desde localStorage', () => {
  it('carga totalCols y rowHeight guardados', async () => {
    store['jota.grid'] = JSON.stringify({ totalCols: 8, rowHeight: 80, gap: 12 })
    const { totalCols, rowHeight, gridGap } = await fresh()
    expect(totalCols.value).toBe(8)
    expect(rowHeight.value).toBe(80)
    expect(gridGap.value).toBe(12)
  })
})
