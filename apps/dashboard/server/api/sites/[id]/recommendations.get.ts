import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { db } from '../../../database'
import { requireAccount } from '../../../utils/guard'
import { recommendationsForSite } from '../../../utils/recommendationsForSite'

const siteIdSchema = z.string().regex(/^SITE\d{3}$/)

export default defineEventHandler(async (event) => {
  await requireAccount(event)

  const id = getRouterParam(event, 'id')
  const parsedId = siteIdSchema.safeParse(id)
  if (!parsedId.success) {
    throw createError({ status: 422, statusText: 'Identifiant de site invalide' })
  }

  try {
    return await recommendationsForSite(db, parsedId.data, new Date())
  } catch {
    throw createError({ status: 503, statusText: 'Recommandations indisponibles' })
  }
})
