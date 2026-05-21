import { defineComponent, computed } from '/lib/vue.esm-browser.js'
import { store } from '/app.js'

export default defineComponent({
  name: 'Orb',
  setup() {
    return { store }
  },
  template: `
    <div id="orb-wrap">
      <div id="orb">
        <div id="bars">
          <div class="bar"></div>
          <div class="bar"></div>
          <div class="bar"></div>
          <div class="bar"></div>
          <div class="bar"></div>
        </div>
      </div>
    </div>
  `
})
