import { ref, readonly } from 'vue'

const layoutClass = ref('vapor-left')   // defecto mientras carga

async function loadLayout() {
  const res = await fetch('/config/layout.json').catch(() => null)
  if (!res?.ok) return

  const cfg = await res.json().catch(() => null)
  if (!cfg) return

  const pos = cfg.vapor?.position ?? 'left'
  const valid = ['left', 'right', 'top', 'bottom', 'center']
  if (valid.includes(pos)) layoutClass.value = `vapor-${pos}`
}

async function saveLayout(vaporPosition) {
  const cfg = { vapor: { position: vaporPosition } }
  await fetch('/config/layout.json', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(cfg),
  }).catch(() => {})
  layoutClass.value = `vapor-${vaporPosition}`
}

export function useLayout() {
  return { layoutClass: readonly(layoutClass), loadLayout, saveLayout }
}
