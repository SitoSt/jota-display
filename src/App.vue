<!-- src/App.vue -->
<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import SettingsDrawer from './components/SettingsDrawer.vue'
import { ROUTE_ORDER } from './router.js'

const router = useRouter()
const route  = useRoute()

const transitionName = ref('page-slide-left')

const currentIndex = computed(() => {
  const idx = ROUTE_ORDER.indexOf(route.path)
  return idx === -1 ? 1 : idx
})

// Detectar tipo de transición antes de cada navegación
router.beforeEach((to, from) => {
  if (to.path === '/widgets/browser' || from.path === '/widgets/browser') {
    transitionName.value = 'slide-up'
    return
  }
  const toIdx   = ROUTE_ORDER.indexOf(to.path)
  const fromIdx = ROUTE_ORDER.indexOf(from.path)
  transitionName.value = toIdx >= fromIdx ? 'page-slide-left' : 'page-slide-right'
})

// Swipe horizontal (solo entre páginas del carrusel)
let swipeStartX = 0
let swipeStartY = 0
let swipeActive = false

function onPointerDown(e) {
  if (route.path === '/widgets/browser') return
  swipeStartX = e.clientX
  swipeStartY = e.clientY
  swipeActive = true
}

function onPointerUp(e) {
  if (!swipeActive) return
  swipeActive = false
  const dx = e.clientX - swipeStartX
  const dy = e.clientY - swipeStartY
  if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return

  const idx = currentIndex.value
  if (dx < 0 && idx < ROUTE_ORDER.length - 1) {
    router.push(ROUTE_ORDER[idx + 1])
  } else if (dx > 0 && idx > 0) {
    router.push(ROUTE_ORDER[idx - 1])
  }
}

function onPointerCancel() {
  swipeActive = false
}
</script>

<template>
  <div
    id="app"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
  >
    <RouterView v-slot="{ Component }">
      <Transition :name="transitionName">
        <component :is="Component" :key="route.path" />
      </Transition>
    </RouterView>

    <!-- Indicador de página (solo para rutas del carrusel principal) -->
    <div
      v-if="ROUTE_ORDER.includes(route.path)"
      class="page-dots"
    >
      <div
        v-for="(_, i) in ROUTE_ORDER"
        :key="i"
        class="page-dot"
        :class="{ 'page-dot--active': i === currentIndex }"
      />
    </div>

    <SettingsDrawer />
  </div>
</template>
