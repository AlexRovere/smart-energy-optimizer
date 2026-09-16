// Lit docs/data.md et en extrait les cinq tableaux de colonnes, pour que le
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

const TABLES_ATTENDUES = ['roles', 'users', 'sessions', 'sites', 'user_sites'] as const

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
  if (tables.size !== TABLES_ATTENDUES.length) {
    throw new Error(
      `${tables.size} table(s) lue(s) dans data.md, ${TABLES_ATTENDUES.length} attendues`
    )
  }
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
    case 'TIMESTAMPTZ':
      return { dataType: 'timestamp with time zone', longueur: null }
    default:
      throw new Error(`Type non pris en charge dans data.md : ${typeDocumente}`)
  }
}
