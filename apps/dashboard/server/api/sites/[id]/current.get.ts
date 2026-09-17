import { createError } from 'h3'
import { z } from 'zod'
import { energyReadingSchema } from '../../../../shared/energyReadingSchema'
import { exigerCompte } from '../../../utils/garde'
import { fetchMockApi } from '../../../utils/mockApiClient'

const siteIdSchema = z.string().regex(/^SITE\d{3}$/)

export default defineEventHandler(async (event) => {
  // La garde vient AVANT la validation de l'identifiant : un anonyme n'a pas à
  // apprendre, par un 422, quelles formes d'identifiant existent.
  await exigerCompte(event)

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
