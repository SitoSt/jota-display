<!-- src/components/EntityBrowser.vue -->
<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useHA } from '../composables/useHA.js'
import { useWidgets } from '../composables/useWidgets.js'

const router = useRouter()
const { entities } = useHA()
const { addWidgets } = useWidgets()

const PANEL = ref('bottom-bar')

const selected = ref({})   // entity_id → boolean
const names    = ref({})   // entity_id → string (editable)

const DOMAIN_LABELS = {
  light:  'Luces',
  sensor: 'Sensores',
  switch: 'Interruptores',
}
const DOMAIN_ORDER = ['light', 'sensor', 'switch']

const groups = computed(() => {
  const all = Object.values(entities.value)
  const byDomain = {}
  for (const e of all) {
    const domain = e.entity_id.split('.')[0]
    if (!byDomain[domain]) byDomain[domain] = []
    byDomain[domain].push(e)
  }

  const result = []
  // Grupos en orden predefinido primero
  for (const domain of DOMAIN_ORDER) {
    if (byDomain[domain]?.length) {
      result.push({
        domain,
        label: DOMAIN_LABELS[domain] ?? domain,
        entities: byDomain[domain].sort((a, b) =>
          (a.attributes.friendly_name ?? a.entity_id)
            .localeCompare(b.attributes.friendly_name ?? b.entity_id)
        ),
      })
    }
  }
  // Resto (Otros)
  const others = Object.entries(byDomain)
    .filter(([d]) => !DOMAIN_ORDER.includes(d))
    .flatMap(([, ents]) => ents)
    .sort((a, b) =>
      (a.attributes.friendly_name ?? a.entity_id)
        .localeCompare(b.attributes.friendly_name ?? b.entity_id)
    )
  if (others.length) {
    result.push({ domain: 'other', label: 'Otros', entities: others })
  }
  return result
})

const selectedCount = computed(() =>
  Object.values(selected.value).filter(Boolean).length
)

function toggleEntity(entityId, friendlyName) {
  if (selected.value[entityId]) {
    selected.value[entityId] = false
  } else {
    selected.value[entityId] = true
    if (!names.value[entityId]) {
      names.value[entityId] = friendlyName ?? entityId
    }
  }
}

function inferType(entityId) {
  const domain = entityId.split('.')[0]
  if (domain === 'sensor') return 'home-assistant:sensor'
  return 'home-assistant:toggle'
}

function formatState(entity) {
  const s = entity.state
  if (s === 'on') return 'encendido'
  if (s === 'off') return 'apagado'
  const unit = entity.attributes.unit_of_measurement
  return unit ? `${s} ${unit}` : s
}

function confirm() {
  const items = Object.entries(selected.value)
    .filter(([, v]) => v)
    .map(([entityId]) => ({
      type:   inferType(entityId),
      entity: entityId,
      label:  names.value[entityId] ?? entityId,
      size:   'small',
      panel:  PANEL.value,
    }))
  addWidgets(items)
  router.push('/widgets')
}

function cancel() {
  router.push('/widgets')
}
</script>

