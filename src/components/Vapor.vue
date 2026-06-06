<script setup>
import { computed } from 'vue'
import { useVoice } from '../composables/useVoice.js'

const { current, startListening, cancel } = useVoice()

const stateClass = computed(() => `vapor--${current.value}`)

function handleTap() {
  if (current.value === 'listening' || current.value === 'thinking') {
    cancel()
  } else {
    startListening()
  }
}
</script>

<template>
  <div class="vapor-wrap" :class="stateClass" @click="handleTap">
    <div class="vapor">
      <div class="vapor__blob vapor__blob--a"></div>
      <div class="vapor__blob vapor__blob--b"></div>
      <div class="vapor__blob vapor__blob--c"></div>
      <div class="vapor__blob vapor__blob--d"></div>
    </div>
  </div>
</template>

<style scoped>
/*
 * SISTEMA DE PULSADO ORIENTADO AL LAYOUT
 * --vdx / --vdy: amplitud de deriva horizontal/vertical
 * --vsx / --vsy: escala de pulsación horizontal/vertical
 * Se sobreescriben según el layout del ancestro #app
 */
.vapor-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  --vdx: clamp(5px, 1.5vmin, 16px);
  --vdy: clamp(5px, 1.5vmin, 16px);
  --vsx: 1.08;
  --vsy: 1.08;
}

/* Layout lateral → pulsación principalmente vertical */
:global(.vapor-left) .vapor-wrap,
:global(.vapor-right) .vapor-wrap {
  --vdx: clamp(2px, 0.6vmin, 7px);
  --vdy: clamp(9px, 2.8vmin, 28px);
  --vsx: 0.90;
  --vsy: 1.16;
}

/* Layout superior/inferior → pulsación principalmente horizontal */
:global(.vapor-top) .vapor-wrap,
:global(.vapor-bottom) .vapor-wrap {
  --vdx: clamp(9px, 2.8vmin, 28px);
  --vdy: clamp(2px, 0.6vmin, 7px);
  --vsx: 1.16;
  --vsy: 0.90;
}

/* ── Contenedor de los blobs ── */
.vapor {
  position: relative;
  width: clamp(120px, 28vmin, 220px);
  aspect-ratio: 1;
  overflow: visible;
}

/*
 * Blobs: círculos pequeños (≈40% del contenedor) con blur grande relativo
 * a su tamaño propio → el blur los difumina completamente, sin borde sólido.
 * El blur debe ser ≥ 35% del diámetro del blob para que no queden bordes duros.
 */
.vapor__blob {
  position: absolute;
  width: 45%;
  aspect-ratio: 1;
  border-radius: 50%;
  mix-blend-mode: screen;
  opacity: 0;
  filter: blur(clamp(14px, 3.8vmin, 38px));
  transition: opacity var(--dur-slow) var(--ease-in-out);
}

/* Posiciones base de cada blob (se animan desde aquí) */
.vapor__blob--a { top:  5%; left:  8%; }
.vapor__blob--b { top: 15%; left: 48%; }
.vapor__blob--c { top: 45%; left: 22%; }
/* Blob-d: ambient/glow — más grande, más difuso */
.vapor__blob--d {
  width: 65%;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  filter: blur(clamp(22px, 6vmin, 55px));
}

/* ── Estado: idle — presencia ambiental visible ── */
.vapor--idle .vapor__blob--a {
  background: rgba(74, 222, 128, 0.45);
  opacity: 1;
  animation: drift-a 13s ease-in-out infinite;
}
.vapor--idle .vapor__blob--b {
  background: rgba(96, 165, 250, 0.35);
  opacity: 1;
  animation: drift-b 17s ease-in-out infinite;
}
.vapor--idle .vapor__blob--c {
  background: rgba(196, 181, 253, 0.28);
  opacity: 1;
  animation: drift-c 21s ease-in-out infinite;
}
.vapor--idle .vapor__blob--d {
  background: rgba(74, 222, 128, 0.18);
  opacity: 1;
  animation: drift-b 25s ease-in-out infinite reverse;
}

