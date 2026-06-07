export const registry = {
  'home-assistant:light':  () => import('./packs/home-assistant/LightWidget.vue'),
  'home-assistant:toggle': () => import('./packs/home-assistant/LightWidget.vue'),
  'home-assistant:sensor': () => import('./packs/home-assistant/SensorWidget.vue'),
}

export function resolveWidget(type) {
  return registry[type] ?? null
}
