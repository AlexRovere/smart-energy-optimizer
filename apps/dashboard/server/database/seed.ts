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
import { hash } from '@node-rs/argon2'
import type { Sql } from 'postgres'

// Paramètres de docs/data.md, repris de la fiche OWASP « Password Storage ».
export const PARAMETRES_ARGON2ID = {
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
  if (!existe.present) {
    throw new Error(
      "Le rôle PostgreSQL « etl » n'existe pas : appliquer les migrations avant d'amorcer."
    )
  }

  // PostgreSQL n'accepte pas de paramètre lié dans ALTER ROLE ... PASSWORD, et
  // un bloc DO n'en accepte pas davantage. L'échappement se fait donc côté
  // serveur, par quote_literal, avant d'assembler la commande.
  const [{ literal }] = await sql<{ literal: string }[]>`
    SELECT quote_literal(${motDePasse}) AS literal
  `
  await sql.unsafe(`ALTER ROLE etl WITH LOGIN PASSWORD ${literal}`)
}
