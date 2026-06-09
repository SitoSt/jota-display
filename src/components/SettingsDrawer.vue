<!-- src/components/SettingsDrawer.vue -->
<script setup>
import { ref, computed, watch } from 'vue'
import { useLayout } from '../composables/useLayout.js'
import { useIdle } from '../composables/useIdle.js'
import { useWidgets } from '../composables/useWidgets.js'
import { useGridConfig } from '../composables/useGridConfig.js'
import { useHA } from '../composables/useHA.js'
import { registry, resolveDefinition } from '../widgets/index.js'
import WidgetCatalog from './WidgetCatalog.vue'
import WidgetShell from '../widgets/WidgetShell.vue'

const open              = ref(false)
const currentSection    = ref(null)
const navDirection      = ref('forward')
const showCatalog       = ref(false)
const widgetTab         = ref('tablero')
const isEditing         = ref(false)
const selectedWidgetId  = ref(null)

const { layoutClass, saveLayout } = useLayout()
const { config, loadIdle, saveIdle } = useIdle()
const { widgets, removeWidget, updateWidget, reorderWidgets } = useWidgets()
const { cellPx, gridCols, gridGap, setCellPx, setCols, setGap } = useGridConfig()
const { connected, entities } = useHA()

// Mapping de spans (igual que WidgetGrid)
const SPANS = { small: [2,2], horizontal: [2,1], medium: [4,2], large: [99,2] }
function spanStyle(size) {
  const [col, row] = SPANS[size] ?? [2,2]
  return { gridColumn: `span ${Math.min(col, gridCols.value)}`, gridRow: `span ${row}` }
}

const tableroGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${gridCols.value}, ${cellPx.value}px)`,
  gridAutoRows:        `${cellPx.value}px`,
  gap:                 `${gridGap.value}px`,
}))

// Drag-to-reorder
const tableroRef  = ref(null)
const dragId      = ref(null)
const dragOverIdx = ref(null)

function onItemPointerDown(e, id) {
  if (!isEditing.value) return
  dragId.value = id
  dragOverIdx.value = widgetDefs.value.findIndex(({ widget }) => widget.id === id)
}

function onGridPointerMove(e) {
  if (!dragId.value || !tableroRef.value) return
  const items = [...tableroRef.value.querySelectorAll('.tablero-item')]
  const idx = items.findIndex(el => {
    const r = el.getBoundingClientRect()
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
  })
  if (idx !== -1) dragOverIdx.value = idx
}

function onGridPointerUp() {
  if (dragId.value !== null && dragOverIdx.value !== null) {
    const ids = widgetDefs.value.map(({ widget }) => widget.id)
    const from = ids.indexOf(dragId.value)
    const to   = dragOverIdx.value
    if (from !== -1 && from !== to) {
      const newIds = [...ids]
      newIds.splice(from, 1)
      newIds.splice(to, 0, dragId.value)
      reorderWidgets(newIds)
    }
  }
  dragId.value      = null
  dragOverIdx.value = null
}

const vaporPos = ref(layoutClass.value.replace('vapor-', ''))

watch(open, async (v) => {
  if (v) {
    currentSection.value   = null
    showCatalog.value      = false
    widgetTab.value        = 'tablero'
    isEditing.value        = false
    selectedWidgetId.value = null
    await loadIdle()
    vaporPos.value = layoutClass.value.replace('vapor-', '')
  }
})

function openSection(id) {
  navDirection.value   = 'forward'
  currentSection.value = id
}

function back() {
  navDirection.value   = 'back'
  currentSection.value = null
}

async function setVaporPos(pos) {
  vaporPos.value = pos
  await saveLayout(pos)
}

const vaporPosLabel = computed(() => ({
  left: 'izquierda', right: 'derecha', top: 'arriba', bottom: 'abajo',
}[vaporPos.value] ?? vaporPos.value))

const idleModes = [
  { value: 'clock-widgets', label: 'Reloj y widgets',   sub: 'Muestra el reloj con los widgets activos' },
  { value: 'clock',         label: 'Solo reloj',        sub: 'Pantalla limpia, solo la hora' },
  { value: 'off',           label: 'Pantalla apagada',  sub: 'Apaga la pantalla completamente' },
]

const timeoutOptions = [
  { value: 30,  label: '30s'    },
  { value: 60,  label: '1 min'  },
  { value: 120, label: '2 min'  },
  { value: 300, label: '5 min'  },
  { value: 600, label: '10 min' },
  { value: 0,   label: 'Nunca'  },
]

const SIZE_LABELS = { small: 'Compact.', horizontal: 'Horiz.' }

const catalogTypes      = computed(() => Object.values(registry))
const widgetDefs        = computed(() =>
  widgets.value.map(w => ({ widget: w, def: resolveDefinition(w.type) }))
)
const entityCount       = computed(() => Object.keys(entities.value).length)
const selectedWidget    = computed(() => widgets.value.find(w => w.id === selectedWidgetId.value) ?? null)
const selectedDef       = computed(() => selectedWidget.value ? resolveDefinition(selectedWidget.value.type) : null)

function stopEditing() {
  isEditing.value        = false
  selectedWidgetId.value = null
}

function toggleWidgetSelect(id) {
  selectedWidgetId.value = selectedWidgetId.value === id ? null : id
}

function removeSelected() {
  if (selectedWidgetId.value) {
    removeWidget(selectedWidgetId.value)
    selectedWidgetId.value = null
    if (widgets.value.length === 0) isEditing.value = false
  }
}

function nightH(field) { return config.value.nightRule?.[field]?.split(':')[0] ?? (field === 'from' ? '23' : '07') }
function nightM(field) { return config.value.nightRule?.[field]?.split(':')[1] ?? '00' }
function setNightH(field, v) {
  const h = String(Math.min(23, Math.max(0, parseInt(v) || 0))).padStart(2, '0')
  saveIdle({ nightRule: { ...config.value.nightRule, [field]: h + ':' + nightM(field) } })
}
function setNightM(field, v) {
  const m = String(Math.min(59, Math.max(0, parseInt(v) || 0))).padStart(2, '0')
  saveIdle({ nightRule: { ...config.value.nightRule, [field]: nightH(field) + ':' + m } })
}

const widgetSubtitle = computed(() => {
  const n = widgets.value.length
  return n === 0
    ? 'Sin widgets instalados, añadir o eliminar'
    : `${n} widget${n > 1 ? 's' : ''} instalado${n > 1 ? 's' : ''}, añadir o eliminar`
})
</script>

<template>
  <!-- ── Botón de apertura ─────────────────────────────── -->
  <button class="settings-trigger" @click="open = true" aria-label="Ajustes">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
    </svg>
    <span class="settings-trigger__label">Ajustes</span>
  </button>

  <!-- ── Pantalla de ajustes ───────────────────────────── -->
  <Transition name="screen-open">
    <div v-if="open" class="settings-screen" role="dialog" aria-label="Ajustes">

      <Transition :name="navDirection === 'forward' ? 'nav-fwd' : 'nav-back'" mode="out-in">
        <div :key="currentSection ?? 'main'" class="settings-view">

          <!-- ══════════════════════════════════════════════
               Menú principal — tiles 2×2
               ══════════════════════════════════════════════ -->
          <template v-if="!currentSection">
            <header class="s-header">
              <span class="s-header__title">Ajustes</span>
              <button class="s-close" @click="open = false" aria-label="Cerrar">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </header>

            <div class="tiles">
              <button class="tile tile--reposo" @click="openSection('reposo')">
                <div class="tile__glow"/>
                <div class="tile__icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                </div>
                <div class="tile__title">Reposo</div>
                <div class="tile__sub">Modo de pantalla, reloj,<br>horario nocturno</div>
                <span class="tile__arrow">›</span>
              </button>

              <button class="tile tile--pantalla" @click="openSection('pantalla')">
                <div class="tile__glow"/>
                <div class="tile__icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
                    <rect x="2" y="3" width="20" height="14" rx="2"/>
                    <path d="M8 21h8M12 17v4"/>
                  </svg>
                </div>
                <div class="tile__title">Pantalla</div>
                <div class="tile__sub">Posición del vapor,<br>distribución en pantalla</div>
                <span class="tile__arrow">›</span>
              </button>

              <button class="tile tile--widgets" @click="openSection('widgets')">
                <div class="tile__glow"/>
                <div class="tile__icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
                    <rect x="3" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/>
                    <rect x="14" y="14" width="7" height="7" rx="1"/>
                  </svg>
                </div>
                <div class="tile__title">Widgets</div>
                <div class="tile__sub">{{ widgetSubtitle }}</div>
                <span class="tile__arrow">›</span>
              </button>

              <button class="tile tile--sistema" @click="openSection('sistema')">
                <div class="tile__glow"/>
                <div class="tile__icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4M12 8h.01"/>
                  </svg>
                </div>
                <div class="tile__title">Sistema</div>
                <div class="tile__sub">Información de la aplicación,<br>versión y estado</div>
                <span class="tile__arrow">›</span>
              </button>
            </div>
          </template>

          <!-- ══════════════════════════════════════════════
               Reposo — dos columnas
               ══════════════════════════════════════════════ -->
          <template v-else-if="currentSection === 'reposo'">
            <header class="s-header s-header--inner">
              <button class="s-back" @click="back">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
                Ajustes
              </button>
              <span class="s-header__title-sm">Reposo</span>
              <button class="s-close" @click="open = false" aria-label="Cerrar">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </header>

            <div class="reposo-grid">
              <!-- Columna izquierda -->
              <div class="reposo-col">
                <div class="s-section">
                  <span class="s-label">Modo en reposo</span>
                  <div class="mode-cards">
                    <button
                      v-for="m in idleModes" :key="m.value"
                      class="mode-card"
                      :class="{ 'mode-card--on': config.mode === m.value }"
                      @click="saveIdle({ mode: m.value })"
                    >
                      <svg v-if="config.mode === m.value" class="mode-card__check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M5 12l5 5L20 7"/>
                      </svg>
                      <span class="mode-card__title">{{ m.label }}</span>
                      <span class="mode-card__sub">{{ m.sub }}</span>
                    </button>
                  </div>
                </div>

                <div class="s-section">
                  <span class="s-label">Inactividad hasta reposo</span>
                  <div class="chips">
                    <button
                      v-for="t in timeoutOptions" :key="t.value"
                      class="chip"
                      :class="{ 'chip--on': config.inactivityTimeout === t.value }"
                      @click="saveIdle({ inactivityTimeout: t.value })"
                    >{{ t.label }}</button>
                  </div>
                </div>
              </div>

              <!-- Columna derecha -->
              <div class="reposo-col">
                <div class="s-section">
                  <span class="s-label">Reloj</span>
                  <div class="s-list">
                    <div class="s-row">
                      <span class="s-row__text">Formato</span>
                      <div class="seg">
                        <button class="seg__btn" :class="{ 'seg__btn--on': config.clockFormat === '24h' }" @click="saveIdle({ clockFormat: '24h' })">24h</button>
                        <button class="seg__btn" :class="{ 'seg__btn--on': config.clockFormat === '12h' }" @click="saveIdle({ clockFormat: '12h' })">12h</button>
                      </div>
                    </div>
                    <div class="s-row s-row--tap" @click="saveIdle({ showDate: !config.showDate })">
                      <span class="s-row__text">Mostrar fecha</span>
                      <span class="sw" :class="{ 'sw--on': config.showDate }"><span class="sw__knob"/></span>
                    </div>
                    <div class="s-row s-row--tap" @click="saveIdle({ showDayOfWeek: !config.showDayOfWeek })">
                      <span class="s-row__text">Día de la semana</span>
                      <span class="sw" :class="{ 'sw--on': config.showDayOfWeek }"><span class="sw__knob"/></span>
                    </div>
                    <div class="s-row s-row--tap" @click="saveIdle({ showSeconds: !config.showSeconds })">
                      <span class="s-row__text">Segundos</span>
                      <span class="sw" :class="{ 'sw--on': config.showSeconds }"><span class="sw__knob"/></span>
                    </div>
                  </div>
                </div>

                <div class="s-section">
                  <span class="s-label">Horario nocturno</span>
                  <div class="s-list">
                    <div class="s-row s-row--tap" @click="saveIdle({ nightRule: { ...config.nightRule, enabled: !config.nightRule.enabled } })">
                      <span class="s-row__text">Activar</span>
                      <span class="sw" :class="{ 'sw--on': config.nightRule.enabled }"><span class="sw__knob"/></span>
                    </div>
                  </div>
                  <Transition name="expand">
                    <div v-if="config.nightRule.enabled" class="night-block">
                      <div class="night-times">
                        <div class="night-time">
                          <span class="night-time__label">🌙 INICIO</span>
                          <div class="time-field">
                            <input type="number" min="0" max="23" class="time-num"
                              :value="nightH('from')"
                              @change="setNightH('from', $event.target.value)">
                            <span class="time-sep">:</span>
                            <input type="number" min="0" max="59" class="time-num"
                              :value="nightM('from')"
                              @change="setNightM('from', $event.target.value)">
                          </div>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="night-arrow">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                        <div class="night-time">
                          <span class="night-time__label">🌤 FIN</span>
                          <div class="time-field">
                            <input type="number" min="0" max="23" class="time-num"
                              :value="nightH('to')"
                              @change="setNightH('to', $event.target.value)">
                            <span class="time-sep">:</span>
                            <input type="number" min="0" max="59" class="time-num"
                              :value="nightM('to')"
                              @change="setNightM('to', $event.target.value)">
                          </div>
                        </div>
                      </div>
                    </div>
                  </Transition>
                </div>
              </div>
            </div>
          </template>

          <!-- ══════════════════════════════════════════════
               Pantalla
               ══════════════════════════════════════════════ -->
          <template v-else-if="currentSection === 'pantalla'">
            <header class="s-header s-header--inner">
              <button class="s-back" @click="back">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
                Ajustes
              </button>
              <span class="s-header__title-sm">Pantalla</span>
              <button class="s-close" @click="open = false" aria-label="Cerrar">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </header>

            <div class="vapor-row">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" class="vapor-row__icon">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
              </svg>
              <span class="vapor-row__label">Vapor posicionado a la <strong>{{ vaporPosLabel }}</strong></span>
              <div class="vapor-btns">
                <button
                  v-for="[pos, lbl] in [['left','Izq.'],['right','Der.'],['top','Arriba'],['bottom','Abajo']]"
                  :key="pos"
                  class="vapor-btn"
                  :class="{ 'vapor-btn--on': vaporPos === pos }"
                  @click="setVaporPos(pos)"
                >{{ lbl }}</button>
              </div>
            </div>

            <div class="layout-placeholder">
              <div class="layout-preview" :class="`layout-preview--${vaporPos}`">
                <div class="layout-preview__vapor">
                  <span class="layout-preview__orb"/>
                  <span class="layout-preview__vapor-label">VAPOR</span>
                </div>
                <div class="layout-preview__content">
                  <div class="layout-preview__widget-mock"/>
                  <div class="layout-preview__widget-mock"/>
                </div>
              </div>
              <span class="layout-placeholder__badge">PRÓXIMAMENTE</span>
              <span class="layout-placeholder__title">Editor de layout</span>
              <span class="layout-placeholder__sub">Arrastra zonas para colocar widgets, reloj, tiempo o el vapor donde quieras en la pantalla</span>
            </div>
          </template>

          <!-- ══════════════════════════════════════════════
               Widgets — Tablero / Catálogo
               ══════════════════════════════════════════════ -->
          <template v-else-if="currentSection === 'widgets'">
            <header class="s-header s-header--inner">
              <button class="s-back" @click="showCatalog ? (showCatalog = false) : isEditing ? stopEditing() : back()">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
                {{ showCatalog ? 'Widgets' : isEditing ? 'Widgets' : 'Ajustes' }}
              </button>
              <span class="s-header__title-sm">Widgets</span>
              <template v-if="!showCatalog && widgetTab === 'tablero'">
                <button v-if="isEditing" class="s-action s-action--done" @click="stopEditing">Listo</button>
                <button v-else-if="widgets.length > 0" class="s-action" @click="isEditing = true">Editar</button>
                <button v-else class="s-action" @click="showCatalog = true">+ Añadir</button>
              </template>
              <button v-else-if="!showCatalog" class="s-action" @click="showCatalog = true">+ Añadir</button>
              <span v-else class="s-header__side"/>
            </header>

            <!-- Flujo añadir widget (WidgetCatalog) -->
            <div v-if="showCatalog" class="s-body">
              <WidgetCatalog @done="showCatalog = false" />
            </div>

            <!-- Tabs normales -->
            <template v-else>
              <!-- Config de rejilla -->
              <div class="grid-cfg">
                <div class="grid-cfg-row">
                  <span class="grid-cfg__label">Por fila</span>
                  <div class="grid-cfg__pills">
                    <button v-for="n in [2, 3, 4]" :key="n"
                      class="grid-pill"
                      :class="{ 'grid-pill--on': gridCols === n * 2 }"
                      @click="setCols(n * 2)">{{ n }}</button>
                  </div>
                </div>
                <div class="grid-cfg-row">
                  <span class="grid-cfg__label">Tamaño</span>
                  <div class="grid-stepper">
                    <button class="grid-stepper__btn" @click="setCellPx(cellPx - 5)">−</button>
                    <span class="grid-stepper__val">{{ cellPx }}px</span>
                    <button class="grid-stepper__btn" @click="setCellPx(cellPx + 5)">+</button>
                  </div>
                </div>
                <div class="grid-cfg-row">
                  <span class="grid-cfg__label">Espacio</span>
                  <div class="grid-stepper">
                    <button class="grid-stepper__btn" @click="setGap(gridGap - 2)">−</button>
                    <span class="grid-stepper__val">{{ gridGap }}px</span>
                    <button class="grid-stepper__btn" @click="setGap(gridGap + 2)">+</button>
                  </div>
                </div>
              </div>

              <div class="tab-bar">
                <button class="tab" :class="{ 'tab--on': widgetTab === 'tablero' }"
                  @click="widgetTab = 'tablero'">Tablero</button>
                <button class="tab" :class="{ 'tab--on': widgetTab === 'catalogo' }"
                  @click="widgetTab = 'catalogo'; stopEditing()">Catálogo</button>
              </div>

              <!-- Tab Tablero -->
              <div v-if="widgetTab === 'tablero'" class="tablero">

                <!-- Estado vacío -->
                <div v-if="widgets.length === 0" class="tablero-empty">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                  </svg>
                  <p>Sin widgets configurados</p>
                  <button class="tablero-empty__cta" @click="showCatalog = true">+ Añadir desde catálogo</button>
                </div>

                <!-- Grid de widgets — preview 1:1 del layout real -->
                <div
                  v-else
                  ref="tableroRef"
                  class="tablero-grid"
                  :class="{ 'tablero-grid--editing': isEditing }"
                  :style="tableroGridStyle"
                  @pointermove="onGridPointerMove"
                  @pointerup="onGridPointerUp"
                >
                  <div
                    v-for="({ widget, def }, idx) in widgetDefs"
                    :key="widget.id"
                    class="tablero-item"
                    :class="{
                      'tablero-item--selected': selectedWidgetId === widget.id,
                      'tablero-item--dragging': dragId === widget.id,
                      'tablero-item--dragover': isEditing && dragOverIdx === idx && dragId !== widget.id,
                    }"
                    :style="spanStyle(widget.size || def.defaultSize || 'small')"
                    @pointerdown="onItemPointerDown($event, widget.id)"
                  >
                    <WidgetShell :config="widget" :definition="def" />

                    <!-- Botón de config (solo en modo edición) -->
                    <button
                      v-if="isEditing"
                      class="widget-cfg-btn"
                      :class="{ 'widget-cfg-btn--active': selectedWidgetId === widget.id }"
                      @click.stop="toggleWidgetSelect(widget.id)"
                      aria-label="Configurar widget"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Panel de config del widget seleccionado -->
                <Transition name="sheet-up">
                  <div v-if="selectedWidget" class="widget-cfg-sheet">
                    <div class="widget-cfg-sheet__header">
                      <div class="widget-cfg-sheet__info">
                        <span class="widget-cfg-sheet__name">{{ selectedWidget.label }}</span>
                        <span class="widget-cfg-sheet__entity">{{ selectedWidget.entity }}</span>
                      </div>
                      <button class="widget-cfg-sheet__close" @click="selectedWidgetId = null">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>

                    <div class="widget-cfg-sheet__body">
                      <!-- Opciones de tamaño (si el widget soporta múltiples) -->
                      <div v-if="selectedDef?.sizes?.length > 1" class="widget-cfg-row">
                        <span class="widget-cfg-label">Tamaño</span>
                        <div class="size-pills">
                          <button
                            v-for="sz in selectedDef.sizes"
                            :key="sz"
                            class="size-pill"
                            :class="{ 'size-pill--on': selectedWidget.size === sz }"
                            @click="updateWidget(selectedWidget.id, { size: sz })"
                          >{{ SIZE_LABELS[sz] ?? sz }}</button>
                        </div>
                      </div>

                      <button class="remove-widget-btn" @click="removeSelected">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                        </svg>
                        Eliminar widget
                      </button>
                    </div>
                  </div>
                </Transition>

              </div>

              <!-- Tab Catálogo -->
              <div v-else class="catalogo-grid">
                <button
                  v-for="type in catalogTypes"
                  :key="type.type"
                  class="catalog-card"
                  @click="showCatalog = true"
                >
                  <div class="catalog-card__preview">
                    <svg v-if="type.type.includes('light')" width="36" height="36" viewBox="0 0 24 24" fill="none">
                      <path d="M9 18h6M12 2a7 7 0 0 1 7 7c0 2.5-1.3 4.7-3.3 6H8.3A7 7 0 0 1 5 9a7 7 0 0 1 7-7z"
                        fill="rgba(255,165,45,.2)" stroke="rgba(255,180,70,.75)" stroke-width="1.4" stroke-linejoin="round"/>
                    </svg>
                    <svg v-else-if="type.type.includes('sensor')" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(96,165,250,.75)" stroke-width="1.4">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                    </svg>
                    <svg v-else width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="1.4">
                      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                    </svg>
                  </div>
                  <div class="catalog-card__info">
                    <span class="catalog-card__name">{{ type.label }}</span>
                    <span class="catalog-card__pack">Home Assistant · {{ type.configSchema?.entity?.domain ?? 'any' }}</span>
                  </div>
                </button>
              </div>
            </template>
          </template>

          <!-- ══════════════════════════════════════════════
               Sistema
               ══════════════════════════════════════════════ -->
          <template v-else-if="currentSection === 'sistema'">
            <header class="s-header s-header--inner">
              <button class="s-back" @click="back">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
                Ajustes
              </button>
              <span class="s-header__title-sm">Sistema</span>
              <button class="s-close" @click="open = false" aria-label="Cerrar">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </header>

            <div class="sistema-grid">
              <div class="info-card">
                <span class="info-card__label">APLICACIÓN</span>
                <span class="info-card__title">jota-display</span>
                <span class="info-card__sub">v0.1.0 · build 2026.06</span>
              </div>
              <div class="info-card">
                <span class="info-card__label">ESTADO</span>
                <span class="info-card__title info-card__title--ok">En desarrollo</span>
                <span class="info-card__sub">{{ connected ? 'Home Assistant conectado' : 'Home Assistant desconectado' }}</span>
              </div>
              <div class="info-card">
                <span class="info-card__label">HOME ASSISTANT</span>
                <span class="info-card__title">WebSocket</span>
                <span class="info-card__sub">{{ entityCount }} entidades activas</span>
              </div>
              <div class="info-card">
                <span class="info-card__label">DISPOSITIVO</span>
                <span class="info-card__title">Termux · Android</span>
                <span class="info-card__sub">Fully Kiosk Browser</span>
              </div>
            </div>
          </template>

        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
/* ── Trigger ───────────────────────────────────────── */
.settings-trigger {
  position: fixed;
  bottom: 1.25rem;
  left: 1.25rem;
  height: 44px;
  padding: 0 1rem 0 0.75rem;
  border-radius: var(--radius-full);
  background: var(--surface-2);
  border: 1px solid var(--border-hover);
  color: var(--fg-dim);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  z-index: 10;
  box-shadow: 0 2px 10px rgba(0,0,0,0.45);
  transition: background var(--dur-fast) var(--ease-out),
              color var(--dur-fast) var(--ease-out),
              border-color var(--dur-fast) var(--ease-out);
  -webkit-tap-highlight-color: transparent;
}
.settings-trigger:hover { background: var(--surface); color: var(--fg); border-color: rgba(255,255,255,.2); }
.settings-trigger__label {
  font-size: var(--text-sm);
  font-family: var(--font);
  font-weight: var(--fw-medium);
}

/* ── Screen & view ─────────────────────────────────── */
.settings-screen {
  position: fixed;
  inset: 0;
  background: var(--bg);
  z-index: 100;
}

.settings-view {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Header ────────────────────────────────────────── */
.s-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28px 40px 0;
  flex-shrink: 0;
}

.s-header--inner {
  padding: 0 40px;
  height: 64px;
  border-bottom: 1px solid var(--border);
  position: relative;
}

.s-header__title {
  font-size: 13px;
  font-weight: 400;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: rgba(255,255,255,.22);
}

.s-header__title-sm {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: var(--text-base);
  font-weight: var(--fw-medium);
  color: var(--fg);
  pointer-events: none;
}

.s-header__side { width: 72px; }

.s-back {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: none;
  border: none;
  color: rgba(255,255,255,.45);
  font-size: var(--text-sm);
  font-family: var(--font);
  cursor: pointer;
  padding: 0.5rem 0;
  transition: color var(--dur-fast);
  -webkit-tap-highlight-color: transparent;
}
.s-back:hover { color: rgba(255,255,255,.75); }

.s-close {
  width: 32px;
  height: 32px;
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: var(--radius-full);
  color: rgba(255,255,255,.35);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--dur-fast), color var(--dur-fast);
  -webkit-tap-highlight-color: transparent;
}
.s-close:hover { color: var(--fg); background: rgba(255,255,255,.09); }

.s-action {
  background: none;
  border: 1px solid rgba(255,255,255,.15);
  border-radius: var(--radius-sm);
  color: rgba(255,255,255,.55);
  font-size: var(--text-xs);
  font-family: var(--font);
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  transition: border-color var(--dur-fast), color var(--dur-fast);
  -webkit-tap-highlight-color: transparent;
}
.s-action:hover { border-color: rgba(255,255,255,.3); color: rgba(255,255,255,.8); }

/* ── Tiles (menú principal) ────────────────────────── */
.tiles {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 16px;
  padding: 24px 40px 40px;
}

.tile {
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.03);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 32px 36px;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  text-align: left;
  font-family: var(--font);
  transition: background .2s ease, border-color .2s ease;
  -webkit-tap-highlight-color: transparent;
}
.tile:hover { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.14); }

.tile__icon {
  position: absolute;
  top: 36px;
  left: 36px;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.09);
}

.tile__glow {
  position: absolute;
  pointer-events: none;
  border-radius: 50%;
  filter: blur(60px);
  opacity: .18;
}

.tile__title {
  font-size: 22px;
  font-weight: 300;
  letter-spacing: -.02em;
  color: rgba(255,255,255,.88);
  line-height: 1;
  margin-bottom: 8px;
}

.tile__sub {
  font-size: 13px;
  font-weight: 400;
  color: rgba(255,255,255,.28);
  line-height: 1.4;
}

.tile__arrow {
  position: absolute;
  bottom: 32px;
  right: 36px;
  color: rgba(255,255,255,.2);
  font-size: 18px;
}

/* Tints por sección */
.tile--reposo .tile__glow { width: 300px; height: 300px; background: #4060cc; top: -80px; right: -60px; }
.tile--reposo .tile__icon { border-color: rgba(100,130,255,.2); background: rgba(80,100,220,.12); }
.tile--reposo .tile__icon svg { color: rgba(140,165,255,.9); }
.tile--reposo:hover { border-color: rgba(100,130,255,.2); }

.tile--pantalla .tile__glow { width: 260px; height: 260px; background: #20aa70; bottom: -80px; left: -40px; }
.tile--pantalla .tile__icon { border-color: rgba(60,200,130,.2); background: rgba(40,170,100,.1); }
.tile--pantalla .tile__icon svg { color: rgba(80,210,140,.9); }
.tile--pantalla:hover { border-color: rgba(60,200,130,.18); }

.tile--widgets .tile__glow { width: 280px; height: 280px; background: #cc7020; top: -60px; left: -60px; }
.tile--widgets .tile__icon { border-color: rgba(255,165,45,.22); background: rgba(220,130,30,.1); }
.tile--widgets .tile__icon svg { color: rgba(255,180,70,.9); }
.tile--widgets:hover { border-color: rgba(255,165,45,.18); }

.tile--sistema .tile__glow { width: 240px; height: 240px; background: #505060; bottom: -70px; right: -50px; }
.tile--sistema .tile__icon { border-color: rgba(150,150,170,.18); background: rgba(120,120,140,.08); }
.tile--sistema .tile__icon svg { color: rgba(170,170,190,.85); }
.tile--sistema:hover { border-color: rgba(150,150,170,.16); }

/* ── Reposo — dos columnas ─────────────────────────── */
.reposo-grid {
  flex: 1;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  padding: 32px 40px 40px;
}

.reposo-col {
  display: flex;
  flex-direction: column;
  gap: 28px;
  overflow-y: auto;
}

.mode-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mode-card {
  position: relative;
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 14px;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  text-align: left;
  cursor: pointer;
  font-family: var(--font);
  transition: background .15s, border-color .15s;
  -webkit-tap-highlight-color: transparent;
}
.mode-card:hover { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.14); }
.mode-card--on {
  border-color: rgba(255,255,255,.2);
  background: rgba(255,255,255,.06);
}

.mode-card__check {
  position: absolute;
  top: 16px;
  right: 16px;
  color: rgba(255,255,255,.65);
}

.mode-card__title {
  font-size: var(--text-sm);
  font-weight: 500;
  color: rgba(255,255,255,.82);
}

.mode-card__sub {
  font-size: var(--text-xs);
  color: rgba(255,255,255,.28);
}

/* ── Pantalla ──────────────────────────────────────── */
.vapor-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 40px;
  border-bottom: 1px solid var(--border);
  background: rgba(255,255,255,.015);
  flex-shrink: 0;
}

.vapor-row__icon { color: rgba(255,255,255,.25); flex-shrink: 0; }

.vapor-row__label {
  flex: 1;
  font-size: var(--text-sm);
  color: rgba(255,255,255,.45);
}
.vapor-row__label strong { color: rgba(255,255,255,.8); font-weight: 500; }

.vapor-btns {
  display: flex;
  gap: 8px;
}

.vapor-btn {
  padding: 8px 16px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 8px;
  color: rgba(255,255,255,.4);
  font-size: var(--text-sm);
  font-family: var(--font);
  cursor: pointer;
  transition: background .15s, border-color .15s, color .15s;
  -webkit-tap-highlight-color: transparent;
}
.vapor-btn:hover { color: rgba(255,255,255,.7); border-color: rgba(255,255,255,.2); }
.vapor-btn--on {
  background: rgba(255,255,255,.09);
  border-color: rgba(255,255,255,.28);
  color: rgba(255,255,255,.9);
}

.layout-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 40px;
}

.layout-preview {
  width: 380px;
  height: 224px;
  background: rgba(255,255,255,.025);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  opacity: .55;
}

.layout-preview--left  { flex-direction: row; }
.layout-preview--right { flex-direction: row-reverse; }
.layout-preview--top   { flex-direction: column; }
.layout-preview--bottom { flex-direction: column-reverse; }

.layout-preview__vapor {
  background: rgba(255,255,255,.03);
  border-color: rgba(255,255,255,.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-shrink: 0;
}
.layout-preview--left .layout-preview__vapor,
.layout-preview--right .layout-preview__vapor {
  width: 110px;
  border-right: 1px solid rgba(255,255,255,.06);
}
.layout-preview--right .layout-preview__vapor {
  border-right: none;
  border-left: 1px solid rgba(255,255,255,.06);
}
.layout-preview--top .layout-preview__vapor,
.layout-preview--bottom .layout-preview__vapor {
  height: 70px;
  border-right: none;
  border-bottom: 1px solid rgba(255,255,255,.06);
  flex-direction: row;
  gap: 14px;
}
.layout-preview--bottom .layout-preview__vapor {
  border-bottom: none;
  border-top: 1px solid rgba(255,255,255,.06);
}

.layout-preview__orb {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(196,181,253,.18);
  border: 1px solid rgba(196,181,253,.35);
  display: block;
}

.layout-preview__vapor-label {
  font-size: 8px;
  letter-spacing: .1em;
  color: rgba(255,255,255,.2);
}

.layout-preview__content {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 16px;
}

.layout-preview__widget-mock {
  width: 48px;
  height: 62px;
  border-radius: 8px;
  background: rgba(255,165,45,.12);
  border: 1px solid rgba(255,165,45,.22);
}

.layout-placeholder__badge {
  font-size: 10px;
  letter-spacing: .12em;
  color: rgba(255,255,255,.22);
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.09);
  border-radius: var(--radius-full);
  padding: 4px 12px;
}

.layout-placeholder__title {
  font-size: 18px;
  font-weight: 300;
  color: rgba(255,255,255,.45);
}

.layout-placeholder__sub {
  font-size: var(--text-sm);
  color: rgba(255,255,255,.2);
  text-align: center;
  max-width: 400px;
  line-height: 1.5;
}

/* ── Widgets — tabs ────────────────────────────────── */
.tab-bar {
  display: flex;
  gap: 4px;
  padding: 0 36px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.tab {
  padding: 14px 16px 16px;
  background: none;
  border: none;
  font-size: var(--text-sm);
  font-family: var(--font);
  font-weight: 400;
  color: rgba(255,255,255,.32);
  cursor: pointer;
  position: relative;
  transition: color .15s;
  -webkit-tap-highlight-color: transparent;
}
.tab:hover { color: rgba(255,255,255,.55); }
.tab--on { color: rgba(255,255,255,.82); }
.tab--on::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 16px;
  right: 16px;
  height: 2px;
  background: rgba(255,255,255,.65);
  border-radius: 9999px;
}

/* ── Config de rejilla ─────────────────────────────── */
.grid-cfg {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 40px 4px;
}

.grid-cfg-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.grid-cfg__label {
  font-size: var(--text-xs);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.10em;
  color: rgba(255,255,255,0.35);
  min-width: 70px;
}

.grid-cfg__pills { display: flex; gap: 6px; }

.grid-pill {
  width: 36px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.12);
  background: transparent;
  color: rgba(255,255,255,0.35);
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.grid-pill--on {
  background: rgba(255,255,255,0.12);
  border-color: rgba(255,255,255,0.28);
  color: rgba(255,255,255,0.90);
}

.grid-stepper {
  display: flex;
  align-items: center;
  gap: 2px;
}

.grid-stepper__btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.12);
  background: transparent;
  color: rgba(255,255,255,0.55);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.grid-stepper__btn:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.9); }

.grid-stepper__val {
  min-width: 42px;
  text-align: center;
  font-size: var(--text-xs);
  color: rgba(255,255,255,0.70);
}

/* ── Tablero ───────────────────────────────────────── */
.tablero {
  flex: 1;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

.tablero-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--fg-muted);
  text-align: center;
  padding: 40px;
}
.tablero-empty p { font-size: var(--text-sm); margin: 0; }
.tablero-empty__cta {
  padding: 0.6rem 1.5rem;
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: var(--radius-full);
  color: rgba(255,255,255,.5);
  font-size: var(--text-sm);
  font-family: var(--font);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background var(--dur-fast), color var(--dur-fast);
}
.tablero-empty__cta:hover { background: rgba(255,255,255,.09); color: rgba(255,255,255,.8); }

.tablero-grid {
  flex: 1;
  overflow-y: auto;
  padding: 24px 40px 36px;
  display: grid;   /* las columnas/filas vienen del :style inline */
  align-content: start;
}

.tablero-item {
  position: relative;
  min-width: 0;
  min-height: 0;
  cursor: grab;
}

.tablero-item--dragging  { opacity: 0.25; pointer-events: none; }
.tablero-item--dragover  { outline: 2px solid rgba(255,255,255,0.35); border-radius: 20px; }

/* En modo edición: leve opacidad para los no-seleccionados */
.tablero-grid--editing .tablero-item { opacity: .75; transition: opacity .15s; }
.tablero-grid--editing .tablero-item--selected,
.tablero-grid--editing .tablero-item:hover { opacity: 1; }

/* Botón de config en esquina superior derecha */
.widget-cfg-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(20,20,24,.95);
  border: 1px solid rgba(255,255,255,.18);
  color: rgba(255,255,255,.55);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 5;
  transition: background .15s, border-color .15s, color .15s;
  -webkit-tap-highlight-color: transparent;
}
.widget-cfg-btn:hover { background: rgba(40,40,50,.98); color: rgba(255,255,255,.9); border-color: rgba(255,255,255,.3); }
.widget-cfg-btn--active {
  background: rgba(237,232,225,.12);
  border-color: rgba(237,232,225,.4);
  color: var(--ui-accent);
}

/* Panel de config que sube desde abajo */
.widget-cfg-sheet {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  background: rgba(18,18,22,.97);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-top: 1px solid rgba(255,255,255,.1);
  border-radius: 20px 20px 0 0;
  padding: 20px 36px 32px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.widget-cfg-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.widget-cfg-sheet__info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.widget-cfg-sheet__name {
  font-size: var(--text-base);
  font-weight: 400;
  color: rgba(255,255,255,.82);
}

.widget-cfg-sheet__entity {
  font-size: 0.62rem;
  color: var(--fg-muted);
  font-family: monospace;
}

.widget-cfg-sheet__close {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.1);
  color: rgba(255,255,255,.4);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  -webkit-tap-highlight-color: transparent;
}
.widget-cfg-sheet__close:hover { color: var(--fg); }

.widget-cfg-sheet__body {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.widget-cfg-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.widget-cfg-label {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: .09em;
  color: rgba(255,255,255,.3);
}

.size-pills {
  display: flex;
  gap: 6px;
}

.size-pill {
  padding: 6px 16px;
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: var(--radius-full);
  color: rgba(255,255,255,.4);
  font-size: var(--text-sm);
  font-family: var(--font);
  cursor: pointer;
  text-transform: capitalize;
  transition: background .15s, border-color .15s, color .15s;
  -webkit-tap-highlight-color: transparent;
}
.size-pill--on {
  background: rgba(237,232,225,.1);
  border-color: rgba(237,232,225,.35);
  color: var(--ui-accent);
}

.remove-widget-btn {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 18px;
  background: rgba(248,113,113,.08);
  border: 1px solid rgba(248,113,113,.2);
  border-radius: var(--radius-sm);
  color: rgba(248,113,113,.75);
  font-size: var(--text-sm);
  font-family: var(--font);
  cursor: pointer;
  transition: background .15s, border-color .15s, color .15s;
  -webkit-tap-highlight-color: transparent;
}
.remove-widget-btn:hover { background: rgba(248,113,113,.15); border-color: rgba(248,113,113,.4); color: #f87171; }

/* Transición del config sheet */
.sheet-up-enter-active { transition: transform .22s var(--ease-out), opacity .2s var(--ease-out); }
.sheet-up-leave-active { transition: transform .18s var(--ease-in), opacity .15s var(--ease-in); }
.sheet-up-enter-from { transform: translateY(100%); opacity: 0; }
.sheet-up-leave-to  { transform: translateY(100%); opacity: 0; }

/* Botón Listo en header */
.s-action--done {
  background: rgba(237,232,225,.1);
  border-color: rgba(237,232,225,.3);
  color: var(--ui-accent);
}

.catalogo-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  padding: 28px 40px;
  align-content: start;
}

.catalog-card {
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  font-family: var(--font);
  text-align: left;
  transition: background .15s, border-color .15s;
  -webkit-tap-highlight-color: transparent;
}
.catalog-card:hover { background: rgba(255,255,255,.055); border-color: rgba(255,255,255,.15); }

.catalog-card__preview {
  height: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,.18);
  border-bottom: 1px solid rgba(255,255,255,.06);
}

.catalog-card__info { padding: 14px 18px; }

.catalog-card__name {
  display: block;
  font-size: var(--text-sm);
  font-weight: 500;
  color: rgba(255,255,255,.72);
  margin-bottom: 4px;
}

.catalog-card__pack {
  font-size: var(--text-xs);
  color: rgba(255,255,255,.22);
}

/* ── Sistema ───────────────────────────────────────── */
.sistema-grid {
  flex: 1;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 16px;
  padding: 32px 40px 40px;
}

.info-card {
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 16px;
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-card__label {
  font-size: 10px;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: rgba(255,255,255,.2);
}

.info-card__title {
  font-size: 26px;
  font-weight: 300;
  letter-spacing: -.02em;
  color: rgba(255,255,255,.78);
  line-height: 1.1;
}

.info-card__title--ok { color: #4ade80; }

.info-card__sub {
  font-size: var(--text-xs);
  color: rgba(255,255,255,.28);
  margin-top: 2px;
}

/* ── Compartido ────────────────────────────────────── */
.s-body {
  flex: 1;
  overflow-y: auto;
  padding: 28px 40px 40px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.s-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.s-label {
  font-size: 10px;
  font-weight: 400;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: rgba(255,255,255,.22);
  padding: 0 2px;
}

.s-list {
  background: rgba(255,255,255,.03);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.s-row {
  display: flex;
  align-items: center;
  padding: 0 18px;
  min-height: 52px;
  gap: 12px;
  border-bottom: 1px solid var(--border);
}
.s-row:last-child { border-bottom: none; }

.s-row--tap {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}
.s-row--tap:hover { background: rgba(255,255,255,.02); }

.s-row__text {
  flex: 1;
  font-size: var(--text-sm);
  color: rgba(255,255,255,.65);
}
.s-row__text--muted { color: var(--fg-muted); }

.s-row__stack {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.s-row__mono {
  font-size: 0.62rem;
  color: var(--fg-muted);
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.s-row__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255,255,255,.15);
  flex-shrink: 0;
}
.s-row__dot--ha { background: rgba(74,222,128,.5); }

.s-row__remove {
  background: none;
  border: none;
  color: var(--fg-muted);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
}
.s-row__remove:hover { color: #f87171; }

/* ── Toggle ────────────────────────────────────────── */
.sw {
  position: relative;
  width: 44px;
  height: 26px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 13px;
  flex-shrink: 0;
  transition: background .2s, border-color .2s;
  display: inline-block;
}
.sw__knob {
  position: absolute;
  width: 20px;
  height: 20px;
  background: rgba(255,255,255,.35);
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: transform .2s, background .2s;
  display: block;
}
.sw--on { background: rgba(237,232,225,.12); border-color: rgba(237,232,225,.3); }
.sw--on .sw__knob { transform: translateX(18px); background: var(--ui-accent); }

/* ── Segmented ─────────────────────────────────────── */
.seg {
  display: flex;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.09);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.seg__btn {
  padding: 0.35rem 0.9rem;
  background: none;
  border: none;
  color: rgba(255,255,255,.35);
  font-size: var(--text-sm);
  font-family: var(--font);
  cursor: pointer;
  transition: background var(--dur-fast), color var(--dur-fast);
  -webkit-tap-highlight-color: transparent;
}
.seg__btn--on {
  background: rgba(237,232,225,.1);
  color: var(--ui-accent);
}

/* ── Chips ─────────────────────────────────────────── */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.chip {
  padding: 0.5rem 0.9rem;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.09);
  border-radius: var(--radius-full);
  color: rgba(255,255,255,.38);
  font-size: var(--text-sm);
  font-family: var(--font);
  cursor: pointer;
  transition: background var(--dur-fast), border-color var(--dur-fast), color var(--dur-fast);
  -webkit-tap-highlight-color: transparent;
}
.chip:hover { border-color: rgba(255,255,255,.18); color: rgba(255,255,255,.65); }
.chip--on {
  background: rgba(237,232,225,.08);
  border-color: rgba(237,232,225,.28);
  color: var(--ui-accent);
}

/* ── Horario nocturno ──────────────────────────────── */
.night-block {
  background: rgba(255,255,255,.025);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 12px;
  padding: 20px 22px;
}
.night-times {
  display: flex;
  align-items: flex-end;
  gap: 20px;
}
.night-time {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.night-time__label {
  font-size: 10px;
  letter-spacing: .09em;
  color: rgba(255,255,255,.25);
}
.night-arrow {
  color: rgba(255,255,255,.18);
  flex-shrink: 0;
  margin-bottom: 16px;
}

.time-field {
  display: flex;
  align-items: center;
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 10px;
  padding: 10px 14px;
  gap: 2px;
  transition: border-color var(--dur-fast);
}
.time-field:focus-within { border-color: rgba(255,255,255,.22); }

.time-num {
  background: none;
  border: none;
  color: rgba(255,255,255,.82);
  font-size: 26px;
  font-weight: 200;
  letter-spacing: -.02em;
  width: 2.2ch;
  text-align: center;
  font-family: var(--font);
  -moz-appearance: textfield;
  appearance: textfield;
}
.time-num::-webkit-outer-spin-button,
.time-num::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.time-num:focus { outline: none; }

.time-sep {
  font-size: 24px;
  font-weight: 200;
  color: rgba(255,255,255,.25);
  line-height: 1;
  user-select: none;
}

/* ── Transiciones ──────────────────────────────────── */
.screen-open-enter-active { transition: opacity .2s var(--ease-out); }
.screen-open-leave-active { transition: opacity .15s var(--ease-in); }
.screen-open-enter-from,
.screen-open-leave-to { opacity: 0; }

.nav-fwd-enter-active,
.nav-fwd-leave-active,
.nav-back-enter-active,
.nav-back-leave-active {
  transition: transform .22s var(--ease-out), opacity .22s var(--ease-out);
}
.nav-fwd-enter-from  { transform: translateX(48px); opacity: 0; }
.nav-fwd-leave-to    { transform: translateX(-28px); opacity: 0; }
.nav-back-enter-from { transform: translateX(-28px); opacity: 0; }
.nav-back-leave-to   { transform: translateX(48px); opacity: 0; }

.expand-enter-active { transition: opacity .2s ease; }
.expand-leave-active { transition: opacity .15s ease; }
.expand-enter-from,
.expand-leave-to { opacity: 0; }
</style>
