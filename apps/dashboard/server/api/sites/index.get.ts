import { createError, defineEventHandler } from 'h3'
import type { SiteApiItem } from '../../../shared/siteSchema'
import { db } from '../../database'
import { requireAccount } from '../../utils/guard'
import { logger } from '../../utils/logger'
import { earliestDataPerSite, latestDataPerSite } from '../../utils/parquetFreshness'
import { allowedSites } from '../../utils/session'
import { querySitesList } from '../../utils/sitesRepository'

// La fraîcheur est un complément : un Parquet absent ou illisible ne doit pas
// priver l'écran de la liste des sites, qui vient de la base.
async function dataRange(route: string): Promise<{ first: Record<string, string>; last: Record<string, string> }> {
  try {
    const dir = process.env.NUXT_PARQUET_DIR
    if (!dir) throw new Error("NUXT_PARQUET_DIR n'est pas défini")
    const [first, last] = await Promise.all([earliestDataPerSite(dir), latestDataPerSite(dir)])
    return { first, last }
  } catch (error_) {
    logger.warn('Plage des données disponibles introuvable', {
      route,
      message: error_ instanceof Error ? error_.message : String(error_),
    })
    return { first: {}, last: {} }
  }
}

export default defineEventHandler(async (event): Promise<SiteApiItem[]> => {
  const account = await requireAccount(event)
  const permittedIds = await allowedSites(db, account)

  let sites: SiteApiItem[]
  try {
    sites = await querySitesList(db, permittedIds)
  } catch (error_) {
    throw createError({ statusCode: 503, message: 'Référentiel des sites indisponible', cause: error_ })
  }

  const { first, last } = await dataRange(event.path)
  return sites.map(site => ({
    ...site,
    first_data_at: first[site.site_id] ?? null,
    last_data_at: last[site.site_id] ?? null,
  }))
})
