import { describe, expect, it } from 'vitest'
import { buildDatabaseUrl } from '../../../server/database/databaseUrl'

const PARTS = {
  host: 'postgres',
  port: '5432',
  database: 'enervision',
  user: 'enervision',
  password: 'mot-de-passe',
}

describe('buildDatabaseUrl', () => {
  // ── Assemblage ─────────────────────────────────────────────────────────

  it('assemble une URL à partir des morceaux', () => {
    expect(buildDatabaseUrl(PARTS)).toBe('postgresql://enervision:mot-de-passe@postgres:5432/enervision')
  })

  it('retient localhost et 5432 quand hôte et port manquent', () => {
    expect(buildDatabaseUrl({ ...PARTS, host: undefined, port: undefined }))
      .toBe('postgresql://enervision:mot-de-passe@localhost:5432/enervision')
  })

  // ── Encodage ───────────────────────────────────────────────────────────

  // Un `/` dans le mot de passe terminait l'autorité de l'URL : `Invalid URL`,
  // sans que rien ne désigne ni la base ni le mot de passe (#158).
  it('encode un mot de passe qui casserait l URL', () => {
    const url = buildDatabaseUrl({ ...PARTS, password: 'a/b+c@d' })

    expect(url).toBe('postgresql://enervision:a%2Fb%2Bc%40d@postgres:5432/enervision')
    expect(() => new URL(url)).not.toThrow()
    expect(new URL(url).hostname).toBe('postgres')
  })

  it('encode aussi l utilisateur', () => {
    expect(buildDatabaseUrl({ ...PARTS, user: 'a b' }))
      .toBe('postgresql://a%20b:mot-de-passe@postgres:5432/enervision')
  })

  // ── Surcharge ──────────────────────────────────────────────────────────

  // Testcontainers rend une chaîne toute faite, et la boucle locale s'en sert.
  it('rend la surcharge telle quelle quand elle est présente', () => {
    const override = 'postgresql://autre:autre@127.0.0.1:55432/autre'

    expect(buildDatabaseUrl({ ...PARTS, url: override })).toBe(override)
  })

  it('ignore une surcharge vide et assemble', () => {
    expect(buildDatabaseUrl({ ...PARTS, url: '' })).toBe(buildDatabaseUrl(PARTS))
  })

  // ── Échec bruyant ──────────────────────────────────────────────────────

  it('échoue en nommant la variable manquante', () => {
    expect(() => buildDatabaseUrl({ ...PARTS, password: undefined }))
      .toThrow(/POSTGRES_PASSWORD/)
    expect(() => buildDatabaseUrl({ ...PARTS, user: undefined }))
      .toThrow(/POSTGRES_USER/)
    expect(() => buildDatabaseUrl({ ...PARTS, database: undefined }))
      .toThrow(/POSTGRES_DB/)
  })
})
