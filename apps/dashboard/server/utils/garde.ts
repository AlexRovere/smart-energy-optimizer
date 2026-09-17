// La garde que toute route authentifiée appelle en premier.
//
// `requireUserSession` de nuxt-auth-utils ne convient pas : il vérifie la
// présence d'une clé `user` DANS le cookie scellé, or notre cookie ne porte
// qu'un identifiant de session, et c'est ce qui rend la révocation possible
// (#29). La vérification a donc lieu en base, à chaque requête.
import type { H3Event } from 'h3'
import { db } from '../database'
import { compteDeSession, type CompteAuthentifie } from './session'

export async function exigerCompte(event: H3Event): Promise<CompteAuthentifie> {
  const { sessionId } = await getUserSession(event)
  const compte = sessionId === undefined ? null : await compteDeSession(db, sessionId)

  if (compte === null) {
    // Le cookie est effacé au passage : le garder ne servirait qu'à rejouer
    // cette requête perdue d'avance à chaque navigation.
    await clearUserSession(event)
    throw createError({ statusCode: 401, message: 'Session invalide' })
  }

  return compte
}
