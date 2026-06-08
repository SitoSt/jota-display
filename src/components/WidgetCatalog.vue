<!-- src/components/WidgetCatalog.vue -->
<script setup>
import { ref, computed } from 'vue'
import { registry } from '../widgets/index.js'
import { useHA } from '../composables/useHA.js'
import { useWidgets } from '../composables/useWidgets.js'

const emit = defineEmits(['done'])

const { entities } = useHA()
const { addWidgets } = useWidgets()

const step = ref(1)
const selectedType = ref(null)
const selectedEntity = ref(null)
const customLabel = ref('')

const types = Object.values(registry)

const compatibleEntities = computed(() => {
  if (!selectedType.value) return []
  const domain = selectedType.value.configSchema?.entity?.domain
  const all = Object.values(entities.value)
  return domain ? all.filter(e => e.entity_id.startsWith(domain + '.')) : all
})

function pickType(def) {
  selectedType.value = def
  step.value = 2
}

function pickEntity(entity) {
  selectedEntity.value = entity
  customLabel.value = entity.attributes.friendly_name ?? entity.entity_id
  step.value = 3
}

function confirm() {
  addWidgets([{
    type:   selectedType.value.type,
    entity: selectedEntity.value.entity_id,
    label:  customLabel.value || selectedEntity.value.attributes.friendly_name || selectedEntity.value.entity_id,
    size:   selectedType.value.defaultSize,
    panel:  'bottom-bar',
  }])
  emit('done')
}

function back() {
  if (step.value > 1) step.value--
}
</script>

<template>
  <div class="widget-catalog">

    <!-- Paso 1: catálogo de tipos -->
    <div v-if="step === 1" data-step="1" class="catalog-step">
      <div class="catalog-step__title">Tipo de widget</div>
      <div class="catalog-grid">
        <button
          v-for="def in types"
          :key="def.type"
          class="catalog-card"
          :data-type="def.type"
          @click="pickType(def)"
        >
          {{ def.label }}
        </button>
      </div>
    </div>

    <!-- Paso 2: picker de entidad -->
    <div v-else-if="step === 2" data-step="2" class="catalog-step">
      <button class="catalog-back" @click="back">← Atrás</button>
      <div class="catalog-step__title">Elige dispositivo</div>
      <div v-if="compatibleEntities.length === 0" class="catalog-empty">
        No hay dispositivos compatibles disponibles
      </div>
      <ul v-else class="catalog-entity-list">
        <li
          v-for="entity in compatibleEntities"
          :key="entity.entity_id"
          class="catalog-entity"
          :data-entity="entity.entity_id"
          @click="pickEntity(entity)"
        >
          <span class="catalog-entity__name">{{ entity.attributes.friendly_name ?? entity.entity_id }}</span>
          <span class="catalog-entity__id">{{ entity.entity_id }}</span>
        </li>
      </ul>
    </div>

    <!-- Paso 3: nombre personalizado -->
    <div v-else-if="step === 3" data-step="3" class="catalog-step">
      <button class="catalog-back" @click="back">← Atrás</button>
      <div class="catalog-step__title">Nombre del widget</div>
      <input
        v-model="customLabel"
        class="catalog-input"
        placeholder="Nombre personalizado"
      />
      <button
        class="catalog-confirm"
        data-action="confirm"
        @click="confirm"
      >
        Añadir widget
      </button>
    </div>

  </div>
</template>

<style scoped>
.widget-catalog {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.catalog-step__title {
  font-size: var(--text-sm);
  color: var(--fg-dim);
  font-weight: var(--fw-medium);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.5rem;
}

.catalog-back {
  background: none;
  border: none;
  color: var(--fg-muted);
  font-size: var(--text-sm);
  cursor: pointer;
  padding: 0;
  margin-bottom: 0.5rem;
  font-family: var(--font);
}

.catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 0.5rem;
}

.catalog-card {
  padding: 0.75rem 0.5rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--fg-dim);
  font-size: var(--text-sm);
  cursor: pointer;
  text-align: center;
  font-family: var(--font);
  transition: border-color var(--dur-fast), color var(--dur-fast);
}
.catalog-card:hover { border-color: var(--accent); color: var(--fg); }

.catalog-entity-list { list-style: none; display: flex; flex-direction: column; gap: 0.25rem; }

.catalog-entity {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.6rem 0.75rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: border-color var(--dur-fast);
}
.catalog-entity:hover { border-color: var(--accent); }

.catalog-entity__name { font-size: var(--text-sm); color: var(--fg); }
.catalog-entity__id   { font-size: 0.65rem; color: var(--fg-muted); font-family: monospace; }

.catalog-empty {
  font-size: var(--text-sm);
  color: var(--fg-muted);
  text-align: center;
  padding: 1rem 0;
}

.catalog-input {
  width: 100%;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--fg);
  font-family: var(--font);
  font-size: var(--text-sm);
  padding: 0.5rem 0.6rem;
}

.catalog-confirm {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.65rem;
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.4);
  border-radius: var(--radius);
  color: var(--accent);
  font-family: var(--font);
  font-size: var(--text-sm);
  font-weight: var(--fw-medium);
  cursor: pointer;
}
</style>
