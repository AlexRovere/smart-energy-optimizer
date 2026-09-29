import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DuckDBInstance } from '@duckdb/node-api'
import { drizzle } from 'drizzle-orm/postgres-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../server/database/schema'
import { detectConsumptionAlertFromHistory } from '../../../server/utils/consumptionAlertFromHistory'
import { databaseAvailable, createTestDatabase, type TestDatabase } from '../../database/test-database'

const TEMP_DIR = join(tmpdir(), `parquet-conso-test-${Date.now()}`)
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

describe.skipIf(!databaseAvailable())('detectConsumptionAlertFromHistory — Parquet réel', () => {
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
        ('SITE002', 'Usine Lyon', 'factory', 800, 'active'),
        ('SITE003', 'Entrepôt Nantes', 'warehouse', 500, 'active')
    `
    await testDb.sql`
      INSERT INTO alert_thresholds (site_id, type, duration, threshold)
      VALUES ('SITE001', 'conso', 3, 200)
    `

    await writeConsumptionHours('SITE001', [210, 220, 260])
    await writeConsumptionHours('SITE002', [50, 60, 70])
    await writeConsumptionHours('SITE003', [200, 250, 150])
  })

  afterAll(async () => {
    await testDb.close()
    rmSync(TEMP_DIR, { recursive: true, force: true })
    process.env.NUXT_PARQUET_DIR = savedEnv
  })

  it('déclenche sur un dépassement réel, avec la règle réglée en base', async () => {
    expect(await detectConsumptionAlertFromHistory(db, 'SITE001', REFERENCE)).toEqual({
      alert: true,
      average: 230,
      thresholdKwh: 200
    })
  })

  it('ne déclenche pas quand la moyenne reste sous le seuil par défaut (200 kWh)', async () => {
    expect(await detectConsumptionAlertFromHistory(db, 'SITE002', REFERENCE)).toEqual({
      alert: false,
      average: 60,
      thresholdKwh: 200
    })
  })

  it('déclenche à la limite exacte du seuil par défaut, sans règle en base', async () => {
    // Moyenne des trois dernières heures par défaut (duration = 5, donc les trois seules
    // heures écrites) : (200 + 250 + 150) / 3 = 200
    expect(await detectConsumptionAlertFromHistory(db, 'SITE003', REFERENCE)).toEqual({
      alert: true,
      average: 200,
      thresholdKwh: 200
    })
  })
})
