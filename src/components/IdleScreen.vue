<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useIdle } from '../composables/useIdle.js'

defineProps({
  compressed: { type: Boolean, default: false }
})

const { config } = useIdle()
const now = ref(new Date())
let timer

onMounted(() => { timer = setInterval(() => { now.value = new Date() }, 1000) })
onUnmounted(() => clearInterval(timer))

const timeStr = computed(() => {
  const h = now.value.getHours()
  const m = now.value.getMinutes().toString().padStart(2, '0')
  if (config.value.clockFormat === '12h') {
    return `${((h % 12) || 12)}:${m}`
  }
  return `${h.toString().padStart(2, '0')}:${m}`
})

const secondsStr = computed(() =>
  `:${now.value.getSeconds().toString().padStart(2, '0')}`
)

const dateStr = computed(() =>
  now.value.toLocaleDateString('es-ES', {
    weekday: config.value.showDayOfWeek ? 'long' : undefined,
    day: 'numeric',
    month: 'long'
  })
)
</script>

<template>
  <div class="idle-screen" :class="{ compressed }">
    <div class="idle-clock">
      <span class="idle-clock__time">{{ timeStr }}</span>
      <span v-if="config.showSeconds && !compressed" class="idle-clock__seconds">
        {{ secondsStr }}
      </span>
    </div>
    <div v-if="config.showDate && !compressed" class="idle-date">{{ dateStr }}</div>
  </div>
</template>

<style scoped>
.idle-screen {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  cursor: pointer;
}

.idle-screen.compressed {
  align-items: flex-start;
  justify-content: flex-start;
  padding: 1.25rem 1.5rem;
  z-index: 2;
}

.idle-clock {
  display: flex;
  align-items: baseline;
  gap: 0.1em;
}

.idle-clock__time {
  font-size: var(--text-display);
  font-weight: var(--fw-thin);
  color: var(--fg);
  line-height: 1;
  letter-spacing: -0.02em;
  transition: font-size var(--dur-slow) var(--ease-in-out),
              color var(--dur-slow) var(--ease-in-out);
}

.idle-screen.compressed .idle-clock__time {
  font-size: var(--text-xl);
  font-weight: var(--fw-light);
  color: var(--fg-dim);
}

.idle-clock__seconds {
  font-size: calc(var(--text-display) * 0.4);
  font-weight: var(--fw-thin);
  color: var(--fg-muted);
}

.idle-date {
  font-size: var(--text-base);
  font-weight: var(--fw-light);
  color: var(--fg-dim);
  text-transform: capitalize;
}
</style>
