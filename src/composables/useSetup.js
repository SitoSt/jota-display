// src/composables/useSetup.js
import { ref } from 'vue'

const needsSetup = ref(false)

export async function checkSetup() {
  try {
    const res = await fetch('/config/ha.json')
    if (!res.ok) { needsSetup.value = true; return }
    const cfg = await res.json()
    if (!cfg.url || !cfg.token) needsSetup.value = true
  } catch {
    needsSetup.value = true
  }
}

export function useSetup() {
  return {
    needsSetup,
    markDone() { needsSetup.value = false },
  }
}
