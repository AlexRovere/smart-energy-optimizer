import { db } from '../../database'
import { compteDeSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const { sessionId } = await getUserSession(event)
  const compte = sessionId === undefined ? null : await compteDeSession(db, sessionId)

  if (compte === null) {
    // Le cookie est effacé au passage : le garder ne servirait qu'à refaire
    // cette requête à chaque navigation.
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Session invalide' })
  }

  return { user: compte }
})
