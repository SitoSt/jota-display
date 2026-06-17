<!-- src/components/SetupWizard.vue -->
<script setup>
import { ref, computed } from 'vue'
import {
  createConnection,
  createLongLivedTokenAuth,
} from 'home-assistant-js-websocket'
import { useSetup } from '../composables/useSetup.js'

const { markDone } = useSetup()

const step    = ref(1)
const haUrl   = ref('')
const haToken = ref('')
const devName = ref('')

// ── Estado de la prueba de conexión ─────────────────────────────────────────
const testState = ref('idle') // idle | testing | ok | error
const testMsg   = ref('')

const canTest   = computed(() => haUrl.value.trim() && haToken.value.trim())
const canFinish = computed(() => testState.value === 'ok')

async function testConnection() {
  testState.value = 'testing'
  testMsg.value   = ''
  let conn = null
  try {
    const url = haUrl.value.trim().replace(/\/$/, '')
    const auth = createLongLivedTokenAuth(url, haToken.value.trim())
    conn = await createConnection({ auth })
    testState.value = 'ok'
    testMsg.value   = 'Conexión exitosa'
  } catch (e) {
    testState.value = 'error'
    testMsg.value   = _friendlyError(e)
  } finally {
    try { conn?.close() } catch {}
  }
}

function _friendlyError(e) {
  const msg = String(e?.message ?? e ?? '')
  if (msg.includes('Cannot connect') || msg.includes('fetch'))
    return 'No se puede conectar — revisa la URL'
  if (msg.includes('auth_invalid') || msg.includes('401') || msg.includes('403'))
    return 'Token incorrecto'
  if (msg.includes('ERR_CANNOT_CONNECT'))
    return 'No se puede conectar — revisa la URL'
  return 'Error: ' + (msg || 'desconocido')
}

// ── Guardado y finalización ──────────────────────────────────────────────────
const saving = ref(false)

