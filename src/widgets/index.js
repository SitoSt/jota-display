export const registry = {
  'home-assistant:toggle': () => import('./packs/home-assistant/ToggleWidget.vue'),
  'home-assistant:sensor': () => import('./packs/home-assistant/SensorWidget.vue'),
}

export function resolveWidget(type) {
  return registry[type] ?? null
}
