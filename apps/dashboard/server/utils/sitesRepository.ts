import { inArray } from 'drizzle-orm'
import type { SiteApiItem } from '../../shared/siteSchema'
import { sites } from '../database/schema'
import type { AppDatabase } from './session'

export async function querySitesList(
  db: AppDatabase,
  siteIds: string[]
): Promise<SiteApiItem[]> {
  if (siteIds.length === 0) return []

  const rows = await db
    .select({
      id: sites.id,
      name: sites.name,
      siteType: sites.type,
      location: sites.location,
      capacityKw: sites.capacityKw,
      status: sites.status,
      warningThresholdKw: sites.warningThresholdKw,
      presentInSource: sites.presentInSource
    })
    .from(sites)
    .where(inArray(sites.id, siteIds))

  return rows.map(row => ({
    site_id: row.id,
    site_name: row.name,
    site_type: row.siteType,
    location: row.location ?? null,
    capacity_kw: row.capacityKw,
    status: row.status as SiteApiItem['status'],
    warning_threshold_kw: row.warningThresholdKw ?? null,
    present_in_source: row.presentInSource
  }))
}
