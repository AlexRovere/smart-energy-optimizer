import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { creerBaseDeTest, type BaseDeTest } from './base-de-test'

// Mot de passe de test, jamais un secret : le rôle vit dans un conteneur
// jetable qui n'est joignable que par cette suite.
const MOT_DE_PASSE = 'mot-de-passe-de-test'
const PRIVILEGE_INSUFFISANT = '42501'

describe('le rôle etl ne peut faire que ce que data.md lui accorde', () => {
  let base: BaseDeTest
  let etl: postgres.Sql

  beforeAll(async () => {
    base = await creerBaseDeTest()

    const [{ literal }] = await base.sql<{ literal: string }[]>`
      SELECT quote_literal(${MOT_DE_PASSE}) AS literal
    `
    await base.sql.unsafe(`ALTER ROLE etl WITH LOGIN PASSWORD ${literal}`)

    await base.sql`
      INSERT INTO sites (id, name, type, capacity_kw, status)
      VALUES ('SITE001', 'Bureau Paris La Défense', 'office', 200, 'active')
    `

    const url = new URL(base.url)
    url.username = 'etl'
    url.password = MOT_DE_PASSE
    etl = postgres(url.toString(), { max: 1 })
  })

  afterAll(async () => {
    await etl?.end()
    await base?.fermer()
  })

  describe('ce qui doit passer', () => {
    it('lit les sites', async () => {
      const lignes = await etl`SELECT id FROM sites`
      expect(lignes).toHaveLength(1)
    })

    it('insère un site', async () => {
      await etl`
        INSERT INTO sites (id, name, type, capacity_kw, status)
        VALUES ('SITE002', 'Usine Lyon', 'factory', 500, 'active')
      `
      const lignes = await etl`SELECT id FROM sites WHERE id = 'SITE002'`
      expect(lignes).toHaveLength(1)
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
      const [ligne] = await etl<{ capacity_kw: number }[]>`
        SELECT capacity_kw FROM sites WHERE id = 'SITE001'
      `
      expect(ligne.capacity_kw).toBe(220)
    })
  })

  describe('ce qui doit être refusé', () => {
    const refus = async (requete: () => Promise<unknown>) => {
      await expect(requete()).rejects.toMatchObject({ code: PRIVILEGE_INSUFFISANT })
    }

    it('ne lit pas les comptes', async () => {
      await refus(() => etl`SELECT id FROM users`)
    })

    it('ne lit pas les sessions', async () => {
      await refus(() => etl`SELECT id FROM sessions`)
    })

    it("ne lit pas les périmètres d'accès", async () => {
      await refus(() => etl`SELECT user_id FROM user_sites`)
    })

    it("n'écrase pas un seuil réglé à l'écran", async () => {
      await refus(() => etl`UPDATE sites SET warning_threshold_kw = 100`)
    })

    it('ne supprime aucun site', async () => {
      await refus(() => etl`DELETE FROM sites`)
    })

    it('ne touche pas au référentiel des rôles', async () => {
      await refus(() => etl`INSERT INTO roles (name) VALUES ('PIRATE')`)
    })
  })
})
