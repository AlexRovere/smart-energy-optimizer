import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { databaseAvailable, createTestDatabase, MIGRATIONS_DIR, expectedRow, type TestDatabase } from './test-database'
import { seedDatabase, DEMO_ACCOUNTS, ROLES, DEMO_SITES } from '../../server/database/seed'

const OPTIONS = {
  demoPassword: 'mot-de-passe-de-test',
  etlPassword: 'mot-de-passe-etl-de-test'
}

// Apostrophe, antislash et guillemet : de quoi casser une concaténation naïve.
// ALTER ROLE ... PASSWORD n'accepte aucun paramètre lié, donc l'amorçage
// assemble là le seul SQL non paramétré de la branche, et rien ne l'exerçait
// jusqu'ici avec autre chose qu'un mot de passe sage.
const HOSTILE_ETL_PASSWORD = 'a\'b\\c"d'

describe.skipIf(!databaseAvailable())('amorçage', () => {
  let base: TestDatabase

  beforeAll(async () => {
    base = await createTestDatabase()
  })

  afterAll(async () => {
    await base?.close()
  })

  const countRows = async (table: 'roles' | 'users') => {
    const { total } = expectedRow(
      await base.sql<{ total: number }[]>`
        SELECT count(*)::int AS total FROM ${base.sql(table)}
      `,
      `le décompte des lignes de ${table}`
    )
    return total
  }

  it('crée les trois rôles, les trois comptes et les sites de démonstration au premier passage', async () => {
    const result = await seedDatabase(base.sql, OPTIONS)

    const expectedAccess = DEMO_ACCOUNTS.length * DEMO_SITES.length
    expect(result).toEqual({
      createdRoles: ROLES.length,
      createdAccounts: DEMO_ACCOUNTS.length,
      createdSites: DEMO_SITES.length,
      createdAccess: expectedAccess
    })
    expect(await countRows('roles')).toBe(ROLES.length)
    expect(await countRows('users')).toBe(DEMO_ACCOUNTS.length)
  })

  it('hache les mots de passe en Argon2id', async () => {
    const row = expectedRow(
      await base.sql<{ password_hash: string }[]>`
        SELECT password_hash FROM users WHERE email = ${DEMO_ACCOUNTS[0].email}
      `,
      `le compte de démonstration ${DEMO_ACCOUNTS[0].email}`
    )
    expect(row.password_hash).toMatch(/^\$argon2id\$/)
    expect(row.password_hash).toContain('m=19456,t=2,p=1')
  })

  it('ne duplique rien au second passage', async () => {
    const result = await seedDatabase(base.sql, OPTIONS)

    expect(result).toEqual({ createdRoles: 0, createdAccounts: 0, createdSites: 0, createdAccess: 0 })
    expect(await countRows('roles')).toBe(ROLES.length)
    expect(await countRows('users')).toBe(DEMO_ACCOUNTS.length)
  })

  it("n'écrase pas un mot de passe changé depuis", async () => {
    const email = DEMO_ACCOUNTS[0].email
    const hashChanged = '$argon2id$empreinte-posee-a-la-main'

    await base.sql`
      UPDATE users SET password_hash = ${hashChanged} WHERE email = ${email}
    `
    await seedDatabase(base.sql, OPTIONS)

    const row = expectedRow(
      await base.sql<{ password_hash: string }[]>`
        SELECT password_hash FROM users WHERE email = ${email}
      `,
      `le compte ${email} relu après le second amorçage`
    )
    expect(row.password_hash).toBe(hashChanged)
  })

  it('amorce les sites de démonstration pour permettre de tester sans ETL', async () => {
    const { total } = expectedRow(
      await base.sql<{ total: number }[]>`
        SELECT count(*)::int AS total FROM sites
      `,
      'le décompte des lignes de sites'
    )
    expect(total).toBe(DEMO_SITES.length)
  })

  it('rend le rôle etl capable de se connecter', async () => {
    const row = expectedRow(
      await base.sql<{ rolcanlogin: boolean }[]>`
        SELECT rolcanlogin FROM pg_roles WHERE rolname = 'etl'
      `,
      'la ligne pg_roles du rôle etl'
    )
    expect(row.rolcanlogin).toBe(true)
  })

  // Volontairement le dernier test qui amorce : le mot de passe d'un rôle est
  // global au cluster, celui-ci le remplace pour de bon. Il couvre d'un coup
  // l'échappement par quote_literal et la propriété que personne ne vérifiait,
  // le mot de passe posé par l'amorçage ouvrant réellement une session.
  it('pose un mot de passe hostile avec lequel le rôle etl se connecte vraiment', async () => {
    await seedDatabase(base.sql, { ...OPTIONS, etlPassword: HOSTILE_ETL_PASSWORD })

    // Connexion par options et non par URL : un mot de passe pareil ne traverse
    // pas une chaîne d'URL sans questions d'encodage, et ce test parle
    // d'échappement SQL, pas d'encodage d'URL.
    const url = new URL(base.url)
    const etl = postgres({
      host: url.hostname,
      port: Number(url.port),
      database: url.pathname.slice(1),
      username: 'etl',
      password: HOSTILE_ETL_PASSWORD,
      max: 1
    })

    try {
      const row = expectedRow(
        await etl<{ user: string }[]>`
          SELECT current_user AS "user"
        `,
        'le current_user de la session ouverte par le rôle etl'
      )
      expect(row.user).toBe('etl')
      expect(await etl`SELECT id FROM sites`).toHaveLength(DEMO_SITES.length)
    } finally {
      await etl.end()
    }
  })

  it("s'arrête dès la première insertion si les migrations n'ont pas été appliquées", async () => {
    const blank = await createTestDatabase({ migrate: false })
    try {
      const error = await seedDatabase(blank.sql, OPTIONS).catch((cause: unknown) => cause)

      // Ce que l'échec dit réellement : 42P01, table roles inexistante. C'est
      // PostgreSQL qui parle, pas la garde de seed.ts, qu'une base vierge
      // n'atteint jamais. L'assertion le nomme plutôt que de se contenter d'un
      // rejet quelconque ; la garde est couverte juste en dessous.
      expect(error).toMatchObject({ code: '42P01' })
      expect((error as Error).message).toMatch(/relation "roles" does not exist/)
    } finally {
      await blank.close()
    }
  })

  describe('la garde du rôle etl, là où elle est atteignable', () => {
    // Un rôle PostgreSQL est global au cluster, et le conteneur partagé de la
    // suite en a déjà un : la garde de seed.ts y est inatteignable, quelle que
    // soit la base. Un second conteneur, jetable, est le seul endroit où le
    // schéma peut exister sans le rôle. On y applique les migrations, puis on
    // retire le rôle : c'est exactement la situation que la conception nomme,
    // une base dont les migrations ne sont pas celles qu'on croit.
    let container: StartedPostgreSqlContainer
    let sql: postgres.Sql

    beforeAll(async () => {
      container = await new PostgreSqlContainer('postgres:16-alpine').start()
      sql = postgres(container.getConnectionUri(), { max: 1 })
      await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_DIR })
      // DROP OWNED BY retire aussi les privilèges accordés au rôle dans cette
      // base : sans lui, la suppression bute sur la table sites.
      await sql.unsafe('DROP OWNED BY etl')
      await sql.unsafe('DROP ROLE etl')
    })

    afterAll(async () => {
      await sql?.end()
      await container?.stop()
    })

    it('nomme le rôle manquant au lieu de laisser PostgreSQL parler à sa place', async () => {
      await expect(seedDatabase(sql, OPTIONS)).rejects.toThrow(
        "Le rôle PostgreSQL « etl » n'existe pas : appliquer les migrations avant d'amorcer."
      )
    })
  })
})
