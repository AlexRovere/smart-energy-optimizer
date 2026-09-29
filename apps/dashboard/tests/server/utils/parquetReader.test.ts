import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { dayFiles, querySiteHistory, resetInstanceForTests } from '../../../server/utils/parquetReader'

// vi.hoisted garantit que ces variables sont initialisées avant le hissage de vi.mock
const { mockRunAndReadAll, mockPrepare, mockConnect, mockCreate } = vi.hoisted(() => {
  const mockRunAndReadAll = vi.fn()
  const mockPrepare = vi.fn().mockResolvedValue({ runAndReadAll: mockRunAndReadAll })
  const mockConnect = vi.fn().mockResolvedValue({ prepare: mockPrepare })
  const mockCreate = vi.fn().mockResolvedValue({ connect: mockConnect })
  return { mockRunAndReadAll, mockPrepare, mockConnect, mockCreate }
})

vi.mock('@duckdb/node-api', () => ({
  DuckDBInstance: { create: mockCreate }
}))

// Chaque jour demandé « existe » : ces tests portent sur la requête, pas sur les fichiers.
const { mockExistsSync } = vi.hoisted(() => ({ mockExistsSync: vi.fn((_path: unknown) => true) }))
vi.mock('node:fs', () => ({ existsSync: mockExistsSync }))


const readingFixture = {
  timestamp: new Date('2026-09-16T14:00:00Z'),
  site_id: 'SITE001',
  site_type: 'office',
  consumption_kw: 87.34,
  consumption_kwh: null,
  voltage_v: null,
  current_a: null,
  power_factor: null,
  temperature_celsius: null,
  humidity_percent: null,
  null_reasons: [],
  data_quality: 'good'
}

function mockResultReader(rows: Record<string, unknown>[]) {
  return { getRowObjectsJS: () => rows }
}

describe('querySiteHistory', () => {
  const savedEnv = process.env.NUXT_PARQUET_DIR

  beforeEach(() => {
    resetInstanceForTests()
    process.env.NUXT_PARQUET_DIR = '/data/parquet'
    vi.clearAllMocks()
    mockRunAndReadAll.mockResolvedValue(mockResultReader([readingFixture]))
    mockPrepare.mockResolvedValue({ runAndReadAll: mockRunAndReadAll })
    mockConnect.mockResolvedValue({ prepare: mockPrepare })
    mockCreate.mockResolvedValue({ connect: mockConnect })
  })

  afterEach(() => {
    process.env.NUXT_PARQUET_DIR = savedEnv
  })

  it('retourne les mesures pour une plage valide', async () => {
    const result = await querySiteHistory('SITE001', '2026-09-16T00:00:00Z', '2026-09-17T00:00:00Z', 500)
    expect(result).toHaveLength(1)
    expect(result[0]!.site_id).toBe('SITE001')
  })

  it('retourne un tableau vide si aucune mesure sur la période', async () => {
    mockRunAndReadAll.mockResolvedValue(mockResultReader([]))
    const result = await querySiteHistory('SITE001', '2026-09-16T00:00:00Z', '2026-09-17T00:00:00Z', 500)
    expect(result).toEqual([])
  })

  it('lève une erreur si NUXT_PARQUET_DIR est absent', async () => {
    delete process.env.NUXT_PARQUET_DIR
    await expect(
      querySiteHistory('SITE001', '2026-09-16T00:00:00Z', '2026-09-17T00:00:00Z', 500)
    ).rejects.toThrow(/NUXT_PARQUET_DIR/)
  })

  it('propage l\'erreur DuckDB si la requête échoue', async () => {
    mockRunAndReadAll.mockRejectedValue(new Error('DuckDB: fichier introuvable'))
    await expect(
      querySiteHistory('SITE001', '2026-09-16T00:00:00Z', '2026-09-17T00:00:00Z', 500)
    ).rejects.toThrow('DuckDB: fichier introuvable')
  })

  it('construit la requête avec le bon site_id', async () => {
    await querySiteHistory('SITE002', '2026-09-16T00:00:00Z', '2026-09-17T00:00:00Z', 500)
    const sql: string = mockPrepare.mock.calls[0]![0] as string
    expect(sql).toContain('SITE002')
  })

  it('applique la limite fournie', async () => {
    await querySiteHistory('SITE001', '2026-09-16T00:00:00Z', '2026-09-17T00:00:00Z', 42)
    const sql: string = mockPrepare.mock.calls[0]![0] as string
    expect(sql).toContain('LIMIT 42')
  })

  it('émet un avertissement quand une ligne est rejetée par le schéma', async () => {
    const invalidRow = { ...readingFixture, data_quality: 'inconnue' }
    mockRunAndReadAll.mockResolvedValue(mockResultReader([invalidRow]))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await querySiteHistory('SITE001', '2026-09-16T00:00:00Z', '2026-09-17T00:00:00Z', 500)

    expect(result).toHaveLength(0)
    expect(warnSpy).toHaveBeenCalledOnce()
    expect(warnSpy.mock.calls[0]![0]).toContain('SITE001')
    warnSpy.mockRestore()
  })

  it("n'initialise DuckDBInstance qu'une seule fois pour plusieurs appels", async () => {
    await querySiteHistory('SITE001', '2026-09-16T00:00:00Z', '2026-09-17T00:00:00Z', 500)
    await querySiteHistory('SITE001', '2026-09-16T00:00:00Z', '2026-09-17T00:00:00Z', 500)
    expect(mockCreate).toHaveBeenCalledOnce()
  })
})

describe('dayFiles', () => {
  beforeEach(() => mockExistsSync.mockReturnValue(true))

  it('vise le dossier de chaque jour de la plage, mois et jour sur deux chiffres', () => {
    expect(dayFiles('/data', 'SITE001', '2026-09-08T00:00:00Z', '2026-09-10T00:00:00Z')).toEqual([
      '/data/site_id=SITE001/year=2026/month=09/day=08/*.parquet',
      '/data/site_id=SITE001/year=2026/month=09/day=09/*.parquet',
    ])
  })

  it('inclut le jour entamé au début de la plage et celui où elle finit', () => {
    const files = dayFiles('/data', 'SITE001', '2026-09-08T14:00:00Z', '2026-09-09T06:00:00Z')
    expect(files.map(f => f.split('/').at(-2))).toEqual(['day=08', 'day=09'])
  })

  it('écarte les jours sans fichier', () => {
    mockExistsSync.mockImplementation((path: unknown) => String(path).includes('day=09'))
    expect(dayFiles('/data', 'SITE001', '2026-09-08T00:00:00Z', '2026-09-10T00:00:00Z')).toHaveLength(1)
  })
})
