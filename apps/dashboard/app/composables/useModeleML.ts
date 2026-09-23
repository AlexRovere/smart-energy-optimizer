import type { ModelInfo } from '~/types/api'

export function useModeleML() {
  const { data, refresh, error } = useFetch<ModelInfo>('/api/model')
  return {
    modele: data,
    rafraichirModele: refresh,
    disponible: computed(() => error.value == null),
  }
}
