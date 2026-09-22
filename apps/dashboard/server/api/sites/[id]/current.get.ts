import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { energyReadingSchema } from '../../../../shared/energyReadingSchema'
import { requireAccount } from '../../../utils/guard'
import { fetchMockApi } from '../../../utils/mockApiClient'
import { logger } from '../../../utils/logger'

const siteIdSchema = z.string().regex(/^SITE\d{3}$/)

export default defineEventHandler(async (event) => {
  // La garde vient AVANT la validation de l'identifiant : un anonyme n'a pas à
  // apprendre, par un 422, quelles formes d'identifiant existent.
  await requireAccount(event)

  const id = getRouterParam(event, 'id')
  const parsed = siteIdSchema.safeParse(id)
  if (!parsed.success) {
    throw createError({ status: 422, statusText: 'Identifiant de site invalide' })
  }

  const { mockApiUrl } = useRuntimeConfig()

  try {
    const raw = await fetchMockApi<unknown>(
      `/api/v1/sites/${parsed.data}/current`,
      mockApiUrl,
    )
    return energyReadingSchema.parse(raw)
  }
  catch (err) {
    if (err instanceof z.ZodError) {
      throw createError({ status: 422, statusText: 'Réponse source invalide', cause: err })
    }
    logger.error('Lecture courante indisponible', {
      route: event.path,
      siteId: parsed.data,
      message: err instanceof Error ? err.message : String(err),
    })
    throw createError({ status: 503, statusText: 'Lecture courante indisponible' })
  }
})
