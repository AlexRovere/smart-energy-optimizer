import type { H3Event } from 'h3'

// La garde que toute route authentifiée appelle en premier.
//
// `requireUserSession` de nuxt-auth-utils ne convient pas : il vérifie la
// présence d'une clé `user` DANS le cookie scellé, or notre cookie ne porte
// qu'un identifiant de session, et c'est ce qui rend la révocation possible
// (#29). La vérification a donc lieu en base, à chaque requête.
import { db } from '../database'
import { accountForSession, allowedSites, type AuthenticatedAccount } from './session'
import { siteExists } from './sitesRepository'

const SITE_ID_PATTERN = /^SITE\d{3}$/

export async function requireAccount(event: H3Event): Promise<AuthenticatedAccount> {
  const { sessionId } = await getUserSession(event)
  const account = sessionId === undefined ? null : await accountForSession(db, sessionId)

  if (account === null) {
    // Le cookie est effacé au passage : le garder ne servirait qu'à rejouer
    // cette requête perdue d'avance à chaque navigation.
    await clearUserSession(event)
    throw createError({ statusCode: 401, message: 'Session invalide' })
  }

  return account
}

// Vérifie que le compte authentifié possède le rôle requis. Le rôle est relu
// en base à chaque requête via requireAccount : rétrograder un compte prend
// effet immédiatement, sans attendre l'expiration de la session (#95).
export async function requireRole(event: H3Event, role: string): Promise<AuthenticatedAccount> {
  const account = await requireAccount(event)
  if (account.role !== role) {
    throw createError({ statusCode: 403, message: 'Accès interdit' })
  }
  return account
}

// La garde des routes `sites/{id}/*`. L'ordre est celui de docs/api.md :
// la session d'abord (un anonyme n'apprend rien des identifiants), puis le
// format (422), l'existence (404) et enfin le périmètre (403). L'identifiant
// reçu est comparé au périmètre, jamais pris pour source.
export async function requireSiteAccess(
  event: H3Event,
  id: string | undefined
): Promise<{ account: AuthenticatedAccount, siteId: string }> {
  const account = await requireAccount(event)

  if (id === undefined || !SITE_ID_PATTERN.test(id)) {
    throw createError({ statusCode: 422, message: 'Identifiant de site invalide' })
  }
  if (!await siteExists(db, id)) {
    throw createError({ statusCode: 404, message: 'Site inconnu' })
  }
  if (!(await allowedSites(db, account)).includes(id)) {
    throw createError({ statusCode: 403, message: 'Site hors périmètre' })
  }

  return { account, siteId: id }
}
