// Client du service ML réel : POST /predictions, contrat lu dans apps/ml/src/api/schemas.py (docs/api.md n'est pas à jour, #175).
import { $fetch } from 'ofetch'

export interface PredictionRequestItem {
  site_id: string
  date: string
  hour: number
}

export interface PredictionResponseItem {
  site_id: string
  timestamp: string
  consumption_kwh: number
}

export async function fetchPredictions(
  requests: PredictionRequestItem[],
  baseUrl: string = useRuntimeConfig().mlServiceUrl as string
): Promise<PredictionResponseItem[]> {
  return $fetch<PredictionResponseItem[]>('/predictions', {
    baseURL: baseUrl,
    method: 'POST',
    body: requests
  })
}
