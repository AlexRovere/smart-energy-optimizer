// Lit docs/data.md et en extrait les six tableaux de colonnes, pour que le
// document devienne vérifiable au lieu d'être seulement lu.
//
// Un parseur de Markdown est fragile par nature : celui-ci échoue bruyamment
// s'il ne trouve pas ce qu'il attend, parce qu'un test de conformité qui passe
// à vide est pire que pas de test du tout.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const CHEMIN_DATA_MD = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../docs/data.md'
)

const TABLES_ATTENDUES = [
  'roles',
  'users',
  'sessions',
  'sites',
  'user_sites',
  'alert_thresholds'
] as const

export interface ColonneDocumentee {
  nom: string
  type: string
  contraintes: string
  nullable: boolean
  aUnDefaut: boolean
}

export interface TableDocumentee {
  nom: string
  colonnes: ColonneDocumentee[]
}

function cellules(ligne: string): string[] {
  const brut = ligne.trim()
  const sansBordures = brut.slice(1, brut.endsWith('|') ? -1 : undefined)
  return sansBordures.split('|').map(cellule => cellule.trim())
}

function sansAccentsGraves(valeur: string): string {
  return valeur.replaceAll('`', '').trim()
}

function estSeparateur(ligne: string): boolean {
  return /^\|[\s:|-]+\|?\s*$/.test(ligne.trim())
}

function lireTable(lignes: string[], nom: string): TableDocumentee {
  const debut = lignes.findIndex(ligne => ligne.trim() === `### \`${nom}\``)
  if (debut === -1) {
    throw new Error(`Section « ### \`${nom}\` » introuvable dans ${CHEMIN_DATA_MD}`)
  }

  const entete = lignes.findIndex(
    (ligne, index) => index > debut && ligne.trim().startsWith('|')
  )
  if (entete === -1) {
    throw new Error(`Aucun tableau après la section de la table ${nom}`)
  }

  const titres = cellules(lignes[entete]!).map(sansAccentsGraves)
  const indexNom = titres.indexOf('Colonne')
  const indexType = titres.indexOf('Type')
  const indexContraintes = titres.indexOf('Contraintes')
  if (indexNom === -1 || indexType === -1 || indexContraintes === -1) {
    throw new Error(
      `Le tableau de ${nom} n'a pas les en-têtes attendus : ${titres.join(', ')}`
    )
  }

  const colonnes: ColonneDocumentee[] = []
  for (let index = entete + 1; index < lignes.length; index += 1) {
    const ligne = lignes[index]!
    if (!ligne.trim().startsWith('|')) break
    if (estSeparateur(ligne)) continue

    const valeurs = cellules(ligne)
    const contraintes = sansAccentsGraves(valeurs[indexContraintes] ?? '')
    const type = sansAccentsGraves(valeurs[indexType] ?? '')
    // Frontières de mot obligatoires : « NOT NULL » contient « NULL », et la
    // lecture naïve rendrait toute colonne nullable.
    const nonNul = /\bNOT NULL\b/i.test(contraintes) || /\bPRIMARY KEY\b/i.test(contraintes)

    colonnes.push({
      nom: sansAccentsGraves(valeurs[indexNom] ?? ''),
      type,
      contraintes,
      nullable: !nonNul,
      aUnDefaut: /\bDEFAULT\b/i.test(contraintes) || type.toUpperCase() === 'SERIAL'
    })
  }

  if (colonnes.length === 0) {
    throw new Error(`Le tableau de ${nom} n'a aucune colonne`)
  }
  return { nom, colonnes }
}

export function lireTablesDocumentees(): Map<string, TableDocumentee> {
  const lignes = readFileSync(CHEMIN_DATA_MD, 'utf8').split(/\r?\n/)
  const tables = new Map<string, TableDocumentee>()
  for (const nom of TABLES_ATTENDUES) {
    tables.set(nom, lireTable(lignes, nom))
  }
  // Pas de contrôle du nombre de tables ici : la boucle ci-dessus parcourt une
  // constante de six entrées distinctes et lireTable lève avant de rendre, si
  // bien qu'un tel contrôle ne pourrait jamais être vrai. C'est data-md.test.ts
  // qui vérifie que les six tables sont bien celles attendues.
  return tables
}

export function typePostgres(
  typeDocumente: string
): { dataType: string, longueur: number | null } {
  const type = typeDocumente.trim().toUpperCase()

  const varchar = /^VARCHAR\((\d+)\)$/.exec(type)
  if (varchar) {
    return { dataType: 'character varying', longueur: Number(varchar[1]) }
  }

  switch (type) {
    case 'SERIAL':
    case 'INTEGER':
      return { dataType: 'integer', longueur: null }
    case 'UUID':
      return { dataType: 'uuid', longueur: null }
    case 'BOOLEAN':
      return { dataType: 'boolean', longueur: null }
    case 'INET':
      return { dataType: 'inet', longueur: null }
    case 'REAL':
      return { dataType: 'real', longueur: null }
    case 'TIMESTAMPTZ':
      return { dataType: 'timestamp with time zone', longueur: null }
    default:
      throw new Error(`Type non pris en charge dans data.md : ${typeDocumente}`)
  }
}

