// src/widgets/index.js
import lightDef  from './packs/home-assistant/light/index.js'
import sensorDef from './packs/home-assistant/sensor/index.js'

export const registry = {
  [lightDef.type]:  lightDef,
  [sensorDef.type]: sensorDef,
}

export function resolveWidget(type) {
  return registry[type]?.component ?? null
}

export function resolveDefinition(type) {
  return registry[type] ?? null
}
