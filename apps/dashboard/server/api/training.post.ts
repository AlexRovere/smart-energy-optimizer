import { defineEventHandler } from 'h3'
import { requireRole } from '../utils/guard'
import { logger } from '../utils/logger'
import { triggerTraining } from '../utils/mlClient'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'ADMIN')

  // L'entraînement peut durer plusieurs minutes : on déclenche sans attendre
  // la fin et on répond 200 immédiatement. Les erreurs partent au logger.
  triggerTraining().catch((err: unknown) => {
    logger.error('Entraînement ML échoué ou service indisponible', {
      route: event.path,
      message: err instanceof Error ? err.message : String(err),
    })
  })

  return { status: 'démarré' }
})
