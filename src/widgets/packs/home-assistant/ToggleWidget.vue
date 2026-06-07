<!-- src/widgets/packs/home-assistant/ToggleWidget.vue -->
<script>
export const meta = {
  pack:        'home-assistant',
  type:        'toggle',
  label:       'Interruptor',
  sizes:       ['small'],
  defaultSize: 'small',
}
</script>

<script setup>
import { ref, computed } from 'vue'
import { useHA } from '../../../composables/useHA.js'
import { entityToRgb } from './lightColor.js'

const props = defineProps({
  config: { type: Object, required: true },
  size:   { type: String, default: 'small' },
})

const { entities, callService } = useHA()

const entity    = computed(() => entities.value[props.config.entity])
const isOn      = computed(() => entity.value?.state === 'on')
const isUnavail = computed(() => !entity.value || entity.value.state === 'unavailable')
const label     = computed(() =>
  props.config.label ??
  entity.value?.attributes?.friendly_name ??
  props.config.entity
)

const brightness = computed(() => {
  const b = entity.value?.attributes?.brightness
  return b != null ? Math.round(b / 2.55) : (isOn.value ? 100 : 0)
})

const rgb    = computed(() => entityToRgb(entity.value))
const rgbStr = computed(() => rgb.value.join(','))

const cardStyle = computed(() =>
  isOn.value && !isUnavail.value
    ? { '--rgb': rgbStr.value, '--brightness': brightness.value + '%' }
    : {}
)

const mode = ref('idle')  // 'idle' | 'slider' | 'popover'
const localBrightness = ref(null)
const displayBrightness = computed(() => localBrightness.value ?? brightness.value)
const widgetRef = ref(null)
const popoverAbove = ref(false)

const hasBrightness = computed(() =>
  entity.value?.attributes?.brightness != null
)

let pressTimer = null

function onPointerDown(e) {
  if (mode.value !== 'idle') return
  pressTimer = setTimeout(() => {
    pressTimer = null
    if (hasBrightness.value && !isUnavail.value) {
      localBrightness.value = brightness.value
      mode.value = 'slider'
    }
  }, 400)
}

function onPointerUp() {
  if (mode.value === 'slider') {
    mode.value = 'idle'
    localBrightness.value = null
    return
  }
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
    openPopover()
  }
}

function onPointerCancel() {
  clearTimeout(pressTimer)
  pressTimer = null
  if (mode.value === 'slider') {
    mode.value = 'idle'
    localBrightness.value = null
  }
}

function onSliderPointerDown(e) {
  e.stopPropagation()
  e.currentTarget.setPointerCapture(e.pointerId)
}

function onSliderPointerMove(e) {
  if (e.buttons === 0) return
  const rect = e.currentTarget.getBoundingClientRect()
  localBrightness.value = Math.round(
    Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))
  )
}

function onSliderPointerUp() {
  callService('light', 'turn_on', {
    entity_id:      props.config.entity,
    brightness_pct: localBrightness.value,
  })
  mode.value = 'idle'
  localBrightness.value = null
}

// ── Popover ───────────────────────────────────────────────────────────────────
const popoverPos = ref({ top: 0, left: 0 })

function openPopover() {
  if (widgetRef.value) {
    const rect = widgetRef.value.getBoundingClientRect()
    const POPOVER_H = 290
    const spaceBelow = window.innerHeight - rect.bottom
    popoverAbove.value = spaceBelow < POPOVER_H + 16
    popoverPos.value = popoverAbove.value
      ? { top: rect.top - POPOVER_H - 10, left: rect.left + rect.width / 2 }
      : { top: rect.bottom + 10,          left: rect.left + rect.width / 2 }
  }
  mode.value = 'popover'
}

function closePopover() {
  mode.value = 'idle'
}

function turnOff() {
  callService('light', 'turn_off', { entity_id: props.config.entity })
  closePopover()
}

function commitPopoverBrightness() {
  callService('light', 'turn_on', {
    entity_id:      props.config.entity,
    brightness_pct: localBrightness.value ?? brightness.value,
  })
  localBrightness.value = null
}

