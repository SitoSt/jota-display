<!-- src/widgets/WidgetGrid.vue -->
<script setup>
import { computed } from 'vue'
import { resolveDefinition } from './index.js'
import { useWidgets } from '../composables/useWidgets.js'
import WidgetShell from './WidgetShell.vue'

const { widgets } = useWidgets()

const slots = computed(() =>
  widgets.value
    .map(w => {
      const definition = resolveDefinition(w.type)
      if (!definition) return null
      return { config: w, definition }
    })
    .filter(Boolean)
)
</script>

<template>
  <div v-if="slots.length" class="widget-grid">
    <div
      v-for="(slot, i) in slots"
      :key="slot.config.id ?? i"
      class="widget-slot"
      :class="`widget-slot--${slot.config.size || slot.definition.defaultSize}`"
    >
      <WidgetShell :config="slot.config" :definition="slot.definition" />
    </div>
  </div>
</template>

<style scoped>
.widget-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: stretch;
  flex-shrink: 0;
  padding: 10px 12px 16px;
}

.widget-slot { flex-shrink: 0; position: relative; }
.widget-slot--small  { width: 120px; }
.widget-slot--medium { width: 240px; }
.widget-slot--large  { width: 100%; }
</style>
