import { createError } from 'h3'
import { z } from 'zod'
import { energyReadingSchema } from '../../../../shared/energyReadingSchema'
import { fetchMockApi } from '../../../utils/mockApiClient'

const siteIdSchema = z.string().regex(/^SITE\d{3}$/)

export default defineEventHandler(async (event) => {
  // #29 — requireUserSession(event) bloqué par l'incompatibilité de types
  // entre nuxt-auth-utils (h3 v1) et Nuxt 4 (h3 v2). 
  // TODO: À rétablir quand le module sera mis à jour.
  void event

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
    throw err
  }
})