function setColor(r, g, b) {
  callService('light', 'turn_on', { entity_id: props.config.entity, rgb_color: [r, g, b] })
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
  top:  popoverPos.value.top  + 'px',
  left: popoverPos.value.left + 'px',
  '--popover-rgb': rgbStr.value,
}))
const popoverClass = computed(() =>
  popoverAbove.value ? 'widget-popover toggle--popover widget-popover--above' : 'widget-popover toggle--popover'
)

const stateLabel = computed(() => {
  if (!isOn.value) return 'apagada'
  return `encendida · ${brightness.value}%`
})
</script>

<template>
  <div
    ref="widgetRef"
    class="toggle"
    :class="{
      'toggle--on':          isOn && !isUnavail,
      'toggle--off':         !isOn && !isUnavail,
      'toggle--unavailable': isUnavail,
      'toggle--active':      mode !== 'idle',
      'toggle--slider':      mode === 'slider',
    }"
    :style="cardStyle"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
  >
    <div class="toggle__fill"></div>

    <!-- ── Modo slider ─────────────────────────────────────────────────── -->
    <template v-if="mode === 'slider'">
      <div class="toggle__icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 18h6M12 2a7 7 0 0 1 7 7c0 2.5-1.3 4.7-3.3 6H8.3A7 7 0 0 1 5 9a7 7 0 0 1 7-7z"
            :fill="`rgba(${rgbStr},${displayBrightness / 100})`"
            :stroke="`rgba(${rgbStr},0.9)`"
            stroke-width="1.4"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <div class="toggle__slider-body">
        <div class="toggle__slider-top">
          <span class="toggle__slider-name">{{ label }}</span>
          <span class="toggle__slider-pct">{{ displayBrightness }}%</span>
        </div>
        <div
          class="toggle__slider-track"
          @pointerdown="onSliderPointerDown"
          @pointermove="onSliderPointerMove"
          @pointerup="onSliderPointerUp"
        >
          <div class="toggle__slider-fill" :style="{ width: displayBrightness + '%' }"></div>
          <div class="toggle__slider-thumb" :style="{ left: displayBrightness + '%' }"></div>
        </div>
      </div>
    </template>

    <!-- ── Modo normal ─────────────────────────────────────────────────── -->
    <template v-else>
      <div class="toggle__icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 18h6M12 2a7 7 0 0 1 7 7c0 2.5-1.3 4.7-3.3 6H8.3A7 7 0 0 1 5 9a7 7 0 0 1 7-7z"
            :fill="isOn && !isUnavail
              ? `rgba(${rgbStr},${brightness / 100})`
              : 'rgba(255,255,255,0.04)'"
            :stroke="isOn && !isUnavail
              ? `rgba(${rgbStr},0.9)`
              : 'rgba(255,255,255,0.2)'"
            stroke-width="1.4"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <div class="toggle__value">{{ isOn && !isUnavail ? brightness + '%' : 'OFF' }}</div>
      <div class="toggle__label">{{ label }}</div>
    </template>

    <!-- ── Popover (Teleport a body) ───────────────────────────────────── -->
    <Teleport to="body">
      <div
        v-if="mode === 'popover'"
        class="widget-overlay"
        @click="closePopover"
      ></div>
      <div
        v-if="mode === 'popover'"
        :class="popoverClass"
        :style="popoverStyle"
      >
        <div class="widget-popover__title">{{ label }}</div>
        <div class="widget-popover__state">{{ stateLabel }}</div>

        <div class="widget-popover__section">Brillo</div>
        <div class="widget-popover__brightness-row">
          <div
            class="widget-popover__brightness-track"
            @pointerdown.stop="onSliderPointerDown"
            @pointermove.stop="onSliderPointerMove"
            @pointerup.stop="commitPopoverBrightness"
          >
            <div
              class="widget-popover__brightness-fill"
              :style="{ width: (localBrightness ?? brightness) + '%' }"
            ></div>
            <div
              class="widget-popover__brightness-thumb"
              :style="{ left: (localBrightness ?? brightness) + '%' }"
            ></div>
          </div>
          <span class="widget-popover__brightness-pct">{{ localBrightness ?? brightness }}%</span>
        </div>

        <div class="widget-popover__section">Color</div>
        <div class="widget-popover__swatches">
          <div
            v-for="([r,g,b], i) in SWATCHES"
            :key="i"
            class="widget-popover__swatch"
            :class="{ 'widget-popover__swatch--active': rgb[0]===r && rgb[1]===g && rgb[2]===b }"
            :style="{ background: `rgb(${r},${g},${b})` }"
            @click.stop="setColor(r, g, b)"
          ></div>
        </div>

        <div class="widget-popover__actions">
          <button
            class="widget-popover__btn"
            data-action="off"
            @click.stop="turnOff"
          >Apagar</button>
          <button class="widget-popover__btn" @click.stop="closePopover">Escena</button>
          <button class="widget-popover__btn" @click.stop="closePopover">Timer</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.toggle {
  position: relative;
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid rgba(255,140,30,0.25);
  background: rgba(255,140,30,0.12);
  backdrop-filter: blur(var(--blur));
  -webkit-backdrop-filter: blur(var(--blur));
  box-shadow: 0 2px 20px rgba(0,0,0,0.6), 0 0 0 0px rgba(255,140,30,0);
  width: 110px;
  padding: 1rem 0.8rem 0.9rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  touch-action: none;
  cursor: pointer;
}

