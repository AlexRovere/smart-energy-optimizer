import { createError, defineEventHandler, getRouterParam, readValidatedBody } from 'h3'
import { z } from 'zod'
import { requireAccount } from '../../../utils/guard'
import { logger } from '../../../utils/logger'
import { fetchModelInfo, fetchPredictions } from '../../../utils/mlClient'
import { hoursInHorizon } from '../../../utils/predictionHorizon'

const siteIdSchema = z.string().regex(/^SITE\d{3}$/)
const bodySchema = z.object({
  horizon_hours: z.number().int().min(1).max(48).default(24)
})

export default defineEventHandler(async (event) => {
  await requireAccount(event)

  const id = getRouterParam(event, 'id')
  const parseId = siteIdSchema.safeParse(id)
  if (!parseId.success) {
    throw createError({ status: 422, statusText: 'Identifiant de site invalide' })
  }

  const body = await readValidatedBody(event, (raw) => bodySchema.safeParse(raw ?? {}))
  if (!body.success) {
    throw createError({ status: 422, statusText: 'Paramètres de requête invalide' })
  }

  const { horizon_hours } = body.data
  const siteId = parseId.data

  try {
    const heures = hoursInHorizon(new Date(), horizon_hours)
    const requests = heures.map(d => ({
      site_id: siteId,
      date: d.toISOString().slice(0, 10),
      hour: d.getUTCHours()
    }))
    const [items, modèle] = await Promise.all([
      fetchPredictions(requests),
      fetchModelInfo()
    ])
    return {
      site_id: siteId,
      predicted_at: new Date().toISOString(),
      horizon_hours,
      granularity: 'hour' as const,
      model_version: modèle.version,
      predictions: items.map(item => ({
        timestamp: item.timestamp,
        predicted_consumption_kw: item.consumption_kwh
      }))
    }
  } catch (err) {
    logger.error('Service de prédiction indisponible', {
      route: event.path,
      siteId,
      message: err instanceof Error ? err.message : String(err),
    })
    throw createError({ status: 503, statusText: 'Service de prédiction indisponible' })
  }
})