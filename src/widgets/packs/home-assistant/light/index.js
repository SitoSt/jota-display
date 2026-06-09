// src/widgets/packs/home-assistant/light/index.js
export default {
  type:        'home-assistant:light',
  label:       'Luz',
  sizes:       ['small', 'horizontal'],
  defaultSize: 'small',

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

  component: () => import('./LightWidget.vue'),
}
