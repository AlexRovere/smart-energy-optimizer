import { createError, defineEventHandler } from 'h3'
import { parkSummarySchema } from '../../../shared/parkSummarySchema'
import { fetchMockApi } from '../../utils/mockApiClient'
import { requireAccount } from '../../utils/guard'
import { logger } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  await requireAccount(event)

  let réponse: unknown
  try {
    réponse = await fetchMockApi('/api/v1/stats/summary')
  } catch (erreur) {
    logger.error('Source de données indisponible', {
      route: event.path,
      message: erreur instanceof Error ? erreur.message : String(erreur),
    })
    throw createError({ status: 503, statusText: 'Source de données indisponible', cause: erreur })
  }

  const parse = parkSummarySchema.safeParse(réponse)
  if (!parse.success) {
    throw createError({ status: 502, statusText: 'Réponse inattendue de la source' })
  }

  return parse.data
})
