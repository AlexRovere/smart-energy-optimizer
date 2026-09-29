import { afterAll, describe, expect, it } from 'vitest'
import { databaseAvailable, createTestDatabase, expectedRow, type TestDatabase } from './test-database'

describe.skipIf(!databaseAvailable())('socle de test', () => {
  const openDatabases: TestDatabase[] = []

  afterAll(async () => {
    await Promise.all(openDatabases.map(base => base.close()))
  })

  it('rend une base jetable joignable', async () => {
    const base = await createTestDatabase({ migrate: false })
    openDatabases.push(base)

    const row = expectedRow(
      await base.sql<{ un: number }[]>`SELECT 1 AS un`,
      'le SELECT 1 de la base jetable'
    )
    expect(row.un).toBe(1)
  })

  it("isole deux bases l'une de l'autre", async () => {
    const first = await createTestDatabase({ migrate: false })
    const second = await createTestDatabase({ migrate: false })
    openDatabases.push(first, second)

    await first.sql`CREATE TABLE marqueur (id integer)`

    const { exists } = expectedRow(
      await second.sql<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = 'marqueur'
        ) AS "exists"
      `,
      'la présence de la table marqueur dans la seconde base'
    )
    expect(exists).toBe(false)
  })
})
