// src/composables/useGridConfig.js
import { ref, readonly } from 'vue'

const STORAGE_KEY = 'jota.grid'

const _cellPx = ref(70)   // tamaño de celda base en px (2×2 = 140×140 por defecto)
const _cols   = ref(4)    // columnas base (small ocupa 2 → 2 por fila con cols=4)
const _gap    = ref(8)    // px entre celdas

let _init = false

function _load(cfg) {
  if (cfg.cellPx != null) _cellPx.value = cfg.cellPx
  if (cfg.cols   != null) _cols.value   = cfg.cols
  if (cfg.gap    != null) _gap.value    = cfg.gap
}

async function _persist() {
  const body = { cellPx: _cellPx.value, cols: _cols.value, gap: _gap.value }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(body))
  try {
    await fetch('/config/grid.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {}
}

export function useGridConfig() {
  if (!_init) {
    _init = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) _load(JSON.parse(raw))
    } catch {}
    fetch('/config/grid.json')
      .then(r => r.ok ? r.json() : null)
      .then(cfg => { if (cfg) _load(cfg) })
      .catch(() => {})
  }

  async function setCellPx(v) {
    _cellPx.value = Math.max(40, Math.min(160, v))
    await _persist()
  }

  async function setCols(v) {
    _cols.value = v
    await _persist()
  }

  async function setGap(v) {
    _gap.value = Math.max(0, Math.min(32, v))
    await _persist()
  }

  return {
    cellPx: readonly(_cellPx),
    gridCols: readonly(_cols),
    gridGap: readonly(_gap),
    setCellPx,
    setCols,
    setGap,
  }
}
