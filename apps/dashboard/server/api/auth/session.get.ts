import { db } from '../../database'
import { compteDeSession, sitesAutorises } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const { sessionId } = await getUserSession(event)
  const compte = sessionId === undefined ? null : await compteDeSession(db, sessionId)

  if (compte === null) {
    // Le cookie est effacé au passage : le garder ne servirait qu'à refaire
    // cette requête à chaque navigation.
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Session invalide' })
  }

  // `sites` fait partie du contrat d'api.md. Il sort vide tant que l'ETL n'a
  // pas posé le référentiel (#21) et qu'aucun périmètre n'est réglé, ce qui est
  // le bon défaut : zéro accès plutôt que tous.
  return { user: { ...compte, sites: await sitesAutorises(db, compte.id) } }
})
