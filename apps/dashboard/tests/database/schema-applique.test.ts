import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerBaseDeTest, type BaseDeTest } from './base-de-test'

const TABLES = ['roles', 'users', 'sessions', 'sites', 'user_sites']

describe('schéma appliqué', () => {
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

  it('pose les deux index nommés par le document', async () => {
    const lignes = await base.sql<{ indexname: string }[]>`
      SELECT indexname
        FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname IN ('idx_sessions_user', 'idx_user_sites_site')
       ORDER BY indexname
    `
    expect(lignes.map(l => l.indexname)).toEqual([
      'idx_sessions_user',
      'idx_user_sites_site'
    ])
  })

  it('refuse une capacité nulle ou négative', async () => {
    await expect(base.sql`
      INSERT INTO sites (id, name, type, capacity_kw, status)
      VALUES ('SITE999', 'Essai', 'office', 0, 'active')
    `).rejects.toMatchObject({ code: '23514' })
  })
})
