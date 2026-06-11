<script setup>
defineProps({ content: { type: String, default: '' } })
</script>

<template>
  <div class="img-block">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
    <span>{{ content || 'imagen' }}</span>
  </div>
</template>

<style scoped>
.img-block {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  border: 1px dashed rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.22);
  font-size: 0.72rem;
  width: fit-content;
}
</style>
