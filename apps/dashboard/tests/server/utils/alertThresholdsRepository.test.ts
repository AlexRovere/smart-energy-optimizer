import { drizzle } from 'drizzle-orm/postgres-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../server/database/schema'
import { getAlertThreshold } from '../../../server/utils/alertThresholdsRepository'
import { baseDisponible, creerBaseDeTest, type BaseDeTest } from '../../database/base-de-test'

const DEFAUT_CONSO = { duration: 5, threshold: 200 }

describe.skipIf(!baseDisponible())('getAlertThreshold', () => {
  let testDb: BaseDeTest
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    testDb = await creerBaseDeTest()
    db = drizzle(testDb.sql, { schema })

    await testDb.sql`
      INSERT INTO sites (id, name, type, capacity_kw, status)
      VALUES ('SITE001', 'Bureau Paris La Défense', 'office', 300, 'active')
    `
    await testDb.sql`
      INSERT INTO alert_thresholds (site_id, type, duration, threshold)
      VALUES ('SITE001', 'conso', 12, 350)
    `
  })

  afterAll(async () => {
    await testDb.fermer()
  })

  it('rend la règle réglée en base quand elle existe', async () => {
    const réglage = await getAlertThreshold(db, 'SITE001', 'conso', DEFAUT_CONSO)

    expect(réglage).toEqual({ duration: 12, threshold: 350 })
  })

  it('rend les valeurs par défaut quand aucune règle n\'est réglée pour ce site', async () => {
    const réglage = await getAlertThreshold(db, 'SITE002', 'conso', DEFAUT_CONSO)

    expect(réglage).toEqual(DEFAUT_CONSO)
  })

  it('ne confond pas les règles conso et pic du même site', async () => {
    const réglage = await getAlertThreshold(db, 'SITE001', 'pic', { duration: 5, threshold: 1.5 })

    expect(réglage).toEqual({ duration: 5, threshold: 1.5 })
  })
})
