import { z } from 'zod'

export const energyReadingSchema = z.object({
  timestamp: z.string().datetime(),
  site_id: z.string(),
  site_type: z.string().optional(),
  consumption_kw: z.number().nullable(),
  consumption_kw_raw: z.number().nullable().optional(),
  consumption_kwh: z.number().nullable().optional(),
  voltage_v: z.number().nullable().optional(),
  current_a: z.number().nullable().optional(),
  power_factor: z.number().nullable().optional(),
  temperature_celsius: z.number().nullable().optional(),
  humidity_percent: z.number().nullable().optional(),
  null_reasons: z.array(z.string()),
  data_quality: z.enum(['good', 'partial', 'degraded', 'critical'])
})

export type EnergyReading = z.infer<typeof energyReadingSchema>
