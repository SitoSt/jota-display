import { ref, readonly } from 'vue'

const DEFAULT_HEIGHT = 54

const stripHeight = ref(DEFAULT_HEIGHT)

async function loadLayoutConfig() {
  try {
    const res = await fetch('/config/layout.json')
    if (!res.ok) return
    const cfg = await res.json()
    stripHeight.value = cfg.strip?.height ?? DEFAULT_HEIGHT
  } catch {}
}

async function saveLayoutConfig(patch) {
  if ('stripHeight' in patch) stripHeight.value = patch.stripHeight
  try {
    await fetch('/config/layout.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strip: { height: stripHeight.value } }),
    })
  } catch {}
}

export { loadLayoutConfig, saveLayoutConfig }

export function useLayoutConfig() {
  return { stripHeight: readonly(stripHeight), saveLayoutConfig, loadLayoutConfig }
}
