import { createError, defineEventHandler } from 'h3'
import { db } from '../../database'
import { requireAccount } from '../../utils/guard'
import { allowedSites } from '../../utils/session'
import { listAlertThresholds } from '../../utils/alertThresholdsRepository'

export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const permittedIds = await allowedSites(db, account)

  try {
    const entries = await listAlertThresholds(db, permittedIds)
    return entries.map(entry => ({
      site_id: entry.siteId,
      type: entry.type,
      duration: entry.duration,
      threshold: entry.threshold
    }))
  } catch (error_) {
    throw createError({ statusCode: 503, message: 'Règles d\'alerte indisponibles', cause: error_ })
  }
})
