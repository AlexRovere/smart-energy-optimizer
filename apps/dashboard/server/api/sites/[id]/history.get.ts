import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3'
import { z } from 'zod'
import { querySiteHistory } from '../../../utils/parquetReader'
import { requireAccount } from '../../../utils/guard'
import { logger } from '../../../utils/logger'

const siteIdSchema = z.string().regex(/^SITE\d{3}$/)

const querySchema = z.object({
  from: z.string().datetime({ message: 'from doit être un horodatage ISO 8601 valide' }),
  to: z.string().datetime({ message: 'to doit être un horodatage ISO 8601 valide' }),
  limit: z.coerce.number().int().min(1).max(1000).default(500)
})

export default defineEventHandler(async (event) => {
  await requireAccount(event)

  const id = getRouterParam(event, 'id')
  const parsedId = siteIdSchema.safeParse(id)
  if (!parsedId.success) {
    throw createError({ status: 422, statusText: 'Identifiant de site invalide' })
  }

  const query = getQuery(event)
  const parsedQuery = querySchema.safeParse(query)
  if (!parsedQuery.success) {
    throw createError({ status: 422, statusText: 'Paramètres de requête invalides' })
  }

  const { from, to, limit } = parsedQuery.data

  try {
    return await querySiteHistory(parsedId.data, from, to, limit)
  } catch (err) {
    logger.error('Échec lecture historique Parquet', {
      route: event.path,
      siteId: parsedId.data,
      message: err instanceof Error ? err.message : String(err),
    })
    throw createError({ status: 503, statusText: 'Historique indisponible' })
  }
})
