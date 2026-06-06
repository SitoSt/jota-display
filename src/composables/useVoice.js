import { ref, readonly } from 'vue'

const current    = ref('idle')   // 'idle' | 'listening' | 'thinking' | 'response'
const transcript = ref('')
const response   = ref('')

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
    cancel,
    startListening,
  }
}
