import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerBaseDeTest, type BaseDeTest } from './base-de-test'
import {
  clesEtrangeresDocumentees,
  colonnesAvecCheckDocumentees,
  colonnesClePrimaire,
  colonnesUniquesDocumentees,
  lireTablesDocumentees,
  typePostgres
} from './data-md'

interface ColonneEnBase {
  column_name: string
  data_type: string
  character_maximum_length: number | null
  is_nullable: 'YES' | 'NO'
  column_default: string | null
}

// Clef de tri stable pour comparer des tuples sans dépendre de l'ordre dans
// lequel la base et le document les rendent.
function clefTri(valeurs: readonly string[]): string {
  return valeurs.join('|')
}

describe('le schéma appliqué correspond à docs/data.md', () => {
  const documentees = lireTablesDocumentees()
  // Dérivées une seule fois du document : ces appels lèvent déjà si
  // l'extraction par expression régulière ne trouve plus rien, avant même
  // qu'un test tourne.
  const clesEtrangeresAttendues = clesEtrangeresDocumentees(documentees)
  const colonnesUniquesAttendues = colonnesUniquesDocumentees(documentees)
  const colonnesCheckAttendues = colonnesAvecCheckDocumentees(documentees)

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
      let clePrimaireEnBase: string[]

      beforeAll(async () => {
        const lignes = await base.sql<ColonneEnBase[]>`
          SELECT column_name, data_type, character_maximum_length,
                 is_nullable, column_default
            FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = ${nomTable}
           ORDER BY ordinal_position
        `
        enBase = new Map(lignes.map(ligne => [ligne.column_name, ligne]))

        const lignesClePrimaire = await base.sql<{ column_name: string }[]>`
          SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON kcu.constraint_name = tc.constraint_name
           WHERE tc.constraint_type = 'PRIMARY KEY'
             AND tc.table_schema = 'public'
             AND tc.table_name = ${nomTable}
        `
        clePrimaireEnBase = lignesClePrimaire.map(l => l.column_name)
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

      // Inclusion, pas égalité : `user_sites` n'a aucune colonne marquée
      // PRIMARY KEY dans son tableau (sa clé composite est en prose, couverte
      // par schema-applique.test.ts), et l'inclusion y est alors vide sans
      // qu'il faille coder d'exception.
      it('sa clé primaire en base inclut les colonnes marquées PRIMARY KEY du document', () => {
        for (const colonne of colonnesClePrimaire(table)) {
          expect(
            clePrimaireEnBase,
            `${colonne} n'est pas dans la clé primaire de ${nomTable} en base`
          ).toContain(colonne)
        }
      })
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

    const enBase = lignes
      .map(l => [l.table_name, l.column_name, l.foreign_table_name, l.delete_rule])
      .sort((a, b) => clefTri(a).localeCompare(clefTri(b)))
    const attendues = clesEtrangeresAttendues
      .map(f => [f.table, f.colonne, f.tableReferencee, f.onDelete])
      .sort((a, b) => clefTri(a).localeCompare(clefTri(b)))

    // Égalité dans les deux sens : une clé étrangère posée en base mais
    // absente du document est aussi un écart.
    expect(enBase).toEqual(attendues)
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
    const enBase = lignes
      .map(l => [l.table_name, l.column_name])
      .sort((a, b) => clefTri(a).localeCompare(clefTri(b)))
    const attendues = colonnesUniquesAttendues
      .map(([tableNom, colonneNom]) => [tableNom, colonneNom])
      .sort((a, b) => clefTri(a).localeCompare(clefTri(b)))

    expect(enBase).toEqual(attendues)
  })

  it('pose une contrainte CHECK pour chaque colonne du document qui en porte une', async () => {
    const lignes = await base.sql<{ table_name: string, definition: string }[]>`
      SELECT t.relname AS table_name, pg_get_constraintdef(c.oid) AS definition
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
       WHERE c.contype = 'c' AND t.relnamespace = 'public'::regnamespace
    `

    // Granularité volontaire : la présence d'un CHECK qui mentionne la
    // colonne, pas l'expression mot pour mot, qui serait fragile pour rien.
    for (const [tableNom, colonneNom] of colonnesCheckAttendues) {
      const motif = new RegExp(`\\b${colonneNom}\\b`)
      const trouvee = lignes.some(
        l => l.table_name === tableNom && motif.test(l.definition)
      )
      expect(trouvee, `aucun CHECK trouvé sur ${tableNom}.${colonneNom}`).toBe(true)
    }
  })
})
