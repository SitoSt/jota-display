<script setup>
import { computed } from 'vue'
import { useChat } from '../../composables/useChat.js'

const { session, historyVisible, newSession, showHistory, hideHistory } = useChat()

const hasHistory   = computed(() => session.value.messages.length > 0)
const showNewBtn   = computed(() => historyVisible.value && hasHistory.value)
const showCloseBtn = computed(() => historyVisible.value)
const showOpenBtn  = computed(() => !historyVisible.value && hasHistory.value)
</script>

<template>
  <div class="session-controls">

    <!-- Botón cerrar — sale como burbuja desde el botón nueva sesión -->
    <Transition name="ctrl-close">
      <button
        v-if="showCloseBtn"
        class="session-btn"
        aria-label="Cerrar conversación"
        title="Cerrar conversación"
        @click="hideHistory"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </Transition>

    <!-- Botón nueva conversación -->
    <Transition name="ctrl-fade">
      <button
        v-if="showNewBtn"
        class="session-btn"
        aria-label="Nueva conversación"
        title="Nueva conversación"
        @click="newSession"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          <line x1="12" y1="9" x2="12" y2="15"/>
          <line x1="9" y1="12" x2="15" y2="12"/>
        </svg>
      </button>
    </Transition>

    <!-- Botón ver historial -->
    <Transition name="ctrl-fade">
      <button
        v-if="showOpenBtn"
        class="session-btn"
        aria-label="Ver conversación"
        title="Ver conversación"
        @click="showHistory"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
    </Transition>

  </div>
</template>

<style scoped>
.session-controls {
  position: absolute;
  top: calc(var(--strip-h, 54px) + 12px);
  right: 1rem;
  z-index: 5;
  display: flex;
  flex-direction: row-reverse; /* nueva sesión queda a la derecha; cerrar crece hacia la izquierda */
  gap: 6px;
}

.session-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.35);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--dur-fast), color var(--dur-fast);
  -webkit-tap-highlight-color: transparent;
}
.session-btn:hover { background: rgba(255,255,255,0.09); color: rgba(255,255,255,0.7); }

/* ── Cerrar: burbuja que nace del botón de la derecha ── */
.ctrl-close-enter-active {
  animation: bubble-bloom 0.38s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-origin: right center;
}
.ctrl-close-leave-active {
  animation: bubble-shrink 0.2s cubic-bezier(0.4, 0, 1, 1) forwards;
  transform-origin: right center;
}

@keyframes bubble-bloom {
  0%   { opacity: 0; transform: scale(0); }
  55%  { opacity: 1; }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes bubble-shrink {
  from { opacity: 1; transform: scale(1); }
  to   { opacity: 0; transform: scale(0); }
}

/* ── Fade para los demás botones ── */
.ctrl-fade-enter-active { transition: opacity var(--dur-fast) var(--ease-out); }
.ctrl-fade-leave-active { transition: opacity var(--dur-fast) var(--ease-in); }
.ctrl-fade-enter-from, .ctrl-fade-leave-to { opacity: 0; }
</style>
