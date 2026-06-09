<!-- src/widgets/packs/home-assistant/light/LightWidget.vue -->
<script setup>
import { ref, computed } from 'vue'
import { useWidget } from '../../../../composables/useWidget.js'
import { entityToRgb } from './lightColor.js'

const props = defineProps({
  config: { type: Object, required: true },
  size:   { type: String, default: 'small' },
})

const { state, isAvailable, dispatch } = useWidget(props)

const isOn      = computed(() => state.value?.state === 'on')
const isUnavail = computed(() => !isAvailable.value)
const label     = computed(() =>
  props.config.label ??
  state.value?.attributes?.friendly_name ??
  props.config.entity
)

const brightness = computed(() => {
  const b = state.value?.attributes?.brightness
  return b != null ? Math.round(b / 2.55) : (isOn.value ? 100 : 0)
})

const hasBrightness = computed(() => state.value?.attributes?.brightness != null)

const rgb    = computed(() => entityToRgb(state.value))
const rgbStr = computed(() => rgb.value.join(','))

const widgetStyle = computed(() => {
  if (!isOn.value || isUnavail.value) return {}
  return {
    '--rgb':        rgbStr.value,
    '--brightness': brightness.value + '%',
    borderColor:    `rgba(${rgbStr.value},0.45)`,
    boxShadow:      `0 0 45px rgba(${rgbStr.value},0.18), inset 0 1px 0 rgba(${rgbStr.value},0.08)`,
  }
})

/* ── Modo de interacción ───────────────────────────── */
const mode = ref('idle')          // 'idle' | 'expand' | 'popover'
const localBrightness = ref(null)
const displayBrightness = computed(() => localBrightness.value ?? brightness.value)
const widgetRef = ref(null)

/* ── Icono — tap directo para encender/apagar ────── */
function onIconTap() {
  if (mode.value !== 'idle' || isUnavail.value) return
  isOn.value ? dispatch('light.turn_off') : dispatch('light.turn_on')
}

/* ── Puntero — distingue tap vs pulsación larga ────── */
let pressTimer = null
const LONG_MS = 420

function onPointerDown(e) {
  if (mode.value !== 'idle') return
  pressTimer = setTimeout(() => {
    pressTimer = null
    openExpand()
  }, LONG_MS)
}

function onPointerUp() {
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
    if (!isUnavail.value) openPopover()
  }
}

function onPointerCancel() {
  clearTimeout(pressTimer)
  pressTimer = null
  if (mode.value === 'expand') commitExpand()
}

/* ── Expand (pulsación larga) — slider vertical ────── */
const expandPos = ref({ bottom: 0, left: 0, width: 0 })

function openExpand() {
  if (!hasBrightness.value || isUnavail.value) return
  if (widgetRef.value) {
    const r = widgetRef.value.getBoundingClientRect()
    expandPos.value = {
      bottom: window.innerHeight - r.bottom,
      left:   r.left,
      width:  r.width,
    }
  }
  localBrightness.value = brightness.value
  mode.value = 'expand'
}

function onExpandTrackDown(e) {
  e.stopPropagation()
  e.currentTarget.setPointerCapture(e.pointerId)
  updateExpandBrightness(e)
}

function onExpandTrackMove(e) {
  if (e.buttons === 0) return
  updateExpandBrightness(e)
}

function updateExpandBrightness(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  localBrightness.value = Math.round(
    Math.min(100, Math.max(0, (1 - (e.clientY - rect.top) / rect.height) * 100))
  )
}

function commitExpand() {
  if (localBrightness.value !== null) {
    dispatch('light.turn_on', { brightness_pct: localBrightness.value })
  }
  mode.value = 'idle'
  localBrightness.value = null
}

const expandStyle = computed(() => ({
  bottom: expandPos.value.bottom + 'px',
  left:   expandPos.value.left   + 'px',
  width:  expandPos.value.width  + 'px',
  '--rgb': rgbStr.value,
}))

/* ── Popover (tap corto) ───────────────────────────── */
const popoverPos   = ref({ top: 0, left: 0 })
const popoverAbove = ref(false)

function openPopover() {
  if (widgetRef.value) {
    const r = widgetRef.value.getBoundingClientRect()
    const POPOVER_H = 300
    const spaceBelow = window.innerHeight - r.bottom
    popoverAbove.value = spaceBelow < POPOVER_H + 16
    popoverPos.value = popoverAbove.value
      ? { top: r.top - POPOVER_H - 10, left: r.left + r.width / 2 }
      : { top: r.bottom + 10,          left: r.left + r.width / 2 }
  }
  localBrightness.value = brightness.value
  mode.value = 'popover'
}

