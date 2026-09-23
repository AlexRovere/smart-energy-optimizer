import { createError, defineEventHandler, getRouterParam } from 'h3'
import { db } from '../../../database'
import { requireSiteAccess } from '../../../utils/guard'
import { recommendationsForSite } from '../../../utils/recommendationsForSite'

export default defineEventHandler(async (event) => {
  const { siteId } = await requireSiteAccess(event, getRouterParam(event, 'id'))

  try {
    return await recommendationsForSite(db, siteId, new Date())
  } catch {
    throw createError({ status: 503, statusText: 'Recommandations indisponibles' })
  }
})
