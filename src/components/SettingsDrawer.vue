<script setup>
import { ref, watch } from 'vue'
import { useLayout } from '../composables/useLayout.js'
import { useIdle } from '../composables/useIdle.js'

const open = ref(false)
const { layoutClass, saveLayout } = useLayout()
const { config, loadIdle, saveIdle } = useIdle()

const vaporPos = ref(layoutClass.value.replace('vapor-', ''))

watch(open, async (v) => {
  if (v) {
    await loadIdle()
    vaporPos.value = layoutClass.value.replace('vapor-', '')
  }
})

async function setVaporPos(pos) {
  vaporPos.value = pos
  await saveLayout(pos)
}

const idleModes = [
  { value: 'clock-widgets', label: 'Reloj + widgets' },
  { value: 'clock-weather', label: 'Reloj + tiempo'  },
  { value: 'clock',         label: 'Solo reloj'      },
  { value: 'off',           label: 'Apagar'          },
]

const timeoutOptions = [
  { value: 30,  label: '30s'   },
  { value: 60,  label: '1 min' },
  { value: 120, label: '2 min' },
  { value: 300, label: '5 min' },
  { value: 600, label: '10 min'},
  { value: 0,   label: 'Nunca' },
]

const vaporPositions = [
  { value: 'left',   label: 'Izq'    },
  { value: 'right',  label: 'Der'    },
  { value: 'top',    label: 'Arriba' },
  { value: 'bottom', label: 'Abajo'  },
]
</script>

<template>
  <button class="settings-trigger" @click="open = true" aria-label="Ajustes">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
    </svg>
  </button>

  <Transition name="drawer">
    <div v-if="open" class="drawer-overlay" @click.self="open = false">
      <div class="drawer" role="dialog" aria-label="Ajustes">

        <div class="drawer__header">
          <span class="drawer__title">Ajustes</span>
          <button class="drawer__close" @click="open = false" aria-label="Cerrar">✕</button>
        </div>

        <!-- ── Reposo ──────────────────────────────────── -->
        <section class="drawer__section">
          <h3 class="drawer__section-label">Reposo</h3>

          <div class="field">
            <label class="field__label">Pantalla en reposo</label>
            <div class="options-grid">
              <button
                v-for="m in idleModes" :key="m.value"
                class="option"
                :class="{ 'option--active': config.mode === m.value }"
                @click="saveIdle({ mode: m.value })"
              >{{ m.label }}</button>
            </div>
          </div>

          <div class="field">
            <label class="field__label">Inactividad hasta reposo</label>
            <div class="options-grid">
              <button
                v-for="t in timeoutOptions" :key="t.value"
                class="option"
                :class="{ 'option--active': config.inactivityTimeout === t.value }"
                @click="saveIdle({ inactivityTimeout: t.value })"
              >{{ t.label }}</button>
            </div>
          </div>

          <div class="field">
            <label class="field__label">Formato de hora</label>
            <div class="options-row">
              <button
                class="option"
                :class="{ 'option--active': config.clockFormat === '24h' }"
                @click="saveIdle({ clockFormat: '24h' })"
              >24h</button>
              <button
                class="option"
                :class="{ 'option--active': config.clockFormat === '12h' }"
                @click="saveIdle({ clockFormat: '12h' })"
              >12h</button>
            </div>
          </div>

          <div class="field">
            <label class="field__label">Elementos del reloj</label>
            <div class="toggles">
              <label class="toggle">
                <input type="checkbox" :checked="config.showDate"
                       @change="saveIdle({ showDate: $event.target.checked })">
                <span>Fecha</span>
              </label>
              <label class="toggle">
                <input type="checkbox" :checked="config.showDayOfWeek"
                       @change="saveIdle({ showDayOfWeek: $event.target.checked })">
                <span>Día de la semana</span>
              </label>
              <label class="toggle">
                <input type="checkbox" :checked="config.showSeconds"
                       @change="saveIdle({ showSeconds: $event.target.checked })">
                <span>Segundos</span>
              </label>
            </div>
          </div>

          <div class="field">
            <div class="field__label-row">
              <span class="field__label">Horario nocturno</span>
              <label class="toggle toggle--inline">
                <input type="checkbox" :checked="config.nightRule.enabled"
                       @change="saveIdle({ nightRule: { ...config.nightRule, enabled: $event.target.checked } })">
              </label>
            </div>
            <div v-if="config.nightRule.enabled" class="time-range">
              <span class="time-range__sep">De</span>
              <input type="time" class="time-input" :value="config.nightRule.from"
                     @change="saveIdle({ nightRule: { ...config.nightRule, from: $event.target.value } })">
              <span class="time-range__sep">a</span>
              <input type="time" class="time-input" :value="config.nightRule.to"
                     @change="saveIdle({ nightRule: { ...config.nightRule, to: $event.target.value } })">
              <span class="time-range__sep">→ apagar pantalla</span>
            </div>
          </div>
        </section>

        <!-- ── Vapor ──────────────────────────────────── -->
        <section class="drawer__section">
          <h3 class="drawer__section-label">Vapor</h3>

          <div class="field">
            <label class="field__label">Posición</label>
            <div class="options-grid">
              <button
                v-for="p in vaporPositions" :key="p.value"
                class="option"
                :class="{ 'option--active': vaporPos === p.value }"
                @click="setVaporPos(p.value)"
              >{{ p.label }}</button>
            </div>
          </div>
        </section>

        <!-- ── Sistema ────────────────────────────────── -->
        <section class="drawer__section drawer__section--muted">
          <h3 class="drawer__section-label">Sistema</h3>
          <p class="system-info">jota-display · en desarrollo</p>
        </section>

      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Trigger */
