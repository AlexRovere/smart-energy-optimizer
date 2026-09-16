import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { creerBaseDeTest, DOSSIER_MIGRATIONS, ligneAttendue, type BaseDeTest } from './base-de-test'

interface EntreeJournal {
  id: number
  hash: string
  created_at: string
}

describe('rejouabilité des migrations Drizzle', () => {
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

  describe('le journal ne rejoue pas une migration déjà consignée', () => {
    it('a appliqué les deux migrations au premier passage', () => {
      expect(premierPassage).toHaveLength(2)
    })

    it("ne casse rien et n'applique rien deux fois au second passage sur la même base", async () => {
      await expect(
        migrate(drizzle(base.sql), { migrationsFolder: DOSSIER_MIGRATIONS })
      ).resolves.toBeUndefined()

      const secondPassage = [...(await journal())]
      expect(secondPassage).toEqual(premierPassage)
    })

    it('laisse les cinq tables et le rôle etl en place', async () => {
      const { tables } = ligneAttendue(
        await base.sql<{ tables: number }[]>`
          SELECT count(*)::int AS tables
            FROM information_schema.tables
           WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        `,
        'le décompte des tables du schéma public'
      )
      expect(tables).toBe(5)

      const { existe } = ligneAttendue(
        await base.sql<{ existe: boolean }[]>`
          SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'etl') AS existe
        `,
        'la présence du rôle etl dans le cluster'
      )
      expect(existe).toBe(true)
    })
  })

  describe('le SQL de 0001_role_etl.sql supporte un cluster où son effet existe déjà', () => {
    // Le rôle etl est global au cluster : la base ci-dessus l'a déjà créé.
    // Cette seconde base a un journal de migrations vierge, donc migrate()
    // y rejoue réellement le SQL de 0001 et exerce pour de bon le garde
    // IF NOT EXISTS du bloc DO. Un second passage sur la même base ne le
    // ferait pas : le journal sait déjà la migration appliquée et ne la
    // rejoue jamais, garde compris.
    let secondeBase: BaseDeTest

    beforeAll(async () => {
      secondeBase = await creerBaseDeTest({ migrer: false })
    })

    afterAll(async () => {
      await secondeBase?.fermer()
    })

    it('applique les migrations sans échouer sur le rôle etl déjà présent dans le cluster', async () => {
      await expect(
        migrate(drizzle(secondeBase.sql), { migrationsFolder: DOSSIER_MIGRATIONS })
      ).resolves.toBeUndefined()

      const { existe } = ligneAttendue(
        await secondeBase.sql<{ existe: boolean }[]>`
          SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'etl') AS existe
        `,
        'la présence du rôle etl vue depuis la seconde base'
      )
      expect(existe).toBe(true)
    })
  })
})
