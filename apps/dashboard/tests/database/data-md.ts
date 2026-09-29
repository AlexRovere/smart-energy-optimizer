// Lit docs/data.md et en extrait les six tableaux de colonnes, pour que le
// document devienne vérifiable au lieu d'être seulement lu.
//
// Un parseur de Markdown est fragile par nature : celui-ci échoue bruyamment
// s'il ne trouve pas ce qu'il attend, parce qu'un test de conformité qui passe
// à vide est pire que pas de test du tout.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DATA_MD_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../docs/data.md'
)

const EXPECTED_TABLES = [
  'roles',
  'users',
  'sessions',
  'sites',
  'user_sites',
  'alert_thresholds',
  'feedback'
] as const

export interface DocumentedColumn {
  name: string
  type: string
  constraints: string
  nullable: boolean
  hasDefault: boolean
}

export interface DocumentedTable {
  name: string
  columns: DocumentedColumn[]
}

function cells(row: string): string[] {
  const raw = row.trim()
  const withoutBorders = raw.slice(1, raw.endsWith('|') ? -1 : undefined)
  return withoutBorders.split('|').map(cell => cell.trim())
}

function withoutBackticks(value: string): string {
  return value.replaceAll('`', '').trim()
}

function isSeparator(row: string): boolean {
  const raw = row.trim()
  const remainingChars = raw.replaceAll('|', '').replaceAll(':', '').replaceAll('-', '').trim()
  return raw.startsWith('|') && raw.length > 1 && remainingChars === ''
}

function readTable(rows: string[], name: string): DocumentedTable {
  const startedAt = rows.findIndex(row => row.trim() === `### \`${name}\``)
  if (startedAt === -1) {
    throw new Error(`Section « ### \`${name}\` » introuvable dans ${DATA_MD_PATH}`)
  }

  const header = rows.findIndex(
    (row, index) => index > startedAt && row.trim().startsWith('|')
  )
  if (header === -1) {
    throw new Error(`Aucun tableau après la section de la table ${name}`)
  }

  const titles = cells(rows[header]!).map(withoutBackticks)
  const indexName = titles.indexOf('Colonne')
  const indexType = titles.indexOf('Type')
  const constraintIndexes = titles.indexOf('Contraintes')
  if (indexName === -1 || indexType === -1 || constraintIndexes === -1) {
    throw new Error(
      `Le tableau de ${name} n'a pas les en-têtes attendus : ${titles.join(', ')}`
    )
  }

  const columns: DocumentedColumn[] = []
  for (let index = header + 1; index < rows.length; index += 1) {
    const row = rows[index]!
    if (!row.trim().startsWith('|')) break
    if (isSeparator(row)) continue

    const values = cells(row)
    const constraints = withoutBackticks(values[constraintIndexes] ?? '')
    const type = withoutBackticks(values[indexType] ?? '')
    // Frontières de mot obligatoires : « NOT NULL » contient « NULL », et la
    // lecture naïve rendrait toute colonne nullable.
    const notNull = /\bNOT NULL\b/i.test(constraints) || /\bPRIMARY KEY\b/i.test(constraints)

    columns.push({
      name: withoutBackticks(values[indexName] ?? ''),
      type,
      constraints,
      nullable: !notNull,
      hasDefault: /\bDEFAULT\b/i.test(constraints) || type.toUpperCase() === 'SERIAL'
    })
  }

  if (columns.length === 0) {
    throw new Error(`Le tableau de ${name} n'a aucune colonne`)
  }
  return { name, columns }
}

export function readDocumentedTables(): Map<string, DocumentedTable> {
  const rows = readFileSync(DATA_MD_PATH, 'utf8').split(/\r?\n/)
  const tables = new Map<string, DocumentedTable>()
  for (const name of EXPECTED_TABLES) {
    tables.set(name, readTable(rows, name))
  }
  // Pas de contrôle du nombre de tables ici : la boucle ci-dessus parcourt une
  // constante de sept entrées distinctes et lireTable lève avant de rendre, si
  // bien qu'un tel contrôle ne pourrait jamais être vrai. C'est data-md.test.ts
  // qui vérifie que les sept tables sont bien celles attendues.
  return tables
}

export function typePostgres(
  documentedType: string
): { dataType: string, size: number | null } {
  const type = documentedType.trim().toUpperCase()

  const varchar = /^VARCHAR\((\d+)\)$/.exec(type)
  if (varchar) {
    return { dataType: 'character varying', size: Number(varchar[1]) }
  }

  switch (type) {
    case 'SERIAL':
    case 'INTEGER':
      return { dataType: 'integer', size: null }
    case 'UUID':
      return { dataType: 'uuid', size: null }
    case 'BOOLEAN':
      return { dataType: 'boolean', size: null }
    case 'INET':
      return { dataType: 'inet', size: null }
    case 'REAL':
      return { dataType: 'real', size: null }
    case 'TIMESTAMPTZ':
      return { dataType: 'timestamp with time zone', size: null }
    default:
      throw new Error(`Type non pris en charge dans data.md : ${documentedType}`)
  }
}

