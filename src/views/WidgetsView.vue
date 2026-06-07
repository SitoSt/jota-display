<!-- src/views/WidgetsView.vue -->
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWidgets } from '../composables/useWidgets.js'

const router = useRouter()
const { widgets, removeWidget, updateWidget } = useWidgets()

const editingId  = ref(null)
const editLabel  = ref('')
const editPanel  = ref('bottom-bar')

const swipingId    = ref(null)
let swipeStartX    = 0
const SWIPE_THRESHOLD = 60

const PANELS = ['bottom-bar']

const TYPE_ICON = {
  'home-assistant:light':  '💡',
  'home-assistant:sensor': '📊',
}

function typeIcon(type) {
  return TYPE_ICON[type] ?? '⚙️'
}

function startEdit(w) {
  editingId.value = w.id
  editLabel.value  = w.label
  editPanel.value  = w.panel
}

function commitEdit() {
  if (!editingId.value) return
  updateWidget(editingId.value, { label: editLabel.value, panel: editPanel.value })
  editingId.value = null
}

function cancelEdit() {
  editingId.value = null
}

function onItemPointerDown(e, id) {
  swipeStartX = e.clientX
  swipingId.value = null
  e.currentTarget.setPointerCapture(e.pointerId)
}

function onItemPointerMove(e, id) {
  const dx = e.clientX - swipeStartX
  if (dx < -SWIPE_THRESHOLD) {
    swipingId.value = id
  } else if (dx > 10) {
    swipingId.value = null
  }
}

function onItemPointerUp(e, id) {
  // El tap (sin deslizamiento) abre edición
  const dx = Math.abs(e.clientX - swipeStartX)
  if (dx < 10 && swipingId.value !== id) {
    const w = widgets.value.find(w => w.id === id)
    if (w) startEdit(w)
  }
}
</script>

<template>
  <div class="widgets-view">
    <header class="widgets-view__header">
      <h1 class="widgets-view__title">Widgets</h1>
    </header>

    <!-- Lista vacía -->
    <div v-if="widgets.length === 0" class="widgets-view__empty">
      No hay widgets configurados. Pulsa Añadir para empezar.
    </div>

    <!-- Lista de widgets -->
    <ul v-else class="widgets-view__list">
      <li
        v-for="w in widgets"
        :key="w.id"
        class="widget-item"
        :class="{ 'widget-item--swiped': swipingId === w.id }"
      >
        <!-- Fila principal -->
        <div
          class="widget-item__row"
          @pointerdown="(e) => onItemPointerDown(e, w.id)"
          @pointermove="(e) => onItemPointerMove(e, w.id)"
          @pointerup="(e) => onItemPointerUp(e, w.id)"
        >
          <span class="widget-item__icon">{{ typeIcon(w.type) }}</span>
          <div class="widget-item__info">
            <span class="widget-item__label">{{ w.label }}</span>
            <span class="widget-item__entity">{{ w.entity }}</span>
          </div>
          <span class="widget-item__panel">{{ w.panel }}</span>
          <button
            class="widget-item__delete"
            @click.stop="removeWidget(w.id)"
          >✕</button>
        </div>

        <!-- Edición inline -->
        <div v-if="editingId === w.id" class="widget-item__edit">
          <input
            v-model="editLabel"
            class="widget-item__input"
            placeholder="Nombre"
          />
          <select v-model="editPanel" class="widget-item__select">
            <option v-for="p in PANELS" :key="p" :value="p">{{ p }}</option>
          </select>
          <div class="widget-item__edit-actions">
            <button class="widget-item__btn widget-item__btn--save" @click="commitEdit">Guardar</button>
            <button class="widget-item__btn" @click="cancelEdit">Cancelar</button>
          </div>
        </div>
      </li>
    </ul>

    <!-- Botón fijo "Añadir widgets" -->
    <button class="widgets-view__add-btn" @click="router.push('/widgets/browser')">
      + Añadir widgets
    </button>
  </div>
</template>

<style scoped>
.widgets-view {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  overflow: hidden;
}

.widgets-view__header {
  padding: 1.5rem 1rem 0.75rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.widgets-view__title {
  font-size: 1rem;
  font-weight: var(--fw-medium);
  color: var(--fg);
}

.widgets-view__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 0.75rem;
  color: var(--fg-dim);
  padding: 2rem;
  line-height: 1.6;
}

.widgets-view__list {
  list-style: none;
  overflow-y: auto;
  flex: 1;
  padding: 0.5rem 0;
}

.widget-item {
  border-bottom: 1px solid var(--border);
  overflow: hidden;
}

.widget-item__row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  user-select: none;
  cursor: pointer;
  transition: background var(--dur-fast);
}

.widget-item__row:hover { background: var(--surface); }

.widget-item__icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.widget-item__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.widget-item__label {
  font-size: 0.8rem;
  color: var(--fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.widget-item__entity {
  font-size: 0.65rem;
  color: var(--fg-muted);
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.widget-item__panel {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-dim);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  padding: 0.2rem 0.5rem;
  flex-shrink: 0;
}

.widget-item__delete {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--fg-muted);
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: var(--radius-sm);
  transition: color var(--dur-fast), background var(--dur-fast);
}

.widget-item__delete:hover {
  color: #f87171;
  background: rgba(248, 113, 113, 0.1);
}

/* Edición inline */
.widget-item__edit {
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--surface);
  border-top: 1px solid var(--border);
}

.widget-item__input,
.widget-item__select {
  width: 100%;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--fg);
  font-family: var(--font);
  font-size: 0.8rem;
  padding: 0.4rem 0.6rem;
}

.widget-item__edit-actions {
  display: flex;
  gap: 0.5rem;
}

.widget-item__btn {
  flex: 1;
  padding: 0.4rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--fg-dim);
  font-family: var(--font);
  font-size: 0.7rem;
  cursor: pointer;
}

.widget-item__btn--save {
  border-color: rgba(74, 222, 128, 0.3);
  color: #4ade80;
}

/* Botón fijo inferior */
.widgets-view__add-btn {
  position: absolute;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  background: var(--accent);
  color: #000;
  border: none;
  border-radius: var(--radius-full);
  font-family: var(--font);
  font-weight: var(--fw-medium);
  font-size: 0.8rem;
  padding: 0.7rem 1.8rem;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(74, 222, 128, 0.35);
  white-space: nowrap;
}
</style>
