import { createError, defineEventHandler } from 'h3'
import { requireRole } from '../utils/guard'
import { logger } from '../utils/logger'
import { triggerTraining } from '../utils/mlClient'
import { trainingState } from '../utils/trainingState'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'ADMIN')

  if (trainingState.inProgress) {
    throw createError({ statusCode: 409, message: 'Entraînement déjà en cours' })
  }

  const startedAt = new Date()
  trainingState.inProgress = true
  trainingState.startedAt = startedAt

  triggerTraining()
    .then(() => {
      trainingState.lastRun = { status: 'success', startedAt, finishedAt: new Date() }
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      trainingState.lastRun = { status: 'error', startedAt, finishedAt: new Date(), message }
      logger.error('Entraînement ML échoué ou service indisponible', {
        route: event.path,
        message,
      })
    })
    .finally(() => {
      trainingState.inProgress = false
    })

  return { status: 'started' }
})
