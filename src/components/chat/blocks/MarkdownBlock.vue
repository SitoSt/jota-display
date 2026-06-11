<template>
  <div class="md-block">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
    <span>Markdown</span>
  </div>
</template>

<style scoped>
.md-block {
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
