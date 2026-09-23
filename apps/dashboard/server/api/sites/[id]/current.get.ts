import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { energyReadingSchema } from '../../../../shared/energyReadingSchema'
import { requireSiteAccess } from '../../../utils/guard'
import { fetchMockApi } from '../../../utils/mockApiClient'
import { logger } from '../../../utils/logger'

export default defineEventHandler(async (event) => {
  const { siteId } = await requireSiteAccess(event, getRouterParam(event, 'id'))

  try {
    const raw = await fetchMockApi<unknown>(`/api/v1/sites/${siteId}/current`)
    return energyReadingSchema.parse(raw)
  }
  catch (err) {
    if (err instanceof z.ZodError) {
      throw createError({ status: 422, statusText: 'Réponse source invalide', cause: err })
    }
    logger.error('Lecture courante indisponible', {
      route: event.path,
      siteId,
      message: err instanceof Error ? err.message : String(err),
    })
    throw createError({ status: 503, statusText: 'Lecture courante indisponible' })
  }
})