.settings-trigger {
  position: fixed;
  bottom: 1.25rem;
  left: 1.25rem;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  background: transparent;
  border: 1px solid var(--border);
  color: var(--fg-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color var(--dur-fast) var(--ease-out),
              border-color var(--dur-fast) var(--ease-out);
  z-index: 10;
  -webkit-tap-highlight-color: transparent;
}
.settings-trigger:hover { color: var(--fg-dim); border-color: var(--border-hover); }

/* Overlay */
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  align-items: stretch;
  justify-content: flex-end;
}

/* Drawer */
.drawer {
  background: var(--surface);
  border-left: 1px solid var(--border);
  width: min(360px, 100%);
  height: 100%;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--border);
}
.drawer__title {
  font-size: var(--text-base);
  font-weight: var(--fw-medium);
  color: var(--fg);
  letter-spacing: 0.04em;
}
.drawer__close {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--fg-dim);
  cursor: pointer;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Secciones */
.drawer__section {
  padding: 1.25rem 0;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}
.drawer__section--muted { border-bottom: none; }
.drawer__section-label {
  font-size: var(--text-xs);
  font-weight: var(--fw-medium);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--fg-dim);
}

/* Fields */
.field { display: flex; flex-direction: column; gap: 0.55rem; }
.field__label { font-size: var(--text-sm); color: var(--fg-dim); }
.field__label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Options */
.options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(70px, 1fr));
  gap: 0.4rem;
}
.options-row { display: flex; gap: 0.4rem; }

.option {
  padding: 0.5rem 0.6rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--fg-dim);
  font-size: var(--text-sm);
  cursor: pointer;
  text-align: center;
  transition: background var(--dur-fast) var(--ease-out),
              border-color var(--dur-fast) var(--ease-out),
              color var(--dur-fast) var(--ease-out);
  -webkit-tap-highlight-color: transparent;
}
.option:hover { background: var(--surface); border-color: var(--border-hover); color: var(--fg); }
.option--active {
  background: rgba(74, 222, 128, 0.1);
  border-color: rgba(74, 222, 128, 0.4);
  color: var(--accent);
}

/* Toggles */
.toggles { display: flex; flex-direction: column; gap: 0.5rem; }
.toggle {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
  font-size: var(--text-sm);
  color: var(--fg-dim);
}
.toggle input[type="checkbox"] { accent-color: var(--accent); cursor: pointer; }
.toggle--inline { margin: 0; }

/* Horario nocturno */
.time-range {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding-top: 0.2rem;
}
.time-range__sep { font-size: var(--text-sm); color: var(--fg-muted); }
.time-input {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--fg);
  font-size: var(--text-sm);
  padding: 0.35rem 0.5rem;
  cursor: pointer;
}
.time-input:focus { outline: none; border-color: var(--accent); }

/* Sistema */
.system-info { font-size: var(--text-sm); color: var(--fg-muted); }

/* Transición */
.drawer-enter-active { transition: opacity var(--dur-normal) var(--ease-out); }
.drawer-leave-active { transition: opacity var(--dur-fast) var(--ease-in); }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }

.drawer-enter-active .drawer { transition: transform var(--dur-normal) var(--ease-out); }
.drawer-leave-active .drawer  { transition: transform var(--dur-fast) var(--ease-in); }
.drawer-enter-from .drawer,
.drawer-leave-to .drawer      { transform: translateX(100%); }
</style>
