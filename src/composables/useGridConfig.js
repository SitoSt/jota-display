// src/composables/useGridConfig.js
import { ref, readonly } from 'vue'

const STORAGE_KEY = 'jota.grid'

const _totalCols = ref(12)
const _rowHeight  = ref(60)
const _gap        = ref(8)

let _init = false
let _dirty = false

function _load(cfg) {
  if (cfg.totalCols != null) _totalCols.value = cfg.totalCols
  if (cfg.rowHeight  != null) _rowHeight.value  = cfg.rowHeight
  if (cfg.gap        != null) _gap.value        = cfg.gap
}

async function _persist() {
  _dirty = true
  const body = { totalCols: _totalCols.value, rowHeight: _rowHeight.value, gap: _gap.value }
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
    } catch (e) {
      console.warn('[useGridConfig] localStorage corrupto:', e)
    }
    fetch('/config/grid.json')
      .then(r => r.ok ? r.json() : null)
      .then(cfg => { if (cfg && !_dirty) _load(cfg) })
      .catch(() => {})
  }

  async function setTotalCols(v) {
    _totalCols.value = Math.max(4, Math.min(24, v))
    await _persist()
  }

  async function setRowHeight(v) {
    _rowHeight.value = Math.max(40, Math.min(200, v))
    await _persist()
  }

  async function setGap(v) {
    _gap.value = Math.max(0, Math.min(32, v))
    await _persist()
  }

  return {
    totalCols: readonly(_totalCols),
    rowHeight:  readonly(_rowHeight),
    gridGap:    readonly(_gap),
    setTotalCols,
    setRowHeight,
    setGap,
  }
}
