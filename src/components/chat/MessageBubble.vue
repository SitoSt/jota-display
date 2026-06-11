<script setup>
import TextBlock     from './blocks/TextBlock.vue'
import ThinkingBlock from './blocks/ThinkingBlock.vue'
import ToolBlock     from './blocks/ToolBlock.vue'
import MarkdownBlock from './blocks/MarkdownBlock.vue'
import ImageBlock    from './blocks/ImageBlock.vue'
import CodeBlock     from './blocks/CodeBlock.vue'

defineProps({
  message: { type: Object, required: true },
})

const BLOCK = {
  text:     TextBlock,
  thinking: ThinkingBlock,
  tool:     ToolBlock,
  markdown: MarkdownBlock,
  image:    ImageBlock,
  code:     CodeBlock,
}
</script>

<template>
  <div class="msg-bubble" :class="`msg-bubble--${message.role}`">
    <span class="msg-bubble__label">{{ message.role === 'user' ? 'tú' : 'jota' }}</span>
    <div class="msg-bubble__blocks">
      <component
        v-for="(block, i) in message.blocks"
        :key="i"
        :is="BLOCK[block.type] ?? TextBlock"
        v-bind="block"
      />
    </div>
  </div>
</template>

<style scoped>
.msg-bubble {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.msg-bubble__label {
  font-size: var(--text-sm);
  font-weight: var(--fw-medium);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.25);
}

.msg-bubble__blocks {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.msg-bubble--user .msg-bubble__blocks {
  opacity: 0.5;
}
</style>
