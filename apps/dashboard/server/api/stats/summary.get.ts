import { createError, defineEventHandler } from 'h3'
import { parkSummarySchema } from '../../../shared/parkSummarySchema'
import { fetchMockApi } from '../../utils/mockApiClient'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  let réponse: unknown
  try {
    réponse = await fetchMockApi('/api/v1/stats/summary')
  } catch (erreur) {
    throw createError({ status: 503, statusText: 'Source de données indisponible', cause: erreur })
  }

  const parse = parkSummarySchema.safeParse(réponse)
  if (!parse.success) {
    throw createError({ status: 502, statusText: 'Réponse inattendue de la source' })
  }

  return parse.data
})
