<script setup>
defineOptions({ inheritAttrs: false })
</script>

<template>
  <div class="thinking-block">
    <span/><span/><span/>
  </div>
</template>

<style scoped>
.thinking-block {
  display: flex;
  gap: 0.4rem;
  padding: 0.5rem 0;
}
.thinking-block span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-2);
  animation: dot-pulse 1.4s ease-in-out infinite;
}
.thinking-block span:nth-child(2) { animation-delay: 0.2s; }
.thinking-block span:nth-child(3) { animation-delay: 0.4s; }

@keyframes dot-pulse {
  0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
  40%           { opacity: 1;    transform: scale(1); }
}
</style>
