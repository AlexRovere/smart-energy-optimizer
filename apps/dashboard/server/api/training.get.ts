import { defineEventHandler } from 'h3'
import { requireRole } from '../utils/guard'
import { trainingState } from '../utils/trainingState'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'ADMIN')

  const { enCours, dernier } = trainingState
  return {
    en_cours: enCours,
    dernier: dernier
      ? {
          statut: dernier.statut,
          début: dernier.début.toISOString(),
          fin: dernier.fin.toISOString(),
          message: dernier.message,
        }
      : null,
  }
})
