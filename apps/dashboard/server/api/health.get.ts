import { sql } from 'drizzle-orm'
import { defineEventHandler } from 'h3'
import { db } from '../database'
import { latestDataPerSite } from '../utils/parquetFreshness'

type Availability = 'ok' | 'unavailable'

// Route publique : elle dit si le service tient debout, jamais rien d'un site.
// La base est critique (sans elle, aucune route authentifiée ne répond), le
// Parquet ne l'est pas (seul l'historique manque) : docs/api.md, Dégradation.
async function database(): Promise<Availability> {
  try {
    await db.execute(sql`select 1`)
    return 'ok'
  } catch {
    return 'unavailable'
  }
}

async function lastCollect(): Promise<{ parquet: Availability; last_data_at: string | null }> {
  try {
    const dir = process.env.NUXT_PARQUET_DIR
    if (!dir) throw new Error("NUXT_PARQUET_DIR n'est pas défini")
    const dates = Object.values(await latestDataPerSite(dir)).sort()
    return { parquet: 'ok', last_data_at: dates.at(-1) ?? null }
  } catch {
    return { parquet: 'unavailable', last_data_at: null }
  }
}

export default defineEventHandler(async () => {
  const [dbState, parquetState] = await Promise.all([database(), lastCollect()])
  let status: 'ok' | 'degraded' | 'down' = 'ok'
  if (dbState === 'unavailable') status = 'down'
  else if (parquetState.parquet === 'unavailable') status = 'degraded'

  return {
    status,
    db: dbState,
    parquet: parquetState.parquet,
    version: process.env.NUXT_APP_VERSION || 'dev',
    uptime: Math.round(process.uptime()),
    last_data_at: parquetState.last_data_at,
  }
})
