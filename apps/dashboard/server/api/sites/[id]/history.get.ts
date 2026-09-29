import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3'
import { z } from 'zod'
import { MAX_RANGE_DAYS } from '../../../../shared/historyRange'
import { querySiteHistory } from '../../../utils/parquetReader'
import { requireSiteAccess } from '../../../utils/guard'
import { logger } from '../../../utils/logger'

// Plage bornée à un trimestre. Mesuré le 29 septembre 2026 sur un an de données,
// une fois les partitions élaguées : 20 ms pour un jour, 0,27 s pour les 2 208
// points de 92 jours, sérialisation comprise (contre 1,06 s pour toute plage
// avant l'élagage). Au-delà du coût, c'est le graphique qui décide : 2 208
// points horaires restent lisibles, les 8 760 d'une année ne le sont plus.
const HOUR_MS = 3_600_000
// Une heure de marge : une plage de journées locales qui traverse le passage à
// l'heure d'hiver dure une heure de plus.
const MAX_SPAN_MS = MAX_RANGE_DAYS * 24 * HOUR_MS + HOUR_MS
const MAX_POINTS = MAX_SPAN_MS / HOUR_MS

const querySchema = z.object({
  from: z.string().datetime({ message: 'from doit être un horodatage ISO 8601 valide' }),
  to: z.string().datetime({ message: 'to doit être un horodatage ISO 8601 valide' }),
  limit: z.coerce.number().int().min(1).max(MAX_POINTS).optional()
})

export default defineEventHandler(async (event) => {
  const { siteId } = await requireSiteAccess(event, getRouterParam(event, 'id'))

  const query = getQuery(event)
  const parsedQuery = querySchema.safeParse(query)
  if (!parsedQuery.success) {
    throw createError({ status: 422, statusText: 'Paramètres de requête invalides' })
  }

  const { from, to } = parsedQuery.data
  const span = Date.parse(to) - Date.parse(from)
  if (span <= 0) {
    throw createError({ status: 422, statusText: 'La fin de la plage doit suivre son début' })
  }
  if (span > MAX_SPAN_MS) {
    throw createError({ status: 422, statusText: `Plage trop longue : ${MAX_RANGE_DAYS} jours au plus` })
  }
  // Sans limite explicite, un point par heure de la plage : rien n'est tronqué.
  const limit = parsedQuery.data.limit ?? Math.ceil(span / HOUR_MS)

  try {
    return await querySiteHistory(siteId, from, to, limit)
  } catch (err) {
    logger.error('Échec lecture historique Parquet', {
      route: event.path,
      siteId,
      message: err instanceof Error ? err.message : String(err),
    })
    throw createError({ status: 503, statusText: 'Historique indisponible' })
  }
})
