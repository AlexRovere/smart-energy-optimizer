import { z } from 'zod'

// Sévérité et type laissés en `string` volontairement : l'API Mock peut
// renvoyer une valeur inconnue, et le contrat dit que l'affichage ne doit
// pas crasher dans ce cas (#34).
export const alerteSchema = z.object({
  alert_id: z.string(),
  site_id: z.string(),
  severity: z.string(),
  type: z.string(),
  message: z.string(),
  timestamp: z.string(),
  value: z.number().nullable().optional(),
  threshold: z.number().nullable().optional(),
  acknowledged: z.boolean().optional(),
})

export const alertesSchema = z.array(alerteSchema)

export type AlerteRaw = z.infer<typeof alerteSchema>
