import { db } from '../../database'
import { revoquerSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const { sessionId } = await getUserSession(event)
  if (sessionId === undefined) {
    throw createError({ statusCode: 401, message: 'Session invalide' })
  }

  // La révocation vient AVANT l'effacement du cookie : vider le cookie seul
  // laisserait valable toute copie prise avant la déconnexion, et c'est
  // exactement ce que le dernier critère de #29 interdit.
  await revoquerSession(db, sessionId)
  await clearUserSession(event)

  return { success: true }
})
