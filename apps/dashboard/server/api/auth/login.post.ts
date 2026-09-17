import { verify } from '@node-rs/argon2'
import { and, eq } from 'drizzle-orm'
import { loginSchema } from '../../../shared/authSchema'
import { db } from '../../database'
import * as schema from '../../database/schema'
import { clesDeTentative, limiteurConnexion } from '../../utils/limiteTentatives'
import { ouvrirSession, purgerSessionsExpirees } from '../../utils/session'

// Empreinte d'un mot de passe que personne ne connaît, vérifiée quand le compte
// demandé n'existe pas. Sans elle, une adresse inconnue répondrait en une
// microseconde et une adresse connue en une centaine de millisecondes : le
// temps de réponse dirait alors quels comptes existent.
const EMPREINTE_LEURRE
  = '$argon2id$v=19$m=19456,t=2,p=1$YWJjZGVmZ2hpamtsbW5vcA$'
    + 'Qq0TQeCPTqRP4rCDyFJKBoqNJzqbc4hqO9VZBNjCEKg'

export default defineEventHandler(async (event) => {
  const entree = await readValidatedBody(event, loginSchema.safeParse)
  if (!entree.success) {
    throw createError({ statusCode: 422, message: 'Entrée invalide' })
  }
  const { email, password } = entree.data

  const { trustProxy } = useRuntimeConfig()
  // `xForwardedFor` n'est lu que derrière un proxy DE CONFIANCE. Activé sans
  // proxy, l'en-tête se forge et l'attaquant se donne une adresse neuve à
  // chaque essai ; désactivé derrière un proxy, toutes les requêtes portent
  // l'adresse du proxy et le premier balayage verrouille tout le monde. Le
  // réglage suit donc #39, il ne se devine pas.
  const ip = getRequestIP(event, { xForwardedFor: trustProxy }) ?? 'inconnue'
  const cles = clesDeTentative(ip, email)

  const verdict = limiteurConnexion.verifier(cles)
  if (!verdict.autorise) {
    // h3 type cet en-tête en nombre de secondes, la forme « date » n'a pas
    // cours ici.
    setResponseHeader(event, 'retry-after', verdict.retryAfterSecondes)
    throw createError({ statusCode: 429, message: 'Trop de tentatives, réessayez plus tard' })
  }

  const [compte] = await db
    .select({
      id: schema.users.id,
      passwordHash: schema.users.passwordHash
    })
    .from(schema.users)
    .where(and(eq(schema.users.email, email), eq(schema.users.isActive, true)))

  const correct = await verify(compte?.passwordHash ?? EMPREINTE_LEURRE, password)

  if (compte === undefined || !correct) {
    limiteurConnexion.enregistrerEchec(cles)
    // Le même message dans les deux cas : distinguer « compte inconnu » de
    // « mot de passe faux » ferait de cette route un annuaire des comptes.
    throw createError({ statusCode: 401, message: 'Identifiants invalides' })
  }

  limiteurConnexion.reinitialiser(cles)
  await purgerSessionsExpirees(db, compte.id)
  const session = await ouvrirSession(db, { userId: compte.id, ip: ip === 'inconnue' ? null : ip })
  await db
    .update(schema.users)
    .set({ lastLogin: new Date() })
    .where(eq(schema.users.id, compte.id))

  // Le cookie ne porte que cet identifiant. Rien n'est rendu dans le corps :
  // aucun jeton ne passe par le navigateur ni par une barre d'adresse.
  await setUserSession(event, { sessionId: session.id })

  return { success: true }
})
