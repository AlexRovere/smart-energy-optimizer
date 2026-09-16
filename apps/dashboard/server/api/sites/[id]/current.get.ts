import { HTTPError } from 'h3'
import { z } from 'zod'
import { energyReadingSchema } from '../../../../shared/energyReadingSchema'
import { fetchMockApi } from '../../../utils/mockApiClient'

const siteIdSchema = z.string().regex(/^SITE\d{3}$/)

export default defineEventHandler(async (event) => {
  // #29 — requireUserSession(event) bloqué par l'incompatibilité de types
  // entre nuxt-auth-utils (h3 v1) et Nuxt 4 (h3 v2). À rétablir quand le
  // module sera mis à jour.
  void event

  const id = getRouterParam(event, 'id')
  const parsed = siteIdSchema.safeParse(id)
  if (!parsed.success) {
    throw new HTTPError('Identifiant de site invalide', { status: 422 })
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
      throw new HTTPError('Réponse source invalide', { status: 422, cause: err })
    }
    throw err
  }
})
