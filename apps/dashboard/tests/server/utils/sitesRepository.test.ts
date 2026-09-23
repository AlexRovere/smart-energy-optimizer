import { drizzle } from 'drizzle-orm/postgres-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../server/database/schema'
import { siteExists } from '../../../server/utils/sitesRepository'
import { baseDisponible, creerBaseDeTest, type BaseDeTest } from '../../database/base-de-test'

describe.skipIf(!baseDisponible())('siteExists', () => {
  let testDb: BaseDeTest
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    testDb = await creerBaseDeTest()
    db = drizzle(testDb.sql, { schema })
    await testDb.sql`
      INSERT INTO sites (id, name, type, capacity_kw, status)
      VALUES ('SITE001', 'Usine A', 'usine', 500, 'active')
    `
  })

  afterAll(async () => {
    await testDb.fermer()
  })

  it('reconnaît un site présent au référentiel', async () => {
    expect(await siteExists(db, 'SITE001')).toBe(true)
  })

  it('ne reconnaît pas un site absent du référentiel', async () => {
    expect(await siteExists(db, 'SITE999')).toBe(false)
  })
})
