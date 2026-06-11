<script setup>
defineProps({
  content:   { type: String,  default: '' },
  streaming: { type: Boolean, default: false },
})
</script>

<template>
  <p class="text-block">
    {{ content }}<span v-if="streaming" class="text-block__cursor" />
  </p>
</template>

<style scoped>
.text-block {
  font-size: clamp(1.4rem, 3.5vmin, 2rem);
  font-weight: 300;
  color: rgba(255,255,255,0.88);
  line-height: 1.45;
  margin: 0;
}

.text-block__cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: rgba(255,255,255,0.6);
  vertical-align: text-bottom;
  margin-left: 2px;
  animation: cursor-blink 1s step-end infinite;
}

@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
</style>
