<script setup>
import { computed } from 'vue'
import { useChat } from '../../composables/useChat.js'

const { session, historyVisible, newSession, showHistory } = useChat()

const hasHistory      = computed(() => session.value.messages.length > 0)
const showNewBtn      = computed(() => historyVisible.value && hasHistory.value)
const showOpenBtn     = computed(() => !historyVisible.value && hasHistory.value)
</script>

<template>
  <div class="session-controls">
    <Transition name="ctrl-fade">
      <button
        v-if="showNewBtn"
        key="new"
        class="session-btn"
        @click="newSession"
        title="Nueva conversación"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
      </button>
    </Transition>
    <Transition name="ctrl-fade">
      <button
        v-if="showOpenBtn"
        key="open"
        class="session-btn"
        @click="showHistory"
        title="Ver conversación"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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

.ctrl-fade-enter-active { transition: opacity var(--dur-fast) var(--ease-out); }
.ctrl-fade-leave-active { transition: opacity var(--dur-fast) var(--ease-in); }
.ctrl-fade-enter-from, .ctrl-fade-leave-to { opacity: 0; }
</style>
