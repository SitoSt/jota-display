<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useVoice } from '../composables/useVoice.js'

const { current, startListening, cancel } = useVoice()

function handleTap() {
  if (current.value === 'listening' || current.value === 'thinking') cancel()
  else startListening()
}

// ── Simplex noise 2D (Stefan Gustavson, dominio público) ──────────────
const sn = (() => {
  const F=.5*(Math.sqrt(3)-1),G=(3-Math.sqrt(3))/6
  const gv=[[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]]
  const perm=Array.from({length:256},(_,i)=>i)
  for(let i=255;i>0;i--){const j=0|Math.random()*(i+1);[perm[i],perm[j]]=[perm[j],perm[i]]}
  const pm=new Uint8Array(512);for(let i=0;i<512;i++)pm[i]=perm[i&255]
  const dot=([a,b],x,y)=>a*x+b*y
  const contrib=(g,x,y)=>{let v=.5-x*x-y*y;return v<0?0:(v*=v,v*v*dot(g,x,y))}
  return(x,y)=>{
    const s=(x+y)*F,i=0|x+s,j=0|y+s,tt=(i+j)*G
    const x0=x-(i-tt),y0=y-(j-tt),[i1,j1]=x0>y0?[1,0]:[0,1]
    const g0=pm[(i+pm[j&255])&255]&7,g1=pm[(i+i1+pm[(j+j1)&255])&255]&7,g2=pm[(i+1+pm[(j+1)&255])&255]&7
    return 70*(contrib(gv[g0],x0,y0)+contrib(gv[g1],x0-i1+G,y0-j1+G)+contrib(gv[g2],x0-1+2*G,y0-1+2*G))
  }
})()

// ── Paletas HSL [hue, sat, lit] por estado ────────────────────────────
const PALETTES = {
  idle:      [[140,68,55],[160,60,50],[190,50,45]],
  listening: [[130,80,60],[155,75,58],[80,70,58]],
  thinking:  [[215,80,62],[240,65,68],[195,85,65]],
  response:  [[270,70,72],[315,65,72],[245,60,68]],
}
const HUE_DRIFT = { idle:18, listening:30, thinking:22, response:25 }
const COLOR_SPD = { idle:.3,  listening:.9,  thinking:.55, response:.45 }
const SHAPE_SPD = { idle:.04, listening:.12, thinking:.07, response:.06 }
const INTENSITY = { idle:.55, listening:1.0, thinking:.82, response:.88 }
const TARGET_FPS = { idle:24, listening:30,  thinking:30,  response:30  }

// ── 5 blobs: posición normalizada (nx, ny), radios fraccionarios, paleta
const BLOBS = [
  { nx:.12, ny:-.15, rx:.38, ry:.65, palIdx:0 },
  { nx:.50, ny:-.05, rx:.45, ry:.72, palIdx:1 },
  { nx:.82, ny:-.10, rx:.38, ry:.65, palIdx:2 },
  { nx:.30, ny:-.08, rx:.32, ry:.55, palIdx:1 },
  { nx:.68, ny:-.12, rx:.32, ry:.55, palIdx:0 },
]

// ── Canvas state ──────────────────────────────────────────────────────
const canvasEl = ref(null)
const DRAW_DPR = Math.min(window.devicePixelRatio || 1, 1.5)

let W = 0, H = 0
let rafId = null, ro = null
let toSt = 'idle', fromSt = 'idle', transT = 1.0
let t = 0, lastTs = 0, lastFrameTs = 0
let visible = true
const TRANS_DUR = 1.4

function resize() {
  const c = canvasEl.value
  if (!c) return
  const r = c.getBoundingClientRect()
  W = r.width; H = r.height
  c.width  = Math.round(W * DRAW_DPR)
  c.height = Math.round(H * DRAW_DPR)
  c.getContext('2d').setTransform(DRAW_DPR, 0, 0, DRAW_DPR, 0, 0)
}

function lerp(a, b, t) { return a + (b - a) * t }
function smooth(t) { const c = Math.max(0, Math.min(1, t)); return c*c*(3-2*c) }
function hsl(h, s, l, a) { return `hsla(${h|0},${s|0}%,${l|0}%,${a.toFixed(3)})` }

