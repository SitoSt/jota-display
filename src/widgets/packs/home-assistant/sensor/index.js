// src/widgets/packs/home-assistant/sensor/index.js
export default {
  type:        'home-assistant:sensor',
  label:       'Sensor',
  sizes:       ['small', 'medium'],
  defaultSize: 'small',

  configSchema: {
    entity: { type: 'ha-entity', domain: 'sensor', required: true },
    label:  { type: 'string', optional: true },
    unit:   { type: 'string', optional: true },
  },

  fields: {
    value: (state, config) => {
      const unit = config.unit ?? state.attributes.unit_of_measurement ?? ''
      return unit ? `${state.state} ${unit}` : state.state
    },
    label: (state, config) =>
      config.label ?? state.attributes.friendly_name ?? config.entity,
  },

  previewState: {
    state: '21.5',
    attributes: { unit_of_measurement: '°C', friendly_name: 'Temperatura' },
  },

  component: () => import('./SensorWidget.vue'),
}
