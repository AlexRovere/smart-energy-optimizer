import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DuckDBInstance } from '@duckdb/node-api'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { latestDataPerSite } from '../../../server/utils/parquetFreshness'

const racine = join(tmpdir(), `parquet-fraicheur-${Date.now()}`)

async function écrireJour(siteId: string, year: string, month: string, day: string, horodatages: string[]) {
  const dossier = join(racine, `site_id=${siteId}`, `year=${year}`, `month=${month}`, `day=${day}`)
  mkdirSync(dossier, { recursive: true })
  const lignes = horodatages.map(t => `SELECT TIMESTAMPTZ '${t}' AS timestamp`).join(' UNION ALL ')
  const instance = await DuckDBInstance.create()
  const conn = await instance.connect()
  await conn.run(`COPY (${lignes}) TO '${join(dossier, 'readings.parquet').replace(/\\/g, '/')}' (FORMAT PARQUET)`)
}

beforeAll(async () => {
  // Le mois 10 doit l'emporter sur le mois 9 : un tri de chaînes sans zéro
  // initial rangerait « 9 » après « 10 ».
  await écrireJour('SITE001', '2026', '9', '30', ['2026-09-30T23:00:00Z'])
  await écrireJour('SITE001', '2026', '10', '01', ['2026-10-01T05:00:00Z', '2026-10-01T07:00:00Z'])
  await écrireJour('SITE002', '2025', '12', '31', ['2025-12-31T10:00:00Z'])
  await écrireJour('SITE002', '2026', '01', '02', ['2026-01-02T03:00:00Z'])
  writeFileSync(join(racine, 'LISEZMOI.txt'), 'pas une partition')
})

afterAll(() => {
  rmSync(racine, { recursive: true, force: true })
})

describe('latestDataPerSite', () => {
  it("donne pour chaque site l'horodatage le plus récent de sa dernière partition", async () => {
    expect(await latestDataPerSite(racine)).toEqual({
      SITE001: '2026-10-01T07:00:00.000Z',
      SITE002: '2026-01-02T03:00:00.000Z',
    })
  })

  it('échoue sur un répertoire absent, pour que l’appelant le signale', async () => {
    await expect(latestDataPerSite(join(racine, 'absent'))).rejects.toThrow()
  })
})
