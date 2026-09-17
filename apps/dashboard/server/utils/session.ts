// État des sessions, côté serveur et uniquement là.
//
// Le cookie ne porte qu'un identifiant opaque : tout ce qui décide de la
// validité vit dans la table `sessions`. C'est ce qui rend la déconnexion
// révocable, exigence de #29 (« un cookie rejoué après déconnexion répond 401,
// même s'il n'a pas expiré », ASVS V3.3.1, CWE-613). `nuxt-auth-utils` scelle
// sinon la session DANS le cookie, et le serveur n'a alors rien à révoquer.
//
// Une seule requête sert les trois vérifications, comme l'écrit docs/data.md :
// la session est vivante, le compte est actif, et le rôle est celui d'AUJOURD'HUI.
// Le rôle n'est jamais relu depuis le cookie, sans quoi une rétrogradation ne
// prendrait effet qu'à la prochaine connexion.
import { and, eq, gt, isNull, lt } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../database/schema'

// Deux heures, comme docs/data.md.
export const DUREE_SESSION_MS = 2 * 60 * 60_000

export type BaseApplicative = PostgresJsDatabase<typeof schema>

// Ce que le cookie scellé porte, et RIEN d'autre : un identifiant de session
// opaque. Pas le rôle, qui se relit en base à chaque requête, pas l'adresse
// électronique, qui est une donnée personnelle.
declare module '#auth-utils' {
  interface UserSession {
    sessionId?: string
  }
}

export interface SessionOuverte {
  id: string
  expiresAt: Date
}

export async function ouvrirSession(
  db: BaseApplicative,
  { userId, ip }: { userId: string, ip: string | null }
): Promise<SessionOuverte> {
  const expiresAt = new Date(Date.now() + DUREE_SESSION_MS)

  const [session] = await db
    .insert(schema.sessions)
    .values({ userId, expiresAt, ip })
    .returning({ id: schema.sessions.id })

  if (session === undefined) {
    throw new Error("L'ouverture de session n'a rendu aucune ligne.")
  }

  return { id: session.id, expiresAt }
}

export interface CompteAuthentifie {
  id: string
  email: string
  role: string
}

export async function compteDeSession(
  db: BaseApplicative,
  sessionId: string
): Promise<CompteAuthentifie | null> {
  const [compte] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      role: schema.roles.name
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .innerJoin(schema.roles, eq(schema.roles.id, schema.users.roleId))
    .where(and(
      eq(schema.sessions.id, sessionId),
      isNull(schema.sessions.revokedAt),
      gt(schema.sessions.expiresAt, new Date()),
      eq(schema.users.isActive, true)
    ))

  return compte ?? null
}

// Le périmètre d'accès, site par site. Une seule fonction le rend, et le filtre
// SQL est toujours appliqué : jamais de branche qui saute le WHERE pour un
// administrateur (data.md). Un périmètre oublié donne donc zéro accès, jamais
// tous, et c'est le sens du choix de la table contre un tableau de sites.
export async function sitesAutorises(db: BaseApplicative, userId: string): Promise<string[]> {
  const lignes = await db
    .select({ siteId: schema.userSites.siteId })
    .from(schema.userSites)
    .where(eq(schema.userSites.userId, userId))

  return lignes.map(ligne => ligne.siteId)
}

// Entretien décrit par docs/data.md : les lignes périmées partent à la
// connexion suivante du même compte. Rien de planifié, rien à surveiller. La
// purge est bornée au compte qui se connecte, parce que `sessions.ip` est une
// donnée personnelle et qu'un balayage global n'a aucune raison d'être déclenché
// par un tiers.
export async function purgerSessionsExpirees(
  db: BaseApplicative,
  userId: string
): Promise<void> {
  await db
    .delete(schema.sessions)
    .where(and(
      eq(schema.sessions.userId, userId),
      lt(schema.sessions.expiresAt, new Date())
    ))
}

// La déconnexion pose `revoked_at` plutôt que de supprimer la ligne : la trace
// reste pour l'audit (#58), et la session cesse d'être valide au même instant.
export async function revoquerSession(db: BaseApplicative, sessionId: string): Promise<void> {
  await db
    .update(schema.sessions)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(schema.sessions.id, sessionId),
      isNull(schema.sessions.revokedAt)
    ))
}
