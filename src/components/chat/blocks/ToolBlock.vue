<script setup>
defineProps({
  toolName:   { type: String, default: 'tool' },
  toolStatus: { type: String, default: 'running', validator: v => ['running', 'done', 'error'].includes(v) },
})
</script>

<template>
  <div class="tool-block" :class="`tool-block--${toolStatus}`">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
    <span class="tool-block__name">{{ toolName }}</span>
    <span class="tool-block__status">{{ toolStatus }}</span>
  </div>
</template>

<style scoped>
.tool-block {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.09);
  background: rgba(255,255,255,0.03);
  width: fit-content;
  color: rgba(255,255,255,0.3);
}
.tool-block__name   { font-size: 0.72rem; font-family: monospace; color: rgba(255,255,255,0.5); }
.tool-block__status { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.08em; }
.tool-block--running .tool-block__status { color: rgba(96,165,250,0.7); }
.tool-block--done    .tool-block__status { color: rgba(74,222,128,0.7); }
.tool-block--error   .tool-block__status { color: rgba(248,113,113,0.7); }
</style>
