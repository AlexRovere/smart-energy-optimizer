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
  // Horodatage de la dernière mesure écrite dans le Parquet ; ajouté par la
  // route, absent du référentiel en base.
  last_data_at: z.string().nullable().optional()
})

export const siteListSchema = z.array(siteApiItemSchema)

export type SiteApiItem = z.infer<typeof siteApiItemSchema>
