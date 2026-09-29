import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { databaseAvailable, createTestDatabase, MIGRATIONS_DIR, expectedRow, type TestDatabase } from './test-database'

interface JournalEntry {
  id: number
  hash: string
  created_at: string
}

describe.skipIf(!databaseAvailable())('rejouabilité des migrations Drizzle', () => {
  let base: TestDatabase
  let firstRun: JournalEntry[]

  const journal = () => base.sql<JournalEntry[]>`
    SELECT id, hash, created_at
      FROM drizzle.__drizzle_migrations
     ORDER BY created_at, id
  `

  beforeAll(async () => {
    base = await createTestDatabase({ migrate: false })
    await migrate(drizzle(base.sql), { migrationsFolder: MIGRATIONS_DIR })
    firstRun = [...(await journal())]
  })

  afterAll(async () => {
    await base?.close()
  })

  describe('le journal ne rejoue pas une migration déjà consignée', () => {
    it('a appliqué les trois migrations au premier passage', () => {
      expect(firstRun).toHaveLength(3)
    })

    it("ne casse rien et n'applique rien deux fois au second passage sur la même base", async () => {
      await expect(
        migrate(drizzle(base.sql), { migrationsFolder: MIGRATIONS_DIR })
      ).resolves.toBeUndefined()

      const secondRun = [...(await journal())]
      expect(secondRun).toEqual(firstRun)
    })

    it('laisse les six tables et le rôle etl en place', async () => {
      const { tables } = expectedRow(
        await base.sql<{ tables: number }[]>`
          SELECT count(*)::int AS tables
            FROM information_schema.tables
           WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        `,
        'le décompte des tables du schéma public'
      )
      expect(tables).toBe(6)

      const { exists } = expectedRow(
        await base.sql<{ exists: boolean }[]>`
          SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'etl') AS "exists"
        `,
        'la présence du rôle etl dans le cluster'
      )
      expect(exists).toBe(true)
    })
  })

  describe('le SQL de 0001_role_etl.sql supporte un cluster où son effet existe déjà', () => {
    // Le rôle etl est global au cluster : la base ci-dessus l'a déjà créé.
    // Cette seconde base a un journal de migrations vierge, donc migrate()
    // y rejoue réellement le SQL de 0001 et exerce pour de bon le garde
    // IF NOT EXISTS du bloc DO. Un second passage sur la même base ne le
    // ferait pas : le journal sait déjà la migration appliquée et ne la
    // rejoue jamais, garde compris.
    let secondDatabase: TestDatabase

    beforeAll(async () => {
      secondDatabase = await createTestDatabase({ migrate: false })
    })

    afterAll(async () => {
      await secondDatabase?.close()
    })

    it('applique les migrations sans échouer sur le rôle etl déjà présent dans le cluster', async () => {
      await expect(
        migrate(drizzle(secondDatabase.sql), { migrationsFolder: MIGRATIONS_DIR })
      ).resolves.toBeUndefined()

      const { exists } = expectedRow(
        await secondDatabase.sql<{ exists: boolean }[]>`
          SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'etl') AS "exists"
        `,
        'la présence du rôle etl vue depuis la seconde base'
      )
      expect(exists).toBe(true)
    })
  })
})
