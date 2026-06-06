<script>
export const meta = {
  pack:        'home-assistant',
  type:        'sensor',
  label:       'Sensor',
  sizes:       ['small', 'medium'],
  defaultSize: 'small',
}
</script>

<script setup>
import { computed } from 'vue'
import { useHA } from '../../../composables/useHA.js'

const props = defineProps({
  config: { type: Object, required: true },
  size:   { type: String, default: 'small' },
})

const { entities } = useHA()

const entity    = computed(() => entities.value[props.config.entity])
const isUnavail = computed(() => !entity.value || entity.value.state === 'unavailable')
const label     = computed(() =>
  props.config.label ??
  entity.value?.attributes?.friendly_name ??
  props.config.entity
)
const value = computed(() => isUnavail.value ? '—' : entity.value.state)
const unit  = computed(() =>
  props.config.unit ??
  entity.value?.attributes?.unit_of_measurement ??
  ''
)
</script>

<template>
  <div
    class="sensor"
    :class="{ 'sensor--unavailable': isUnavail }"
  >
    <div class="sensor__icon">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <path
          d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"
          fill="rgba(96,165,250,.18)"
          stroke="rgba(96,165,250,.55)"
          stroke-width="1.4"
        />
      </svg>
    </div>
    <div class="sensor__value">
      {{ value }}<span v-if="unit && !isUnavail" class="sensor__unit">{{ unit }}</span>
    </div>
    <div class="sensor__label">{{ label }}</div>
  </div>
</template>

<style scoped>
.sensor {
  position: relative;
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid rgba(96,165,250,.14);
  background: var(--surface);
  width: 110px;
  padding: 1rem 0.8rem 0.9rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
}

.sensor--unavailable { opacity: 0.28; }

.sensor__icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sensor__value {
  font-size: 0.85rem;
  font-weight: 400;
  color: rgb(147, 197, 253);
  line-height: 1;
}

.sensor__unit {
  font-size: 0.7rem;
  font-weight: 300;
  color: rgba(96,165,250,.6);
  margin-left: 0.1rem;
}

.sensor__label {
  font-size: 0.58rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(96,165,250,.35);
}
</style>
