import { z } from 'zod'

export const siteApiItemSchema = z.object({
  site_id: z.string(),
  site_name: z.string(),
  site_type: z.string(),
  location: z.string().nullable(),
  capacity_kw: z.number().int().positive(),
  status: z.enum(['active', 'inactive', 'maintenance']),
  warning_threshold_kw: z.number().int().positive().nullable(),
  present_in_source: z.boolean(),
  // Première et dernière mesure écrites dans le Parquet ; ajoutées par la
  // route, absentes du référentiel en base.
  first_data_at: z.string().nullable().optional(),
  last_data_at: z.string().nullable().optional()
})

export const siteListSchema = z.array(siteApiItemSchema)

export type SiteApiItem = z.infer<typeof siteApiItemSchema>
