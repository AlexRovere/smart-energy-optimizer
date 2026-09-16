import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerBaseDeTest, type BaseDeTest } from './base-de-test'
import { lireTablesDocumentees, typePostgres } from './data-md'

interface ColonneEnBase {
  column_name: string
  data_type: string
  character_maximum_length: number | null
  is_nullable: 'YES' | 'NO'
  column_default: string | null
}

describe('le schéma appliqué correspond à docs/data.md', () => {
  const documentees = lireTablesDocumentees()
  let base: BaseDeTest

  beforeAll(async () => {
    base = await creerBaseDeTest()
  })

  afterAll(async () => {
    await base?.fermer()
  })

  for (const [nomTable, table] of documentees) {
    describe(nomTable, () => {
      let enBase: Map<string, ColonneEnBase>

      beforeAll(async () => {
        const lignes = await base.sql<ColonneEnBase[]>`
          SELECT column_name, data_type, character_maximum_length,
                 is_nullable, column_default
            FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = ${nomTable}
           ORDER BY ordinal_position
        `
        enBase = new Map(lignes.map(ligne => [ligne.column_name, ligne]))
      })

      it('a exactement les colonnes du document', () => {
        expect([...enBase.keys()].sort()).toEqual(
          table.colonnes.map(c => c.nom).sort()
        )
      })

      for (const colonne of table.colonnes) {
        it(`${colonne.nom} : type, nullabilité et défaut`, () => {
          const reelle = enBase.get(colonne.nom)
          expect(reelle, `colonne ${colonne.nom} absente de la base`).toBeDefined()

          const attendu = typePostgres(colonne.type)
          expect(reelle!.data_type).toBe(attendu.dataType)
          expect(reelle!.character_maximum_length).toBe(attendu.longueur)
          expect(reelle!.is_nullable).toBe(colonne.nullable ? 'YES' : 'NO')
          expect(reelle!.column_default !== null).toBe(colonne.aUnDefaut)
        })
      }
    })
  }

  it('respecte les clés étrangères et leur ON DELETE', async () => {
    const lignes = await base.sql<{
      table_name: string
      column_name: string
      foreign_table_name: string
      delete_rule: string
    }[]>`
      SELECT tc.table_name,
             kcu.column_name,
             ccu.table_name AS foreign_table_name,
             rc.delete_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
        JOIN information_schema.referential_constraints rc
          ON rc.constraint_name = tc.constraint_name
       WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
       ORDER BY tc.table_name, kcu.column_name
    `

    expect(lignes.map(l => [l.table_name, l.column_name, l.foreign_table_name, l.delete_rule])).toEqual([
      ['sessions', 'user_id', 'users', 'CASCADE'],
      ['user_sites', 'site_id', 'sites', 'RESTRICT'],
      ['user_sites', 'user_id', 'users', 'CASCADE'],
      ['users', 'role_id', 'roles', 'RESTRICT']
    ])
  })

  it('pose les contraintes UNIQUE du document', async () => {
    const lignes = await base.sql<{ table_name: string, column_name: string }[]>`
      SELECT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name
       WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = 'public'
       ORDER BY tc.table_name, kcu.column_name
    `
    expect(lignes.map(l => [l.table_name, l.column_name])).toEqual([
      ['roles', 'name'],
      ['users', 'email']
    ])
  })

  it('pose les deux CHECK du document sur sites', async () => {
    const lignes = await base.sql<{ definition: string }[]>`
      SELECT pg_get_constraintdef(c.oid) AS definition
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
       WHERE c.contype = 'c' AND t.relname = 'sites'
       ORDER BY definition
    `
    const definitions = lignes.map(l => l.definition.replaceAll('"', ''))
    expect(definitions.some(d => /capacity_kw > 0/.test(d))).toBe(true)
    expect(definitions.some(d => /warning_threshold_kw > 0/.test(d))).toBe(true)
  })
})
