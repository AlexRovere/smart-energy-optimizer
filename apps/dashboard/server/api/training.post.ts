import { createError, defineEventHandler } from 'h3'
import { requireRole } from '../utils/guard'
import { logger } from '../utils/logger'
import { triggerTraining } from '../utils/mlClient'
import { trainingState } from '../utils/trainingState'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'ADMIN')

  if (trainingState.enCours) {
    throw createError({ statusCode: 409, message: 'Entraînement déjà en cours' })
  }

  const début = new Date()
  trainingState.enCours = true
  trainingState.debut = début

  triggerTraining()
    .then(() => {
      trainingState.dernier = { statut: 'succès', début, fin: new Date() }
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      trainingState.dernier = { statut: 'erreur', début, fin: new Date(), message }
      logger.error('Entraînement ML échoué ou service indisponible', {
        route: event.path,
        message,
      })
    })
    .finally(() => {
      trainingState.enCours = false
    })

  return { status: 'démarré' }
})
