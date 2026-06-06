<script setup>
import { computed, watch, onMounted } from 'vue'
import { useVoice } from '../composables/useVoice.js'
import { useIdle } from '../composables/useIdle.js'
import { useLayout } from '../composables/useLayout.js'
import { applyTheme } from '../composables/useTheme.js'
import IdleScreen from '../components/IdleScreen.vue'
import Vapor from '../components/Vapor.vue'
import Conversation from '../components/Conversation.vue'
import WidgetGrid from '../widgets/WidgetGrid.vue'

const { connectSSE, current } = useVoice()
const { loadIdle, idleActive, startIdleTimer, dismissIdle } = useIdle()
const { layoutClass, loadLayout } = useLayout()

const voiceActive = computed(() => current.value !== 'idle')

watch(current, (state) => {
  if (state !== 'idle') {
    dismissIdle()
  } else {
    startIdleTimer()
  }
})

onMounted(async () => {
  connectSSE()
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
      <div v-if="!idleActive" class="home-layout" :class="layoutClass">
        <div class="vapor-area">
          <Vapor />
        </div>
        <div class="conversation-area">
          <Transition name="content-fade">
            <Conversation v-if="voiceActive" class="conversation-area__transcript" />
          </Transition>
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
