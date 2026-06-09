import { ref, readonly } from 'vue'
import { subscribeHAEvents, getSatelliteEntity } from './useHA.js'

const current    = ref('idle')   // 'idle' | 'listening' | 'thinking' | 'response'
const transcript = ref('')
const response   = ref('')

// Mapa de estados del satélite HA → estados de voz internos
const HA_STATE_MAP = {
  idle:       'idle',
  listening:  'listening',
  processing: 'thinking',
  responding: 'response',
}

function applyEvent(data) {
  const s = data.state || 'idle'
  if (s === 'idle') {
    current.value    = 'idle'
    transcript.value = ''
    response.value   = ''
  } else if (s === 'listening') {
    current.value = 'listening'
  } else if (s === 'thinking') {
    current.value  = 'thinking'
    response.value = ''
    if (data.text) transcript.value = data.text
  } else if (s === 'response') {
    current.value = 'response'
    if (data.text) response.value = data.text
  }
}

let es = null
function connectSSE() {
  es = new EventSource('/events')
  es.onmessage = e => { try { applyEvent(JSON.parse(e.data)) } catch {} }
  es.onerror   = () => { es.close(); setTimeout(connectSSE, 2000) }
}

// Canal secundario: watch del satélite vía HA WebSocket.
// - Proporciona transiciones de estado rápidas (antes de que el hook dispare curl)
// - Cubre el retorno a idle, para el que no hay hook en wyoming-satellite
// - Los hooks (SSE) siguen siendo autoritativos para el texto (transcripción/respuesta)
let _haSub = null
async function connectHA() {
  const entity = getSatelliteEntity()
  if (!entity) return
  try {
    _haSub = await subscribeHAEvents(event => {
      const d = event?.data
      if (d?.entity_id !== entity) return
      const voiceState = HA_STATE_MAP[d?.new_state?.state]
      if (!voiceState) return

      if (voiceState === 'idle') {
        current.value    = 'idle'
        transcript.value = ''
        response.value   = ''
      } else {
        current.value = voiceState
      }
    }, 'state_changed')
  } catch (err) {
    console.warn('[useVoice] HA satellite tracking failed:', err.message)
  }
}

async function cancel() {
  await fetch('/state', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ state: 'idle', text: '' }),
  }).catch(() => {})
}

async function startListening() {
  await fetch('/listen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }).catch(() => {})
}

export { applyEvent }

export function useVoice() {
  return {
    current:    readonly(current),
    transcript: readonly(transcript),
    response:   readonly(response),
    connectSSE,
    connectHA,
    cancel,
    startListening,
  }
}
