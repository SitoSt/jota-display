<!-- src/widgets/WidgetGrid.vue -->
<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { resolveDefinition } from './index.js'
import { useWidgets } from '../composables/useWidgets.js'
import { useGridConfig } from '../composables/useGridConfig.js'
import WidgetShell from './WidgetShell.vue'

const { widgets } = useWidgets()
const { totalCols, rowHeight, gridGap } = useGridConfig()

const gridEl = ref(null)
const containerWidth = ref(0)
let _ro = null

onMounted(() => {
  _ro = new ResizeObserver(entries => {
    containerWidth.value = entries[0].contentRect.width
  })
  if (gridEl.value) _ro.observe(gridEl.value)
})
onUnmounted(() => _ro?.disconnect())

const columnWidth = computed(() => {
  const cols = totalCols.value
  const gap  = gridGap.value
  const w    = containerWidth.value
  if (!w || !cols) return 60
  return (w - (cols - 1) * gap) / cols
})

const slots = computed(() =>
  widgets.value
    .map(w => {
      const def = resolveDefinition(w.type)
      if (!def) return null
      const cols = w.cols ?? def.defaultCols ?? 4
      const rows = w.rows ?? def.defaultRows ?? 2
      const widthPx  = cols * columnWidth.value + (cols - 1) * gridGap.value
      const heightPx = rows * rowHeight.value  + (rows - 1) * gridGap.value
      return { config: w, def, cols, rows, widthPx, heightPx }
    })
    .filter(Boolean)
)

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${totalCols.value}, 1fr)`,
  gridAutoRows:        `${rowHeight.value}px`,
  gap:                 `${gridGap.value}px`,
}))
</script>

<template>
  <div v-if="slots.length" ref="gridEl" class="widget-grid" :style="gridStyle">
    <div
      v-for="(slot, i) in slots"
      :key="slot.config.id ?? i"
      class="widget-slot"
      :style="{
        gridColumn: `span ${slot.cols}`,
        gridRow:    `span ${slot.rows}`,
      }"
    >
      <WidgetShell
        :config="slot.config"
        :definition="slot.def"
        :width-px="slot.widthPx"
        :height-px="slot.heightPx"
      />
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
