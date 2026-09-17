import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// vi.hoisted garantit que ces variables sont initialisées avant le hissage de vi.mock
const { mockRun, mockPrepare, mockConnect, mockCreate } = vi.hoisted(() => {
  const mockRun = vi.fn()
  const mockPrepare = vi.fn().mockResolvedValue({ run: mockRun })
  const mockConnect = vi.fn().mockResolvedValue({ prepare: mockPrepare })
  const mockCreate = vi.fn().mockResolvedValue({ connect: mockConnect })
  return { mockRun, mockPrepare, mockConnect, mockCreate }
})

vi.mock('@duckdb/node-api', () => ({
  DuckDBInstance: { create: mockCreate }
}))

import { querySiteHistory } from '../../../server/utils/parquetReader'

const mesureFixture = {
  timestamp: new Date('2026-09-16T14:00:00Z'),
  site_id: 'SITE001',
  site_type: 'office',
  consumption_kw: 87.34,
  consumption_kw_raw: null,
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
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const row of rows) yield row
    }
  }
}

describe('querySiteHistory', () => {
  const envSauvegarde = process.env.NUXT_PARQUET_DIR

  beforeEach(() => {
    process.env.NUXT_PARQUET_DIR = '/data/parquet'
    vi.clearAllMocks()
    mockRun.mockResolvedValue(mockResultReader([mesureFixture]))
    mockPrepare.mockResolvedValue({ run: mockRun })
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
    mockRun.mockResolvedValue(mockResultReader([]))
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
    mockRun.mockRejectedValue(new Error('DuckDB: fichier introuvable'))
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
})
