import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import handler from '../../../server/api/health.get'

const { mockExecute, mockLatestDataPerSite } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockLatestDataPerSite: vi.fn(),
}))

vi.mock('../../../server/database', () => ({ db: { execute: mockExecute } }))
vi.mock('../../../server/utils/parquetFreshness', () => ({ latestDataPerSite: mockLatestDataPerSite }))

const event = {} as H3Event

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NUXT_PARQUET_DIR = '/data'
    process.env.NUXT_APP_VERSION = '1.2.0'
    mockExecute.mockResolvedValue([{ '?column?': 1 }])
    mockLatestDataPerSite.mockResolvedValue({
      SITE001: '2026-09-29T12:00:00.000Z',
      SITE002: '2026-09-29T13:00:00.000Z',
    })
  })

  it('dit tout sain, avec la version, la durée de fonctionnement et la dernière collecte', async () => {
    const résultat = await handler(event)

    expect(résultat).toEqual({
      status: 'ok',
      db: 'ok',
      parquet: 'ok',
      version: '1.2.0',
      uptime: expect.any(Number),
      last_data_at: '2026-09-29T13:00:00.000Z',
    })
  })

  it('passe en dégradé quand le Parquet est illisible : le temps réel fonctionne encore', async () => {
    mockLatestDataPerSite.mockRejectedValue(new Error('ENOENT'))

    expect(await handler(event)).toMatchObject({ status: 'degraded', parquet: 'unavailable', last_data_at: null })
  })

  it('passe en panne quand la base ne répond pas', async () => {
    mockExecute.mockRejectedValue(new Error('ECONNREFUSED'))

    expect(await handler(event)).toMatchObject({ status: 'down', db: 'unavailable' })
  })

  it('annonce une version de développement faute de mieux', async () => {
    delete process.env.NUXT_APP_VERSION

    expect(await handler(event)).toMatchObject({ version: 'dev' })
  })

  it('ne nomme aucun site : la route est publique', async () => {
    expect(JSON.stringify(await handler(event))).not.toContain('SITE')
  })
})
