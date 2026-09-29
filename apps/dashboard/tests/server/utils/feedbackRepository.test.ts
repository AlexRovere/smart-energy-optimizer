import { drizzle } from 'drizzle-orm/postgres-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../server/database/schema'
import { listFeedback, upsertFeedback } from '../../../server/utils/feedbackRepository'
import { databaseAvailable, createTestDatabase, expectedRow, type TestDatabase } from '../../database/test-database'

describe.skipIf(!databaseAvailable())('feedbackRepository', () => {
  let testDb: TestDatabase
  let db: ReturnType<typeof drizzle<typeof schema>>
  let alice: string
  let bruno: string

  async function createUser(email: string): Promise<string> {
    return expectedRow(
      await testDb.sql<{ id: string }[]>`
        INSERT INTO users (role_id, email, password_hash)
        SELECT r.id, ${email}, 'digest' FROM roles r WHERE r.name = 'VIEWER'
        RETURNING id
      `,
      `le compte ${email}`
    ).id
  }

  beforeAll(async () => {
    testDb = await createTestDatabase()
    db = drizzle(testDb.sql, { schema })
    await testDb.sql`INSERT INTO roles (name) VALUES ('ADMIN'), ('OPERATOR'), ('VIEWER')`
    await testDb.sql`
      INSERT INTO sites (id, name, type, capacity_kw, status)
      VALUES ('SITE001', 'Bureau', 'office', 300, 'active'), ('SITE002', 'Usine', 'factory', 900, 'active')
    `
    alice = await createUser('alice@enervision.local')
    bruno = await createUser('bruno@enervision.local')
  })

  afterAll(async () => {
    await testDb.close()
  })

  it('enregistre un vote et le relit pour le compte et le site', async () => {
    await upsertFeedback(db, { userId: alice, siteId: 'SITE001', targetType: 'recommendation', targetId: 'REC-1', useful: true })

    expect(await listFeedback(db, alice, 'SITE001')).toEqual([
      { targetType: 'recommendation', targetId: 'REC-1', useful: true },
    ])
  })

  it('remplace le vote précédent au lieu d’en ajouter un', async () => {
    await upsertFeedback(db, { userId: alice, siteId: 'SITE001', targetType: 'forecast', targetId: 'P-1', useful: true })
    await upsertFeedback(db, { userId: alice, siteId: 'SITE001', targetType: 'forecast', targetId: 'P-1', useful: false })

    const votes = await listFeedback(db, alice, 'SITE001')
    expect(votes.filter(v => v.targetId === 'P-1')).toEqual([{ targetType: 'forecast', targetId: 'P-1', useful: false }])
  })

  it("ne rend ni les votes d'un autre compte, ni ceux d'un autre site", async () => {
    await upsertFeedback(db, { userId: bruno, siteId: 'SITE001', targetType: 'recommendation', targetId: 'REC-9', useful: false })
    await upsertFeedback(db, { userId: alice, siteId: 'SITE002', targetType: 'recommendation', targetId: 'REC-2', useful: true })

    const ids = (await listFeedback(db, alice, 'SITE001')).map(v => v.targetId)
    expect(ids).not.toContain('REC-9')
    expect(ids).not.toContain('REC-2')
  })

  it('efface les votes avec le compte', async () => {
    const carla = await createUser('carla@enervision.local')
    await upsertFeedback(db, { userId: carla, siteId: 'SITE001', targetType: 'recommendation', targetId: 'REC-1', useful: true })

    await testDb.sql`DELETE FROM users WHERE id = ${carla}`

    expect(await listFeedback(db, carla, 'SITE001')).toEqual([])
  })
})