.toggle--on  {
  border-color: rgba(var(--rgb, 255,168,50), 0.5);
  box-shadow: 0 2px 20px rgba(0,0,0,0.6), 0 0 16px rgba(var(--rgb, 255,168,50), 0.2);
}
.toggle--unavailable { opacity: 0.28; }

.toggle--active {
  transform: scale(1.06);
  transform-origin: bottom center;
  z-index: 5;
  box-shadow: 0 4px 24px rgba(0,0,0,.6);
  transition: transform var(--dur-fast) var(--ease-out);
}

.toggle__fill {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: var(--brightness, 0%);
  background: linear-gradient(
    to top,
    rgba(var(--rgb, 255,168,50), .22) 0%,
    rgba(var(--rgb, 255,168,50), .05) 100%
  );
  pointer-events: none;
  transition: height var(--dur-slow) var(--ease-out);
}

.toggle__icon {
  position: relative;
  z-index: 1;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle__value {
  position: relative;
  z-index: 1;
  font-size: var(--text-sm);
  font-weight: 400;
  color: var(--fg);
  line-height: 1;
}

.toggle--on .toggle__value { color: rgb(var(--rgb, 255,168,50)); }

.toggle__label {
  position: relative;
  z-index: 1;
  font-size: var(--text-xs);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.3);
}

.toggle--on .toggle__label { color: rgba(var(--rgb, 255,168,50), 0.5); }

/* Modo slider */
.toggle--slider {
  position: absolute;
  bottom: 0; left: 0;
  width: 250px;
  flex-direction: row;
  align-items: center;
  padding: 0.75rem 0.85rem;
  gap: 0.7rem;
  overflow: hidden;
  z-index: 20;
  box-shadow: 0 8px 32px rgba(0,0,0,.7);
  border-color: rgba(var(--rgb, 255,168,50), .4);
}

.toggle__slider-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  position: relative;
  z-index: 1;
}

.toggle__slider-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.toggle__slider-name {
  font-size: 0.62rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(var(--rgb, 255,168,50), .6);
}

.toggle__slider-pct {
  font-size: 0.85rem;
  font-weight: 400;
  color: rgb(var(--rgb, 255,168,50));
}

.toggle__slider-track {
  position: relative;
  height: 5px;
  background: rgba(var(--rgb, 255,168,50), .1);
  border-radius: 9999px;
  border: 1px solid rgba(var(--rgb, 255,168,50), .15);
  cursor: pointer;
}

.toggle__slider-fill {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  border-radius: 9999px;
  background: linear-gradient(
    90deg,
    rgba(var(--rgb, 255,168,50), .5),
    rgba(var(--rgb, 255,168,50), .9)
  );
  pointer-events: none;
}

.toggle__slider-thumb {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: rgb(var(--rgb, 255,168,50));
  box-shadow: 0 0 8px rgba(var(--rgb, 255,168,50), .6);
  pointer-events: none;
}
</style>
