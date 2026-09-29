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

export interface ModelInfo {
  name: string
  version: string
  alias: string
  creation_timestamp?: number
  metrics?: Record<string, number>
}

export async function fetchModelInfo(baseURL?: string): Promise<ModelInfo> {
  const url = baseURL ?? (useRuntimeConfig().mlServiceUrl as string | undefined)
  if (!url) throw new Error('NUXT_ML_SERVICE_URL n\'est pas configuré')
  return $fetch('/model', { method: 'GET', baseURL: url })
}

export interface TrainingResponse {
  status: string
}

export async function triggerTraining(baseURL?: string): Promise<TrainingResponse> {
  const url = baseURL ?? (useRuntimeConfig().mlServiceUrl as string | undefined)
  if (!url) throw new Error('NUXT_ML_SERVICE_URL n\'est pas configuré')
  return $fetch('/training', { method: 'POST', baseURL: url })
}

export async function fetchPredictions(
  requests: PredictionRequestItem[],
  baseURL?: string
): Promise<PredictionResponseItem[]> {
  const url = baseURL ?? (useRuntimeConfig().mlServiceUrl as string | undefined)
  if (!url) throw new Error('NUXT_ML_SERVICE_URL n\'est pas configuré')
  return $fetch<PredictionResponseItem[]>('/predictions', {
    baseURL: url,
    method: 'POST',
    body: requests
  })
}
