<!-- src/widgets/WidgetGrid.vue -->
<script setup>
import { computed } from 'vue'
import { resolveDefinition } from './index.js'
import { useWidgets } from '../composables/useWidgets.js'
import { useGridConfig } from '../composables/useGridConfig.js'
import WidgetShell from './WidgetShell.vue'

const { widgets } = useWidgets()
const { cellPx, gridCols, gridGap } = useGridConfig()

const SPANS = {
  small:      [2, 2],
  horizontal: [2, 1],
  medium:     [4, 2],
  large:      [99, 2],
}

const slots = computed(() =>
  widgets.value
    .map(w => {
      const def = resolveDefinition(w.type)
      if (!def) return null
      const size = w.size || def.defaultSize || 'small'
      const [col, row] = SPANS[size] ?? [2, 2]
      return { config: w, def, colSpan: Math.min(col, gridCols.value), rowSpan: row }
    })
    .filter(Boolean)
)

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${gridCols.value}, ${cellPx.value}px)`,
  gridAutoRows:        `${cellPx.value}px`,
  gap:                 `${gridGap.value}px`,
}))
</script>

<template>
  <div v-if="slots.length" class="widget-grid" :style="gridStyle">
    <div
      v-for="(slot, i) in slots"
      :key="slot.config.id ?? i"
      class="widget-slot"
      :style="{
        gridColumn: `span ${slot.colSpan}`,
        gridRow:    `span ${slot.rowSpan}`,
      }"
    >
      <WidgetShell :config="slot.config" :definition="slot.def" />
    </div>
  </div>
</template>

<style scoped>
.widget-grid {
  display: grid;
  align-content: start;
  flex-shrink: 0;
  padding: 10px 12px 16px;
}

.widget-slot {
  position: relative;
  min-width: 0;
  min-height: 0;
}
</style>
