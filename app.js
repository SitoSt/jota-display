import { createApp, reactive } from '/lib/vue.esm-browser.js'
import Orb from '/components/Orb.js'
import UserBubble from '/components/UserBubble.js'
import JotaBubble from '/components/JotaBubble.js'

// Estado global reactivo — única fuente de verdad
// Cualquier componente puede importarlo y Vue actualizará la UI automáticamente
export const store = reactive({
  current: 'idle',    // 'idle' | 'listening' | 'thinking' | 'response'
  transcript: '',     // lo que dijo el usuario (estado thinking/response)
  response: '',       // respuesta de Jota (estado response)
})

// Máquina de estados: recibe un evento SSE y actualiza el store
function applyEvent(data) {
  const s = data.state || 'idle'

  if (s === 'idle') {
    store.current    = 'idle'
    store.transcript = ''
    store.response   = ''
    return
  }

  if (s === 'listening') {
    store.current = 'listening'
    return
  }

  if (s === 'thinking') {
    store.current = 'thinking'
    if (data.text) store.transcript = data.text
    store.response = ''
    return
  }

  if (s === 'response') {
    store.current = 'response'
    if (data.text) store.response = data.text
    return
  }
}

// Conexión SSE — se reconecta sola si se pierde
function connectSSE() {
  const es = new EventSource('/events')
  es.onmessage = e => {
    try { applyEvent(JSON.parse(e.data)) } catch {}
  }
  es.onerror = () => { es.close(); setTimeout(connectSSE, 2000) }
}

// Mantiene la pantalla encendida mientras la página está visible
function setupWakeLock() {
  if (!('wakeLock' in navigator)) return
  const req = () => navigator.wakeLock.request('screen').catch(() => {})
  req()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') req()
  })
}

const App = {
  components: { Orb, UserBubble, JotaBubble },

  setup() {
    connectSSE()
    setupWakeLock()
    return { store }
  },

  template: `
    <div id="root" :class="'s-' + store.current">

      <div id="sidebar">
        <Orb />
      </div>

      <div id="main">
        <UserBubble />

        <div id="dots">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>

        <div id="divider"></div>

        <JotaBubble />
      </div>

    </div>
  `
}

createApp(App).mount('#app')
