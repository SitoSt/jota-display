async function loadLayout() {
  const res = await fetch('/config/layout.json').catch(() => null)
  if (!res?.ok) return
  const cfg = await res.json().catch(() => null)
  if (!cfg) return
  const h = cfg.strip?.height
  if (typeof h === 'number' && h > 0) {
    document.documentElement.style.setProperty('--strip-h', `${h}px`)
  }
}

export function useLayout() {
  return { loadLayout }
}
