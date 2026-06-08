<!-- src/widgets/WidgetRenderer.vue -->
<script setup>
defineProps({
  fields: { type: Object, required: true },
  config: { type: Object, required: true },
})
</script>

<template>
  <div class="widget-renderer">
    <div class="widget-renderer__value">{{ fields.value }}</div>
    <div class="widget-renderer__label">{{ fields.label }}</div>
  </div>
</template>

<style scoped>
.widget-renderer {
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--surface);
  padding: 1rem 0.8rem 0.9rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
}

.widget-renderer__value {
  font-size: 1rem;
  font-weight: 400;
  color: var(--fg);
  line-height: 1;
}

.widget-renderer__label {
  font-size: var(--text-xs);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--fg-dim);
}
</style>
