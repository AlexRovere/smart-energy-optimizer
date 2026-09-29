import type { ModelInfo } from '~/types/api'

export function useMlModel() {
  const { data, refresh, error } = useFetch<ModelInfo>('/api/model')
  return {
    model: data,
    refreshModel: refresh,
    available: computed(() => error.value == null),
  }
}
