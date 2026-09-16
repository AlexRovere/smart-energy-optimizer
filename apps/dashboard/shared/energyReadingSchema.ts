import { z } from 'zod'

export const energyReadingSchema = z.object({
  timestamp: z.string(),
  site_id: z.string(),
  site_type: z.string(),
  consumption_kw: z.number().nullable(),
  consumption_kwh: z.number().nullable(),
  voltage_v: z.number().nullable(),
  current_a: z.number().nullable(),
  power_factor: z.number().nullable(),
  temperature_celsius: z.number().nullable(),
  humidity_percent: z.number().nullable(),
  null_reasons: z.array(z.string()),
  data_quality: z.enum(['good', 'partial', 'degraded', 'critical'])
})

export type EnergyReading = z.infer<typeof energyReadingSchema>