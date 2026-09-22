import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { querySiteHistory, resetInstanceForTests } from '../../../server/utils/parquetReader'

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


const mesureFixture = {
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
  const envSauvegarde = process.env.NUXT_PARQUET_DIR

  beforeEach(() => {
    resetInstanceForTests()
    process.env.NUXT_PARQUET_DIR = '/data/parquet'
    vi.clearAllMocks()
    mockRunAndReadAll.mockResolvedValue(mockResultReader([mesureFixture]))
    mockPrepare.mockResolvedValue({ runAndReadAll: mockRunAndReadAll })
    mockConnect.mockResolvedValue({ prepare: mockPrepare })
    mockCreate.mockResolvedValue({ connect: mockConnect })
  })

  afterEach(() => {
    process.env.NUXT_PARQUET_DIR = envSauvegarde
  })

  it('retourne les mesures pour une plage valide', async () => {
    const résultat = await querySiteHistory('SITE001', '2026-09-16T00:00:00Z', '2026-09-17T00:00:00Z', 500)
    expect(résultat).toHaveLength(1)
    expect(résultat[0]!.site_id).toBe('SITE001')
  })

  it('retourne un tableau vide si aucune mesure sur la période', async () => {
    mockRunAndReadAll.mockResolvedValue(mockResultReader([]))
    const résultat = await querySiteHistory('SITE001', '2026-09-16T00:00:00Z', '2026-09-17T00:00:00Z', 500)
    expect(résultat).toEqual([])
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
    const ligneInvalide = { ...mesureFixture, data_quality: 'inconnue' }
    mockRunAndReadAll.mockResolvedValue(mockResultReader([ligneInvalide]))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const résultat = await querySiteHistory('SITE001', '2026-09-16T00:00:00Z', '2026-09-17T00:00:00Z', 500)

    expect(résultat).toHaveLength(0)
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
