import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { creerBaseDeTest, DOSSIER_MIGRATIONS, type BaseDeTest } from './base-de-test'

interface EntreeJournal {
  id: number
  hash: string
  created_at: string
}

describe('drizzle-kit migrate est rejouable', () => {
  let base: BaseDeTest
  let premierPassage: EntreeJournal[]

  const journal = () => base.sql<EntreeJournal[]>`
    SELECT id, hash, created_at
      FROM drizzle.__drizzle_migrations
     ORDER BY created_at, id
  `

  beforeAll(async () => {
    base = await creerBaseDeTest({ migrer: false })
    await migrate(drizzle(base.sql), { migrationsFolder: DOSSIER_MIGRATIONS })
    premierPassage = [...(await journal())]
  })

  afterAll(async () => {
    await base?.fermer()
  })

  it('a appliqué les deux migrations au premier passage', () => {
    expect(premierPassage).toHaveLength(2)
  })

  it('ne casse rien et n applique rien deux fois au second passage', async () => {
    await expect(
      migrate(drizzle(base.sql), { migrationsFolder: DOSSIER_MIGRATIONS })
    ).resolves.toBeUndefined()

    const secondPassage = [...(await journal())]
    expect(secondPassage).toEqual(premierPassage)
  })

  it('laisse les cinq tables et le rôle etl en place', async () => {
    const [{ tables }] = await base.sql<{ tables: number }[]>`
      SELECT count(*)::int AS tables
        FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `
    expect(tables).toBe(5)

    const [{ existe }] = await base.sql<{ existe: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'etl') AS existe
    `
    expect(existe).toBe(true)
  })
})
