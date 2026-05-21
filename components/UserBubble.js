import { defineComponent, computed } from '/lib/vue.esm-browser.js'
import { store } from '/app.js'

export default defineComponent({
  name: 'UserBubble',
  setup() {
    const visible = computed(() =>
      !!store.transcript && (store.current === 'thinking' || store.current === 'response')
    )
    return { store, visible }
  },
  template: `
    <div id="user-bubble" class="bubble" :class="{ show: visible }">
      <div class="bubble-label">tú</div>
      <div class="bubble-text">{{ store.transcript }}</div>
    </div>
  `
})
