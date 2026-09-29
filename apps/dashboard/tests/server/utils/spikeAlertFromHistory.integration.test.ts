import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DuckDBInstance } from '@duckdb/node-api'
import { drizzle } from 'drizzle-orm/postgres-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../server/database/schema'
import { detectSpikeAlertFromHistory } from '../../../server/utils/spikeAlertFromHistory'
import { databaseAvailable, createTestDatabase, type TestDatabase } from '../../database/test-database'

const TEMP_DIR = join(tmpdir(), `parquet-pic-test-${Date.now()}`)
const REFERENCE = new Date('2026-09-18T10:00:00Z')

async function writeConsumptionHours(siteId: string, valuesByHour: number[]): Promise<void> {
  const instance = await DuckDBInstance.create(':memory:')
  const connection = await instance.connect()

  for (const [index, kwh] of valuesByHour.entries()) {
    const stamp = new Date(REFERENCE.getTime() - (valuesByHour.length - 1 - index) * 3_600_000)
    const directory = join(
      TEMP_DIR,
      `site_id=${siteId}`,
      `year=${stamp.getUTCFullYear()}`,
      `month=${String(stamp.getUTCMonth() + 1).padStart(2, '0')}`,
      `day=${String(stamp.getUTCDate()).padStart(2, '0')}`
    )
    mkdirSync(directory, { recursive: true })
    const file = join(directory, `readings-${index}.parquet`).replace(/\\/g, '/')

    await connection.run(`
      COPY (
        SELECT
          TIMESTAMPTZ '${stamp.toISOString()}' AS timestamp,
          '${siteId}'                                AS site_id,
          'office'                                    AS site_type,
          ${kwh}::DOUBLE                              AS consumption_kw,
          NULL::DOUBLE                                AS consumption_kw_corrected,
          ${kwh}::DOUBLE                               AS consumption_kwh,
          NULL::DOUBLE                                AS voltage_v,
          NULL::DOUBLE                                AS current_a,
          NULL::DOUBLE                                AS power_factor,
          NULL::DOUBLE                                AS temperature_celsius,
          NULL::DOUBLE                                AS humidity_percent,
          []::VARCHAR[]                               AS null_reasons,
          'good'                                       AS data_quality
      ) TO '${file}' (FORMAT PARQUET)
    `)
  }
}

describe.skipIf(!databaseAvailable())('detectSpikeAlertFromHistory — Parquet réel', () => {
  let testDb: TestDatabase
  let db: ReturnType<typeof drizzle<typeof schema>>
  const savedEnv = process.env.NUXT_PARQUET_DIR

  beforeAll(async () => {
    testDb = await createTestDatabase()
    db = drizzle(testDb.sql, { schema })
    process.env.NUXT_PARQUET_DIR = TEMP_DIR

    await testDb.sql`
      INSERT INTO sites (id, name, type, capacity_kw, status)
      VALUES
        ('SITE001', 'Bureau Paris La Défense', 'office', 300, 'active'),
        ('SITE002', 'Usine Lyon', 'factory', 800, 'active')
    `
    await testDb.sql`
      INSERT INTO alert_thresholds (site_id, type, duration, threshold)
      VALUES ('SITE001', 'pic', 3, 1.5)
    `

    // Moyenne des 3 heures précédentes : 100. Dernière heure (la valeur courante) : 200.
    // 200 >= 100 × 1.5 (150) : dépassement.
    await writeConsumptionHours('SITE001', [100, 100, 100, 200])
    // Même moyenne (100), dernière heure 120 < 150 : pas de dépassement.
    await writeConsumptionHours('SITE002', [100, 100, 100, 120])
  })

  afterAll(async () => {
    await testDb.close()
    rmSync(TEMP_DIR, { recursive: true, force: true })
    process.env.NUXT_PARQUET_DIR = savedEnv
  })

  it('déclenche sur un pic réel au-delà de la moyenne × seuil, règle réglée en base', async () => {
    expect(await detectSpikeAlertFromHistory(db, 'SITE001', REFERENCE)).toEqual({
      alert: true,
      currentValue: 200,
      average: 100,
      thresholdKw: 150
    })
  })

  it('ne déclenche pas quand la valeur courante reste sous la moyenne × seuil par défaut', async () => {
    expect(await detectSpikeAlertFromHistory(db, 'SITE002', REFERENCE)).toEqual({
      alert: false,
      currentValue: 120,
      average: 100,
      thresholdKw: 150
    })
  })
})
