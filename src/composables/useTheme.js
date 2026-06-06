export async function applyTheme() {
  const res = await fetch('/config/theme.json').catch(() => null)
  if (!res?.ok) return

  const theme = await res.json().catch(() => null)
  if (!theme) return

  const root = document.documentElement
  const set  = (k, v) => v && root.style.setProperty(k, v)

  const c = theme.colors ?? {}
  set('--bg',           c.bg)
  set('--surface',      c.surface)
  set('--surface-2',    c.surface2)
  set('--border',       c.border)
  set('--border-hover', c.borderHover)
  set('--fg',           c.fg)
  set('--fg-dim',       c.fgDim)
  set('--fg-muted',     c.fgMuted)
  set('--accent',       c.accent)
  set('--accent-2',     c.accent2)
  set('--accent-3',     c.accent3)

  const f = theme.font ?? {}
  set('--font',      f.family)
  if (f.weightLight)  root.style.setProperty('--fw-light',  String(f.weightLight))
  if (f.weightNormal) root.style.setProperty('--fw-normal', String(f.weightNormal))
}
