<script setup>
import { computed } from 'vue'
import { useVoice } from '../composables/useVoice.js'

const { current, transcript, response } = useVoice()

const showTranscript = computed(() =>
  !!transcript.value && (current.value === 'thinking' || current.value === 'response')
)
const showResponse = computed(() =>
  !!response.value && current.value === 'response'
)
const showDots = computed(() => current.value === 'thinking')
</script>

<template>
  <div class="conversation" :class="`s-${current}`">

    <Transition name="bubble">
      <div v-if="showTranscript" class="bubble bubble--user">
        <span class="bubble__label">tú</span>
        <p class="bubble__text">{{ transcript }}</p>
      </div>
    </Transition>

    <Transition name="dots">
      <div v-if="showDots" class="thinking-dots">
        <span></span><span></span><span></span>
      </div>
    </Transition>

    <Transition name="bubble">
      <div v-if="showResponse" class="bubble bubble--jota">
        <span class="bubble__label">jota</span>
        <p class="bubble__text">{{ response }}</p>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
.conversation {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  height: 100%;
}

/* Burbujas — sin caja, texto limpio */
.bubble { display: flex; flex-direction: column; gap: 0.5rem; }

.bubble__label {
  font-size: var(--text-sm);
  font-weight: var(--fw-medium);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.25);
}
.bubble--user .bubble__text {
  font-size: var(--text-xl);
  font-weight: var(--fw-light);
  color: rgba(255,255,255,0.45);
  line-height: 1.4;
}
.bubble--jota .bubble__text {
  font-size: clamp(1.6rem, 4vmin, 2.2rem);
  font-weight: var(--fw-light);
  color: rgba(255,255,255,0.88);
  line-height: 1.45;
}

/* Puntos de thinking */
.thinking-dots {
  display: flex;
  gap: 0.4rem;
  padding: 0.5rem 0;
}
.thinking-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-2);
  animation: dot-pulse 1.4s ease-in-out infinite;
}
.thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
.thinking-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes dot-pulse {
  0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
  40%           { opacity: 1;    transform: scale(1); }
}

/* Transiciones Vue */
.bubble-enter-active { transition: opacity var(--dur-slow) var(--ease-out), transform var(--dur-slow) var(--ease-out); }
.bubble-leave-active { transition: opacity var(--dur-normal) var(--ease-in), transform var(--dur-normal) var(--ease-in); }
.bubble-enter-from   { opacity: 0; transform: translateY(12px); }
.bubble-leave-to     { opacity: 0; transform: translateY(-8px); }

.dots-enter-active, .dots-leave-active { transition: opacity var(--dur-normal) var(--ease-in-out); }
.dots-enter-from, .dots-leave-to       { opacity: 0; }
</style>
