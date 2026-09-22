import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DuckDBInstance } from '@duckdb/node-api'
import { drizzle } from 'drizzle-orm/postgres-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../server/database/schema'
import { detectConsumptionAlertFromHistory } from '../../../server/utils/consumptionAlertFromHistory'
import { baseDisponible, creerBaseDeTest, type BaseDeTest } from '../../database/base-de-test'

const RÉPERTOIRE_TEMP = join(tmpdir(), `parquet-conso-test-${Date.now()}`)
const RÉFÉRENCE = new Date('2026-09-18T10:00:00Z')

async function écrireHeuresDeConsommation(siteId: string, valeursParHeure: number[]): Promise<void> {
  const instance = await DuckDBInstance.create(':memory:')
  const connexion = await instance.connect()

  for (const [index, kwh] of valeursParHeure.entries()) {
    const horodatage = new Date(RÉFÉRENCE.getTime() - (valeursParHeure.length - 1 - index) * 3_600_000)
    const dossier = join(
      RÉPERTOIRE_TEMP,
      `site_id=${siteId}`,
      `year=${horodatage.getUTCFullYear()}`,
      `month=${String(horodatage.getUTCMonth() + 1).padStart(2, '0')}`,
      `day=${String(horodatage.getUTCDate()).padStart(2, '0')}`
    )
    mkdirSync(dossier, { recursive: true })
    const fichier = join(dossier, `readings-${index}.parquet`).replace(/\\/g, '/')

    await connexion.run(`
      COPY (
        SELECT
          TIMESTAMPTZ '${horodatage.toISOString()}' AS timestamp,
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
      ) TO '${fichier}' (FORMAT PARQUET)
    `)
  }
}

describe.skipIf(!baseDisponible())('detectConsumptionAlertFromHistory — Parquet réel', () => {
  let testDb: BaseDeTest
  let db: ReturnType<typeof drizzle<typeof schema>>
  const envSauvegarde = process.env.NUXT_PARQUET_DIR

  beforeAll(async () => {
    testDb = await creerBaseDeTest()
    db = drizzle(testDb.sql, { schema })
    process.env.NUXT_PARQUET_DIR = RÉPERTOIRE_TEMP

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

    await écrireHeuresDeConsommation('SITE001', [210, 220, 260])
    await écrireHeuresDeConsommation('SITE002', [50, 60, 70])
    await écrireHeuresDeConsommation('SITE003', [200, 250, 150])
  })

  afterAll(async () => {
    await testDb.fermer()
    rmSync(RÉPERTOIRE_TEMP, { recursive: true, force: true })
    process.env.NUXT_PARQUET_DIR = envSauvegarde
  })

  it('déclenche sur un dépassement réel, avec la règle réglée en base', async () => {
    expect(await detectConsumptionAlertFromHistory(db, 'SITE001', RÉFÉRENCE)).toEqual({
      alert: true,
      average: 230,
      thresholdKwh: 200
    })
  })

  it('ne déclenche pas quand la moyenne reste sous le seuil par défaut (200 kWh)', async () => {
    expect(await detectConsumptionAlertFromHistory(db, 'SITE002', RÉFÉRENCE)).toEqual({
      alert: false,
      average: 60,
      thresholdKwh: 200
    })
  })

  it('déclenche à la limite exacte du seuil par défaut, sans règle en base', async () => {
    // Moyenne des trois dernières heures par défaut (duration = 5, donc les trois seules
    // heures écrites) : (200 + 250 + 150) / 3 = 200
    expect(await detectConsumptionAlertFromHistory(db, 'SITE003', RÉFÉRENCE)).toEqual({
      alert: true,
      average: 200,
      thresholdKwh: 200
    })
  })
})
