import { ref, readonly } from 'vue'

const DEFAULTS = {
  mode: 'clock-widgets',
  inactivityTimeout: 60,
  clockFormat: '24h',
  showSeconds: false,
  showDate: true,
  showDayOfWeek: true,
  nightRule: {
    enabled: false,
    from: '23:00',
    to: '07:00',
    action: 'off'
  }
}

const config = ref({
  ...DEFAULTS,
  nightRule: { ...DEFAULTS.nightRule }
})

const idleActive = ref(false)
let _idleTimer = null

function startIdleTimer() {
  clearTimeout(_idleTimer)
  const secs = config.value.inactivityTimeout
  if (config.value.mode === 'off' || secs <= 0) return
  _idleTimer = setTimeout(() => { idleActive.value = true }, secs * 1000)
}

function dismissIdle() {
  idleActive.value = false
  startIdleTimer()
}

async function loadIdle() {
  try {
    const r = await fetch('/config/idle.json')
    if (!r.ok) return
    const data = await r.json()
    config.value = {
      ...DEFAULTS,
      ...data,
      nightRule: { ...DEFAULTS.nightRule, ...(data.nightRule ?? {}) }
    }
  } catch {}
}

async function saveIdle(patch) {
  if (patch.nightRule) {
    config.value = {
      ...config.value,
      ...patch,
      nightRule: { ...config.value.nightRule, ...patch.nightRule }
    }
  } else {
    config.value = { ...config.value, ...patch }
  }
  try {
    await fetch('/config/idle.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config.value)
    })
  } catch {}
}

export { loadIdle, saveIdle, startIdleTimer, dismissIdle }

export function useIdle() {
  return { config: readonly(config), idleActive: readonly(idleActive), loadIdle, saveIdle, startIdleTimer, dismissIdle }
}
