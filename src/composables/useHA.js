import { ref, readonly } from 'vue'
import {
  createConnection,
  createLongLivedTokenAuth,
  subscribeEntities,
  callService as haCallService,
} from 'home-assistant-js-websocket'

const entities  = ref({})
const connected = ref(false)
const loading   = ref(false)
let _conn        = null
let _initPromise = null

async function _init() {
  loading.value = true
  try {
    const res = await fetch('/config/ha.json')
    if (!res.ok) throw new Error('ha.json not found')
    const { url, token } = await res.json()
    const auth = createLongLivedTokenAuth(url, token)
    _conn = await createConnection({ auth })
    connected.value = true
    subscribeEntities(_conn, ents => { entities.value = ents })
  } finally {
    loading.value = false
  }
}

function _ensureInit() {
  if (!_initPromise) {
    _initPromise = _init().catch(err => {
      console.warn('[useHA]', err.message)
      _initPromise = null
    })
  }
  return _initPromise
}

export function useHA() {
  _ensureInit()

  async function callService(domain, service, data = {}) {
    if (!_conn) return
    return haCallService(_conn, domain, service, data)
  }

  return {
    entities:  readonly(entities),
    connected: readonly(connected),
    loading:   readonly(loading),
    callService,
  }
}
