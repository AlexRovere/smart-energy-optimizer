// Amorçage idempotent : trois rôles et un compte de démonstration par rôle.
//
// Idempotent veut dire deux choses, et la seconde est la moins évidente : un
// second passage ne crée pas de doublon, ET n'écrase pas un mot de passe
// changé depuis. C'est la clause ON CONFLICT DO NOTHING qui tient la seconde ;
// un DO UPDATE remettrait chaque compte à sa valeur d'usine à chaque passage.
//
// Aucun site n'est amorcé : le référentiel appartient à l'ETL (#21), et seuls
// les identifiants SITE001 à SITE007 sont connus ici. Une ligne inventée ne
// serait jamais corrigée, l'ETL n'insérant que les sites absents.
import { hash, type Algorithm } from '@node-rs/argon2'
import type { Sql } from 'postgres'

// @node-rs/argon2 déclare son énumération Algorithm en `const enum` ambiante,
// et le tsconfig de Nuxt pose verbatimModuleSyntax : lire `Algorithm.Argon2id`
// y est refusé, parce que le compilateur devrait inliner le membre alors que
// l'import doit rester tel quel. La valeur est donc écrite, mais typée sur le
// membre attendu : si la bibliothèque renumérotait son énumération, ce fichier
// cesserait de compiler au lieu de choisir silencieusement un autre algorithme.
const ARGON2ID: Algorithm.Argon2id = 2

// Paramètres de docs/data.md, repris de la fiche OWASP « Password Storage ».
//
// L'algorithme est écrit, alors qu'Argon2id est déjà le défaut de
// @node-rs/argon2 : le dépôt a tranché « Argon2id, et un seul » (data.md, #29),
// et une primitive cryptographique choisie par le défaut d'une bibliothèque
// change le jour où la bibliothèque change d'avis, sans que ce fichier bouge.
export const PARAMETRES_ARGON2ID = {
  algorithm: ARGON2ID,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const

export const ROLES = ['ADMIN', 'OPERATOR', 'VIEWER'] as const

export const COMPTES_DE_DEMONSTRATION = [
  { email: 'admin@enervision.local', role: 'ADMIN' },
  { email: 'operator@enervision.local', role: 'OPERATOR' },
  { email: 'viewer@enervision.local', role: 'VIEWER' }
] as const

export interface OptionsAmorcage {
  motDePasseDemonstration: string
  motDePasseEtl: string
}

export interface ResultatAmorcage {
  rolesCrees: number
  comptesCrees: number
}

export async function amorcer(
  sql: Sql,
  options: OptionsAmorcage
): Promise<ResultatAmorcage> {
  let rolesCrees = 0
  for (const role of ROLES) {
    const inseres = await sql`
      INSERT INTO roles (name) VALUES (${role})
      ON CONFLICT (name) DO NOTHING
      RETURNING id
    `
    rolesCrees += inseres.length
  }

  let comptesCrees = 0
  for (const compte of COMPTES_DE_DEMONSTRATION) {
    // Le hachage a lieu avant l'insertion, donc aussi quand le compte existe
    // déjà. Trois hachages Argon2id par passage, soit une fraction de seconde :
    // moins cher qu'une requête d'existence de plus, et sans course.
    const empreinte = await hash(options.motDePasseDemonstration, PARAMETRES_ARGON2ID)
    const inseres = await sql`
      INSERT INTO users (role_id, email, password_hash)
      SELECT r.id, ${compte.email}, ${empreinte}
        FROM roles r
       WHERE r.name = ${compte.role}
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `
    comptesCrees += inseres.length
  }

  await activerRoleEtl(sql, options.motDePasseEtl)

  return { rolesCrees, comptesCrees }
}

// La migration 0001 crée le rôle sans LOGIN ni mot de passe. C'est ici qu'il
// devient utilisable, et seulement ici, parce que le secret vient de
// l'environnement et ne doit apparaître dans aucun fichier commité.
async function activerRoleEtl(sql: Sql, motDePasse: string): Promise<void> {
  const [existe] = await sql<{ present: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'etl') AS present
  `
  // SELECT EXISTS rend toujours une ligne : n'en rendre aucune signifie que la
  // requête n'a pas été exécutée là où on croyait. On le dit plutôt que de lire
  // une propriété sur rien, l'erreur serait alors « of undefined », sans piste.
  if (existe === undefined) {
    throw new Error(
      "La recherche du rôle PostgreSQL « etl » n'a rendu aucune ligne : la connexion n'est pas celle attendue."
    )
  }
  if (!existe.present) {
    throw new Error(
      "Le rôle PostgreSQL « etl » n'existe pas : appliquer les migrations avant d'amorcer."
    )
  }

  // PostgreSQL n'accepte pas de paramètre lié dans ALTER ROLE ... PASSWORD, et
  // un bloc DO n'en accepte pas davantage. L'échappement se fait donc côté
  // serveur, par quote_literal, avant d'assembler la commande.
  const [echappe] = await sql<{ literal: string }[]>`
    SELECT quote_literal(${motDePasse}) AS literal
  `
  // Même raison qu'au-dessus, et une conséquence plus lourde : sans littéral,
  // la commande assemblée plus bas serait tronquée et poserait n'importe quoi
  // comme mot de passe. On s'arrête avant de l'assembler.
  if (echappe === undefined) {
    throw new Error(
      "L'échappement du mot de passe du rôle « etl » n'a rendu aucune ligne : commande ALTER ROLE non assemblée."
    )
  }
  await sql.unsafe(`ALTER ROLE etl WITH LOGIN PASSWORD ${echappe.literal}`)
}
