import { createError, defineEventHandler } from 'h3'
import { sensorsStatusSchema, type SensorsStatus } from '../../../shared/sensorStatusSchema'
import { db } from '../../database'
import { requireAccount } from '../../utils/guard'
import { logger } from '../../utils/logger'
import { fetchMockApi } from '../../utils/mockApiClient'
import { allowedSites } from '../../utils/session'

export default defineEventHandler(async (event): Promise<SensorsStatus> => {
  const account = await requireAccount(event)
  const permittedIds = new Set(await allowedSites(db, account))

  let response: unknown
  try {
    response = await fetchMockApi('/api/v1/sensors/status')
  } catch (error_) {
    logger.error('État des capteurs indisponible', {
      route: event.path,
      message: error_ instanceof Error ? error_.message : String(error_),
    })
    throw createError({ status: 503, statusText: 'État des capteurs indisponible', cause: error_ })
  }

  const parse = sensorsStatusSchema.safeParse(response)
  if (!parse.success) {
    throw createError({ status: 502, statusText: 'Réponse inattendue de la source' })
  }

  return Object.fromEntries(Object.entries(parse.data).filter(([siteId]) => permittedIds.has(siteId)))
})
