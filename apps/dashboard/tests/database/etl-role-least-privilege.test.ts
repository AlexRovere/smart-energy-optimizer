import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { databaseAvailable, createTestDatabase, expectedRow, type TestDatabase } from './test-database'

// Mot de passe de test, jamais un secret : le rôle vit dans un conteneur
// jetable qui n'est joignable que par cette suite.
const PASSWORD = 'mot-de-passe-de-test'
const INSUFFICIENT_PRIVILEGE = '42501'

describe.skipIf(!databaseAvailable())('le rôle etl ne peut faire que ce que data.md lui accorde', () => {
  let base: TestDatabase
  let etl: postgres.Sql

  beforeAll(async () => {
    base = await createTestDatabase()

    const { literal } = expectedRow(
      await base.sql<{ literal: string }[]>`
        SELECT quote_literal(${PASSWORD}) AS literal
      `,
      'le mot de passe échappé par quote_literal'
    )
    await base.sql.unsafe(`ALTER ROLE etl WITH LOGIN PASSWORD ${literal}`)

    await base.sql`
      INSERT INTO sites (id, name, type, capacity_kw, status)
      VALUES ('SITE001', 'Bureau Paris La Défense', 'office', 200, 'active')
    `

    const url = new URL(base.url)
    url.username = 'etl'
    url.password = PASSWORD
    etl = postgres(url.toString(), { max: 1 })
  })

  afterAll(async () => {
    await etl?.end()
    await base?.close()
  })

  describe('ce qui doit passer', () => {
    it('lit les sites', async () => {
      const rows = await etl`SELECT id FROM sites`
      expect(rows).toHaveLength(1)
    })

    it('insère un site', async () => {
      await etl`
        INSERT INTO sites (id, name, type, capacity_kw, status)
        VALUES ('SITE002', 'Usine Lyon', 'factory', 500, 'active')
      `
      const rows = await etl`SELECT id FROM sites WHERE id = 'SITE002'`
      expect(rows).toHaveLength(1)
    })

    it('met à jour les sept colonnes autorisées', async () => {
      await etl`
        UPDATE sites
           SET name = 'Bureau Paris',
               type = 'office',
               location = 'Paris, France',
               capacity_kw = 220,
               status = 'active',
               present_in_source = TRUE,
               updated_at = NOW()
         WHERE id = 'SITE001'
      `
      const row = expectedRow(
        await etl<{ capacity_kw: number }[]>`
          SELECT capacity_kw FROM sites WHERE id = 'SITE001'
        `,
        'le site SITE001 relu après mise à jour'
      )
      expect(row.capacity_kw).toBe(220)
    })
  })

  describe('ce qui doit être refusé', () => {
    const refusal = async (query: () => Promise<unknown>) => {
      await expect(query()).rejects.toMatchObject({ code: INSUFFICIENT_PRIVILEGE })
    }

    it('ne lit pas les comptes', async () => {
      await refusal(() => etl`SELECT id FROM users`)
    })

    it('ne lit pas les sessions', async () => {
      await refusal(() => etl`SELECT id FROM sessions`)
    })

    it("ne lit pas les périmètres d'accès", async () => {
      await refusal(() => etl`SELECT user_id FROM user_sites`)
    })

    it("n'écrase pas un seuil réglé à l'écran", async () => {
      await refusal(() => etl`UPDATE sites SET warning_threshold_kw = 100`)
    })

    it('ne supprime aucun site', async () => {
      await refusal(() => etl`DELETE FROM sites`)
    })

    it('ne touche pas au référentiel des rôles', async () => {
      await refusal(() => etl`INSERT INTO roles (name) VALUES ('PIRATE')`)
    })
  })
})
