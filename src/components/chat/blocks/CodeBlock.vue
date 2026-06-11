<script setup>
defineProps({
  content: { type: String, default: '' },
  lang:    { type: String, default: '' },
})
</script>

<template>
  <div class="code-block">
    <span v-if="lang" class="code-block__lang">{{ lang }}</span>
    <pre class="code-block__pre"><code>{{ content }}</code></pre>
  </div>
</template>

<style scoped>
.code-block {
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.09);
  background: rgba(0,0,0,0.3);
  overflow: hidden;
  max-width: 100%;
}
.code-block__lang {
  display: block;
  padding: 4px 12px;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.22);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.code-block__pre {
  margin: 0;
  padding: 12px;
  overflow-x: auto;
  font-size: 0.72rem;
  color: rgba(255,255,255,0.6);
  font-family: monospace;
  line-height: 1.5;
}
</style>