function closePopover() {
  mode.value = 'idle'
  localBrightness.value = null
}

function togglePower() {
  isOn.value ? dispatch('light.turn_off') : dispatch('light.turn_on')
  closePopover()
}

function onPopoverSliderDown(e) {
  e.stopPropagation()
  e.currentTarget.setPointerCapture(e.pointerId)
  updatePopoverBrightness(e)
}

function onPopoverSliderMove(e) {
  if (e.buttons === 0) return
  updatePopoverBrightness(e)
}

function updatePopoverBrightness(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  localBrightness.value = Math.round(
    Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))
  )
}

function commitPopoverBrightness() {
  dispatch('light.turn_on', { brightness_pct: localBrightness.value ?? brightness.value })
}

function setColor(r, g, b) {
  dispatch('light.turn_on', { rgb_color: [r, g, b] })
}

const SWATCHES = [
  [255, 200,  80],
  [255, 140,  40],
  [255,  90,  70],
  [255, 240, 200],
  [255, 255, 255],
  [200, 220, 255],
  [140, 170, 255],
  [180, 120, 255],
]

const popoverStyle = computed(() => ({
  top:             popoverPos.value.top  + 'px',
  left:            popoverPos.value.left + 'px',
  '--popover-rgb': rgbStr.value,
}))
</script>

<template>
  <div
    ref="widgetRef"
    class="light"
    :class="{ 'light--on': isOn && !isUnavail, 'light--horizontal': size === 'horizontal' }"
    :style="widgetStyle"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
  >
    <!-- Fill de brillo (sube desde abajo con el color de la luz) -->
    <div v-if="isOn && !isUnavail" class="light__fill" />

    <!-- Icono bombilla — tap directo enciende/apaga -->
    <div class="light__icon"
      @pointerdown.stop
      @pointerup.stop="onIconTap"
      @pointercancel.stop
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path
          d="M9 18h6M12 2a7 7 0 0 1 7 7c0 2.5-1.3 4.7-3.3 6H8.3A7 7 0 0 1 5 9a7 7 0 0 1 7-7z"
          :fill="isOn && !isUnavail
            ? `rgba(${rgbStr},${brightness / 100 * 0.55 + 0.1})`
            : 'rgba(255,255,255,0.10)'"
          :stroke="isOn && !isUnavail
            ? `rgba(${rgbStr},0.9)`
            : 'rgba(255,255,255,0.50)'"
          stroke-width="1.4"
          stroke-linejoin="round"
        />
        <!-- Línea de tachado cuando está apagada -->
        <line
          v-if="!isOn && !isUnavail"
          x1="4" y1="4" x2="20" y2="20"
          stroke="rgba(255,255,255,0.50)"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
    </div>

    <div v-if="isOn && !isUnavail" class="light__value">{{ brightness }}%</div>
    <div class="light__label">{{ label }}</div>

    <!-- ── Expand overlay (pulsación larga) ─────────── -->
    <Teleport to="body">
      <div v-if="mode === 'expand'" class="light-expand-overlay" @click="commitExpand" />
      <div v-if="mode === 'expand'" class="light-expand" :style="expandStyle">
        <div class="light-expand__fill" :style="{ height: displayBrightness + '%' }" />
        <div class="light-expand__header">
          <span class="light-expand__name">{{ label }}</span>
          <span class="light-expand__pct">{{ displayBrightness }}%</span>
        </div>
        <div class="light-expand__slider-wrap">
          <div
            class="light-expand__track"
            @pointerdown="onExpandTrackDown"
            @pointermove="onExpandTrackMove"
            @pointerup="commitExpand"
          >
            <div class="light-expand__track-fill" :style="{ height: displayBrightness + '%' }" />
            <div class="light-expand__thumb" :style="{ bottom: displayBrightness + '%' }" />
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── Popover (tap corto) ───────────────────────── -->
    <Teleport to="body">
      <div v-if="mode === 'popover'" class="widget-overlay" @click="closePopover" />
      <div
        v-if="mode === 'popover'"
        class="widget-popover"
        :class="{ 'widget-popover--above': popoverAbove }"
        :style="popoverStyle"
      >
        <div class="widget-popover__title">{{ label }}</div>
        <div class="widget-popover__state">
          {{ isOn && !isUnavail ? `encendida · ${brightness}%` : 'apagada' }}
        </div>

        <button
          class="widget-popover__power"
          :class="isOn ? 'widget-popover__power--on' : 'widget-popover__power--off'"
          @click.stop="togglePower"
        >
          {{ isOn ? 'Apagar' : 'Encender' }}
        </button>

        <template v-if="hasBrightness && isOn">
          <div class="widget-popover__section">Brillo</div>
          <div class="widget-popover__brightness-row">
            <div
              class="widget-popover__brightness-track"
              @pointerdown.stop="onPopoverSliderDown"
              @pointermove.stop="onPopoverSliderMove"
              @pointerup.stop="commitPopoverBrightness"
            >
              <div
                class="widget-popover__brightness-fill"
                :style="{ width: displayBrightness + '%' }"
              />
              <div
                class="widget-popover__brightness-thumb"
                :style="{ left: displayBrightness + '%' }"
              />
            </div>
            <span class="widget-popover__brightness-pct">{{ displayBrightness }}%</span>
          </div>
        </template>

        <div class="widget-popover__section">Color</div>
        <div class="widget-popover__swatches">
          <div
            v-for="([r,g,b], i) in SWATCHES"
            :key="i"
            class="widget-popover__swatch"
            :class="{ 'widget-popover__swatch--active': rgb[0]===r && rgb[1]===g && rgb[2]===b }"
            :style="{ background: `rgb(${r},${g},${b})` }"
            @click.stop="setColor(r, g, b)"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.light {
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.16);
  background: rgba(255,255,255,0.08);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 18px 12px 15px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;
  user-select: none;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
  transition:
    border-color var(--dur-normal) var(--ease-out),
    box-shadow   var(--dur-normal) var(--ease-out);
}

