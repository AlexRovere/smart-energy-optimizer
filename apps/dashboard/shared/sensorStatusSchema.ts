import { z } from 'zod'

// États laissés en `string`, comme pour les alertes : une valeur inconnue de
// l'API Mock ne doit pas faire tomber l'écran (docs/api.md, SensorStatus).
export const sensorStateSchema = z.object({
  status: z.string(),
  failing_until: z.string().nullable(),
})

export const siteSensorsSchema = z.object({
  site_name: z.string(),
  sensors: z.record(z.string(), sensorStateSchema),
  overall: z.string(),
})

export const sensorsStatusSchema = z.record(z.string(), siteSensorsSchema)

export type SensorsStatus = z.infer<typeof sensorsStatusSchema>
