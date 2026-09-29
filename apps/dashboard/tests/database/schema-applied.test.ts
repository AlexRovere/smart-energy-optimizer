import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { databaseAvailable, createTestDatabase, expectedRow, type TestDatabase } from './test-database'

const TABLES = ['roles', 'users', 'sessions', 'sites', 'user_sites', 'alert_thresholds']

describe.skipIf(!databaseAvailable())('schéma appliqué', () => {
  let base: TestDatabase

  beforeAll(async () => {
    base = await createTestDatabase()
  })

  afterAll(async () => {
    await base?.close()
  })

  it('crée les six tables', async () => {
    const rows = await base.sql<{ table_name: string }[]>`
      SELECT table_name
        FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name
    `
    expect(rows.map(l => l.table_name)).toEqual([...TABLES].sort())
  })

  it('donne à user_sites une clé primaire composite', async () => {
    const rows = await base.sql<{ column_name: string }[]>`
      SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name
       WHERE tc.table_name = 'user_sites' AND tc.constraint_type = 'PRIMARY KEY'
       ORDER BY kcu.column_name
    `
    expect(rows.map(l => l.column_name)).toEqual(['site_id', 'user_id'])
  })

  it('donne à alert_thresholds une clé primaire composite, une règle par type et par site', async () => {
    const rows = await base.sql<{ column_name: string }[]>`
      SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name
       WHERE tc.table_name = 'alert_thresholds' AND tc.constraint_type = 'PRIMARY KEY'
       ORDER BY kcu.column_name
    `
    expect(rows.map(l => l.column_name)).toEqual(['site_id', 'type'])
  })

  it('refuse une seconde règle du même type pour le même site', async () => {
    await base.sql`
      INSERT INTO sites (id, name, type, capacity_kw, status)
      VALUES ('SITE996', 'Essai', 'office', 200, 'active')
    `
    await base.sql`
      INSERT INTO alert_thresholds (site_id, type, threshold)
      VALUES ('SITE996', 'conso', 230)
    `
    await expect(base.sql`
      INSERT INTO alert_thresholds (site_id, type, threshold)
      VALUES ('SITE996', 'conso', 250)
    `).rejects.toMatchObject({ code: '23505' })
  })

  // Les index sont vérifiés par schema-matches-document.test.ts, qui les
  // tire des blocs SQL de docs/data.md et compare nom, table et colonne.
  // L'assertion qui vivait ici ne regardait que le nom.

  it('refuse une capacité nulle ou négative', async () => {
    await expect(base.sql`
      INSERT INTO sites (id, name, type, capacity_kw, status)
      VALUES ('SITE999', 'Essai', 'office', 0, 'active')
    `).rejects.toMatchObject({ code: '23514' })
  })

  it('refuse un seuil de vigilance nul ou négatif', async () => {
    await expect(base.sql`
      INSERT INTO sites (id, name, type, capacity_kw, status, warning_threshold_kw)
      VALUES ('SITE998', 'Essai', 'office', 200, 'active', 0)
    `).rejects.toMatchObject({ code: '23514' })
  })

  // L'autre moitié du CHECK, et celle que data.md tient à ce qu'on lise bien :
  // NULL ne veut pas dire « pas de vigilance » mais « règle par défaut », donc
  // un CHECK qui refuserait NULL changerait le sens de la colonne.
  it('laisse passer un seuil de vigilance absent', async () => {
    await base.sql`
      INSERT INTO sites (id, name, type, capacity_kw, status, warning_threshold_kw)
      VALUES ('SITE997', 'Essai', 'office', 200, 'active', NULL)
    `
    const row = expectedRow(
      await base.sql<{ warning_threshold_kw: number | null }[]>`
        SELECT warning_threshold_kw FROM sites WHERE id = 'SITE997'
      `,
      'le site SITE997 tout juste inséré'
    )
    expect(row.warning_threshold_kw).toBeNull()
  })
})
