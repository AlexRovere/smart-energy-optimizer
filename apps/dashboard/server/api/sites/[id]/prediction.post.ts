import { createError, defineEventHandler, getRouterParam, readValidatedBody } from 'h3'
import { z } from 'zod'
import { requireSiteAccess } from '../../../utils/guard'
import { logger } from '../../../utils/logger'
import { fetchModelInfo, fetchPredictions } from '../../../utils/mlClient'
import { predictionFailure } from '../../../utils/predictionFailure'
import { hoursInHorizon } from '../../../utils/predictionHorizon'

const bodySchema = z.object({
  horizon_hours: z.number().int().min(1).max(48).default(24)
})

export default defineEventHandler(async (event) => {
  const { siteId } = await requireSiteAccess(event, getRouterParam(event, 'id'))

  const body = await readValidatedBody(event, (raw) => bodySchema.safeParse(raw ?? {}))
  if (!body.success) {
    throw createError({ status: 422, statusText: 'Paramètres de requête invalide' })
  }

  const { horizon_hours } = body.data

  try {
    const hours = hoursInHorizon(new Date(), horizon_hours)
    const requests = hours.map(d => ({
      site_id: siteId,
      date: d.toISOString().slice(0, 10),
      hour: d.getUTCHours()
    }))
    const [items, model] = await Promise.all([
      fetchPredictions(requests),
      fetchModelInfo()
    ])
    return {
      site_id: siteId,
      predicted_at: new Date().toISOString(),
      horizon_hours,
      granularity: 'hour' as const,
      model_version: model.version,
      predictions: items.map(item => ({
        timestamp: item.timestamp,
        predicted_consumption_kw: item.consumption_kwh
      }))
    }
  } catch (err) {
    const { status, message } = predictionFailure(err)
    logger.error(message, {
      route: event.path,
      siteId,
      message: err instanceof Error ? err.message : String(err),
    })
    throw createError({ status, statusText: message })
  }
})