/* ── Estado: listening — verde menta + esmeralda + lima ── */
.vapor--listening .vapor__blob--a {
  background: rgba(74,  222, 128, 0.82); /* verde menta */
  opacity: 1;
  animation: drift-a 4.5s ease-in-out infinite;
}
.vapor--listening .vapor__blob--b {
  background: rgba(52,  211, 153, 0.65); /* esmeralda */
  opacity: 1;
  animation: drift-b 6s ease-in-out infinite;
}
.vapor--listening .vapor__blob--c {
  background: rgba(163, 230,  53, 0.42); /* lima */
  opacity: 1;
  animation: drift-c 7.5s ease-in-out infinite;
}
.vapor--listening .vapor__blob--d {
  background: rgba(74,  222, 128, 0.20);
  opacity: 1;
  animation: breathe 3.2s ease-in-out infinite;
}

/* ── Estado: thinking — azul + índigo + cian ── */
.vapor--thinking .vapor__blob--a {
  background: rgba(96,  165, 250, 0.80); /* azul cielo */
  opacity: 1;
  animation: breathe 2.0s ease-in-out infinite;
}
.vapor--thinking .vapor__blob--b {
  background: rgba(129, 140, 248, 0.60); /* índigo */
  opacity: 1;
  animation: breathe 2.0s ease-in-out infinite 0.35s;
}
.vapor--thinking .vapor__blob--c {
  background: rgba(103, 232, 249, 0.40); /* cian */
  opacity: 1;
  animation: breathe 2.0s ease-in-out infinite 0.70s;
}
.vapor--thinking .vapor__blob--d {
  background: rgba(96,  165, 250, 0.18);
  opacity: 1;
  animation: breathe 2.0s ease-in-out infinite 0.15s;
}

/* ── Estado: response — lavanda + rosa + azul ── */
.vapor--response .vapor__blob--a {
  background: rgba(196, 181, 253, 0.78); /* lavanda */
  opacity: 1;
  animation: drift-a 5.5s ease-in-out infinite;
}
.vapor--response .vapor__blob--b {
  background: rgba(249, 168, 212, 0.58); /* rosa */
  opacity: 1;
  animation: drift-b 7s ease-in-out infinite;
}
.vapor--response .vapor__blob--c {
  background: rgba(96,  165, 250, 0.38); /* azul */
  opacity: 1;
  animation: drift-c 9s ease-in-out infinite;
}
.vapor--response .vapor__blob--d {
  background: rgba(196, 181, 253, 0.20);
  opacity: 1;
  animation: breathe 4s ease-in-out infinite;
}

/* ── Keyframes con pulsación orientada ── */
@keyframes drift-a {
  0%,  100% { transform: translate(0, 0)                              scaleX(1)          scaleY(1); }
  28%        { transform: translate(var(--vdx), calc(-1.2 * var(--vdy))) scaleX(var(--vsx)) scaleY(var(--vsy)); }
  57%        { transform: translate(calc(-0.8 * var(--vdx)), var(--vdy)) scaleX(var(--vsx)) scaleY(var(--vsy)); }
  82%        { transform: translate(var(--vdx), calc(0.6 * var(--vdy)))  scaleX(1)          scaleY(1); }
}

@keyframes drift-b {
  0%,  100% { transform: translate(0, 0)                                   scaleX(1)          scaleY(1); }
  35%        { transform: translate(calc(-1.1 * var(--vdx)), calc(0.9 * var(--vdy))) scaleX(var(--vsx)) scaleY(var(--vsy)); }
  68%        { transform: translate(var(--vdx), calc(-1.3 * var(--vdy)))   scaleX(var(--vsx)) scaleY(var(--vsy)); }
}

@keyframes drift-c {
  0%,  100% { transform: translate(0, 0)                                    scaleX(1)          scaleY(1); }
  22%        { transform: translate(calc(0.7 * var(--vdx)), var(--vdy))     scaleX(var(--vsx)) scaleY(var(--vsy)); }
  74%        { transform: translate(calc(-1.2 * var(--vdx)), calc(-0.8 * var(--vdy))) scaleX(var(--vsx)) scaleY(var(--vsy)); }
}

@keyframes breathe {
  0%,  100% { transform: scaleX(1)          scaleY(1);          opacity: 0.75; }
  50%        { transform: scaleX(var(--vsx)) scaleY(var(--vsy)); opacity: 1; }
}
</style>
