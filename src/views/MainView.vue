<script setup>
import { watch, onMounted } from 'vue'
import { useVoice } from '../composables/useVoice.js'
import { useIdle } from '../composables/useIdle.js'
import { useLayout } from '../composables/useLayout.js'
import { useChat } from '../composables/useChat.js'
import { applyTheme } from '../composables/useTheme.js'
import IdleScreen        from '../components/IdleScreen.vue'
import VaporStrip        from '../components/VaporStrip.vue'
import RichConversation  from '../components/chat/RichConversation.vue'
import SessionControls   from '../components/chat/SessionControls.vue'
import WidgetGrid        from '../widgets/WidgetGrid.vue'

const { connectSSE, connectHA, current } = useVoice()
const { loadIdle, idleActive, startIdleTimer, dismissIdle } = useIdle()
const { loadLayout } = useLayout()
const { historyVisible } = useChat()

watch(current, (state) => {
  if (state !== 'idle') dismissIdle()
  else startIdleTimer()
})

onMounted(async () => {
  connectSSE()
  connectHA()
  await Promise.all([loadLayout(), loadIdle(), applyTheme()])
  if ('wakeLock' in navigator) {
    const req = () => navigator.wakeLock.request('screen').catch(() => {})
    req()
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') req()
    })
  }
})
</script>

<template>
  <div class="main-view">
    <Transition name="screen-fade">
      <IdleScreen v-if="idleActive" @click="dismissIdle" />
    </Transition>

    <Transition name="screen-fade">
      <div v-if="!idleActive" class="home-layout">
        <VaporStrip />
        <SessionControls />
        <div class="content-area">
          <RichConversation v-show="historyVisible" class="content-area__transcript" />
          <WidgetGrid />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.main-view {
  position: absolute;
  inset: 0;
}
</style>
