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
  // L'API peut renvoyer un datetime local sans fuseau (ex : "2026-09-17T12:21:39.091922")
  timestamp: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'Format datetime attendu'),
  total_sites: z.number().int(),
  // Absent de la réponse quand tous les sites sont actifs
  excluded_sites: z.array(z.string()).default([]),
  total_consumption_kw: z.number().nullable(),
  total_capacity_kw: z.number(),
  average_load_percent: z.number().nullable(),
  sites: z.array(siteSummaryItemSchema)
})

export type ParkSummary = z.infer<typeof parkSummarySchema>
export type SiteSummaryItem = z.infer<typeof siteSummaryItemSchema>
