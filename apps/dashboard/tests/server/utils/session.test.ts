import { drizzle } from 'drizzle-orm/postgres-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../server/database/schema'
import {
  accountForSession,
  SESSION_DURATION_MS,
  openSession,
  purgeExpiredSessions,
  revokeSession,
  allowedSites
} from '../../../server/utils/session'
import { baseDisponible, creerBaseDeTest, ligneAttendue, type BaseDeTest } from '../../database/base-de-test'

describe.skipIf(!baseDisponible())('session', () => {
  let testDb: BaseDeTest
  let db: ReturnType<typeof drizzle<typeof schema>>
  let userId: string

  beforeAll(async () => {
    testDb = await creerBaseDeTest()
    db = drizzle(testDb.sql, { schema })

    await testDb.sql`INSERT INTO roles (name) VALUES ('ADMIN'), ('OPERATOR'), ('VIEWER')`
    const account = ligneAttendue(
      await testDb.sql<{ id: string }[]>`
        INSERT INTO users (role_id, email, password_hash)
        SELECT r.id, 'admin@enervision.local', 'digest'
          FROM roles r WHERE r.name = 'ADMIN'
        RETURNING id
      `,
      "le account d'essai"
    )
    userId = account.id
  })

  afterAll(async () => {
    await testDb.fermer()
  })

  it('ouvre une session qui expire au bout de la durée prévue', async () => {
    const before = Date.now()
    const session = await openSession(db, { userId, ip: '203.0.113.7' })

    const gap = session.expiresAt.getTime() - before
    expect(gap).toBeGreaterThanOrEqual(SESSION_DURATION_MS - 5_000)
    expect(gap).toBeLessThanOrEqual(SESSION_DURATION_MS + 5_000)
  })

  it('rend le account et son rôle du jour pour une session ouverte', async () => {
    const session = await openSession(db, { userId, ip: null })

    const account = await accountForSession(db, session.id)

    expect(account).toEqual({
      id: userId,
      email: 'admin@enervision.local',
      role: 'ADMIN'
    })
  })

  it('refuse une session révoquée, alors même qu\'elle n\'a pas expiré', async () => {
    const session = await openSession(db, { userId, ip: null })
    expect(await accountForSession(db, session.id)).not.toBeNull()

    await revokeSession(db, session.id)

    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now())
    expect(await accountForSession(db, session.id)).toBeNull()
  })

  it('refuse une session dont la date de fin est passée', async () => {
    const session = ligneAttendue(
      await testDb.sql<{ id: string }[]>`
        INSERT INTO sessions (user_id, expires_at)
        VALUES (${userId}, NOW() - INTERVAL '1 minute')
        RETURNING id
      `,
      'la session déjà expirée'
    )

    expect(await accountForSession(db, session.id)).toBeNull()
  })

  it('refuse la session ouverte d\'un account désactivé depuis', async () => {
    const disabled = ligneAttendue(
      await testDb.sql<{ id: string }[]>`
        INSERT INTO users (role_id, email, password_hash)
        SELECT r.id, 'parti@enervision.local', 'digest'
          FROM roles r WHERE r.name = 'ADMIN'
        RETURNING id
      `,
      'le account à désactiver'
    )
    const session = await openSession(db, { userId: disabled.id, ip: null })
    expect(await accountForSession(db, session.id)).not.toBeNull()

    await testDb.sql`UPDATE users SET is_active = FALSE WHERE id = ${disabled.id}`

    expect(await accountForSession(db, session.id)).toBeNull()
  })

  it('rend tous les sites pour un compte ADMIN, même sans user_sites', async () => {
    await testDb.sql`
      INSERT INTO sites (id, name, type, capacity_kw, status)
      VALUES ('SITE001', 'Usine A', 'usine', 500, 'active'),
             ('SITE002', 'Usine B', 'usine', 800, 'active')
      ON CONFLICT DO NOTHING
    `
    // Pas de ligne dans user_sites pour l'ADMIN : il doit quand même voir tout
    // le parc. La liste complète est retournée par la fonction, et le WHERE de
    // la requête appelante s'applique dessus sans exception (data.md).
    const adminAccount = { id: userId, email: 'admin@enervision.local', role: 'ADMIN' }
    const sites = await allowedSites(db, adminAccount)
    expect(sites).toContain('SITE001')
    expect(sites).toContain('SITE002')
  })

  it('rend le périmètre de sites d\'un compte non-ADMIN, vide plutôt que tout', async () => {
    await testDb.sql`
      INSERT INTO sites (id, name, type, capacity_kw, status)
      VALUES ('SITE001', 'Usine A', 'usine', 500, 'active'),
             ('SITE002', 'Usine B', 'usine', 800, 'active')
      ON CONFLICT DO NOTHING
    `
    const viewer = ligneAttendue(
      await testDb.sql<{ id: string }[]>`
        INSERT INTO users (role_id, email, password_hash)
        SELECT r.id, 'viewer@enervision.local', 'digest'
          FROM roles r WHERE r.name = 'VIEWER'
        RETURNING id
      `,
      'le compte VIEWER'
    )
    // Une seule ligne de périmètre : l'autre site ne doit PAS ressortir. Un
    // périmètre oublié donne zéro accès, jamais tous (data.md).
    await testDb.sql`
      INSERT INTO user_sites (user_id, site_id) VALUES (${viewer.id}, 'SITE001')
    `
    const viewerAccount = { id: viewer.id, email: 'viewer@enervision.local', role: 'VIEWER' }
    expect(await allowedSites(db, viewerAccount)).toEqual(['SITE001'])
  })

  it('rend un tableau vide pour un compte non-ADMIN sans aucun user_sites', async () => {
    const operator = ligneAttendue(
      await testDb.sql<{ id: string }[]>`
        INSERT INTO users (role_id, email, password_hash)
        SELECT r.id, 'operator@enervision.local', 'digest'
          FROM roles r WHERE r.name = 'OPERATOR'
        RETURNING id
      `,
      'le compte OPERATOR'
    )
    const operatorAccount = { id: operator.id, email: 'operator@enervision.local', role: 'OPERATOR' }
    expect(await allowedSites(db, operatorAccount)).toEqual([])
  })

  it('purge les sessions expirées du account sans toucher aux vivantes', async () => {
    const owner = ligneAttendue(
      await testDb.sql<{ id: string }[]>`
        INSERT INTO users (role_id, email, password_hash)
        SELECT r.id, 'purge@enervision.local', 'digest'
          FROM roles r WHERE r.name = 'ADMIN'
        RETURNING id
      `,
      'le account de la purge'
    )

    await testDb.sql`
      INSERT INTO sessions (user_id, expires_at)
      VALUES (${owner.id}, NOW() - INTERVAL '1 day')
    `
    const alive = await openSession(db, { userId: owner.id, ip: null })
    // Une session expirée d'un AUTRE compte : la purge ne doit pas l'emporter,
    // elle est bornée au compte qui se connecte.
    await testDb.sql`
      INSERT INTO sessions (user_id, expires_at)
      VALUES (${userId}, NOW() - INTERVAL '1 day')
    `

    const expiredElsewhere = async () => Number(ligneAttendue(
      await testDb.sql<{ count: string }[]>`
        SELECT COUNT(*) AS count FROM sessions
         WHERE user_id = ${userId} AND expires_at < NOW()
      `,
      'le décompte des sessions expirées du account voisin'
    ).count)
    const before = await expiredElsewhere()

    await purgeExpiredSessions(db, owner.id)

    const remaining = await testDb.sql<{ id: string }[]>`
      SELECT id FROM sessions WHERE user_id = ${owner.id} AND expires_at < NOW()
    `
    expect(remaining).toHaveLength(0)
    expect(await expiredElsewhere()).toBe(before)
    expect(await accountForSession(db, alive.id)).not.toBeNull()
  })
})
