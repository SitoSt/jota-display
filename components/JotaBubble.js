import { defineComponent, computed } from '/lib/vue.esm-browser.js'
import { store } from '/app.js'

export default defineComponent({
  name: 'JotaBubble',
  setup() {
    const visible = computed(() =>
      !!store.response && store.current === 'response'
    )
    return { store, visible }
  },
  template: `
    <div id="jota-bubble" class="bubble" :class="{ show: visible }">
      <div class="bubble-label">jota</div>
      <div class="bubble-text">{{ store.response }}</div>
    </div>
  `
})
