// src/composables/useGridConfig.js
import { ref, readonly } from 'vue'

const STORAGE_KEY = 'jota.grid'
const _cols = ref(4)   // columnas base (small ocupa 2×2, horizontal 2×1)
const _gap  = ref(8)   // px entre celdas

let _init = false

export function useGridConfig() {
  if (!_init) {
    _init = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const cfg = JSON.parse(raw)
        _cols.value = cfg.cols ?? 4
        _gap.value  = cfg.gap  ?? 8
      }
    } catch {}
    fetch('/config/grid.json')
      .then(r => r.ok ? r.json() : null)
      .then(cfg => {
        if (cfg) {
          _cols.value = cfg.cols ?? _cols.value
          _gap.value  = cfg.gap  ?? _gap.value
        }
      })
      .catch(() => {})
  }

  async function saveGrid(cols, gap = _gap.value) {
    _cols.value = cols
    _gap.value  = gap
    const body = { cols, gap }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(body))
    try {
      await fetch('/config/grid.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {}
  }

  return { gridCols: readonly(_cols), gridGap: readonly(_gap), saveGrid }
}
