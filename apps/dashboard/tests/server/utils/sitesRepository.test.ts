// `querySitesList` est la seule fonction qui matérialise le cloisonnement des
// sites côté serveur : elle reçoit une liste d'identifiants autorisés et ne
// rend que les sites correspondants. Ces tests vérifient le format de réponse
// et les invariants de filtrage avec une vraie base PostgreSQL.
import { drizzle } from 'drizzle-orm/postgres-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../server/database/schema'
import { querySitesList, siteExists } from '../../../server/utils/sitesRepository'
import { databaseAvailable, createTestDatabase, type TestDatabase } from '../../database/test-database'

describe.skipIf(!databaseAvailable())('sitesRepository', () => {
  let testDb: TestDatabase
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    testDb = await createTestDatabase()
    db = drizzle(testDb.sql, { schema })

    await testDb.sql`
      INSERT INTO sites (id, name, type, capacity_kw, status)
      VALUES
        ('SITE001', 'Bureau Alpha', 'office', 300, 'active'),
        ('SITE002', 'Usine Beta',   'industrial', 800, 'active')
    `
  })

  afterAll(async () => {
    await testDb.close()
  })

  describe('querySitesList', () => {
    it('retourne les champs dans le format API snake_case', async () => {
      // Le mapping Drizzle (camelCase) → API (snake_case) se fait dans cette
      // fonction. Un champ mal nommé ou absent casse les composants frontend qui
      // dépendent de ce contrat, sans qu'aucun test de handler ne le détecte
      // (ils mockent tous la réponse).
      const result = await querySitesList(db, ['SITE001'])

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        site_id: 'SITE001',
        site_name: 'Bureau Alpha',
        site_type: 'office',
        location: null,
        capacity_kw: 300,
        status: 'active',
        warning_threshold_kw: null,
        present_in_source: true
      })
    })

    it('ne retourne que les sites dont l\'identifiant est dans la liste', async () => {
      // La clause WHERE id IN (...) est la frontière de sécurité du
      // cloisonnement. Sa suppression exposerait tous les sites à l'appelant.
      const result = await querySitesList(db, ['SITE001'])

      expect(result).toHaveLength(1)
      expect(result[0]!.site_id).toBe('SITE001')
      expect(result.some(s => s.site_id === 'SITE002')).toBe(false)
    })

    it('renvoie un tableau vide pour un identifiant absent en base', async () => {
      // user_sites peut référencer un site désactivé ou supprimé. La fonction
      // doit retourner un tableau vide, pas une erreur.
      const result = await querySitesList(db, ['SITE999'])

      expect(result).toEqual([])
    })

    it('renvoie un tableau vide sans erreur pour une liste vide', async () => {
      // Le guard `if (siteIds.length === 0) return []` évite une requête
      // WHERE id IN () invalide. Sans lui, tout utilisateur sans site associé
      // déclencherait une erreur SQL.
      const result = await querySitesList(db, [])

      expect(result).toEqual([])
    })
  })

  describe('siteExists', () => {
    it('reconnaît un site présent au référentiel', async () => {
      expect(await siteExists(db, 'SITE001')).toBe(true)
    })

    it('ne reconnaît pas un site absent du référentiel', async () => {
      expect(await siteExists(db, 'SITE999')).toBe(false)
    })
  })
})
