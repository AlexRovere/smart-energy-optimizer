import { describe, expect, it } from 'vitest'
import { buildDatabaseUrl } from '../../../server/database/databaseUrl'

const MORCEAUX = {
  host: 'postgres',
  port: '5432',
  database: 'enervision',
  user: 'enervision',
  password: 'mot-de-passe',
}

describe('buildDatabaseUrl', () => {
  // ── Assemblage ─────────────────────────────────────────────────────────

  it('assemble une URL à partir des morceaux', () => {
    expect(buildDatabaseUrl(MORCEAUX)).toBe('postgresql://enervision:mot-de-passe@postgres:5432/enervision')
  })

  it('retient localhost et 5432 quand hôte et port manquent', () => {
    expect(buildDatabaseUrl({ ...MORCEAUX, host: undefined, port: undefined }))
      .toBe('postgresql://enervision:mot-de-passe@localhost:5432/enervision')
  })

  // ── Encodage ───────────────────────────────────────────────────────────

  // Un `/` dans le mot de passe terminait l'autorité de l'URL : `Invalid URL`,
  // sans que rien ne désigne ni la base ni le mot de passe (#158).
  it('encode un mot de passe qui casserait l URL', () => {
    const url = buildDatabaseUrl({ ...MORCEAUX, password: 'a/b+c@d' })

    expect(url).toBe('postgresql://enervision:a%2Fb%2Bc%40d@postgres:5432/enervision')
    expect(() => new URL(url)).not.toThrow()
    expect(new URL(url).hostname).toBe('postgres')
  })

  it('encode aussi l utilisateur', () => {
    expect(buildDatabaseUrl({ ...MORCEAUX, user: 'a b' }))
      .toBe('postgresql://a%20b:mot-de-passe@postgres:5432/enervision')
  })

  // ── Surcharge ──────────────────────────────────────────────────────────

  // Testcontainers rend une chaîne toute faite, et la boucle locale s'en sert.
  it('rend la surcharge telle quelle quand elle est présente', () => {
    const surcharge = 'postgresql://autre:autre@127.0.0.1:55432/autre'

    expect(buildDatabaseUrl({ ...MORCEAUX, url: surcharge })).toBe(surcharge)
  })

  it('ignore une surcharge vide et assemble', () => {
    expect(buildDatabaseUrl({ ...MORCEAUX, url: '' })).toBe(buildDatabaseUrl(MORCEAUX))
  })

  // ── Échec bruyant ──────────────────────────────────────────────────────

  it('échoue en nommant la variable manquante', () => {
    expect(() => buildDatabaseUrl({ ...MORCEAUX, password: undefined }))
      .toThrow(/POSTGRES_PASSWORD/)
    expect(() => buildDatabaseUrl({ ...MORCEAUX, user: undefined }))
      .toThrow(/POSTGRES_USER/)
    expect(() => buildDatabaseUrl({ ...MORCEAUX, database: undefined }))
      .toThrow(/POSTGRES_DB/)
  })
})
