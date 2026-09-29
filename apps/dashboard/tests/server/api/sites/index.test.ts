import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import handler from '../../../../server/api/sites/index.get'

const { mockRequireAccount, mockAllowedSites, mockQuerySitesList, mockLatestDataPerSite, mockEarliestDataPerSite, mockLoggerWarn } = vi.hoisted(() => ({
  mockRequireAccount: vi.fn(),
  mockAllowedSites: vi.fn(),
  mockQuerySitesList: vi.fn(),
  mockLatestDataPerSite: vi.fn(),
  mockEarliestDataPerSite: vi.fn(),
  mockLoggerWarn: vi.fn(),
}))

vi.mock('../../../../server/utils/parquetFreshness', () => ({
  latestDataPerSite: mockLatestDataPerSite,
  earliestDataPerSite: mockEarliestDataPerSite
}))

vi.mock('../../../../server/utils/logger', () => ({
  logger: { error: vi.fn(), warn: mockLoggerWarn, info: vi.fn(), debug: vi.fn() }
}))

vi.mock('../../../../server/utils/guard', () => ({
  requireAccount: mockRequireAccount
}))

vi.mock('../../../../server/utils/session', () => ({
  allowedSites: mockAllowedSites
}))

vi.mock('../../../../server/utils/sitesRepository', () => ({
  querySitesList: mockQuerySitesList
}))

vi.mock('../../../../server/database', () => ({
  db: {}
}))

const mockEvent = {} as H3Event

const accountFixture = { id: 'user-uuid', email: 'test@enervision.fr', role: 'OPERATOR' }

const siteFixture = {
  site_id: 'SITE001',
  site_name: 'Bureau Paris La Défense',
  site_type: 'office',
  location: 'Paris, France',
  capacity_kw: 300,
  status: 'active' as const,
  warning_threshold_kw: 240,
  present_in_source: true
}

describe('GET /api/sites', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAccount.mockResolvedValue(accountFixture)
    mockLatestDataPerSite.mockResolvedValue({})
    mockEarliestDataPerSite.mockResolvedValue({})
    process.env.NUXT_PARQUET_DIR = '/data'
  })

  it('retourne les sites autorisés de l\'utilisateur', async () => {
    mockAllowedSites.mockResolvedValue(['SITE001'])
    mockQuerySitesList.mockResolvedValue([siteFixture])

    const result = await handler(mockEvent)

    expect(result).toEqual([{ ...siteFixture, first_data_at: null, last_data_at: null }])
    expect(mockAllowedSites).toHaveBeenCalledWith({}, accountFixture)
    expect(mockQuerySitesList).toHaveBeenCalledWith({}, ['SITE001'])
  })

  it('retourne un tableau vide si l\'utilisateur n\'a aucun site autorisé', async () => {
    mockAllowedSites.mockResolvedValue([])
    mockQuerySitesList.mockResolvedValue([])

    const result = await handler(mockEvent)

    expect(result).toEqual([])
  })

  it('retourne 401 quand requireAccount rejette', async () => {
    mockRequireAccount.mockRejectedValue(
      Object.assign(new Error('Session invalide'), { statusCode: 401 })
    )

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('retourne 503 si querySitesList rejette', async () => {
    mockAllowedSites.mockResolvedValue(['SITE001'])
    mockQuerySitesList.mockRejectedValue(new Error('DB indisponible'))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 503 })
  })

  it('donne la date de la dernière donnée de chaque site dans le Parquet', async () => {
    mockAllowedSites.mockResolvedValue(['SITE001'])
    mockQuerySitesList.mockResolvedValue([siteFixture])
    mockLatestDataPerSite.mockResolvedValue({ SITE001: '2026-09-29T13:00:00.000Z', SITE009: '2026-09-29T13:00:00.000Z' })
    mockEarliestDataPerSite.mockResolvedValue({ SITE001: '2025-09-29T00:00:00.000Z' })

    const result = await handler(mockEvent)

    expect(mockLatestDataPerSite).toHaveBeenCalledWith('/data')
    expect(result).toEqual([{ ...siteFixture, first_data_at: '2025-09-29T00:00:00.000Z', last_data_at: '2026-09-29T13:00:00.000Z' }])
  })

  it('sert la liste même quand le Parquet est illisible, et le journalise', async () => {
    mockAllowedSites.mockResolvedValue(['SITE001'])
    mockQuerySitesList.mockResolvedValue([siteFixture])
    mockLatestDataPerSite.mockRejectedValue(new Error('ENOENT'))

    const result = await handler(mockEvent)

    expect(result).toEqual([{ ...siteFixture, first_data_at: null, last_data_at: null }])
    expect(mockLoggerWarn).toHaveBeenCalledOnce()
  })
})
