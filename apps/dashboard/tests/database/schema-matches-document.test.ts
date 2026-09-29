import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { databaseAvailable, createTestDatabase, type TestDatabase } from './test-database'
import {
  documentedForeignKeys,
  documentedPrimaryKeys,
  documentedCheckColumns,
  primaryKeyColumns,
  documentedUniqueColumns,
  documentedIndexes,
  readDocumentedTables,
  typePostgres
} from './data-md'

interface DatabaseColumn {
  column_name: string
  data_type: string
  character_maximum_length: number | null
  is_nullable: 'YES' | 'NO'
  column_default: string | null
}

// Clef de tri stable pour comparer des tuples sans dépendre de l'ordre dans
// lequel la base et le document les rendent.
function sortKey(values: readonly string[]): string {
  return values.join('|')
}

describe.skipIf(!databaseAvailable())('le schéma appliqué correspond à docs/data.md', () => {
  const documented = readDocumentedTables()
  // Dérivées une seule fois du document : ces appels lèvent déjà si
  // l'extraction par expression régulière ne trouve plus rien, avant même
  // qu'un test tourne. clesPrimairesDocumentees n'est pas réutilisée plus
  // bas (le test par table appelle colonnesClePrimaire directement), mais
  // l'appeler ici est ce qui garantit qu'une extraction de clé primaire
  // vide sur tout le document fait échouer la collecte au lieu de laisser
  // les cinq tests d'inclusion passer à vide.
  const expectedForeignKeys = documentedForeignKeys(documented)
  const expectedUniqueColumns = documentedUniqueColumns(documented)
  const expectedCheckColumns = documentedCheckColumns(documented)
  // Les index viennent des blocs SQL du document, pas des tableaux de
  // colonnes : d'où un extracteur qui relit le fichier plutôt qu'une lecture
  // de `documentees`. Même garde anti-vide que les autres.
  const expectedIndexes = documentedIndexes()
  documentedPrimaryKeys(documented)

  let base: TestDatabase

  beforeAll(async () => {
    base = await createTestDatabase()
  })

  afterAll(async () => {
    await base?.close()
  })

  for (const [tableNameValue, table] of documented) {
    describe(tableNameValue, () => {
      let enBase: Map<string, DatabaseColumn>
      let databasePrimaryKey: string[]

      beforeAll(async () => {
        const rows = await base.sql<DatabaseColumn[]>`
          SELECT column_name, data_type, character_maximum_length,
                 is_nullable, column_default
            FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = ${tableNameValue}
           ORDER BY ordinal_position
        `
        enBase = new Map(rows.map(row => [row.column_name, row]))

        const primaryKeyRows = await base.sql<{ column_name: string }[]>`
          SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON kcu.constraint_name = tc.constraint_name
           WHERE tc.constraint_type = 'PRIMARY KEY'
             AND tc.table_schema = 'public'
             AND tc.table_name = ${tableNameValue}
        `
        databasePrimaryKey = primaryKeyRows.map(l => l.column_name)
      })

      it('a exactement les colonnes du document', () => {
        expect([...enBase.keys()].sort()).toEqual(
          table.columns.map(c => c.name).sort()
        )
      })

      for (const column of table.columns) {
        it(`${column.name} : type, nullabilité et défaut`, () => {
          const actual = enBase.get(column.name)
          expect(actual, `colonne ${column.name} absente de la base`).toBeDefined()

          const expected = typePostgres(column.type)
          expect(actual!.data_type).toBe(expected.dataType)
          expect(actual!.character_maximum_length).toBe(expected.size)
          expect(actual!.is_nullable).toBe(column.nullable ? 'YES' : 'NO')
          expect(actual!.column_default !== null).toBe(column.hasDefault)
        })
      }

      // Inclusion, pas égalité : `user_sites` n'a aucune colonne marquée
      // PRIMARY KEY dans son tableau (sa clé composite est en prose, couverte
      // par schema-applied.test.ts), et l'inclusion y est alors vide sans
      // qu'il faille coder d'exception.
      it('sa clé primaire en base inclut les colonnes marquées PRIMARY KEY du document', () => {
        for (const column of primaryKeyColumns(table)) {
          expect(
            databasePrimaryKey,
            `${column} n'est pas dans la clé primaire de ${tableNameValue} en base`
          ).toContain(column)
        }
      })
    })
  }

  it('respecte les clés étrangères et leur ON DELETE', async () => {
    const rows = await base.sql<{
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

    const enBase = rows
      .map(l => [l.table_name, l.column_name, l.foreign_table_name, l.delete_rule])
      .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
    const expectedItems = expectedForeignKeys
      .map(f => [f.table, f.column, f.referencedTable, f.onDelete])
      .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))

    // Égalité dans les deux sens : une clé étrangère posée en base mais
    // absente du document est aussi un écart.
    expect(enBase).toEqual(expectedItems)
  })

  it('pose les contraintes UNIQUE du document', async () => {
    const rows = await base.sql<{ table_name: string, column_name: string }[]>`
      SELECT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name
       WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = 'public'
       ORDER BY tc.table_name, kcu.column_name
    `
    const enBase = rows
      .map(l => [l.table_name, l.column_name])
      .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
    const expectedItems = expectedUniqueColumns
      .map(([tableName, columnName]) => [tableName, columnName])
      .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))

    expect(enBase).toEqual(expectedItems)
  })

  it('pose les index du document, sur leur table et leur colonne', async () => {
    // Ni clé primaire ni index d'unicité : ceux-là sont posés par les
    // contraintes, déjà comparées plus haut. Ce qui reste est exactement
    // l'ensemble des CREATE INDEX, donc l'égalité vaut dans les deux sens et
    // un index en base qu'aucun bloc SQL ne décrit est un écart lui aussi.
    const rows = await base.sql<{
      name: string
      table_name: string
      column: string
    }[]>`
      SELECT i.relname AS name, t.relname AS table_name, a.attname AS "column"
        FROM pg_index x
        JOIN pg_class i ON i.oid = x.indexrelid
        JOIN pg_class t ON t.oid = x.indrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (x.indkey)
       WHERE t.relnamespace = 'public'::regnamespace
         AND NOT x.indisprimary
         AND NOT x.indisunique
    `

    const enBase = rows
      .map(l => [l.name, l.table_name, l.column])
      .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
    const expectedItems = expectedIndexes
      .map(index => [index.name, index.table, index.column])
      .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))

    expect(enBase).toEqual(expectedItems)
  })

  it('pose une contrainte CHECK pour chaque colonne du document qui en porte une', async () => {
    const rows = await base.sql<{ table_name: string, definition: string }[]>`
      SELECT t.relname AS table_name, pg_get_constraintdef(c.oid) AS definition
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
       WHERE c.contype = 'c' AND t.relnamespace = 'public'::regnamespace
    `

    // Granularité volontaire : la présence d'un CHECK qui mentionne la
    // colonne, pas l'expression mot pour mot, qui serait fragile pour rien.
    for (const [tableName, columnName] of expectedCheckColumns) {
      const pattern = new RegExp(`\\b${columnName}\\b`)
      const found = rows.some(
        l => l.table_name === tableName && pattern.test(l.definition)
      )
      expect(found, `aucun CHECK trouvé sur ${tableName}.${columnName}`).toBe(true)
    }
  })
})