<template>
  <div class="entity-browser">
    <!-- Header -->
    <header class="entity-browser__header">
      <button class="entity-browser__cancel" @click="cancel">Cancelar</button>
      <h1 class="entity-browser__title">Elige entidades</h1>
      <select class="entity-browser__panel-select" v-model="PANEL">
        <option value="bottom-bar">bottom-bar</option>
      </select>
    </header>

    <!-- Cargando -->
    <div v-if="groups.length === 0" class="entity-browser__empty">
      Conectando con Home Assistant…
    </div>

    <!-- Lista agrupada -->
    <ul v-else class="entity-browser__list">
      <template v-for="group in groups" :key="group.domain">
        <li class="entity-browser__group-header">{{ group.label }}</li>
        <li
          v-for="entity in group.entities"
          :key="entity.entity_id"
          class="entity-browser__item"
          :class="{ 'entity-browser__item--selected': selected[entity.entity_id] }"
          @click="toggleEntity(entity.entity_id, entity.attributes.friendly_name)"
        >
          <div class="entity-browser__item-row">
            <div class="entity-browser__item-info">
              <span class="entity-browser__item-name">
                {{ entity.attributes.friendly_name ?? entity.entity_id }}
              </span>
              <span class="entity-browser__item-state">{{ formatState(entity) }}</span>
            </div>
            <input
              type="checkbox"
              class="entity-browser__checkbox"
              :checked="selected[entity.entity_id]"
              @click.stop="toggleEntity(entity.entity_id, entity.attributes.friendly_name)"
            />
          </div>
          <!-- Campo de nombre editable (visible solo cuando está seleccionado) -->
          <div
            v-if="selected[entity.entity_id]"
            class="entity-browser__name-edit"
            @click.stop
          >
            <input
              v-model="names[entity.entity_id]"
              class="entity-browser__name-input"
              placeholder="Nombre del widget"
            />
          </div>
        </li>
      </template>
    </ul>

    <!-- Botón flotante "Crear N" -->
    <Transition name="btn-pop">
      <button
        v-if="selectedCount > 0"
        class="entity-browser__confirm-btn"
        @click="confirm"
      >
        Crear {{ selectedCount }} widget{{ selectedCount === 1 ? '' : 's' }}
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.entity-browser {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  overflow: hidden;
}

.entity-browser__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.entity-browser__cancel {
  background: none;
  border: none;
  color: var(--fg-dim);
  font-family: var(--font);
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0.25rem 0;
  flex-shrink: 0;
}

.entity-browser__title {
  flex: 1;
  font-size: 0.9rem;
  font-weight: var(--fw-medium);
  color: var(--fg);
  text-align: center;
}

.entity-browser__panel-select {
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--fg-dim);
  font-family: var(--font);
  font-size: 0.65rem;
  border-radius: var(--radius-sm);
  padding: 0.25rem 0.4rem;
  flex-shrink: 0;
}

.entity-browser__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: var(--fg-dim);
}

.entity-browser__list {
  list-style: none;
  overflow-y: auto;
  flex: 1;
  padding-bottom: 5rem;
}

.entity-browser__group-header {
  padding: 0.5rem 1rem 0.25rem;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--fg-muted);
  background: var(--surface);
  position: sticky;
  top: 0;
  z-index: 1;
}

.entity-browser__item {
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background var(--dur-fast);
}

.entity-browser__item:active { background: var(--surface); }
.entity-browser__item--selected { background: rgba(74, 222, 128, 0.04); }

.entity-browser__item-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
}

.entity-browser__item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.entity-browser__item-name {
  font-size: 0.8rem;
  color: var(--fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entity-browser__item-state {
  font-size: 0.65rem;
  color: var(--fg-muted);
  text-transform: lowercase;
}

.entity-browser__checkbox {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  accent-color: var(--accent);
  cursor: pointer;
}

.entity-browser__name-edit {
  padding: 0 1rem 0.75rem;
}

.entity-browser__name-input {
  width: 100%;
  background: var(--surface-2);
  border: 1px solid rgba(74, 222, 128, 0.3);
  border-radius: var(--radius-sm);
  color: var(--fg);
  font-family: var(--font);
  font-size: 0.8rem;
  padding: 0.4rem 0.6rem;
}

.entity-browser__confirm-btn {
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
  font-size: 0.85rem;
  padding: 0.8rem 2rem;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(74, 222, 128, 0.35);
  white-space: nowrap;
}

/* Transición del botón de confirmación */
.btn-pop-enter-active,
.btn-pop-leave-active {
  transition: transform var(--dur-fast) var(--ease-out), opacity var(--dur-fast);
}
.btn-pop-enter-from,
.btn-pop-leave-to {
  transform: translateX(-50%) translateY(1rem);
  opacity: 0;
}
</style>
