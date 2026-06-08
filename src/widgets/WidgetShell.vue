<!-- src/widgets/WidgetShell.vue -->
<script setup>
import { computed, shallowRef } from 'vue'
import { useHA } from '../composables/useHA.js'
import WidgetRenderer from './WidgetRenderer.vue'

const props = defineProps({
  config:     { type: Object, required: true },
  definition: { type: Object, required: true },
})

const { entities, connected, loading } = useHA()

const entityState = computed(() => entities.value[props.config.entity] ?? null)
const isLoading   = computed(() => loading.value)
const isConnected = computed(() => connected.value)
const isAvailable = computed(() =>
  entityState.value !== null && entityState.value.state !== 'unavailable'
)

const fields = computed(() => {
  if (!entityState.value || !props.definition.fields) return null
  return Object.fromEntries(
    Object.entries(props.definition.fields).map(([key, fn]) => [
      key, fn(entityState.value, props.config)
    ])
  )
})

const resolvedComponent = shallowRef(null)
if (props.definition.component) {
  props.definition.component().then(m => { resolvedComponent.value = m.default })
}

const size = computed(() =>
  props.config.size ?? props.definition.defaultSize ?? 'small'
)
</script>

<template>
  <div class="widget-shell">
    <div v-if="isLoading" class="widget-shell__skeleton" />

    <div v-else-if="!isConnected" class="widget-shell__offline">
      Sin conexión
    </div>

    <div v-else-if="!isAvailable" class="widget-shell__unavailable">
      No disponible
    </div>

    <template v-else>
      <component
        v-if="resolvedComponent"
        :is="resolvedComponent"
        :config="config"
        :size="size"
      />
      <WidgetRenderer
        v-else-if="fields"
        :fields="fields"
        :config="config"
      />
    </template>
  </div>
</template>

<style scoped>
.widget-shell {
  width: 100%;
  height: 100%;
}

.widget-shell__skeleton {
  width: 100%;
  height: 100%;
  min-height: 80px;
  border-radius: 14px;
  background: linear-gradient(90deg, var(--surface) 25%, var(--surface-2) 50%, var(--surface) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease infinite;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.widget-shell__offline,
.widget-shell__unavailable {
  width: 100%;
  height: 100%;
  min-height: 80px;
  border-radius: 14px;
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
</style>
