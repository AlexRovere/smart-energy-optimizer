import { drizzle } from 'drizzle-orm/postgres-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../server/database/schema'
import {
  compteDeSession,
  DUREE_SESSION_MS,
  ouvrirSession,
  purgerSessionsExpirees,
  revoquerSession
} from '../../../server/utils/session'
import { creerBaseDeTest, ligneAttendue, type BaseDeTest } from '../../database/base-de-test'

describe('session', () => {
  let base: BaseDeTest
  let db: ReturnType<typeof drizzle<typeof schema>>
  let userId: string

  beforeAll(async () => {
    base = await creerBaseDeTest()
    db = drizzle(base.sql, { schema })

    await base.sql`INSERT INTO roles (name) VALUES ('ADMIN')`
    const compte = ligneAttendue(
      await base.sql<{ id: string }[]>`
        INSERT INTO users (role_id, email, password_hash)
        SELECT r.id, 'admin@enervision.local', 'empreinte'
          FROM roles r WHERE r.name = 'ADMIN'
        RETURNING id
      `,
      "le compte d'essai"
    )
    userId = compte.id
  })

  afterAll(async () => {
    await base.fermer()
  })

  it('ouvre une session qui expire au bout de la durée prévue', async () => {
    const avant = Date.now()
    const session = await ouvrirSession(db, { userId, ip: '203.0.113.7' })

    const ecart = session.expiresAt.getTime() - avant
    expect(ecart).toBeGreaterThanOrEqual(DUREE_SESSION_MS - 5_000)
    expect(ecart).toBeLessThanOrEqual(DUREE_SESSION_MS + 5_000)
  })

  it('rend le compte et son rôle du jour pour une session ouverte', async () => {
    const session = await ouvrirSession(db, { userId, ip: null })

    const compte = await compteDeSession(db, session.id)

    expect(compte).toEqual({
      id: userId,
      email: 'admin@enervision.local',
      role: 'ADMIN'
    })
  })

  it('refuse une session révoquée, alors même qu\'elle n\'a pas expiré', async () => {
    const session = await ouvrirSession(db, { userId, ip: null })
    expect(await compteDeSession(db, session.id)).not.toBeNull()

    await revoquerSession(db, session.id)

    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now())
    expect(await compteDeSession(db, session.id)).toBeNull()
  })

  it('refuse une session dont la date de fin est passée', async () => {
    const session = ligneAttendue(
      await base.sql<{ id: string }[]>`
        INSERT INTO sessions (user_id, expires_at)
        VALUES (${userId}, NOW() - INTERVAL '1 minute')
        RETURNING id
      `,
      'la session déjà expirée'
    )

    expect(await compteDeSession(db, session.id)).toBeNull()
  })

  it('refuse la session ouverte d\'un compte désactivé depuis', async () => {
    const desactive = ligneAttendue(
      await base.sql<{ id: string }[]>`
        INSERT INTO users (role_id, email, password_hash)
        SELECT r.id, 'parti@enervision.local', 'empreinte'
          FROM roles r WHERE r.name = 'ADMIN'
        RETURNING id
      `,
      'le compte à désactiver'
    )
    const session = await ouvrirSession(db, { userId: desactive.id, ip: null })
    expect(await compteDeSession(db, session.id)).not.toBeNull()

    await base.sql`UPDATE users SET is_active = FALSE WHERE id = ${desactive.id}`

    expect(await compteDeSession(db, session.id)).toBeNull()
  })

  it('purge les sessions expirées du compte sans toucher aux vivantes', async () => {
    const proprietaire = ligneAttendue(
      await base.sql<{ id: string }[]>`
        INSERT INTO users (role_id, email, password_hash)
        SELECT r.id, 'purge@enervision.local', 'empreinte'
          FROM roles r WHERE r.name = 'ADMIN'
        RETURNING id
      `,
      'le compte de la purge'
    )

    await base.sql`
      INSERT INTO sessions (user_id, expires_at)
      VALUES (${proprietaire.id}, NOW() - INTERVAL '1 day')
    `
    const vivante = await ouvrirSession(db, { userId: proprietaire.id, ip: null })
    // Une session expirée d'un AUTRE compte : la purge ne doit pas l'emporter,
    // elle est bornée au compte qui se connecte.
    await base.sql`
      INSERT INTO sessions (user_id, expires_at)
      VALUES (${userId}, NOW() - INTERVAL '1 day')
    `

    const expireesAilleurs = async () => Number(ligneAttendue(
      await base.sql<{ nombre: string }[]>`
        SELECT COUNT(*) AS nombre FROM sessions
         WHERE user_id = ${userId} AND expires_at < NOW()
      `,
      'le décompte des sessions expirées du compte voisin'
    ).nombre)
    const avant = await expireesAilleurs()

    await purgerSessionsExpirees(db, proprietaire.id)

    const restantes = await base.sql<{ id: string }[]>`
      SELECT id FROM sessions WHERE user_id = ${proprietaire.id} AND expires_at < NOW()
    `
    expect(restantes).toHaveLength(0)
    expect(await expireesAilleurs()).toBe(avant)
    expect(await compteDeSession(db, vivante.id)).not.toBeNull()
  })
})
