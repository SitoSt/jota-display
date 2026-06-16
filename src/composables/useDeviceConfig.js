import { ref, readonly } from 'vue'

const DEFAULTS = { name: '', fully: { url: 'http://localhost:2323' }, screenTimeout: 8 }

const name          = ref(DEFAULTS.name)
const fullyUrl      = ref(DEFAULTS.fully.url)
const screenTimeout = ref(DEFAULTS.screenTimeout)

async function loadDeviceConfig() {
  try {
    const res = await fetch('/config/device.json')
    if (!res.ok) return
    const cfg = await res.json()
    name.value          = cfg.name          ?? DEFAULTS.name
    fullyUrl.value      = cfg.fully?.url    ?? DEFAULTS.fully.url
    screenTimeout.value = cfg.screenTimeout ?? DEFAULTS.screenTimeout
  } catch {}
}

async function saveDeviceConfig(patch) {
  if ('name' in patch)          name.value          = patch.name
  if ('screenTimeout' in patch) screenTimeout.value = patch.screenTimeout
  if ('fully' in patch && 'url' in patch.fully) fullyUrl.value = patch.fully.url
  try {
    await fetch('/config/device.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.value,
        fully: { url: fullyUrl.value },
        screenTimeout: screenTimeout.value,
      }),
    })
  } catch {}
}

export { loadDeviceConfig, saveDeviceConfig }

export function useDeviceConfig() {
  return { name: readonly(name), fullyUrl: readonly(fullyUrl), screenTimeout: readonly(screenTimeout), saveDeviceConfig, loadDeviceConfig }
}
