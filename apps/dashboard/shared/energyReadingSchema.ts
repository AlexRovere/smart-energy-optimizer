import { z } from 'zod'

export const energyReadingSchema = z.object({
  // L'API Mock renvoie des timestamps sans fuseau (ex : "2026-09-17T12:21:39.091922")
  timestamp: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'Format datetime attendu'),
  site_id: z.string(),
  site_type: z.string().optional(),
  consumption_kw: z.number().nullable(),
  consumption_kw_corrected: z.number().nullable().optional(),
  consumption_kwh: z.number().nullable().optional(),
  voltage_v: z.number().nullable().optional(),
  current_a: z.number().nullable().optional(),
  power_factor: z.number().nullable().optional(),
  temperature_celsius: z.number().nullable().optional(),
  humidity_percent: z.number().nullable().optional(),
  // L'API peut renvoyer null ou omettre le champ ; on normalise vers []
  null_reasons: z.array(z.string()).nullish().transform(v => v ?? []),
  data_quality: z.enum(['good', 'partial', 'degraded', 'critical'])
})

export type EnergyReading = z.infer<typeof energyReadingSchema>