/* Fill que sube desde abajo */
.light__fill {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: var(--brightness, 0%);
  background: linear-gradient(
    to top,
    rgba(var(--rgb, 255,165,45), .32) 0%,
    rgba(var(--rgb, 255,165,45), .06) 100%
  );
  pointer-events: none;
  border-radius: 0 0 20px 20px;
  transition: height var(--dur-slow) var(--ease-out);
}

/* Icono — botón circular */
.light__icon {
  position: relative;
  z-index: 1;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: auto;
  margin-top: 2px;
  background: rgba(255,255,255,0.08);
  transition:
    background    var(--dur-normal) var(--ease-out),
    filter        var(--dur-normal) var(--ease-out),
    box-shadow    var(--dur-normal) var(--ease-out);
  cursor: pointer;
}

.light--on .light__icon {
  background: rgba(var(--rgb, 255,165,45), 0.18);
  box-shadow: 0 0 14px rgba(var(--rgb, 255,165,45), 0.30);
  filter: drop-shadow(0 0 6px rgba(var(--rgb, 255,165,45), .45));
}

/* Valor */
.light__value {
  position: relative;
  z-index: 1;
  font-size: var(--text-sm);
  font-weight: 300;
  letter-spacing: 0.01em;
  line-height: 1;
  color: rgba(255,255,255,0.55);
  transition: color var(--dur-normal) var(--ease-out);
}

.light--on .light__value {
  color: rgb(var(--rgb, 255,200,75));
}

/* Etiqueta */
.light__label {
  position: relative;
  z-index: 1;
  font-size: var(--text-xs);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(255,255,255,0.40);
  transition: color var(--dur-normal) var(--ease-out);
}

.light--on .light__label {
  color: rgba(var(--rgb, 255,165,45), 0.55);
}

/* ── Layout horizontal ───────────────────────────── */
.light--horizontal {
  padding: 0 18px;
  flex-direction: row;
  align-items: center;
  gap: 14px;
}

.light--horizontal .light__fill {
  top: 0;
  right: auto;
  height: 100%;
  width: var(--brightness, 0%);
  background: linear-gradient(
    to right,
    rgba(var(--rgb, 255,165,45), .32) 0%,
    rgba(var(--rgb, 255,165,45), .06) 100%
  );
  border-radius: 20px 0 0 20px;
  transition: width var(--dur-slow) var(--ease-out);
}

.light--horizontal .light__icon {
  margin-bottom: 0;
  margin-top: 0;
  flex-shrink: 0;
}

.light--horizontal .light__value {
  font-size: var(--text-base);
}

.light--horizontal .light__label {
  margin-left: auto;
}
</style>
