// Les critères de #45 sont des promesses HTTP : protection de la route, validation
// du format d'identifiant, et retour d'un tableau de recommandations. Ce fichier
// les vérifie en HTTP avec une vraie base de test, sur le modèle de authentication.test.ts.
//
// Sans répertoire Parquet ni service ML, le handler retourne [] pour un site
// valide : c'est le comportement de dégradation gracieuse attendu par l'architecture.
import { fileURLToPath } from 'node:url'
import { hash } from '@node-rs/argon2'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { beforeAll, describe, expect, it } from 'vitest'
import { PARAMETRES_ARGON2ID } from '../../server/database/seed'
import { baseDisponible, creerBaseDeTest, type BaseDeTest } from '../database/base-de-test'

const EMAIL = 'admin@enervision.local'
const EMAIL_OPERATEUR = 'operator@enervision.local'
const PASSWORD = 'mot-de-passe-de-demonstration'

let testDb: BaseDeTest

beforeAll(async () => {
  if (!baseDisponible()) return
  testDb = await creerBaseDeTest()
  process.env.NUXT_DATABASE_URL = testDb.url
  process.env.NUXT_SESSION_PASSWORD = 'mot-de-passe-de-test-de-trente-deux-signes'
  process.env.NUXT_MOCK_API_URL = 'http://127.0.0.1:1'
  process.env.NUXT_ML_SERVICE_URL = 'http://127.0.0.1:1'

  const digest = await hash(PASSWORD, PARAMETRES_ARGON2ID)
  await testDb.sql`INSERT INTO roles (name) VALUES ('ADMIN'), ('OPERATOR')`
  await testDb.sql`
    INSERT INTO users (role_id, email, password_hash)
    SELECT r.id, ${EMAIL}, ${digest} FROM roles r WHERE r.name = 'ADMIN'
  `
  await testDb.sql`
    INSERT INTO users (role_id, email, password_hash)
    SELECT r.id, ${EMAIL_OPERATEUR}, ${digest} FROM roles r WHERE r.name = 'OPERATOR'
  `
  await testDb.sql`
    INSERT INTO sites (id, name, type, capacity_kw, status)
    VALUES ('SITE001', 'Usine A', 'usine', 500, 'active'),
           ('SITE002', 'Usine B', 'usine', 800, 'active')
  `
  // L'opérateur n'a que SITE001 : SITE002 existe mais reste hors de son périmètre.
  await testDb.sql`
    INSERT INTO user_sites (user_id, site_id)
    SELECT id, 'SITE001' FROM users WHERE email = ${EMAIL_OPERATEUR}
  `
}, 120_000)

async function signIn(email = EMAIL): Promise<string> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD })
  })
  const header = response.headers.get('set-cookie')
  if (header === null) throw new Error('La réponse ne pose aucun cookie.')
  const [pair] = header.split(';')
  if (pair === undefined) throw new Error('Cookie illisible.')
  return pair
}

describe.skipIf(!baseDisponible())('recommandations', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../..', import.meta.url)),
    server: true,
    browser: false
  })

  it('refuse l\'accès sans session', async () => {
    const response = await fetch('/api/sites/SITE001/recommendations')

    expect(response.status).toBe(401)
  })

  it('rejette un identifiant de site invalide', async () => {
    const cookie = await signIn()

    const response = await fetch('/api/sites/SITEABC/recommendations', {
      headers: { cookie }
    })

    expect(response.status).toBe(422)
  })

  it('retourne un tableau vide quand aucune donnée historique ni ML n\'est disponible', async () => {
    const cookie = await signIn()

    const response = await fetch('/api/sites/SITE001/recommendations', {
      headers: { cookie }
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(Array.isArray(body)).toBe(true)
  })

  it('rend 200 à un opérateur sur un site de son périmètre', async () => {
    const cookie = await signIn(EMAIL_OPERATEUR)

    const response = await fetch('/api/sites/SITE001/recommendations', { headers: { cookie } })

    expect(response.status).toBe(200)
  })

  it('rend 403 à un opérateur sur un site hors de son périmètre', async () => {
    const cookie = await signIn(EMAIL_OPERATEUR)

    const response = await fetch('/api/sites/SITE002/recommendations', { headers: { cookie } })

    expect(response.status).toBe(403)
  })

  it('rend 404 sur un site absent du référentiel', async () => {
    const cookie = await signIn(EMAIL_OPERATEUR)

    const response = await fetch('/api/sites/SITE999/recommendations', { headers: { cookie } })

    expect(response.status).toBe(404)
  })
})
