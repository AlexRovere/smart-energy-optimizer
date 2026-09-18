import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DuckDBInstance } from '@duckdb/node-api'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { querySiteHistory } from '../../../server/utils/parquetReader'

const répertoireTemp = join(tmpdir(), `parquet-test-${Date.now()}`)
const cheminFichier = join(répertoireTemp, 'site_id=SITE001', 'year=2026', 'month=09', 'day=16', 'readings.parquet')

beforeAll(async () => {
  mkdirSync(join(répertoireTemp, 'site_id=SITE001', 'year=2026', 'month=09', 'day=16'), { recursive: true })

  const instance = await DuckDBInstance.create(':memory:')
  const conn = await instance.connect()
  await conn.run(`
    COPY (
      SELECT
        TIMESTAMPTZ '2026-09-16T14:00:00Z'  AS timestamp,
        'SITE001'                            AS site_id,
        'office'                             AS site_type,
        87.34::DOUBLE                        AS consumption_kw,
        NULL::DOUBLE                         AS consumption_kw_corrected,
        NULL::DOUBLE                         AS consumption_kwh,
        NULL::DOUBLE                         AS voltage_v,
        NULL::DOUBLE                         AS current_a,
        NULL::DOUBLE                         AS power_factor,
        NULL::DOUBLE                         AS temperature_celsius,
        NULL::DOUBLE                         AS humidity_percent,
        []::VARCHAR[]                        AS null_reasons,
        'good'                               AS data_quality
    ) TO '${cheminFichier.replace(/\\/g, '/')}' (FORMAT PARQUET)
  `)
})

afterAll(() => {
  rmSync(répertoireTemp, { recursive: true, force: true })
})

describe('querySiteHistory — vrai fichier Parquet', () => {
  const envSauvegarde = process.env.NUXT_PARQUET_DIR

  beforeAll(() => {
    process.env.NUXT_PARQUET_DIR = répertoireTemp
  })

  afterAll(() => {
    process.env.NUXT_PARQUET_DIR = envSauvegarde
  })

  it('retourne les mesures lues depuis le fichier Parquet', async () => {
    const résultat = await querySiteHistory(
      'SITE001',
      '2026-09-16T00:00:00Z',
      '2026-09-17T00:00:00Z',
      500
    )

    expect(résultat).toHaveLength(1)
    expect(résultat[0]!.site_id).toBe('SITE001')
    expect(résultat[0]!.consumption_kw).toBeCloseTo(87.34)
    expect(résultat[0]!.data_quality).toBe('good')
    expect(résultat[0]!.timestamp).toMatch(/^2026-09-16T14:00:00/)
  })
})
