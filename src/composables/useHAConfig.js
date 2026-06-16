import { ref, readonly } from 'vue'

const _raw = {}
const url = ref('')

async function loadHAConfig() {
  try {
    const res = await fetch('/config/ha.json')
    if (!res.ok) return
    const cfg = await res.json()
    Object.assign(_raw, cfg)
    url.value = cfg.url ?? ''
  } catch {}
}

async function saveHAConfig(patch) {
  const merged = { ..._raw, ...patch }
  Object.assign(_raw, merged)
  if ('url' in patch) url.value = patch.url
  try {
    await fetch('/config/ha.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_raw),
    })
  } catch {}
}

export { loadHAConfig, saveHAConfig }

export function useHAConfig() {
  return { url: readonly(url), saveHAConfig, loadHAConfig }
}
