import { createError, defineEventHandler } from 'h3'
import { parkSummarySchema } from '../../../shared/parkSummarySchema'
import { fetchMockApi } from '../../utils/mockApiClient'

export default defineEventHandler(async (event) => {
  // #29 — requireUserSession(event) bloqué par l'incompatibilité de types
  // entre nuxt-auth-utils (h3 v1) et Nuxt 4 (h3 v2).
  // TODO: À rétablir quand le module sera mis à jour.
  void event

  let réponse: unknown
  try {
    réponse = await fetchMockApi('/api/v1/stats/summary')
  } catch (erreur) {
    throw createError({ status: 503, statusText: 'Source de données indisponible' })
  }

  const parse = parkSummarySchema.safeParse(réponse)
  if (!parse.success) {
    throw createError({ status: 502, statusText: 'Réponse inattendue de la source' })
  }

  return parse.data
})