// Ce qui suit dérive du texte brut de `contraintes` les attentes que le test
// de conformité compare à la base : clés primaires, UNIQUE, clés étrangères et
// CHECK. Le but est que ces attentes viennent du document à chaque exécution,
// jamais d'une copie figée recopiée à la main dans le test.

// Colonnes marquées PRIMARY KEY dans le tableau d'une table. Vide pour
// `user_sites` : sa clé composite est décrite en prose sous le tableau, pas
// par colonne, et elle est couverte par ailleurs.
export function primaryKeyColumns(table: DocumentedTable): string[] {
  return table.columns
    .filter(column => /\bPRIMARY KEY\b/i.test(column.constraints))
    .map(column => column.name)
}

// Agrège colonnesClePrimaire sur tout le document. Lève si le total est nul :
// une expression régulière qui ne trouverait plus rien rendrait les tests
// d'inclusion vides et donc verts sans le dire.
export function documentedPrimaryKeys(
  tables: Map<string, DocumentedTable>
): Array<[table: string, column: string]> {
  const pairs = [...tables.values()].flatMap(table =>
    primaryKeyColumns(table).map((column): [string, string] => [table.name, column])
  )
  if (pairs.length === 0) {
    throw new Error(
      'Aucune colonne PRIMARY KEY trouvée dans data.md : extraction probablement cassée'
    )
  }
  return pairs
}

// Colonnes marquées UNIQUE, agrégées sur tout le document.
export function documentedUniqueColumns(
  tables: Map<string, DocumentedTable>
): Array<[table: string, column: string]> {
  const pairs = [...tables.values()].flatMap(table =>
    table.columns
      .filter(column => /\bUNIQUE\b/i.test(column.constraints))
      .map((column): [string, string] => [table.name, column.name])
  )
  if (pairs.length === 0) {
    throw new Error(
      'Aucune colonne UNIQUE trouvée dans data.md : extraction probablement cassée'
    )
  }
  return pairs
}

export interface DocumentedForeignKey {
  table: string
  column: string
  referencedTable: string
  onDelete: string
}

// Extrait la forme « REFERENCES table(colonne) ON DELETE RÈGLE » de
// `contraintes`, agrégée sur tout le document.
export function documentedForeignKeys(
  tables: Map<string, DocumentedTable>
): DocumentedForeignKey[] {
  const result: DocumentedForeignKey[] = []
  for (const table of tables.values()) {
    for (const column of table.columns) {
      const match = /REFERENCES\s+(\w+)\(\w+\)\s+ON DELETE\s+(\w+)/i.exec(
        column.constraints
      )
      if (match) {
        result.push({
          table: table.name,
          column: column.name,
          referencedTable: match[1]!,
          onDelete: match[2]!.toUpperCase()
        })
      }
    }
  }
  if (result.length === 0) {
    throw new Error(
      'Aucune clé étrangère trouvée dans data.md : extraction probablement cassée'
    )
  }
  return result
}

// Colonnes dont les contraintes portent un CHECK, agrégées sur tout le
// document. Ne capture pas l'expression du CHECK : la comparer mot pour mot
// à la base serait fragile pour rien, seule la présence compte.
export function documentedCheckColumns(
  tables: Map<string, DocumentedTable>
): Array<[table: string, column: string]> {
  const pairs = [...tables.values()].flatMap(table =>
    table.columns
      .filter(column => /\bCHECK\b/i.test(column.constraints))
      .map((column): [string, string] => [table.name, column.name])
  )
  if (pairs.length === 0) {
    throw new Error(
      'Aucune colonne avec CHECK trouvée dans data.md : extraction probablement cassée'
    )
  }
  return pairs
}

export interface DocumentedIndex {
  name: string
  table: string
  column: string
}

// Les index du document ne sont pas dans les tableaux de colonnes mais dans des
// blocs SQL, d'où une lecture à part : `CREATE INDEX <nom> ON <table>
// (<colonne>)`. Le nom, la table et la colonne sont rendus tous les trois,
// parce qu'un index correctement nommé mais posé ailleurs est un écart comme un
// autre. Lève si le total est nul, comme les extracteurs ci-dessus.
export function documentedIndexes(): DocumentedIndex[] {
  const rows = readFileSync(DATA_MD_PATH, 'utf8').split(/\r?\n/)
  const result: DocumentedIndex[] = []
  let inSqlBlock = false

  for (const row of rows) {
    const bare = row.trim()
    if (bare.startsWith('```')) {
      inSqlBlock = bare.toLowerCase() === '```sql'
      continue
    }
    if (!inSqlBlock) continue

    const match = /^CREATE INDEX\s+(\w+)\s+ON\s+(\w+)\s*\(\s*(\w+)\s*\)\s*;?$/i
      .exec(bare)
    if (match) {
      result.push({
        name: match[1]!,
        table: match[2]!,
        column: match[3]!
      })
    }
  }

  if (result.length === 0) {
    throw new Error(
      'Aucun CREATE INDEX trouvé dans data.md : extraction probablement cassée'
    )
  }
  return result
}