async function save(key, body) {
  await fetch(`/config/${key}.json`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

async function finish() {
  saving.value = true
  try {
    await save('ha', {
      url:   haUrl.value.trim().replace(/\/$/, ''),
      token: haToken.value.trim(),
    })
    await save('device', {
      name:          devName.value.trim() || 'jota-display',
      fully:         { url: 'http://localhost:2323' },
      screenTimeout: 300,
    })
    await save('layout', { strip: { height: 54 } })
    markDone()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="setup-screen">
    <div class="setup-card">

      <!-- Cabecera -->
      <div class="setup-header">
        <div class="setup-logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
        </div>
        <h1 class="setup-title">jota-display</h1>
        <p class="setup-sub">Configuración inicial</p>
        <div class="setup-steps">
          <div class="setup-step" :class="{ 'setup-step--done': step > 1, 'setup-step--active': step === 1 }">1</div>
          <div class="setup-step-line"/>
          <div class="setup-step" :class="{ 'setup-step--active': step === 2 }">2</div>
        </div>
      </div>

      <!-- ── Paso 1: Home Assistant ── -->
      <Transition name="step" mode="out-in">
        <div v-if="step === 1" key="step1" class="setup-body">
          <h2 class="setup-section-title">Home Assistant</h2>
          <p class="setup-section-sub">Necesitas la URL de tu servidor y un token de acceso de larga duración.</p>

          <div class="setup-field">
            <label class="setup-label">URL del servidor</label>
            <input
              v-model="haUrl"
              class="setup-input"
              type="url"
              placeholder="http://192.168.1.X:8123"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              @input="testState = 'idle'"
            />
          </div>

          <div class="setup-field">
            <label class="setup-label">
              Token de acceso
              <span class="setup-label-hint">Perfil → Seguridad → Tokens de larga duración</span>
            </label>
            <textarea
              v-model="haToken"
              class="setup-input setup-input--token"
              placeholder="eyJhbGc..."
              rows="3"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              @input="testState = 'idle'"
            />
          </div>

          <button
            class="setup-btn-test"
            :class="{
              'setup-btn-test--ok':    testState === 'ok',
              'setup-btn-test--error': testState === 'error',
            }"
            :disabled="!canTest || testState === 'testing'"
            @click="testConnection"
          >
            <svg v-if="testState === 'testing'" class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <svg v-else-if="testState === 'ok'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M5 12l5 5L20 7"/>
            </svg>
            <svg v-else-if="testState === 'error'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
            {{ testState === 'testing' ? 'Probando…' : testState === 'ok' ? 'Conectado' : testState === 'error' ? 'Reintentar' : 'Probar conexión' }}
          </button>
          <p v-if="testMsg" class="setup-test-msg" :class="{ 'setup-test-msg--error': testState === 'error' }">
            {{ testMsg }}
          </p>

          <div class="setup-footer">
            <button class="setup-btn-primary" :disabled="!canFinish" @click="step = 2">
              Continuar →
            </button>
          </div>
        </div>

        <!-- ── Paso 2: Dispositivo ── -->
        <div v-else key="step2" class="setup-body">
          <h2 class="setup-section-title">Este dispositivo</h2>
          <p class="setup-section-sub">¿Cómo quieres llamar a este panel? Puedes cambiarlo después en Ajustes.</p>

          <div class="setup-field">
            <label class="setup-label">Nombre del dispositivo</label>
            <input
              v-model="devName"
              class="setup-input"
              type="text"
              placeholder="Habitación principal"
              autocomplete="off"
            />
          </div>

          <div class="setup-footer setup-footer--two">
            <button class="setup-btn-secondary" @click="step = 1">← Volver</button>
            <button class="setup-btn-primary" :disabled="saving" @click="finish">
              <svg v-if="saving" class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              {{ saving ? 'Guardando…' : 'Finalizar' }}
            </button>
          </div>
        </div>
      </Transition>

    </div>
  </div>
</template>

<style scoped>
.setup-screen {
  position: fixed;
  inset: 0;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 24px;
}

.setup-card {
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ── Cabecera ─────────────────────────────────────────── */
.setup-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 36px;
}

.setup-logo {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255,255,255,.5);
  margin-bottom: 4px;
}

.setup-title {
  font-size: 22px;
  font-weight: 300;
  letter-spacing: -.02em;
  color: rgba(255,255,255,.88);
  margin: 0;
}

.setup-sub {
  font-size: 13px;
  color: rgba(255,255,255,.28);
  margin: 0;
}

.setup-steps {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
}

.setup-step {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,.15);
  color: rgba(255,255,255,.25);
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background .2s, border-color .2s, color .2s;
}

.setup-step--active {
  border-color: rgba(237,232,225,.5);
  color: var(--ui-accent, rgba(237,232,225,.9));
  background: rgba(237,232,225,.08);
}

.setup-step--done {
  border-color: rgba(74,222,128,.4);
  background: rgba(74,222,128,.1);
  color: #4ade80;
}

.setup-step-line {
  width: 40px;
  height: 1px;
  background: rgba(255,255,255,.1);
}

/* ── Cuerpo ───────────────────────────────────────────── */
.setup-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.setup-section-title {
  font-size: 18px;
  font-weight: 300;
  color: rgba(255,255,255,.82);
  margin: 0;
}

.setup-section-sub {
  font-size: 13px;
  color: rgba(255,255,255,.35);
  margin: 0;
  line-height: 1.5;
}

/* ── Campos ───────────────────────────────────────────── */
.setup-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setup-label {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: .1em;
  color: rgba(255,255,255,.3);
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.setup-label-hint {
  font-size: 11px;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: rgba(255,255,255,.2);
}

.setup-input {
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 10px;
  color: rgba(255,255,255,.82);
  font-size: 14px;
  font-family: var(--font);
  padding: 12px 14px;
  width: 100%;
  box-sizing: border-box;
  transition: border-color .15s;
  outline: none;
  -webkit-appearance: none;
}
.setup-input:focus { border-color: rgba(255,255,255,.25); }
.setup-input::placeholder { color: rgba(255,255,255,.18); }

.setup-input--token {
  font-family: monospace;
  font-size: 12px;
  resize: vertical;
  line-height: 1.5;
}

/* ── Botón probar ─────────────────────────────────────── */
.setup-btn-test {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 20px;
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 8px;
  color: rgba(255,255,255,.5);
  font-size: 13px;
  font-family: var(--font);
  cursor: pointer;
  transition: background .15s, border-color .15s, color .15s;
  -webkit-tap-highlight-color: transparent;
  align-self: flex-start;
}
.setup-btn-test:disabled { opacity: .4; cursor: default; }
.setup-btn-test:not(:disabled):hover { background: rgba(255,255,255,.09); color: rgba(255,255,255,.75); }
.setup-btn-test--ok {
  border-color: rgba(74,222,128,.35);
  color: #4ade80;
  background: rgba(74,222,128,.08);
}
.setup-btn-test--error {
  border-color: rgba(248,113,113,.35);
  color: #f87171;
  background: rgba(248,113,113,.07);
}

.setup-test-msg {
  font-size: 12px;
  color: rgba(74,222,128,.8);
  margin: -8px 0 0;
}
.setup-test-msg--error { color: rgba(248,113,113,.8); }

/* ── Footer ───────────────────────────────────────────── */
.setup-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.setup-footer--two {
  justify-content: space-between;
}

.setup-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 12px 28px;
  background: rgba(237,232,225,.1);
  border: 1px solid rgba(237,232,225,.3);
  border-radius: 10px;
  color: var(--ui-accent, rgba(237,232,225,.9));
  font-size: 14px;
  font-family: var(--font);
  font-weight: 500;
  cursor: pointer;
  transition: background .15s, border-color .15s;
  -webkit-tap-highlight-color: transparent;
}
.setup-btn-primary:disabled { opacity: .35; cursor: default; }
.setup-btn-primary:not(:disabled):hover { background: rgba(237,232,225,.16); border-color: rgba(237,232,225,.5); }

.setup-btn-secondary {
  padding: 12px 20px;
  background: none;
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 10px;
  color: rgba(255,255,255,.35);
  font-size: 14px;
  font-family: var(--font);
  cursor: pointer;
  transition: background .15s, color .15s;
  -webkit-tap-highlight-color: transparent;
}
.setup-btn-secondary:hover { background: rgba(255,255,255,.04); color: rgba(255,255,255,.6); }

/* ── Animación spinner ────────────────────────────────── */
.spin {
  animation: spin .7s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Transición entre pasos ───────────────────────────── */
.step-enter-active { transition: opacity .2s, transform .2s; }
.step-leave-active { transition: opacity .15s, transform .15s; }
.step-enter-from { opacity: 0; transform: translateX(20px); }
.step-leave-to  { opacity: 0; transform: translateX(-20px); }
</style>
