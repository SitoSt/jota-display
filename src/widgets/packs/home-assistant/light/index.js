// src/widgets/packs/home-assistant/light/index.js
export default {
  type:        'home-assistant:light',
  label:       'Luz',
  minCols:     2,
  minRows:     2,
  defaultCols: 4,
  defaultRows: 3,

  configSchema: {
    entity: { type: 'ha-entity', domain: 'light', required: true },
    label:  { type: 'string', optional: true },
  },

  fields: {
    value: (state, config) =>
      state.state === 'on'
        ? Math.round((state.attributes.brightness ?? 0) / 2.55) + '%'
        : 'OFF',
    label: (state, config) =>
      config.label ?? state.attributes.friendly_name ?? config.entity,
  },

  actions: {
    toggle:    { service: 'light.toggle',   data: (c)       => ({ entity_id: c.entity }) },
    turnOff:   { service: 'light.turn_off', data: (c)       => ({ entity_id: c.entity }) },
    setBright: { service: 'light.turn_on',  data: (c, xtra) => ({ entity_id: c.entity, brightness_pct: xtra.pct }) },
    setColor:  { service: 'light.turn_on',  data: (c, xtra) => ({ entity_id: c.entity, rgb_color: xtra.rgb }) },
  },

  previewState: {
    state: 'on',
    attributes: { friendly_name: 'Ejemplo', brightness: 191, rgb_color: [255, 200, 80] },
  },

  component: () => import('./LightWidget.vue'),
}