function frame(ts) {
  if (!visible) return

  const interval = 1000 / TARGET_FPS[toSt]
  if (ts - lastFrameTs < interval * .92) {
    rafId = requestAnimationFrame(frame)
    return
  }

  const c = canvasEl.value
  if (!c || !W || !H) { rafId = requestAnimationFrame(frame); return }

  const dt = Math.min((ts - (lastTs || ts)) / 1000, .06)
  lastTs = lastFrameTs = ts
  if (transT < 1) transT = Math.min(1, transT + dt / TRANS_DUR)
  t += dt

  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, W, H)

  const e = smooth(transT)
  const colorSpd  = lerp(COLOR_SPD[fromSt],  COLOR_SPD[toSt],  e)
  const shapeSpd  = lerp(SHAPE_SPD[fromSt],  SHAPE_SPD[toSt],  e)
  const intensity = lerp(INTENSITY[fromSt],  INTENSITY[toSt],  e)
  const hueDrift  = lerp(HUE_DRIFT[fromSt],  HUE_DRIFT[toSt],  e)

  // Dibujar los 5 blobs
  for (let i = 0; i < BLOBS.length; i++) {
    const b = BLOBS[i]
    const pFrom = PALETTES[fromSt][b.palIdx % 3]
    const pTo   = PALETTES[toSt  ][b.palIdx % 3]

    const hueTime = t * colorSpd * .4 + i * 1.7
    const hh = lerp(pFrom[0], pTo[0], e) + Math.sin(hueTime) * hueDrift
    const ss = lerp(pFrom[1], pTo[1], e)
    const ll = lerp(pFrom[2], pTo[2], e)

    const shapeNx = sn(i*3.1,    t*shapeSpd)
    const shapeNy = sn(i*5.7+10, t*shapeSpd*.7)
    const shapeNr = sn(i*7.3+20, t*shapeSpd*.5)

    const cx = (b.nx + shapeNx*.06) * W
    const cy = (b.ny + shapeNy*.04) * H
    const rx = (b.rx + shapeNr*.04) * W
    const ry = (b.ry + shapeNr*.03) * H

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.translate(cx, cy)
    ctx.scale(1, ry / rx)

    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
    const a0 = intensity * (i < 3 ? .65 : .35)
    grd.addColorStop(0,   hsl(hh, ss,     ll,     a0))
    grd.addColorStop(.35, hsl(hh, ss,     ll,     a0 * .55))
    grd.addColorStop(.70, hsl(hh, ss*.8,  ll*.8,  a0 * .18))
    grd.addColorStop(1,   hsl(hh, ss,     ll,     0))

    ctx.fillStyle = grd
    ctx.beginPath()
    ctx.arc(0, 0, rx, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Shimmer — línea luminosa en el borde absoluto superior
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  const pal = PALETTES[toSt]
  for (let x = 0; x < W; x += 3) {
    const nn  = sn(x * .018, t * colorSpd * .6)
    const hue = pal[0][0] + nn * hueDrift * .5 + Math.sin(t * colorSpd + x * .05) * hueDrift * .3
    const al  = (.15 + (nn + 1) * .5 * .2) * intensity
    ctx.fillStyle = hsl(hue, pal[0][1], pal[0][2] + 15, al)
    ctx.fillRect(x, 0, 3, 1.5)
  }
  ctx.restore()

  // Fade mask: desvanece a negro en el borde inferior del strip
  const fadeMask = ctx.createLinearGradient(0, 0, 0, H)
  fadeMask.addColorStop(0,   'rgba(0,0,0,0)')
  fadeMask.addColorStop(.55, 'rgba(0,0,0,0)')
  fadeMask.addColorStop(1,   'rgba(10,10,12,1)')
  ctx.fillStyle = fadeMask
  ctx.fillRect(0, 0, W, H)

  rafId = requestAnimationFrame(frame)
}

function onVisibility() {
  visible = document.visibilityState === 'visible'
  if (visible) rafId = requestAnimationFrame(frame)
}

onMounted(() => {
  ro = new ResizeObserver(resize)
  ro.observe(canvasEl.value)
  resize()
  document.addEventListener('visibilitychange', onVisibility)
  rafId = requestAnimationFrame(frame)
})

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
  if (ro) ro.disconnect()
  document.removeEventListener('visibilitychange', onVisibility)
})

watch(current, (newSt, oldSt) => {
  fromSt = oldSt || 'idle'
  toSt   = newSt
  transT = 0
})
</script>

<template>
  <div class="vapor-strip" @click="handleTap">
    <canvas ref="canvasEl" class="vapor-strip__canvas" />
  </div>
</template>

<style scoped>
.vapor-strip {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: var(--strip-h, 54px);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  z-index: 2;
}

.vapor-strip__canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
