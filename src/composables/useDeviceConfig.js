import { ref, readonly } from 'vue'

const DEFAULTS = { name: '', fully: { url: 'http://localhost:2323' }, screenTimeout: 8 }

const _raw = { ...DEFAULTS, fully: { ...DEFAULTS.fully } }
const name         = ref(DEFAULTS.name)
const fullyUrl     = ref(DEFAULTS.fully.url)
const screenTimeout = ref(DEFAULTS.screenTimeout)

async function loadDeviceConfig() {
  try {
    const res = await fetch('/config/device.json')
    if (!res.ok) return
    const cfg = await res.json()
    Object.assign(_raw, { ...DEFAULTS, ...cfg, fully: { ...DEFAULTS.fully, ...cfg.fully } })
    name.value          = _raw.name
    fullyUrl.value      = _raw.fully.url
    screenTimeout.value = _raw.screenTimeout
  } catch {}
}

async function saveDeviceConfig(patch) {
  if ('name' in patch)         { _raw.name = patch.name; name.value = patch.name }
  if ('screenTimeout' in patch) { _raw.screenTimeout = patch.screenTimeout; screenTimeout.value = patch.screenTimeout }
  if ('fully' in patch) {
    _raw.fully = { ..._raw.fully, ...patch.fully }
    if ('url' in patch.fully) fullyUrl.value = patch.fully.url
  }
  try {
    await fetch('/config/device.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_raw),
    })
  } catch {}
}

export { loadDeviceConfig, saveDeviceConfig }

export function useDeviceConfig() {
  return { name: readonly(name), fullyUrl: readonly(fullyUrl), screenTimeout: readonly(screenTimeout), saveDeviceConfig, loadDeviceConfig }
}
