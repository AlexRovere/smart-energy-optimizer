import { z } from 'zod'

const siteSummaryItemSchema = z.object({
  site_id: z.string(),
  site_name: z.string(),
  current_consumption_kw: z.number().nullable(),
  capacity_kw: z.number(),
  load_percent: z.number().nullable(),
  data_quality: z.enum(['good', 'partial', 'degraded', 'critical'])
})

export const parkSummarySchema = z.object({
  timestamp: z.string().datetime(),
  total_sites: z.number().int(),
  excluded_sites: z.array(z.string()),
  total_consumption_kw: z.number().nullable(),
  total_capacity_kw: z.number(),
  average_load_percent: z.number().nullable(),
  sites: z.array(siteSummaryItemSchema)
})

export type ParkSummary = z.infer<typeof parkSummarySchema>
export type SiteSummaryItem = z.infer<typeof siteSummaryItemSchema>
