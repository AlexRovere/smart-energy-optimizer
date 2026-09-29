import { createError, defineEventHandler } from 'h3'
import { alertsSchema } from '../../../shared/alertSchema'
import { db } from '../../database'
import { requireAccount } from '../../utils/guard'
import { logger } from '../../utils/logger'
import { fetchMockApi } from '../../utils/mockApiClient'
import { allowedSites } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const permittedIds = await allowedSites(db, account)

  let response: unknown
  try {
    response = await fetchMockApi('/api/v1/alerts')
  } catch (error_) {
    logger.error('Alertes indisponibles', {
      route: event.path,
      message: error_ instanceof Error ? error_.message : String(error_),
    })
    throw createError({ status: 503, statusText: 'Alertes indisponibles', cause: error_ })
  }

  const parse = alertsSchema.safeParse(response)
  if (!parse.success) {
    throw createError({ status: 502, statusText: 'Réponse inattendue de la source' })
  }

  return parse.data.filter(a => permittedIds.includes(a.site_id))
})
