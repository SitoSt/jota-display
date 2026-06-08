import { computed } from 'vue'
import { useHA } from './useHA.js'

export function useWidget(props) {
  const { entities, connected, loading, callService } = useHA()

  const state = computed(() => entities.value[props.config.entity] ?? null)
  const isConnected = computed(() => connected.value)
  const isLoading   = computed(() => loading.value)
  const isAvailable = computed(() =>
    state.value !== null && state.value.state !== 'unavailable'
  )

  function dispatch(service, extraData = {}) {
    const [domain, svc] = service.split('.')
    callService(domain, svc, { entity_id: props.config.entity, ...extraData })
  }

  return { state, isConnected, isLoading, isAvailable, config: props.config, dispatch }
}
