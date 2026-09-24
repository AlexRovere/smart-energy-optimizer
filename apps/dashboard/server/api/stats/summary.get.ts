import { createError, defineEventHandler } from 'h3'
import { parkSummarySchema, type ParkSummary } from '../../../shared/parkSummarySchema'
import { db } from '../../database'
import { fetchMockApi } from '../../utils/mockApiClient'
import { requireAccount } from '../../utils/guard'
import { logger } from '../../utils/logger'
import { allowedSites } from '../../utils/session'

// La source rend tout le parc : la synthèse est refaite sur le seul périmètre du
// compte. Les sites sans mesure restent exclus des totaux et nommés dans
// `excluded_sites`, comme le demande docs/api.md.
function restrictToSites(summary: ParkSummary, permittedIds: string[]): ParkSummary {
  const permitted = new Set(permittedIds)
  const sites = summary.sites.filter(s => permitted.has(s.site_id))
  // Un site sans mesure est exclu même si la source a omis de le nommer : sinon
  // il sortirait des totaux sans que rien ne le dise.
  const excluded = [...new Set([
    ...summary.excluded_sites.filter(id => permitted.has(id)),
    ...sites.filter(s => s.current_consumption_kw === null).map(s => s.site_id)
  ])]
  const counted = sites.filter(s => !excluded.includes(s.site_id))

  const totalCapacity = counted.reduce((sum, s) => sum + s.capacity_kw, 0)
  const totalConsumption = counted.length === 0
    ? null
    : Math.round(counted.reduce((sum, s) => sum + (s.current_consumption_kw ?? 0), 0) * 100) / 100

  return {
    timestamp: summary.timestamp,
    total_sites: new Set([...sites.map(s => s.site_id), ...excluded]).size,
    excluded_sites: excluded,
    total_consumption_kw: totalConsumption,
    total_capacity_kw: totalCapacity,
    average_load_percent: totalConsumption === null || totalCapacity === 0
      ? null
      : Math.round((totalConsumption / totalCapacity) * 1000) / 10,
    sites
  }
}

export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const permittedIds = await allowedSites(db, account)

  let réponse: unknown
  try {
    réponse = await fetchMockApi('/api/v1/stats/summary')
  } catch (error_) {
    logger.error('Source de données indisponible', {
      route: event.path,
      message: error_ instanceof Error ? error_.message : String(error_),
    })
    throw createError({ status: 503, statusText: 'Source de données indisponible', cause: error_ })
  }

  const parse = parkSummarySchema.safeParse(réponse)
  if (!parse.success) {
    throw createError({ status: 502, statusText: 'Réponse inattendue de la source' })
  }

  return restrictToSites(parse.data, permittedIds)
})
