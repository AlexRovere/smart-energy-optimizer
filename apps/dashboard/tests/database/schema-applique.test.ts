import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { baseDisponible, creerBaseDeTest, ligneAttendue, type BaseDeTest } from './base-de-test'

const TABLES = ['roles', 'users', 'sessions', 'sites', 'user_sites']

describe.skipIf(!baseDisponible())('schéma appliqué', () => {
  let base: BaseDeTest

  beforeAll(async () => {
    base = await creerBaseDeTest()
  })

  afterAll(async () => {
    await base?.fermer()
  })

  it('crée les cinq tables', async () => {
    const lignes = await base.sql<{ table_name: string }[]>`
      SELECT table_name
        FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name
    `
    expect(lignes.map(l => l.table_name)).toEqual([...TABLES].sort())
  })

  it('donne à user_sites une clé primaire composite', async () => {
    const lignes = await base.sql<{ column_name: string }[]>`
      SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name
       WHERE tc.table_name = 'user_sites' AND tc.constraint_type = 'PRIMARY KEY'
       ORDER BY kcu.column_name
    `
    expect(lignes.map(l => l.column_name)).toEqual(['site_id', 'user_id'])
  })

  // Les index sont vérifiés par schema-conforme-au-document.test.ts, qui les
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
    const ligne = ligneAttendue(
      await base.sql<{ warning_threshold_kw: number | null }[]>`
        SELECT warning_threshold_kw FROM sites WHERE id = 'SITE997'
      `,
      'le site SITE997 tout juste inséré'
    )
    expect(ligne.warning_threshold_kw).toBeNull()
  })
})
