<!-- src/App.vue -->
<script setup>
import { onMounted } from 'vue'
import SettingsDrawer from './components/SettingsDrawer.vue'
import SetupWizard from './components/SetupWizard.vue'
import { checkSetup, useSetup } from './composables/useSetup.js'

const { needsSetup } = useSetup()
onMounted(checkSetup)
</script>

<template>
  <div id="app">
    <template v-if="!needsSetup">
      <RouterView />
      <SettingsDrawer />
    </template>
    <SetupWizard v-else />
  </div>
</template>
