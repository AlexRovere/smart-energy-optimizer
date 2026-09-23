import { drizzle } from 'drizzle-orm/postgres-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../server/database/schema'
import { getAlertThreshold, listAlertThresholds, upsertAlertThreshold } from '../../../server/utils/alertThresholdsRepository'
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

describe.skipIf(!baseDisponible())('listAlertThresholds', () => {
  let testDb: BaseDeTest
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    testDb = await creerBaseDeTest()
    db = drizzle(testDb.sql, { schema })

    await testDb.sql`
      INSERT INTO sites (id, name, type, capacity_kw, status)
      VALUES
        ('SITE001', 'Bureau Paris La Défense', 'office', 300, 'active'),
        ('SITE002', 'Usine Lyon Vénissieux', 'industrial', 1000, 'active')
    `
    await testDb.sql`
      INSERT INTO alert_thresholds (site_id, type, duration, threshold)
      VALUES ('SITE001', 'conso', 12, 350)
    `
  })

  afterAll(async () => {
    await testDb.fermer()
  })

  it('rend une entrée conso et une entrée pic par site, réglée ou par défaut', async () => {
    const entrées = await listAlertThresholds(db, ['SITE001', 'SITE002'])

    expect(entrées).toEqual(expect.arrayContaining([
      { siteId: 'SITE001', type: 'conso', duration: 12, threshold: 350 },
      { siteId: 'SITE001', type: 'pic', duration: 5, threshold: 1.5 },
      { siteId: 'SITE002', type: 'conso', duration: 5, threshold: 200 },
      { siteId: 'SITE002', type: 'pic', duration: 5, threshold: 1.5 }
    ]))
    expect(entrées).toHaveLength(4)
  })

  it('rend une liste vide sans site', async () => {
    expect(await listAlertThresholds(db, [])).toEqual([])
  })
})

describe.skipIf(!baseDisponible())('listAlertThresholds — isolation inter-sites', () => {
  let testDb: BaseDeTest
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    testDb = await creerBaseDeTest()
    db = drizzle(testDb.sql, { schema })

    await testDb.sql`
      INSERT INTO sites (id, name, type, capacity_kw, status)
      VALUES
        ('SITE001', 'Bureau Paris La Défense', 'office', 300, 'active'),
        ('SITE002', 'Usine Lyon Vénissieux', 'industrial', 1000, 'active')
    `
    await testDb.sql`
      INSERT INTO alert_thresholds (site_id, type, duration, threshold)
      VALUES ('SITE001', 'conso', 12, 350)
    `
  })

  afterAll(async () => {
    await testDb.fermer()
  })

  it('n\'expose pas les seuils d\'un site hors du périmètre demandé', async () => {
    // Les tests existants appellent listAlertThresholds avec les deux sites :
    // ils vérifient la présence, jamais l'exclusion. Une régression qui
    // supprimerait le filtre par siteId retournerait les seuils de SITE001
    // à un utilisateur n'ayant accès qu'à SITE002.
    const entrées = await listAlertThresholds(db, ['SITE002'])

    expect(entrées.some(e => e.siteId === 'SITE001')).toBe(false)
    expect(entrées.every(e => e.siteId === 'SITE002')).toBe(true)
  })
})

describe.skipIf(!baseDisponible())('upsertAlertThreshold', () => {
  let testDb: BaseDeTest
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    testDb = await creerBaseDeTest()
    db = drizzle(testDb.sql, { schema })

    await testDb.sql`
      INSERT INTO sites (id, name, type, capacity_kw, status)
      VALUES ('SITE001', 'Bureau Paris La Défense', 'office', 300, 'active')
    `
  })

  afterAll(async () => {
    await testDb.fermer()
  })

  it('crée la règle quand aucune ligne n\'existe pour ce site et ce type', async () => {
    await upsertAlertThreshold(db, 'SITE001', 'pic', { duration: 8, threshold: 1.8 })

    const réglage = await getAlertThreshold(db, 'SITE001', 'pic', { duration: 5, threshold: 1.5 })
    expect(réglage).toEqual({ duration: 8, threshold: 1.8 })
  })

  it('remplace la règle existante plutôt que d\'en ajouter une deuxième', async () => {
    await upsertAlertThreshold(db, 'SITE001', 'pic', { duration: 8, threshold: 1.8 })
    await upsertAlertThreshold(db, 'SITE001', 'pic', { duration: 10, threshold: 2 })

    const réglage = await getAlertThreshold(db, 'SITE001', 'pic', { duration: 5, threshold: 1.5 })
    expect(réglage).toEqual({ duration: 10, threshold: 2 })
  })
})
