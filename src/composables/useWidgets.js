import { ref, readonly } from 'vue'

const STORAGE_KEY = 'jota.widgets'
const widgets = ref([])

function _ensureIds(items) {
  return items.map(w => w.id ? w : { ...w, id: crypto.randomUUID() })
}

function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) widgets.value = _ensureIds(JSON.parse(raw))
  } catch {}
}

function _persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets.value))
}

async function _syncFromServer() {
  try {
    const res = await fetch('/config/widgets.json')
    if (!res.ok) return
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0 && !_mutated) {
      widgets.value = _ensureIds(data)
      _persist()
    }
  } catch {}
}

async function _pushToServer() {
  try {
    await fetch('/config/widgets.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(widgets.value),
    })
  } catch {}
}

let _initialized = false
let _mutated = false

export function useWidgets() {
  if (!_initialized) {
    _initialized = true
    _load()
    _syncFromServer()
  }

  function addWidgets(items) {
    _mutated = true
    const newWidgets = items.map(({ id: _ignored, ...rest }) => ({
      ...rest,
      id: crypto.randomUUID(),
    }))
    widgets.value = [...widgets.value, ...newWidgets]
    _persist()
    _pushToServer()
  }

  function removeWidget(id) {
    _mutated = true
    widgets.value = widgets.value.filter(w => w.id !== id)
    _persist()
    _pushToServer()
  }

  function updateWidget(id, patch) {
    _mutated = true
    widgets.value = widgets.value.map(w => w.id === id ? { ...w, ...patch, id: w.id } : w)
    _persist()
    _pushToServer()
  }

  function reorderWidgets(orderedIds) {
    _mutated = true
    const map = Object.fromEntries(widgets.value.map(w => [w.id, w]))
    widgets.value = orderedIds.map(id => map[id]).filter(Boolean)
    _persist()
    _pushToServer()
  }

  return { widgets: readonly(widgets), addWidgets, removeWidget, updateWidget, reorderWidgets }
}
