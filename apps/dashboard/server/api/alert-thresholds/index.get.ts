import { createError, defineEventHandler } from 'h3'
import { db } from '../../database'
import { requireAccount } from '../../utils/guard'
import { allowedSites } from '../../utils/session'
import { listAlertThresholds } from '../../utils/alertThresholdsRepository'

export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const permittedIds = await allowedSites(db, account)

  try {
    const entrées = await listAlertThresholds(db, permittedIds)
    return entrées.map(entrée => ({
      site_id: entrée.siteId,
      type: entrée.type,
      duration: entrée.duration,
      threshold: entrée.threshold
    }))
  } catch (erreur) {
    throw createError({ statusCode: 503, message: 'Règles d\'alerte indisponibles', cause: erreur })
  }
})