// Ce qui suit dérive du texte brut de `contraintes` les attentes que le test
// de conformité compare à la base : clés primaires, UNIQUE, clés étrangères et
// CHECK. Le but est que ces attentes viennent du document à chaque exécution,
// jamais d'une copie figée recopiée à la main dans le test.

// Colonnes marquées PRIMARY KEY dans le tableau d'une table. Vide pour
// `user_sites` : sa clé composite est décrite en prose sous le tableau, pas
// par colonne, et elle est couverte par ailleurs.
export function colonnesClePrimaire(table: TableDocumentee): string[] {
  return table.colonnes
    .filter(colonne => /\bPRIMARY KEY\b/i.test(colonne.contraintes))
    .map(colonne => colonne.nom)
}

// Agrège colonnesClePrimaire sur tout le document. Lève si le total est nul :
// une expression régulière qui ne trouverait plus rien rendrait les tests
// d'inclusion vides et donc verts sans le dire.
export function clesPrimairesDocumentees(
  tables: Map<string, TableDocumentee>
): Array<[table: string, colonne: string]> {
  const paires = [...tables.values()].flatMap(table =>
    colonnesClePrimaire(table).map((colonne): [string, string] => [table.nom, colonne])
  )
  if (paires.length === 0) {
    throw new Error(
      'Aucune colonne PRIMARY KEY trouvée dans data.md : extraction probablement cassée'
    )
  }
  return paires
}

// Colonnes marquées UNIQUE, agrégées sur tout le document.
export function colonnesUniquesDocumentees(
  tables: Map<string, TableDocumentee>
): Array<[table: string, colonne: string]> {
  const paires = [...tables.values()].flatMap(table =>
    table.colonnes
      .filter(colonne => /\bUNIQUE\b/i.test(colonne.contraintes))
      .map((colonne): [string, string] => [table.nom, colonne.nom])
  )
  if (paires.length === 0) {
    throw new Error(
      'Aucune colonne UNIQUE trouvée dans data.md : extraction probablement cassée'
    )
  }
  return paires
}

export interface CleEtrangereDocumentee {
  table: string
  colonne: string
  tableReferencee: string
  onDelete: string
}

// Extrait la forme « REFERENCES table(colonne) ON DELETE RÈGLE » de
// `contraintes`, agrégée sur tout le document.
export function clesEtrangeresDocumentees(
  tables: Map<string, TableDocumentee>
): CleEtrangereDocumentee[] {
  const resultat: CleEtrangereDocumentee[] = []
  for (const table of tables.values()) {
    for (const colonne of table.colonnes) {
      const correspondance = /REFERENCES\s+(\w+)\(\w+\)\s+ON DELETE\s+(\w+)/i.exec(
        colonne.contraintes
      )
      if (correspondance) {
        resultat.push({
          table: table.nom,
          colonne: colonne.nom,
          tableReferencee: correspondance[1]!,
          onDelete: correspondance[2]!.toUpperCase()
        })
      }
    }
  }
  if (resultat.length === 0) {
    throw new Error(
      'Aucune clé étrangère trouvée dans data.md : extraction probablement cassée'
    )
  }
  return resultat
}

// Colonnes dont les contraintes portent un CHECK, agrégées sur tout le
// document. Ne capture pas l'expression du CHECK : la comparer mot pour mot
// à la base serait fragile pour rien, seule la présence compte.
export function colonnesAvecCheckDocumentees(
  tables: Map<string, TableDocumentee>
): Array<[table: string, colonne: string]> {
  const paires = [...tables.values()].flatMap(table =>
    table.colonnes
      .filter(colonne => /\bCHECK\b/i.test(colonne.contraintes))
      .map((colonne): [string, string] => [table.nom, colonne.nom])
  )
  if (paires.length === 0) {
    throw new Error(
      'Aucune colonne avec CHECK trouvée dans data.md : extraction probablement cassée'
    )
  }
  return paires
}

export interface IndexDocumente {
  nom: string
  table: string
  colonne: string
}

// Les index du document ne sont pas dans les tableaux de colonnes mais dans des
// blocs SQL, d'où une lecture à part : `CREATE INDEX <nom> ON <table>
// (<colonne>)`. Le nom, la table et la colonne sont rendus tous les trois,
// parce qu'un index correctement nommé mais posé ailleurs est un écart comme un
// autre. Lève si le total est nul, comme les extracteurs ci-dessus.
export function indexDocumentes(): IndexDocumente[] {
  const lignes = readFileSync(CHEMIN_DATA_MD, 'utf8').split(/\r?\n/)
  const resultat: IndexDocumente[] = []
  let dansUnBlocSql = false

  for (const ligne of lignes) {
    const nue = ligne.trim()
    if (nue.startsWith('```')) {
      dansUnBlocSql = nue.toLowerCase() === '```sql'
      continue
    }
    if (!dansUnBlocSql) continue

    const correspondance = /^CREATE INDEX\s+(\w+)\s+ON\s+(\w+)\s*\(\s*(\w+)\s*\)\s*;?$/i
      .exec(nue)
    if (correspondance) {
      resultat.push({
        nom: correspondance[1]!,
        table: correspondance[2]!,
        colonne: correspondance[3]!
      })
    }
  }

  if (resultat.length === 0) {
    throw new Error(
      'Aucun CREATE INDEX trouvé dans data.md : extraction probablement cassée'
    )
  }
  return resultat
}
