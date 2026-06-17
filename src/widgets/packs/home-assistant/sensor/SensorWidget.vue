<!-- src/widgets/packs/home-assistant/sensor/SensorWidget.vue -->
<script setup>
import { computed } from 'vue'
import { useWidget } from '../../../../composables/useWidget.js'

const props = defineProps({
  config:    { type: Object, required: true },
  widthPx:   { type: Number, default: 0 },
  heightPx:  { type: Number, default: 0 },
  mockState: { type: Object, default: null },
})

const { state: haState, isAvailable: haIsAvail } = useWidget(props)
const state      = computed(() => props.mockState ?? haState.value)
const isAvailable = computed(() => props.mockState !== null ? true : haIsAvail.value)

const isUnavail = computed(() => !isAvailable.value)
const label = computed(() =>
  props.config.label ??
  state.value?.attributes?.friendly_name ??
  props.config.entity
)
const unit = computed(() =>
  props.config.unit ??
  state.value?.attributes?.unit_of_measurement ??
  ''
)

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

const displayValue = computed(() => {
  if (isUnavail.value) return '—'
  const raw = state.value?.state ?? '—'
  if (ISO_RE.test(raw)) {
    const d = new Date(raw)
    if (!isNaN(d)) return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }
  return raw
})

const displayUnit = computed(() => ISO_RE.test(state.value?.state ?? '') ? '' : unit.value)

const showIcon  = computed(() => props.heightPx >= 80)
const showLabel = computed(() => (props.config.showLabel ?? true) && props.heightPx >= 100)
const showState = computed(() => props.config.showState ?? true)
</script>

<template>
  <div class="sensor" :class="{ 'sensor--unavailable': isUnavail }">
    <div v-if="showIcon" class="sensor__icon">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path
          d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"
          :fill="isUnavail ? 'rgba(255,255,255,0.04)' : 'rgba(96,165,250,0.14)'"
          :stroke="isUnavail ? 'rgba(255,255,255,0.2)' : 'rgba(96,165,250,0.7)'"
          stroke-width="1.4"
        />
      </svg>
    </div>
    <div v-if="showState" class="sensor__value">
      {{ displayValue }}<span v-if="displayUnit && !isUnavail" class="sensor__unit">{{ displayUnit }}</span>
    </div>
    <div v-if="showLabel" class="sensor__label">{{ label }}</div>
  </div>
</template>

<style scoped>
.sensor {
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  border: 1px solid rgba(96,165,250,0.18);
  background: rgba(255,255,255,0.08);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 0 30px rgba(96,165,250,0.06), inset 0 1px 0 rgba(96,165,250,0.05);
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 18px 12px 15px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
}

.sensor--unavailable {
  border-color: rgba(255,255,255,0.09);
  box-shadow: none;
}

.sensor__icon {
  position: relative;
  z-index: 1;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: auto;
  margin-top: 2px;
  filter: drop-shadow(0 0 6px rgba(96,165,250,0.35));
}

.sensor--unavailable .sensor__icon {
  filter: none;
}

.sensor__value {
  position: relative;
  z-index: 1;
  font-size: var(--text-sm);
  font-weight: 300;
  color: rgb(147,210,255);
  line-height: 1;
  letter-spacing: 0.01em;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--dur-normal) var(--ease-out);
}

.sensor--unavailable .sensor__value {
  color: rgba(255,255,255,0.55);
}

.sensor__unit {
  font-size: 0.6rem;
  font-weight: 400;
  color: rgba(96,165,250,0.5);
  margin-left: 0.1rem;
  letter-spacing: 0.04em;
  vertical-align: super;
}

.sensor__label {
  position: relative;
  z-index: 1;
  font-size: var(--text-xs);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(96,165,250,0.38);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--dur-normal) var(--ease-out);
}

.sensor--unavailable .sensor__label {
  color: rgba(255,255,255,0.40);
}
</style>
