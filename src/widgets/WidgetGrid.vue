<!-- src/widgets/WidgetGrid.vue -->
<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { resolveDefinition } from './index.js'
import { useWidgets } from '../composables/useWidgets.js'
import { useGridConfig } from '../composables/useGridConfig.js'
import WidgetShell from './WidgetShell.vue'

const { widgets } = useWidgets()
const { gridCols, gridGap } = useGridConfig()

// Spans en unidades de celda base
const SPANS = {
  small:      [2, 2],
  horizontal: [2, 1],
  medium:     [4, 2],
  large:      [99, 2], // se clampea a gridCols en el template
}

// Anchura observada para calcular el tamaño de celda cuadrada
const gridRef   = ref(null)
const observedW = ref(0)

let ro = null
onMounted(() => {
  ro = new ResizeObserver(([e]) => { observedW.value = e.contentRect.width })
  ro.observe(gridRef.value)
})
onUnmounted(() => ro?.disconnect())

const cellSize = computed(() => {
  if (!observedW.value) return 64
  return (observedW.value - gridGap.value * (gridCols.value - 1)) / gridCols.value
})

const slots = computed(() =>
  widgets.value
    .map(w => {
      const def = resolveDefinition(w.type)
      if (!def) return null
      const size = w.size || def.defaultSize || 'small'
      const [colSpan, rowSpan] = SPANS[size] ?? [2, 2]
      return { config: w, def, colSpan: Math.min(colSpan, gridCols.value), rowSpan }
    })
    .filter(Boolean)
)
</script>

<template>
  <div
    v-if="slots.length"
    ref="gridRef"
    class="widget-grid"
    :style="{
      gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
      gridAutoRows: Math.floor(cellSize) + 'px',
      gap: gridGap + 'px',
    }"
  >
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
