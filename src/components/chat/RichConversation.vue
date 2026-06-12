<script setup>
import { ref, watch, nextTick } from 'vue'
import { useChat } from '../../composables/useChat.js'
import MessageBubble from './MessageBubble.vue'
import ThinkingBlock from './blocks/ThinkingBlock.vue'

const { session, isThinking } = useChat()

const scrollEl    = ref(null)
let userScrolled  = false

function onScroll() {
  if (!scrollEl.value) return
  const { scrollTop, scrollHeight, clientHeight } = scrollEl.value
  userScrolled = scrollHeight - scrollTop - clientHeight > 48
}

async function scrollToBottom() {
  if (userScrolled) return
  await nextTick()
  if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
}

watch(() => session.value.messages.length, scrollToBottom)
watch(isThinking, (v) => { if (v) { userScrolled = false; scrollToBottom() } })
</script>

<template>
  <div class="rich-conv">
    <div class="rich-conv__scroll" ref="scrollEl" @scroll.passive="onScroll">
      <TransitionGroup
        tag="div"
        class="rich-conv__messages"
        name="bubble"
      >
        <MessageBubble
          v-for="msg in session.messages"
          :key="msg.id"
          :message="msg"
        />
        <ThinkingBlock v-if="isThinking" key="thinking" />
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
.rich-conv {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  position: relative;
}

/* Fade superior — indica que hay más mensajes arriba */
.rich-conv::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 64px;
  background: linear-gradient(to bottom, var(--bg), transparent);
  pointer-events: none;
  z-index: 1;
}

.rich-conv__scroll {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  scrollbar-width: none;
}
.rich-conv__scroll::-webkit-scrollbar { display: none; }

.rich-conv__messages {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  padding: 64px 0 0.5rem;
}

.bubble-enter-active { transition: opacity var(--dur-slow) var(--ease-out), transform var(--dur-slow) var(--ease-out); }
.bubble-leave-active { transition: opacity var(--dur-normal) var(--ease-in); }
.bubble-enter-from   { opacity: 0; transform: translateY(12px); }
.bubble-leave-to     { opacity: 0; }
</style>
